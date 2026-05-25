import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

// POST /api/import/run
//
// Receives a typed payload of rows the client already parsed +
// mapped via xlsx in the browser, then inserts with deduplication.
// The contract is: this endpoint NEVER overwrites existing data.
// If a row matches an existing record on natural keys it's skipped.
//
// Hard cap at 1000 rows per request, both to keep one run bounded
// and to discourage abuse (the import flow is user-driven, not a
// pipeline). The /pages/import page enforces the same cap before
// calling.
//
// Request body shape:
//   { entity: 'customers'|'jobs'|'invoices', rows: [...] }
// Each row's shape matches lib/import/presets.js TARGET_SCHEMAS.

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
};

const MAX_ROWS = 1000;

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
  // Already YYYY-MM-DD
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Common US format: MM/DD/YYYY or M/D/YY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let yr = parseInt(m[3], 10);
    if (yr < 100) yr += yr < 50 ? 2000 : 1900;
    const mo = String(parseInt(m[1], 10)).padStart(2, '0');
    const da = String(parseInt(m[2], 10)).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }
  // Fallback: Date.parse
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function normalizeJobStatus(v) {
  const s = trimStr(v)?.toLowerCase();
  if (!s) return 'pending';
  if (/^complet/.test(s) || s === 'done' || s === 'closed') return 'completed';
  if (/in.?progress|active|working/.test(s)) return 'in_progress';
  if (/cancel/.test(s)) return 'cancelled';
  if (/schedul/.test(s)) return 'scheduled';
  return 'pending';
}
function normalizeInvoiceStatus(v, paidDate) {
  const s = trimStr(v)?.toLowerCase();
  if (paidDate) return 'paid';
  if (!s) return 'unpaid';
  if (/paid|0\.00|^0$/.test(s)) return 'paid';
  return 'unpaid';
}

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

  const { entity, rows } = req.body || {};
  if (!['customers','jobs','invoices'].includes(entity)) {
    return res.status(400).json({ error: 'Unknown entity.' });
  }
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array.' });
  if (rows.length === 0) return res.status(400).json({ error: 'No rows to import.' });
  if (rows.length > MAX_ROWS) {
    return res.status(400).json({ error: `Too many rows. Limit is ${MAX_ROWS} per import.` });
  }

  const { data: mem } = await sb.from('org_members')
    .select('org_id').eq('user_id', user.id)
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });
  const orgId = mem.org_id;

  if (entity === 'customers') return importCustomers(sb, res, orgId, user.id, rows);
  if (entity === 'jobs')      return importJobs(sb, res, orgId, user.id, rows);
  if (entity === 'invoices')  return importInvoices(sb, res, orgId, user.id, rows);
}

async function importCustomers(sb, res, orgId, userId, rows) {
  // Pull every existing customer in the org once so we can dedupe
  // in-memory rather than per-row roundtripping. Email and phone
  // are the natural keys; name alone isn't unique.
  const { data: existing } = await sb.from('customers')
    .select('id, name, email, phone')
    .eq('org_id', orgId);

  const emailSeen = new Map();
  const phoneSeen = new Map();
  for (const c of existing || []) {
    if (c.email) emailSeen.set(c.email.trim().toLowerCase(), c.id);
    if (c.phone) phoneSeen.set(c.phone.replace(/\D+/g, ''), c.id);
  }

  const toInsert = [];
  const errors = [];
  let skipped = 0;

  rows.forEach((r, i) => {
    const name = trimStr(r.name, 200);
    if (!name) { errors.push({ row: i + 2, error: 'Missing name.' }); return; }
    const email = trimStr(r.email, 254);
    const phone = trimStr(r.phone, 40);
    const emailKey = email ? email.toLowerCase() : null;
    const phoneKey = phone ? phone.replace(/\D+/g, '') : null;
    if (emailKey && emailSeen.has(emailKey)) { skipped++; return; }
    if (phoneKey && phoneKey.length >= 7 && phoneSeen.has(phoneKey)) { skipped++; return; }
    toInsert.push({
      org_id: orgId,
      owner_id: userId,
      name,
      email,
      phone,
      address: trimStr(r.address, 1000),
      notes:   trimStr(r.notes, 2000),
    });
    if (emailKey) emailSeen.set(emailKey, 'pending');
    if (phoneKey) phoneSeen.set(phoneKey, 'pending');
  });

  let inserted = 0;
  if (toInsert.length) {
    const { error, count } = await sb.from('customers').insert(toInsert, { count: 'exact' });
    if (error) return res.status(500).json({ error: error.message, errors });
    inserted = count ?? toInsert.length;
  }

  return res.status(200).json({ ok: true, inserted, skipped, errors });
}

async function importJobs(sb, res, orgId, userId, rows) {
  // Need customers map (name → id) so jobs can be linked. Build it
  // case-insensitively. We don't auto-create missing customers —
  // that would surprise the contractor; tell them to import the
  // customer first or correct the name.
  const { data: customers } = await sb.from('customers')
    .select('id, name')
    .eq('org_id', orgId);
  const byName = new Map();
  for (const c of customers || []) {
    if (c.name) byName.set(c.name.trim().toLowerCase(), c.id);
  }

  // Existing jobs to dedupe against. Match on
  // (customer_id, title, scheduled_date).
  const { data: existingJobs } = await sb.from('jobs')
    .select('customer_id, title, scheduled_date')
    .eq('org_id', orgId);
  const seen = new Set();
  for (const j of existingJobs || []) {
    seen.add(`${j.customer_id || ''}|${(j.title || '').toLowerCase()}|${j.scheduled_date || ''}`);
  }

  const toInsert = [];
  const errors = [];
  let skipped = 0;

  rows.forEach((r, i) => {
    const title = trimStr(r.title, 200);
    if (!title) { errors.push({ row: i + 2, error: 'Missing title.' }); return; }
    const custName = trimStr(r.customer_name, 200);
    if (!custName) { errors.push({ row: i + 2, error: 'Missing customer name.' }); return; }
    const customerId = byName.get(custName.toLowerCase());
    if (!customerId) {
      errors.push({ row: i + 2, error: `Customer "${custName}" not found — import that customer first.` });
      return;
    }
    const scheduledDate = toIsoDateOrNull(r.scheduled_date);
    const dedupKey = `${customerId}|${title.toLowerCase()}|${scheduledDate || ''}`;
    if (seen.has(dedupKey)) { skipped++; return; }
    seen.add(dedupKey);

    toInsert.push({
      org_id:         orgId,
      owner_id:       userId,
      customer_id:    customerId,
      title,
      status:         normalizeJobStatus(r.status),
      scheduled_date: scheduledDate,
      price:          toNumberOrNull(r.price) ?? 0,
      description:    trimStr(r.description, 2000),
    });
  });

  let inserted = 0;
  if (toInsert.length) {
    const { error, count } = await sb.from('jobs').insert(toInsert, { count: 'exact' });
    if (error) return res.status(500).json({ error: error.message, errors });
    inserted = count ?? toInsert.length;
  }

  return res.status(200).json({ ok: true, inserted, skipped, errors });
}

async function importInvoices(sb, res, orgId, userId, rows) {
  const { data: customers } = await sb.from('customers')
    .select('id, name')
    .eq('org_id', orgId);
  const byName = new Map();
  for (const c of customers || []) {
    if (c.name) byName.set(c.name.trim().toLowerCase(), c.id);
  }

  const { data: existingInvoices } = await sb.from('invoices')
    .select('customer_id, amount, issued_date')
    .eq('org_id', orgId);
  const seen = new Set();
  for (const inv of existingInvoices || []) {
    seen.add(`${inv.customer_id || ''}|${Number(inv.amount || 0).toFixed(2)}|${inv.issued_date || ''}`);
  }

  const toInsert = [];
  const errors = [];
  let skipped = 0;

  rows.forEach((r, i) => {
    const amount = toNumberOrNull(r.amount);
    if (amount == null) { errors.push({ row: i + 2, error: 'Missing or invalid amount.' }); return; }
    const custName = trimStr(r.customer_name, 200);
    if (!custName) { errors.push({ row: i + 2, error: 'Missing customer name.' }); return; }
    const customerId = byName.get(custName.toLowerCase());
    if (!customerId) {
      errors.push({ row: i + 2, error: `Customer "${custName}" not found — import that customer first.` });
      return;
    }
    const issuedDate = toIsoDateOrNull(r.issued_date) || new Date().toISOString().slice(0, 10);
    const paidDate   = toIsoDateOrNull(r.paid_date);
    const dedupKey = `${customerId}|${amount.toFixed(2)}|${issuedDate}`;
    if (seen.has(dedupKey)) { skipped++; return; }
    seen.add(dedupKey);

    toInsert.push({
      org_id:      orgId,
      owner_id:    userId,
      customer_id: customerId,
      amount,
      status:      normalizeInvoiceStatus(r.status, paidDate),
      issued_date: issuedDate,
      paid_date:   paidDate,
      notes:       trimStr(r.notes, 2000),
    });
  });

  let inserted = 0;
  if (toInsert.length) {
    const { error, count } = await sb.from('invoices').insert(toInsert, { count: 'exact' });
    if (error) return res.status(500).json({ error: error.message, errors });
    inserted = count ?? toInsert.length;
  }

  return res.status(200).json({ ok: true, inserted, skipped, errors });
}
