import { verifyAdmin, logAdminEvent } from '../../../../lib/adminAuth';

// 1099-NEC vendor directory + year totals.
// GET    /api/admin/books/vendors-1099           → list (optionally ?year=YYYY to include year totals)
// POST   /api/admin/books/vendors-1099           → create
// PUT    /api/admin/books/vendors-1099?id=<uuid> → partial update
// DELETE /api/admin/books/vendors-1099?id=<uuid> → soft-delete via active=false

function validateBody(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  if (!partial || body.name !== undefined) {
    const n = String(body.name || '').trim();
    if (!n) errors.push('name required.');
    else out.name = n.slice(0, 200);
  }
  for (const k of ['business_name','email','tax_id','address','notes']) {
    if (body[k] !== undefined) out[k] = body[k] ? String(body[k]).slice(0, 500) : null;
  }
  if (body.active !== undefined) out.active = !!body.active;
  return { out, errors };
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET','POST','PUT','DELETE'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  if (req.method === 'GET') {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const { data: vendors, error } = await sb.from('vendors_1099')
      .select('*').order('name').limit(500);
    if (error) return res.status(500).json({ error: error.message });

    // Year totals per vendor from platform_expenses.
    const { data: expenseRows } = await sb.from('platform_expenses')
      .select('vendor_1099_id, amount')
      .gte('occurred_on', `${year}-01-01`)
      .lte('occurred_on', `${year}-12-31`)
      .not('vendor_1099_id', 'is', null);
    const totals = {};
    for (const r of expenseRows || []) {
      totals[r.vendor_1099_id] = (totals[r.vendor_1099_id] || 0) + Number(r.amount || 0);
    }
    const enriched = (vendors || []).map(v => ({
      ...v,
      year_total: round(totals[v.id] || 0),
      requires_1099: (totals[v.id] || 0) >= 600,
    }));
    return res.status(200).json({ year, vendors: enriched });
  }

  if (req.method === 'POST') {
    const { out, errors } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    const { data, error } = await sb.from('vendors_1099').insert(out).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'vendor_1099_create', payload: { id: data.id, name: data.name } });
    return res.status(200).json({ vendor: data });
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { out, errors } = validateBody(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (Object.keys(out).length === 0) return res.status(400).json({ error: 'No fields to update.' });
    const { data, error } = await sb.from('vendors_1099').update(out).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'vendor_1099_update', payload: { id, fields: Object.keys(out) } });
    return res.status(200).json({ vendor: data });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    // Soft delete — keep history for past-year 1099 lookups.
    const { error } = await sb.from('vendors_1099').update({ active: false }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'vendor_1099_archive', payload: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}

function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
