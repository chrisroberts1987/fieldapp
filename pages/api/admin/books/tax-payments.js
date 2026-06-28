import { verifyAdmin, logAdminEvent } from '../../../../lib/adminAuth';

// CRUD for platform_tax_payments. Same shape as expenses.js.
// GET    /api/admin/books/tax-payments              → list (optionally ?from=&to=&tax_type=)
// POST   /api/admin/books/tax-payments              → create
// PUT    /api/admin/books/tax-payments?id=<uuid>    → partial update
// DELETE /api/admin/books/tax-payments?id=<uuid>    → delete

const ALLOWED_TYPES = new Set([
  'federal_quarterly','federal_annual',
  'state_quarterly','state_annual',
  'self_employment','sales','other',
]);

function validateBody(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.paid_on !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.paid_on || ''))) {
      errors.push('paid_on must be YYYY-MM-DD.');
    } else {
      out.paid_on = body.paid_on;
    }
  }
  if (!partial || body.tax_type !== undefined) {
    if (!ALLOWED_TYPES.has(String(body.tax_type || ''))) {
      errors.push(`tax_type must be one of: ${[...ALLOWED_TYPES].join(', ')}.`);
    } else {
      out.tax_type = body.tax_type;
    }
  }
  if (!partial || body.amount !== undefined) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0) errors.push('amount must be a non-negative number.');
    else out.amount = Math.round(n * 100) / 100;
  }
  if (!partial || body.period !== undefined) {
    const p = String(body.period || '').trim();
    if (!p) errors.push('period required (e.g. "2026 Q2").');
    else if (p.length > 40) errors.push('period must be ≤ 40 chars.');
    else out.period = p;
  }
  if (body.notes !== undefined) {
    out.notes = body.notes ? String(body.notes).slice(0, 2000) : null;
  }
  return { out, errors };
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET','POST','PUT','DELETE'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  if (req.method === 'GET') {
    const { from, to, tax_type } = req.query;
    let q = sb.from('platform_tax_payments')
      .select('id, paid_on, period, tax_type, amount, notes, created_at, updated_at')
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (from)     q = q.gte('paid_on', from);
    if (to)       q = q.lte('paid_on', to);
    if (tax_type) q = q.eq('tax_type', tax_type);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ payments: data || [] });
  }

  if (req.method === 'POST') {
    const { out, errors } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    for (const k of ['paid_on','tax_type','amount','period']) {
      if (out[k] === undefined) return res.status(400).json({ error: `Missing field: ${k}` });
    }
    const { data, error } = await sb.from('platform_tax_payments')
      .insert(out).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'tax_payment_create', payload: { id: data.id, amount: data.amount, tax_type: data.tax_type } });
    return res.status(200).json({ payment: data });
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { out, errors } = validateBody(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (Object.keys(out).length === 0) return res.status(400).json({ error: 'No fields to update.' });
    const { data, error } = await sb.from('platform_tax_payments')
      .update(out).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'tax_payment_update', payload: { id, fields: Object.keys(out) } });
    return res.status(200).json({ payment: data });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { error } = await sb.from('platform_tax_payments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'tax_payment_delete', payload: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
