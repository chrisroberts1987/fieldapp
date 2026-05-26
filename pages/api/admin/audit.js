// Returns the most recent audit_log entries across all orgs.
// Used by the admin support tab for "what happened on this account
// recently". Caller must be the platform admin (verifyAdmin).
import { verifyAdmin } from '../../../lib/adminAuth';

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;
  const orgId = req.query.orgId || null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  let q = sb.from('audit_log')
    .select('id, org_id, user_id, user_email, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (orgId) q = q.eq('org_id', orgId);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ entries: data || [] });
}
