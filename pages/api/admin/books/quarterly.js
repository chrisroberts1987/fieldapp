import { verifyAdmin } from '../../../../lib/adminAuth';
import { PLANS } from '../../../../lib/billing';
import { quartersForYear, estimateTaxOn } from '../../../../lib/admin/tax';

// Quarterly tax breakdown for the admin Books tab. Returns the four
// quarters of the requested year (defaults to current UTC year) with:
//   - net income earned in that quarter (revenue proxy − expenses)
//   - federal SE tax owed (running cap on SS portion)
//   - federal income tax owed (effective rate × income after SE deduction)
//   - state income tax owed
//   - total estimated owed
//   - tax payments actually made during/for that quarter
//   - balance still owed
//
// Revenue inside a quarter uses the same MRR proxy as the rest of
// Books (3 × MRR per quarter), pending the Stripe-billed-totals
// follow-up. Expenses come from the platform_expenses table for that
// quarter's date range.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const quarters = quartersForYear(year);

  // Load config (singleton row).
  const { data: configRow } = await sb
    .from('platform_books_config').select('*').eq('id', 1).maybeSingle();
  const config = configRow || {
    filing_state: null, filing_status: 'single',
    se_tax_rate: 0.153, ss_wage_base: 168600,
    federal_income_rate: 0.18, state_income_rate: 0,
  };

  // MRR proxy from current paying orgs (excludes test).
  const { data: orgs } = await sb
    .from('organizations')
    .select('subscription_status, subscription_tier, suspended_at')
    .eq('is_test', false)
    .limit(5000);
  let mrr = 0;
  for (const o of orgs || []) {
    if (o.suspended_at) continue;
    if (o.subscription_status !== 'active') continue;
    if (!o.subscription_tier || !PLANS[o.subscription_tier]) continue;
    mrr += PLANS[o.subscription_tier].monthly;
  }
  const revenuePerQuarter = mrr * 3;

  // Year-bucket expenses + tax payments in one query each.
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  const [{ data: expenseRows }, { data: aiRows }, { data: taxRows }] = await Promise.all([
    sb.from('platform_expenses').select('occurred_on, amount')
      .gte('occurred_on', yearStart).lte('occurred_on', yearEnd),
    sb.from('ai_usage_log').select('created_at, estimated_cost')
      .gte('created_at', `${yearStart}T00:00:00Z`).lt('created_at', `${year + 1}-01-01T00:00:00Z`),
    sb.from('platform_tax_payments').select('paid_on, amount')
      .gte('paid_on', yearStart).lte('paid_on', yearEnd),
  ]);

  let ytdSEBaseUsed = 0; // cumulative across quarters for SS-cap math
  const out = quarters.map(qd => {
    const inRange = (iso) => iso >= qd.startIso && iso <= qd.endIso;
    const expenses = (expenseRows || []).filter(r => inRange(r.occurred_on))
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const aiCost = (aiRows || []).filter(r => inRange(String(r.created_at).slice(0, 10)))
      .reduce((s, r) => s + Number(r.estimated_cost || 0), 0);
    const taxPaid = (taxRows || []).filter(r => inRange(r.paid_on))
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpenses = expenses + aiCost;
    const net = revenuePerQuarter - totalExpenses;
    const tax = estimateTaxOn(net, ytdSEBaseUsed, config);
    if (net > 0) ytdSEBaseUsed += net * 0.9235;

    return {
      quarter: qd.q,
      label:   qd.label,
      window:  { start: qd.startIso, end: qd.endIso },
      dueOn:   qd.dueIso,
      revenue: round(revenuePerQuarter),
      expenses: { ai: round(aiCost), manual: round(expenses), total: round(totalExpenses) },
      netBeforeTax: round(net),
      tax,
      taxPaid: round(taxPaid),
      balanceDue: round(Math.max(0, tax.total - taxPaid)),
    };
  });

  const yearTotals = out.reduce((acc, q) => ({
    revenue:      acc.revenue + q.revenue,
    expenses:     acc.expenses + q.expenses.total,
    netBeforeTax: acc.netBeforeTax + q.netBeforeTax,
    taxOwed:      acc.taxOwed + q.tax.total,
    taxPaid:      acc.taxPaid + q.taxPaid,
    balanceDue:   acc.balanceDue + q.balanceDue,
  }), { revenue: 0, expenses: 0, netBeforeTax: 0, taxOwed: 0, taxPaid: 0, balanceDue: 0 });

  return res.status(200).json({
    year,
    config: {
      filing_state:        config.filing_state,
      filing_status:       config.filing_status,
      se_tax_rate:         config.se_tax_rate,
      ss_wage_base:        config.ss_wage_base,
      federal_income_rate: config.federal_income_rate,
      state_income_rate:   config.state_income_rate,
    },
    quarters: out,
    yearTotals: Object.fromEntries(Object.entries(yearTotals).map(([k, v]) => [k, round(v)])),
  });
}

function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
