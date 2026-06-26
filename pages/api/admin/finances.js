import { verifyAdmin } from '../../../lib/adminAuth';
import { PLANS } from '../../../lib/billing';

// Platform financial profile — the admin-equivalent of a contractor's
// Dashboard financials + Tax tab. Stripe is the source of truth for
// actual revenue, but we don't want to round-trip the Stripe API on
// every load, so we estimate:
//
//   MRR / ARR     = sum of PLANS[tier].monthly across active+trialing
//   This-month    = MRR (assumes steady state in the current cycle)
//   AI cost (mtd) = sum(estimated_cost) from ai_usage_log this month
//   Estimated net = revenue - AI cost
//
// trend[] gives the last 12 calendar months of new-signup counts +
// month-end paid-tier counts, so a small "12-month growth" chart can
// render on the admin Finances card. Cheap counts via group-by.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart  = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // ---- Subscription rollup (revenue side) -----------------------
  const { data: orgs, error: orgErr } = await sb
    .from('organizations')
    .select('id, subscription_status, subscription_tier, suspended_at, created_at')
    .eq('is_test', false)
    .limit(2000);
  if (orgErr) return res.status(500).json({ error: orgErr.message });

  let mrr = 0;
  let paidCount = 0;
  let trialingCount = 0;
  const tierMrr = { solo: 0, crew: 0, business: 0 };
  for (const o of orgs) {
    if (o.suspended_at) continue;
    const t = o.subscription_tier;
    if (!t || !PLANS[t]) continue;
    if (o.subscription_status === 'active') {
      mrr += PLANS[t].monthly;
      tierMrr[t] = (tierMrr[t] || 0) + PLANS[t].monthly;
      paidCount++;
    } else if (o.subscription_status === 'trialing') {
      trialingCount++;
    }
  }
  const arr = mrr * 12;
  // Steady-state assumption: revenue-this-month ≈ MRR. Good enough
  // for an estimate; replace with Stripe's actual invoiced amount
  // when we wire that in.
  const revenueThisMonth = mrr;
  const revenueYTD = mrr * (now.getUTCMonth() + 1); // very rough

  // ---- AI cost (live numbers from ai_usage_log) -----------------
  const { data: aiThis } = await sb
    .from('ai_usage_log')
    .select('estimated_cost')
    .gte('created_at', monthStart.toISOString());
  const aiCostThisMonth = (aiThis || []).reduce((s, r) => s + Number(r.estimated_cost || 0), 0);

  const { data: aiYTD } = await sb
    .from('ai_usage_log')
    .select('estimated_cost')
    .gte('created_at', yearStart.toISOString());
  const aiCostYTD = (aiYTD || []).reduce((s, r) => s + Number(r.estimated_cost || 0), 0);

  const estNetThisMonth = revenueThisMonth - aiCostThisMonth;
  const estNetYTD       = revenueYTD - aiCostYTD;
  const grossMargin     = revenueThisMonth > 0
    ? Math.round(((revenueThisMonth - aiCostThisMonth) / revenueThisMonth) * 100)
    : null;

  // ---- 12-month trend: new signups per month --------------------
  // Cheap, bucket client-side from the org list we already pulled.
  const trend = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1));
    const signups = orgs.filter(o => {
      const c = o.created_at && new Date(o.created_at);
      return c && c >= m && c < next;
    }).length;
    trend.push({
      key: m.toISOString().slice(0, 7),
      label: m.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      signups,
    });
  }

  res.status(200).json({
    mrr,
    arr,
    paidCount,
    trialingCount,
    tierMrr,
    revenueThisMonth,
    revenueYTD,
    aiCostThisMonth,
    aiCostYTD,
    estNetThisMonth,
    estNetYTD,
    grossMargin,
    trend,
  });
}
