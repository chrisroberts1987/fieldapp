import { verifyAdmin, logAdminEvent } from '../../../../lib/adminAuth';

// Singleton config row for the platform Books feature. Lets the admin
// tune filing state, rates, and SS wage base without code changes.
// GET  → returns current config (creates the row if missing)
// PUT  → upserts changes to the row

const FILING_STATUSES = new Set(['single','married_joint','married_separate','head_of_household']);

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET','PUT'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  if (req.method === 'GET') {
    let { data } = await sb.from('platform_books_config').select('*').eq('id', 1).maybeSingle();
    if (!data) {
      const ins = await sb.from('platform_books_config').insert({ id: 1 }).select().single();
      data = ins.data;
    }
    return res.status(200).json({ config: data });
  }

  // PUT
  const body = req.body || {};
  const update = {};
  if (body.filing_state !== undefined) {
    if (body.filing_state && !/^[A-Za-z]{2}$/.test(body.filing_state)) {
      return res.status(400).json({ error: 'filing_state must be a 2-letter state code or null.' });
    }
    update.filing_state = body.filing_state ? body.filing_state.toUpperCase() : null;
  }
  if (body.filing_status !== undefined) {
    if (!FILING_STATUSES.has(body.filing_status)) {
      return res.status(400).json({ error: `filing_status must be one of: ${[...FILING_STATUSES].join(', ')}` });
    }
    update.filing_status = body.filing_status;
  }
  for (const [key, max] of [['se_tax_rate', 0.5], ['federal_income_rate', 0.5], ['state_income_rate', 0.2]]) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      if (!Number.isFinite(n) || n < 0 || n > max) {
        return res.status(400).json({ error: `${key} must be a number between 0 and ${max}.` });
      }
      update[key] = n;
    }
  }
  if (body.ss_wage_base !== undefined) {
    const n = Number(body.ss_wage_base);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'ss_wage_base must be non-negative.' });
    update.ss_wage_base = n;
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No fields to update.' });

  const { data, error } = await sb.from('platform_books_config').update(update).eq('id', 1).select().single();
  if (error) return res.status(500).json({ error: error.message });
  logAdminEvent(sb, { adminEmail, action: 'books_config_update', payload: { fields: Object.keys(update) } });
  return res.status(200).json({ config: data });
}
