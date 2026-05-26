import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

// POST /api/import/run
//
// Unified import. Accepts ONE payload containing batches for every
// entity in the contractor's old-system export — customers, jobs,
// invoices, quotes, expenses, mileage — and processes them in
// dependency order with deduplication. Auto-creates customer rows
// when a job/invoice/quote references a customer name that isn't
// already in the org and wasn't in the customer batch either, so
// the contractor never has to "import customers first."
//
// Two modes:
//   validateOnly=true  → parse + dedupe + plan inserts. Don't
//                        write. Returns a per-entity preview so
//                        the UI can show "will create N, skip Y
//                        dupes, fail Z" before the user commits.
//   validateOnly=false → actually run the import.
//
// Payload shape:
//   { validateOnly?, batches: { customers?: [...], jobs?: [...], ... } }
//
// Caps: 5000 rows per entity, 30000 across all entities per request.
// Inserts batch in chunks of 500 to keep individual PostgREST calls
// bounded.

export const config = {
  api: { bodyParser: { sizeLimit: '6mb' } },
};

const MAX_PER_ENTITY = 5000;
const MAX_TOTAL      = 30000;
const INSERT_CHUNK   = 500;
const ENTITY_ORDER   = ['customers', 'quotes', 'jobs', 'invoices', 'expenses', 'mileage'];

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ===== Helpers =====
function trimStr(v, max = 500) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function toNumberOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function toIsoDateOrNull(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    const mo = String(parseInt(m[1], 10)).padStart(2, '0');
    const da = String(parseInt(m[2], 10)).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function normJobStatus(v) {
  const s = trimStr(v)?.toLowerCase();
  if (!s) return 'pending';
  if (/^complet/.test(s) || s === 'done' || s === 'closed') return 'completed';
  if (/in.?progress|active|working/.test(s)) return 'in_progress';
  if (/cancel/.test(s)) return 'cancelled';
  if (/schedul/.test(s)) return 'scheduled';
  return 'pending';
}
function normInvoiceStatus(v, paidDate) {
  const s = trimStr(v)?.toLowerCase();
  if (paidDate) return 'paid';
  if (!s) return 'unpaid';
  if (/paid|0\.00|^0$/.test(s)) return 'paid';
  return 'unpaid';
}
function normQuoteStatus(v) {
  const s = trimStr(v)?.toLowerCase();
  if (!s) return 'draft';
  if (/approv|accept/.test(s)) return 'approved';
  if (/declin|reject/.test(s)) return 'declined';
  if (/expir/.test(s))         return 'expired';
  if (/sent/.test(s))          return 'sent';
  return 'draft';
}
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ===== Main handler =====
export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { batches = {}, validateOnly = false } = req.body || {};

  // Shape validation
  let total = 0;
  for (const e of ENTITY_ORDER) {
    const list = batches[e];
    if (list == null) continue;
    if (!Array.isArray(list)) return res.status(400).json({ error: `${e} must be an array.` });
    if (list.length > MAX_PER_ENTITY) {
      return res.status(400).json({ error: `Too many ${e} rows. Limit is ${MAX_PER_ENTITY} per entity.` });
    }
    total += list.length;
  }
  if (total === 0) return res.status(400).json({ error: 'No rows to import.' });
  if (total > MAX_TOTAL) return res.status(400).json({ error: `Combined row count exceeds ${MAX_TOTAL}.` });

  const { data: mem } = await sb.from('org_members')
    .select('org_id').eq('user_id', user.id)
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });
  const orgId = mem.org_id;

  // Pre-load existing customer cache used for dedupe + name lookup
  // across all entity importers. Single fetch, in-memory thereafter.
  const { data: existingCustomers } = await sb.from('customers')
    .select('id, name, email, phone')
    .eq('org_id', orgId);

  // Maps for lookup: email/phone for dedupe, name (lowercased) → id
  // for linking jobs/invoices/quotes/etc back to existing customers.
  const emailMap = new Map();
  const phoneMap = new Map();
  const nameMap  = new Map(); // lowercased name → id
  for (const c of existingCustomers || []) {
    if (c.email) emailMap.set(c.email.trim().toLowerCase(), c.id);
    if (c.phone) phoneMap.set(c.phone.replace(/\D+/g, ''), c.id);
    if (c.name)  nameMap.set(c.name.trim().toLowerCase(), c.id);
  }

  // Per-entity results accumulator
  const results = {};
  for (const e of ENTITY_ORDER) results[e] = { inserted: 0, skipped: 0, errors: [], autoCreated: 0 };

  // ---------- 1) Customers ----------
  const customerRows = batches.customers || [];
  const customerInserts = [];
  customerRows.forEach((r, i) => {
    const name = trimStr(r.name, 200);
    if (!name) { results.customers.errors.push({ row: i + 2, error: 'Missing name.' }); return; }
    const email = trimStr(r.email, 254);
    const phone = trimStr(r.phone, 40);
    const emailKey = email ? email.toLowerCase() : null;
    const phoneKey = phone ? phone.replace(/\D+/g, '') : null;
    if (emailKey && emailMap.has(emailKey)) { results.customers.skipped++; nameMap.set(name.toLowerCase(), emailMap.get(emailKey)); return; }
    if (phoneKey && phoneKey.length >= 7 && phoneMap.has(phoneKey)) { results.customers.skipped++; nameMap.set(name.toLowerCase(), phoneMap.get(phoneKey)); return; }
    customerInserts.push({
      org_id: orgId, owner_id: user.id,
      name, email, phone,
      address: trimStr(r.address, 1000),
      notes:   trimStr(r.notes, 2000),
    });
  });
  results.customers.inserted = customerInserts.length;

  // Commit customers first so jobs/invoices/quotes can link to them.
  // In validate mode we still synthesize the resulting nameMap so
  // downstream entities can be planned correctly.
  if (!validateOnly && customerInserts.length > 0) {
    for (const c of chunk(customerInserts, INSERT_CHUNK)) {
      const { data: ins, error } = await sb.from('customers').insert(c).select('id, name, email, phone');
      if (error) return res.status(500).json({ error: error.message, results });
      for (const row of ins || []) {
        if (row.name)  nameMap.set(row.name.trim().toLowerCase(), row.id);
        if (row.email) emailMap.set(row.email.trim().toLowerCase(), row.id);
        if (row.phone) phoneMap.set(row.phone.replace(/\D+/g, ''), row.id);
      }
    }
  } else {
    // Validate-mode: pretend each new customer would land with a
    // placeholder id so downstream lookups don't fail incorrectly.
    for (const c of customerInserts) {
      if (c.name) nameMap.set(c.name.trim().toLowerCase(), '__planned__');
    }
  }

  // Helper for downstream entities: resolve a customer name to an
  // id, auto-creating a placeholder customer if we've never seen it.
  // Tracks auto-created so we can include them in the result count.
  const autoCreatedThisRun = new Map();
  const resolveCustomer = async (rawName) => {
    const name = trimStr(rawName, 200);
    if (!name) return null;
    const key = name.toLowerCase();
    if (nameMap.has(key)) return nameMap.get(key);

    // Auto-create placeholder customer (just a name, no email/phone)
    if (validateOnly) {
      autoCreatedThisRun.set(key, '__planned__');
      nameMap.set(key, '__planned__');
      return '__planned__';
    }
    const { data: ins, error } = await sb.from('customers').insert({
      org_id: orgId, owner_id: user.id, name,
    }).select('id').single();
    if (error || !ins) return null;
    autoCreatedThisRun.set(key, ins.id);
    nameMap.set(key, ins.id);
    return ins.id;
  };

  // ---------- 2) Quotes ----------
  const quoteRows = batches.quotes || [];
  const quoteInserts = [];
  // Existing-quote dedupe by (customer_id, title, amount).
  const { data: existingQuotes } = await sb.from('quotes').select('customer_id, title, amount').eq('org_id', orgId);
  const quoteSeen = new Set();
  for (const q of existingQuotes || []) {
    quoteSeen.add(`${q.customer_id || ''}|${(q.title || '').toLowerCase()}|${Number(q.amount || 0).toFixed(2)}`);
  }
  for (let i = 0; i < quoteRows.length; i++) {
    const r = quoteRows[i];
    const title = trimStr(r.title, 200);
    if (!title) { results.quotes.errors.push({ row: i + 2, error: 'Missing title.' }); continue; }
    const amount = toNumberOrNull(r.amount);
    if (amount == null) { results.quotes.errors.push({ row: i + 2, error: 'Missing or invalid amount.' }); continue; }
    const custId = await resolveCustomer(r.customer_name);
    if (!custId) { results.quotes.errors.push({ row: i + 2, error: 'Missing customer name.' }); continue; }
    const key = `${custId}|${title.toLowerCase()}|${amount.toFixed(2)}`;
    if (quoteSeen.has(key)) { results.quotes.skipped++; continue; }
    quoteSeen.add(key);
    quoteInserts.push({
      org_id: orgId, owner_id: user.id, customer_id: validateOnly ? null : custId,
      customer_name: trimStr(r.customer_name, 200),
      title, amount,
      status: normQuoteStatus(r.status),
      sent_at: toIsoDateOrNull(r.sent_date),
      description: trimStr(r.description, 2000),
    });
  }
  results.quotes.inserted = quoteInserts.length;
  if (!validateOnly && quoteInserts.length > 0) {
    for (const c of chunk(quoteInserts, INSERT_CHUNK)) {
      const { error } = await sb.from('quotes').insert(c);
      if (error) return res.status(500).json({ error: error.message, results });
    }
  }

  // ---------- 3) Jobs ----------
  const jobRows = batches.jobs || [];
  const jobInserts = [];
  const { data: existingJobs } = await sb.from('jobs').select('customer_id, title, scheduled_date').eq('org_id', orgId);
  const jobSeen = new Set();
  for (const j of existingJobs || []) {
    jobSeen.add(`${j.customer_id || ''}|${(j.title || '').toLowerCase()}|${j.scheduled_date || ''}`);
  }
  for (let i = 0; i < jobRows.length; i++) {
    const r = jobRows[i];
    const title = trimStr(r.title, 200);
    if (!title) { results.jobs.errors.push({ row: i + 2, error: 'Missing title.' }); continue; }
    const custId = await resolveCustomer(r.customer_name);
    if (!custId) { results.jobs.errors.push({ row: i + 2, error: 'Missing customer name.' }); continue; }
    const scheduledDate = toIsoDateOrNull(r.scheduled_date);
    const key = `${custId}|${title.toLowerCase()}|${scheduledDate || ''}`;
    if (jobSeen.has(key)) { results.jobs.skipped++; continue; }
    jobSeen.add(key);
    jobInserts.push({
      org_id: orgId, owner_id: user.id, customer_id: validateOnly ? null : custId,
      title,
      status: normJobStatus(r.status),
      scheduled_date: scheduledDate,
      price: toNumberOrNull(r.price) ?? 0,
      description: trimStr(r.description, 2000),
    });
  }
  results.jobs.inserted = jobInserts.length;
  if (!validateOnly && jobInserts.length > 0) {
    for (const c of chunk(jobInserts, INSERT_CHUNK)) {
      const { error } = await sb.from('jobs').insert(c);
      if (error) return res.status(500).json({ error: error.message, results });
    }
  }

  // ---------- 4) Invoices ----------
  const invoiceRows = batches.invoices || [];
  const invoiceInserts = [];
  const { data: existingInvs } = await sb.from('invoices').select('customer_id, amount, issued_date').eq('org_id', orgId);
  const invSeen = new Set();
  for (const inv of existingInvs || []) {
    invSeen.add(`${inv.customer_id || ''}|${Number(inv.amount || 0).toFixed(2)}|${inv.issued_date || ''}`);
  }
  for (let i = 0; i < invoiceRows.length; i++) {
    const r = invoiceRows[i];
    const amount = toNumberOrNull(r.amount);
    if (amount == null) { results.invoices.errors.push({ row: i + 2, error: 'Missing or invalid amount.' }); continue; }
    const custId = await resolveCustomer(r.customer_name);
    if (!custId) { results.invoices.errors.push({ row: i + 2, error: 'Missing customer name.' }); continue; }
    const issuedDate = toIsoDateOrNull(r.issued_date) || new Date().toISOString().slice(0, 10);
    const paidDate   = toIsoDateOrNull(r.paid_date);
    const key = `${custId}|${amount.toFixed(2)}|${issuedDate}`;
    if (invSeen.has(key)) { results.invoices.skipped++; continue; }
    invSeen.add(key);
    invoiceInserts.push({
      org_id: orgId, owner_id: user.id, customer_id: validateOnly ? null : custId,
      amount,
      status: normInvoiceStatus(r.status, paidDate),
      issued_date: issuedDate,
      paid_date: paidDate,
      notes: trimStr(r.notes, 2000),
    });
  }
  results.invoices.inserted = invoiceInserts.length;
  if (!validateOnly && invoiceInserts.length > 0) {
    for (const c of chunk(invoiceInserts, INSERT_CHUNK)) {
      const { error } = await sb.from('invoices').insert(c);
      if (error) return res.status(500).json({ error: error.message, results });
    }
  }

  // ---------- 5) Expenses ----------
  // Schema constrains category to a fixed set + the column for free
  // text is `description` (not `notes`). Map permissively from raw
  // category strings to the allowed enum, fall back to 'other'.
  const ALLOWED_EXPENSE_CATEGORIES = new Set(['materials','fuel','labor','equipment','insurance','office','marketing','other']);
  const normExpenseCategory = (v) => {
    const s = trimStr(v)?.toLowerCase() || '';
    if (ALLOWED_EXPENSE_CATEGORIES.has(s)) return s;
    if (/material|supply|supplies/.test(s)) return 'materials';
    if (/fuel|gas|diesel/.test(s))           return 'fuel';
    if (/labor|wage|payroll|sub/.test(s))    return 'labor';
    if (/equip|tool|rental/.test(s))         return 'equipment';
    if (/insur/.test(s))                     return 'insurance';
    if (/office|admin/.test(s))              return 'office';
    if (/marketing|ad|advertis/.test(s))     return 'marketing';
    return 'other';
  };
  const expenseRows = batches.expenses || [];
  const expenseInserts = [];
  for (let i = 0; i < expenseRows.length; i++) {
    const r = expenseRows[i];
    const amount = toNumberOrNull(r.amount);
    if (amount == null) { results.expenses.errors.push({ row: i + 2, error: 'Missing or invalid amount.' }); continue; }
    expenseInserts.push({
      org_id: orgId, owner_id: user.id,
      amount,
      category: normExpenseCategory(r.category),
      expense_date: toIsoDateOrNull(r.expense_date) || new Date().toISOString().slice(0, 10),
      vendor:      trimStr(r.vendor, 200),
      description: trimStr(r.notes, 2000),
    });
  }
  results.expenses.inserted = expenseInserts.length;
  if (!validateOnly && expenseInserts.length > 0) {
    for (const c of chunk(expenseInserts, INSERT_CHUNK)) {
      const { error } = await sb.from('expenses').insert(c);
      if (error) return res.status(500).json({ error: error.message, results });
    }
  }

  // ---------- 6) Mileage ----------
  // Schema columns: log_date, start_address, end_address, purpose
  // (enum: business/commute/personal/other), notes. Free-text
  // purpose strings get normalized; the raw text goes to notes.
  const ALLOWED_MILEAGE_PURPOSES = new Set(['business','commute','personal','other']);
  const normMileagePurpose = (v) => {
    const s = trimStr(v)?.toLowerCase() || '';
    if (ALLOWED_MILEAGE_PURPOSES.has(s)) return s;
    if (/commut/.test(s))  return 'commute';
    if (/personal|private/.test(s)) return 'personal';
    return 'business';
  };
  const mileageRows = batches.mileage || [];
  const mileageInserts = [];
  for (let i = 0; i < mileageRows.length; i++) {
    const r = mileageRows[i];
    const miles = toNumberOrNull(r.miles);
    if (miles == null) { results.mileage.errors.push({ row: i + 2, error: 'Missing or invalid miles.' }); continue; }
    const date = toIsoDateOrNull(r.mileage_date);
    if (!date) { results.mileage.errors.push({ row: i + 2, error: 'Missing or invalid date.' }); continue; }
    mileageInserts.push({
      org_id: orgId, user_id: user.id,
      miles,
      log_date: date,
      purpose:  normMileagePurpose(r.purpose),
      start_address: trimStr(r.start_location, 500),
      end_address:   trimStr(r.end_location, 500),
      notes:        trimStr(r.purpose, 500), // keep the raw text too
    });
  }
  results.mileage.inserted = mileageInserts.length;
  if (!validateOnly && mileageInserts.length > 0) {
    for (const c of chunk(mileageInserts, INSERT_CHUNK)) {
      const { error } = await sb.from('mileage_logs').insert(c);
      if (error) return res.status(500).json({ error: error.message, results });
    }
  }

  // Tag the customers we auto-created so the UI can mention them.
  results.customers.autoCreated = autoCreatedThisRun.size;

  return res.status(200).json({ ok: true, validateOnly, results });
}
