import { verifyAdmin } from '../../../../lib/adminAuth';
import { PLANS } from '../../../../lib/billing';

// Platform P&L. Rolls up:
//   Revenue            = MRR (Stripe + Apple IAP)
//   - AI cost          = sum(ai_usage_log.estimated_cost)
//   - Other expenses   = sum(platform_expenses.amount) by category
//   = Net before tax
//   - Estimated tax    = NET * EST_TAX_RATE (set-aside, not "paid")
//   = Net after tax
//
// Plus tax-payment totals so we can show "you've set aside / paid
// $X year to date against $Y estimated owed."
//
// Time windows: thisMonth (UTC month-start to now), ytd (UTC year
// start to now). MRR is a steady-state proxy for revenue-this-month —
// real billed amounts will come from the Stripe-fee auto-import in
// Phase 2.

// Estimated combined federal + SE tax rate for a solo SaaS owner. Very
// rough — assumes 15.3% SE plus an effective 14.7% federal income.
// The admin can override this with ?taxRate=0.25 on the query string
// if they want to model different scenarios.
const DEFAULT_TAX_RATE = 0.30;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const taxRate = clampRate(req.query.taxRate);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const yearStart  = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();

  // ---- Revenue (MRR proxy, excluding test orgs) ------------------
  const { data: orgs, error: orgErr } = await sb
    .from('organizations')
    .select('subscription_status, subscription_tier, suspended_at, payment_source')
    .eq('is_test', false)
    .limit(5000);
  if (orgErr) return res.status(500).json({ error: orgErr.message });

  let mrrStripe = 0, mrrApple = 0;
  for (const o of orgs || []) {
    if (o.suspended_at) continue;
    if (o.subscription_status !== 'active') continue;
    const t = o.subscription_tier;
    if (!t || !PLANS[t]) continue;
    if (o.payment_source === 'apple') mrrApple += PLANS[t].monthly;
    else                              mrrStripe += PLANS[t].monthly;
  }
  const mrr = mrrStripe + mrrApple;
  // Steady-state assumption — revenue this month ≈ MRR.
  const revenueThisMonth = mrr;
  // YTD: MRR × elapsed months. Replace with billed totals when
  // the Stripe-fee importer is wired up.
  const revenueYTD = mrr * (now.getUTCMonth() + 1);

  // ---- AI cost ----------------------------------------------------
  const aiThisMonth = await sumNumeric(sb, 'ai_usage_log', 'estimated_cost', 'created_at', monthStart);
  const aiYTD       = await sumNumeric(sb, 'ai_usage_log', 'estimated_cost', 'created_at', yearStart);

  // ---- Manual expenses (by category) ------------------------------
  const expensesThisMonth = await pullExpenses(sb, monthStart);
  const expensesYTD       = await pullExpenses(sb, yearStart);

  // ---- Tax payments (actual recorded) -----------------------------
  const { data: taxPaymentsYTD } = await sb
    .from('platform_tax_payments')
    .select('amount')
    .gte('paid_on', isoDate(yearStart));
  const taxPaidYTD = (taxPaymentsYTD || []).reduce((s, r) => s + Number(r.amount || 0), 0);

  // ---- Roll up ----------------------------------------------------
  const totalExpensesThisMonth = aiThisMonth + expensesThisMonth.total;
  const totalExpensesYTD       = aiYTD       + expensesYTD.total;
  const netBeforeTaxThisMonth  = revenueThisMonth - totalExpensesThisMonth;
  const netBeforeTaxYTD        = revenueYTD       - totalExpensesYTD;
  const estTaxThisMonth        = Math.max(0, netBeforeTaxThisMonth) * taxRate;
  const estTaxYTD              = Math.max(0, netBeforeTaxYTD)       * taxRate;
  const netAfterTaxThisMonth   = netBeforeTaxThisMonth - estTaxThisMonth;
  const netAfterTaxYTD         = netBeforeTaxYTD       - estTaxYTD;
  const taxOwedRemaining       = Math.max(0, estTaxYTD - taxPaidYTD);

  return res.status(200).json({
    asOf: now.toISOString(),
    taxRate,
    revenue: {
      thisMonth: round(revenueThisMonth),
      ytd:       round(revenueYTD),
      byType:    { stripe: round(mrrStripe), apple: round(mrrApple) },
      _note:     'Revenue is an MRR proxy. Real Stripe-billed totals land in Phase 2.',
    },
    expenses: {
      thisMonth: {
        ai:       round(aiThisMonth),
        manual:   round(expensesThisMonth.total),
        total:    round(totalExpensesThisMonth),
        byCategory: expensesThisMonth.byCategory,
      },
      ytd: {
        ai:       round(aiYTD),
        manual:   round(expensesYTD.total),
        total:    round(totalExpensesYTD),
        byCategory: expensesYTD.byCategory,
      },
    },
    netBeforeTax: {
      thisMonth: round(netBeforeTaxThisMonth),
      ytd:       round(netBeforeTaxYTD),
    },
    estimatedTax: {
      thisMonth: round(estTaxThisMonth),
      ytd:       round(estTaxYTD),
      rate:      taxRate,
      _note:     'Set-aside estimate, not paid. Combined federal + SE rate. Override via ?taxRate=0.25.',
    },
    netAfterTax: {
      thisMonth: round(netAfterTaxThisMonth),
      ytd:       round(netAfterTaxYTD),
    },
    taxPayments: {
      paidYTD:        round(taxPaidYTD),
      owedRemaining:  round(taxOwedRemaining),
    },
  });
}

async function pullExpenses(sb, sinceIso) {
  const { data } = await sb
    .from('platform_expenses')
    .select('amount, category')
    .gte('occurred_on', isoDate(sinceIso));
  const byCategory = {};
  let total = 0;
  for (const r of data || []) {
    const amt = Number(r.amount || 0);
    total += amt;
    byCategory[r.category] = round((byCategory[r.category] || 0) + amt);
  }
  return { total, byCategory };
}

async function sumNumeric(sb, table, column, dateColumn, sinceIso) {
  const { data } = await sb.from(table).select(column).gte(dateColumn, sinceIso);
  return (data || []).reduce((s, r) => s + Number(r[column] || 0), 0);
}

function clampRate(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 0.5) return DEFAULT_TAX_RATE;
  return n;
}

function isoDate(iso) { return String(iso).slice(0, 10); }
function round(n)     { return Math.round(Number(n || 0) * 100) / 100; }
