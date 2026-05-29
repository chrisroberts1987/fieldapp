import { verifyAdmin } from '../../../lib/adminAuth';
import { PLANS } from '../../../lib/billing';

// Platform KPIs for the admin Overview tab. Now sources subscription
// data from the real Stripe-synced columns (subscription_status,
// subscription_tier) instead of the old created_at proxies.
//
// MRR is computed by summing monthly-equivalent revenue across every
// org with subscription_status='active' or 'trialing' (counting
// trialing as projected future MRR — most contractors complete the
// trial). Annual plans are amortized at PLANS[tier].annual / 12.
//
// Conversion = active paying / (eligible cohort), where the cohort
// is every org older than the trial window. Younger orgs are still
// in trial and shouldn't count against the rate.

const TRIAL_DAYS = 14;
const SIGNUPS_LIMIT = 12;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const now = new Date();
  const trialCutoff = new Date(now.getTime() - TRIAL_DAYS * 86_400_000).toISOString();
  const weekAgo     = new Date(now.getTime() - 7  * 86_400_000).toISOString();
  const monthStart  = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();

  // One big pull. ~500 cap is fine for now; pagination when we grow.
  const { data: orgs, error } = await sb
    .from('organizations')
    .select('id, name, owner_name, business_email, address, created_at, suspended_at, subscription_status, subscription_tier, subscription_current_period_end')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return res.status(500).json({ error: error.message });

  // Aggregates
  const total = orgs.length;
  let trialAccounts = 0;
  let activeSubs    = 0;
  let pastDue       = 0;
  let canceled      = 0;
  let newSignupsThisWeek = 0;
  let churnedThisMonth   = 0;
  let mrr = 0;
  const byTier = { solo: 0, crew: 0, business: 0 };

  for (const o of orgs) {
    if (o.created_at >= weekAgo) newSignupsThisWeek++;
    if (o.suspended_at && o.suspended_at >= monthStart) churnedThisMonth++;

    const s = o.subscription_status;
    const t = o.subscription_tier;
    if (s === 'trialing') trialAccounts++;
    if (s === 'active') activeSubs++;
    if (s === 'past_due') pastDue++;
    if (s === 'canceled' || s === 'unpaid' || s === 'incomplete_expired') canceled++;

    // Tier breakdown only counts orgs currently paying / on trial
    // with a chosen tier. Suspended orgs excluded.
    if (!o.suspended_at && t && PLANS[t] && (s === 'active' || s === 'trialing')) {
      byTier[t] = (byTier[t] || 0) + 1;
      mrr += PLANS[t].monthly; // monthly equivalent; annual amortizes the same
    }
  }

  // Conversion rate: of orgs older than the trial window, what % are
  // actively subscribed with a tier (i.e. they made it past trial
  // and are paying or in their second cycle)?
  const eligible = orgs.filter(o => o.created_at < trialCutoff && !o.suspended_at);
  const converted = eligible.filter(o => o.subscription_status === 'active' && o.subscription_tier);
  const conversionRate = eligible.length > 0
    ? Math.round((converted.length / eligible.length) * 100)
    : null;

  // Recent signups list (last N, surfaced with the basics needed to
  // render a clickable card on the overview).
  const recentSignups = orgs.slice(0, SIGNUPS_LIMIT).map(o => ({
    id: o.id,
    name: o.name,
    owner_name: o.owner_name,
    business_email: o.business_email,
    created_at: o.created_at,
    subscription_status: o.subscription_status,
    subscription_tier:   o.subscription_tier,
  }));

  // Geographic reach: pull the 2-letter US state out of each org's
  // address field. Addresses are free-text and may be incomplete, so
  // we use the "ST ZIP" pattern (e.g. "TX 78701") which is unique
  // enough to avoid false positives from prose. Anything that
  // doesn't match goes in an "Unknown" bucket so it's countable.
  const byState = {};
  for (const o of orgs) {
    const st = stateFrom(o.address);
    if (!st) { byState['??'] = (byState['??'] || 0) + 1; continue; }
    byState[st] = (byState[st] || 0) + 1;
  }
  const states = Object.entries(byState)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  res.status(200).json({
    totalBusinesses:    total,
    trialAccounts,
    activeSubs,
    pastDue,
    canceled,
    newSignupsThisWeek,
    churnedThisMonth,
    mrr,
    byTier,
    conversionRate,
    conversionCohortSize: eligible.length,
    recentSignups,
    states,
  });
}

function stateFrom(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const m = addr.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  return m ? m[1].toUpperCase() : null;
}
