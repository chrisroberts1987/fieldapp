import { verifyAdmin, logAdminEvent } from '../../../../lib/adminAuth';

// CRUD for platform_expenses (admin "Books" tab).
// GET    /api/admin/books/expenses                → list (optionally ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=...)
// POST   /api/admin/books/expenses                → create (body: { occurred_on, category, vendor, amount, notes, receipt_url })
// PUT    /api/admin/books/expenses?id=<uuid>     → update (body: same fields, partial)
// DELETE /api/admin/books/expenses?id=<uuid>     → delete

const ALLOWED_CATEGORIES = new Set([
  'hosting','ai','ads','software','contractors','salaries',
  'legal','equipment','travel','marketing','fees','other',
]);

function validateBody(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.occurred_on !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.occurred_on || ''))) {
      errors.push('occurred_on must be YYYY-MM-DD.');
    } else {
      out.occurred_on = body.occurred_on;
    }
  }
  if (!partial || body.category !== undefined) {
    if (!ALLOWED_CATEGORIES.has(String(body.category || ''))) {
      errors.push(`category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}.`);
    } else {
      out.category = body.category;
    }
  }
  if (!partial || body.amount !== undefined) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0) errors.push('amount must be a non-negative number.');
    else out.amount = Math.round(n * 100) / 100;
  }
  if (body.vendor !== undefined) {
    out.vendor = body.vendor ? String(body.vendor).slice(0, 200) : null;
  }
  if (body.notes !== undefined) {
    out.notes = body.notes ? String(body.notes).slice(0, 2000) : null;
  }
  if (body.receipt_url !== undefined) {
    if (body.receipt_url && !/^https?:\/\//.test(body.receipt_url)) {
      errors.push('receipt_url must be an http(s) URL.');
    } else {
      out.receipt_url = body.receipt_url || null;
    }
  }
  if (body.vendor_1099_id !== undefined) {
    if (body.vendor_1099_id && !/^[0-9a-f-]{36}$/i.test(String(body.vendor_1099_id))) {
      errors.push('vendor_1099_id must be a UUID or null.');
    } else {
      out.vendor_1099_id = body.vendor_1099_id || null;
    }
  }
  return { out, errors };
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET','POST','PUT','DELETE'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  if (req.method === 'GET') {
    const { from, to, category } = req.query;
    let q = sb.from('platform_expenses')
      .select('id, occurred_on, category, vendor, amount, notes, receipt_url, source, source_id, vendor_1099_id, created_at, updated_at')
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000);
    if (from)     q = q.gte('occurred_on', from);
    if (to)       q = q.lte('occurred_on', to);
    if (category) q = q.eq('category', category);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ expenses: data || [] });
  }

  if (req.method === 'POST') {
    const { out, errors } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    // Required fields must all be present on create.
    for (const k of ['occurred_on','category','amount']) {
      if (out[k] === undefined) return res.status(400).json({ error: `Missing field: ${k}` });
    }
    const { data, error } = await sb.from('platform_expenses')
      .insert(out).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'expense_create', payload: { id: data.id, amount: data.amount, category: data.category } });
    return res.status(200).json({ expense: data });
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { out, errors } = validateBody(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (Object.keys(out).length === 0) return res.status(400).json({ error: 'No fields to update.' });
    const { data, error } = await sb.from('platform_expenses')
      .update(out).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'expense_update', payload: { id, fields: Object.keys(out) } });
    return res.status(200).json({ expense: data });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { error } = await sb.from('platform_expenses').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'expense_delete', payload: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
