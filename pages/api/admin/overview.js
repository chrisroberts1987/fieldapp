import { verifyAdmin } from '../../../lib/adminAuth';

// Platform KPI strip for the admin dashboard. Until Stripe is wired
// up there's no subscription source-of-truth, so we proxy:
//   • trial   = created within the last 14 days
//   • active  = older than 14 days, not suspended
//   • churned = suspended this month
// MRR is shown as "pending Stripe" placeholder.

const TRIAL_DAYS = 14;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const now = new Date();
  const trialCutoff = new Date(now.getTime() - TRIAL_DAYS * 86_400_000).toISOString();
  const weekAgo     = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const monthStart  = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();

  const [orgsAll, orgsTrial, orgsActive, orgsNewWeek, orgsChurned] = await Promise.all([
    sb.from('organizations').select('id', { count:'exact', head:true }),
    sb.from('organizations').select('id', { count:'exact', head:true }).gte('created_at', trialCutoff).is('suspended_at', null),
    sb.from('organizations').select('id', { count:'exact', head:true }).lt('created_at', trialCutoff).is('suspended_at', null),
    sb.from('organizations').select('id', { count:'exact', head:true }).gte('created_at', weekAgo),
    sb.from('organizations').select('id', { count:'exact', head:true }).gte('suspended_at', monthStart),
  ]);

  res.status(200).json({
    totalBusinesses:    orgsAll.count    || 0,
    trialAccounts:      orgsTrial.count  || 0,
    activeSubs:         orgsActive.count || 0,
    newSignupsThisWeek: orgsNewWeek.count|| 0,
    churnedThisMonth:   orgsChurned.count|| 0,
    mrr: null, // populated once Stripe is wired
    mrrPending: true,
  });
}
