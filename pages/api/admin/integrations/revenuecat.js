import { verifyAdmin } from '../../../../lib/adminAuth';
import { PLANS } from '../../../../lib/billing';

// RevenueCat integration card. Reports Apple In-App Purchase metrics:
//   - Active Apple IAP subscriptions
//   - Apple MRR (sum of monthly plan prices for active subs)
//   - New IAP subscriptions this month
//
// RevenueCat's REST API (https://api.revenuecat.com/v2) does not expose
// aggregate metrics directly — you'd need to page through every
// customer to compute MRR. To stay fast and not burn 1k API calls on
// each refresh, we read the local Supabase tables that the iap webhook
// at pages/api/iap/webhook.js keeps in sync:
//   organizations.payment_source = 'apple' / 'stripe' / 'google'
//   organizations.subscription_status, subscription_tier
//   iap_events (immutable log of every RevenueCat webhook delivery)
//
// MRR is computed via PLANS[tier].monthly (same convention as
// /api/admin/overview) since Apple-side prices match the listed tiers.
//
// REVENUECAT_API_KEY is reserved for a future direct-REST path; today
// we only check that the IAP webhook is wired up via the secret. If
// neither REVENUECAT_API_KEY nor REVENUECAT_WEBHOOK_SECRET is set we
// flag the integration as "not configured."

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;
  const lastUpdated = new Date().toISOString();

  const hasWebhook = !!process.env.REVENUECAT_WEBHOOK_SECRET;
  const hasApiKey  = !!process.env.REVENUECAT_API_KEY;
  if (!hasWebhook && !hasApiKey) {
    return res.status(200).json({
      ok: false, configured: false,
      missingEnv: ['REVENUECAT_WEBHOOK_SECRET', 'REVENUECAT_API_KEY (optional, for direct REST polling)'],
      lastUpdated,
    });
  }

  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const { data: orgs, error } = await sb
      .from('organizations')
      .select('id, payment_source, subscription_status, subscription_tier')
      .eq('payment_source', 'apple')
      .limit(5000);
    if (error) throw new Error(error.message);

    let activeSubs = 0;
    let mrr        = 0;
    for (const o of orgs || []) {
      const s = o.subscription_status;
      const t = o.subscription_tier;
      if ((s === 'active' || s === 'trialing') && t && PLANS[t]) {
        activeSubs++;
        mrr += PLANS[t].monthly;
      }
    }

    // New IAP subs this month = unique app_user_id values whose first
    // INITIAL_PURCHASE event fell in this month. We approximate via
    // the first iap_events row per user instead of a self-join — the
    // table is append-only and small enough.
    const { data: newEvents, error: evErr } = await sb
      .from('iap_events')
      .select('app_user_id, event_type, received_at')
      .gte('received_at', monthStart)
      .in('event_type', ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE'])
      .limit(2000);
    if (evErr) throw new Error(evErr.message);

    const uniqueNew = new Set((newEvents || []).map(e => e.app_user_id));
    const newSubsThisMonth = uniqueNew.size;

    return res.status(200).json({
      ok: true, configured: true, lastUpdated,
      data: {
        activeSubs,
        mrr,
        newSubsThisMonth,
        source: 'iap_events',
      },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'RevenueCat metrics query failed.',
      lastUpdated,
    });
  }
}
