import { verifyAdmin, logAdminEvent } from '../../../../lib/adminAuth';

// CRUD for platform_recurring_expenses. The daily cron at
// /api/cron/recurring-expenses consumes this table.

const ALLOWED_CATEGORIES = new Set([
  'hosting','ai','ads','software','contractors','salaries',
  'legal','equipment','travel','marketing','fees','other',
]);

function validateBody(body, { partial = false } = {}) {
  const errors = [];
  const out = {};

  if (!partial || body.name !== undefined) {
    const n = String(body.name || '').trim();
    if (!n) errors.push('name required.');
    else out.name = n.slice(0, 200);
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
  if (!partial || body.day_of_month !== undefined) {
    const n = Math.floor(Number(body.day_of_month));
    if (!Number.isFinite(n) || n < 1 || n > 31) errors.push('day_of_month must be 1-31.');
    else out.day_of_month = n;
  }
  if (body.vendor !== undefined) out.vendor = body.vendor ? String(body.vendor).slice(0, 200) : null;
  if (body.notes  !== undefined) out.notes  = body.notes  ? String(body.notes).slice(0, 2000) : null;
  if (body.active !== undefined) out.active = !!body.active;
  return { out, errors };
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET','POST','PUT','DELETE'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await sb.from('platform_recurring_expenses')
      .select('*').order('day_of_month').limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ recurring: data || [] });
  }

  if (req.method === 'POST') {
    const { out, errors } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    for (const k of ['name','category','amount','day_of_month']) {
      if (out[k] === undefined) return res.status(400).json({ error: `Missing field: ${k}` });
    }
    const { data, error } = await sb.from('platform_recurring_expenses').insert(out).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'recurring_create', payload: { id: data.id, name: data.name } });
    return res.status(200).json({ recurring: data });
  }

  if (req.method === 'PUT') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { out, errors } = validateBody(req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (Object.keys(out).length === 0) return res.status(400).json({ error: 'No fields to update.' });
    const { data, error } = await sb.from('platform_recurring_expenses').update(out).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'recurring_update', payload: { id, fields: Object.keys(out) } });
    return res.status(200).json({ recurring: data });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required as ?id=<uuid>' });
    const { error } = await sb.from('platform_recurring_expenses').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    logAdminEvent(sb, { adminEmail, action: 'recurring_delete', payload: { id } });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
