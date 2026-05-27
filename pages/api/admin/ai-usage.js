import { verifyAdmin } from '../../../lib/adminAuth';

// Admin-only AI usage rollup. Wraps admin_ai_usage_summary (an RPC
// running under SECURITY DEFINER) and the budget-alert thresholds
// the user spec'd:
//   - one contractor over $5/mo
//   - platform over $100/mo
//
// Both numbers come from estimated_cost in ai_usage_log, which is
// computed from MODEL_RATES at log time. We don't query Anthropic's
// billing API — this is a rough monitor, not an invoice.

const PER_ORG_ALERT   = 5;
const PLATFORM_ALERT  = 100;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  const { data, error } = await sb.rpc('admin_ai_usage_summary', { p_since: monthStart });
  if (error) return res.status(500).json({ error: error.message });

  const summary = data || {};
  const topOrgs = Array.isArray(summary.top_orgs) ? summary.top_orgs : [];
  const totalCost = Number(summary.total_cost || 0);

  const alerts = [];
  for (const o of topOrgs) {
    if (Number(o.cost || 0) > PER_ORG_ALERT) {
      alerts.push({
        type: 'org_over_budget',
        org_id: o.org_id,
        org_name: o.org_name,
        cost: Number(o.cost),
        threshold: PER_ORG_ALERT,
      });
    }
  }
  if (totalCost > PLATFORM_ALERT) {
    alerts.push({
      type: 'platform_over_budget',
      cost: totalCost,
      threshold: PLATFORM_ALERT,
    });
  }

  res.status(200).json({
    ...summary,
    alerts,
    thresholds: { per_org: PER_ORG_ALERT, platform: PLATFORM_ALERT },
  });
}
