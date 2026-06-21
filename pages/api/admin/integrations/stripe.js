import { verifyAdmin } from '../../../../lib/adminAuth';
import { stripe } from '../../../../lib/stripe';

// Stripe integration card for the admin Integrations tab. Pulls:
//   - MRR (sum of active subscription line items, normalized to monthly)
//   - Active subscription count (status=active)
//   - New subscriptions this month (created >= UTC month start)
//   - Churned subscriptions this month (canceled_at >= UTC month start)
//
// All counts come from Stripe live; we don't reuse organizations-table
// data because we want the canonical figure direct from the source.
// MRR figures here can differ slightly from /api/admin/overview, which
// estimates MRR from PLANS[tier].monthly on a per-org basis.
//
// Endpoint always returns 200; the `ok` flag tells the UI whether to
// render data, a "not configured" state, or an inline error.

const PAGE_LIMIT = 100;
const MAX_PAGES  = 50;   // hard ceiling — 5,000 subs is plenty for now

function monthStartUtcUnix() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
}

function intervalToMonthly(amount, interval, intervalCount = 1) {
  // amount is in the smallest currency unit (cents for USD).
  const cents = amount * intervalCount;
  switch (interval) {
    case 'day':   return cents * 30.4375;
    case 'week':  return cents * 4.345;
    case 'month': return cents;
    case 'year':  return cents / 12;
    default:      return 0;
  }
}

async function listAll(stripeClient, listFn) {
  // Manual pagination so we can cap pages defensively.
  const out = [];
  let startingAfter = undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await listFn({ limit: PAGE_LIMIT, starting_after: startingAfter });
    out.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return out;
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;

  const lastUpdated = new Date().toISOString();
  const s = stripe();
  if (!s) {
    return res.status(200).json({
      ok: false, configured: false,
      missingEnv: ['STRIPE_SECRET_KEY'],
      lastUpdated,
    });
  }

  try {
    const monthStart = monthStartUtcUnix();

    const [activeSubs, newSubs, canceledSubs] = await Promise.all([
      listAll(s, (p) => s.subscriptions.list({ status: 'active',   ...p })),
      listAll(s, (p) => s.subscriptions.list({ status: 'all',      created: { gte: monthStart }, ...p })),
      listAll(s, (p) => s.subscriptions.list({ status: 'canceled', ...p })),
    ]);

    // MRR in cents, summed from each active subscription's line items
    let mrrCents = 0;
    for (const sub of activeSubs) {
      const items = sub.items?.data || [];
      for (const item of items) {
        const price = item.price;
        if (!price?.recurring) continue;
        const unit = price.unit_amount || 0;
        mrrCents += intervalToMonthly(unit, price.recurring.interval, price.recurring.interval_count) * (item.quantity || 1);
      }
    }

    const churnedThisMonth = canceledSubs.filter(sub => {
      const ts = (sub.canceled_at || sub.ended_at || 0) * 1000;
      return ts >= monthStart * 1000;
    }).length;

    return res.status(200).json({
      ok: true,
      configured: true,
      lastUpdated,
      data: {
        mrr: Math.round(mrrCents / 100),
        mrrCents: Math.round(mrrCents),
        activeSubs: activeSubs.length,
        newSubsThisMonth: newSubs.length,
        churnedThisMonth,
      },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'Stripe request failed.',
      lastUpdated,
    });
  }
}
