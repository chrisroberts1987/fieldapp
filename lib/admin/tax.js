// Quarterly tax math for the platform Books feature. Pure functions
// so they're easy to unit-test and reuse across the quarterly endpoint
// and the year-end CSV export. Numbers are estimates — the admin
// always has a CPA do the actual filing.

// Federal quarterly estimated-tax deadlines for income earned each
// quarter. Standard IRS schedule (Q1 covers Jan-Mar earned, paid by
// Apr 15; Q4 covers Sep-Dec earned, paid by Jan 15 of next year).
const QUARTER_DEFS = [
  { q: 1, startMonth: 0,  endMonth: 2,  dueMonth: 3, dueDay: 15, dueYearOffset: 0 },
  { q: 2, startMonth: 3,  endMonth: 4,  dueMonth: 5, dueDay: 15, dueYearOffset: 0 },
  { q: 3, startMonth: 5,  endMonth: 7,  dueMonth: 8, dueDay: 15, dueYearOffset: 0 },
  { q: 4, startMonth: 8,  endMonth: 11, dueMonth: 0, dueDay: 15, dueYearOffset: 1 },
];

export function quartersForYear(year) {
  return QUARTER_DEFS.map(d => ({
    q:        d.q,
    label:    `Q${d.q} ${year}`,
    startIso: new Date(Date.UTC(year, d.startMonth, 1)).toISOString().slice(0, 10),
    endIso:   new Date(Date.UTC(year, d.endMonth + 1, 0)).toISOString().slice(0, 10), // last day of end month
    dueIso:   new Date(Date.UTC(year + d.dueYearOffset, d.dueMonth, d.dueDay)).toISOString().slice(0, 10),
  }));
}

// Compute estimated tax owed on a chunk of net income, given the
// admin's config. Splits into federal SE, federal income, and state
// so the UI can show the breakdown.
//
//   net           Number — net earnings for the period (revenue − expenses)
//   ytdSEBaseUsed Number — cumulative SE-taxable income already used
//                          this calendar year (for SS-wage-base cap)
//   config        { se_tax_rate, ss_wage_base, federal_income_rate,
//                   state_income_rate }
//
// Returns { se, federal, state, total, ssCappedAt }
export function estimateTaxOn(net, ytdSEBaseUsed, config) {
  if (net <= 0) return { se: 0, federal: 0, state: 0, total: 0, ssCappedAt: null };

  // SE tax base is 92.35% of net earnings (the standard IRS deduction
  // for the employer-half of SE tax). Above the SS wage base, only
  // the Medicare portion (2.9%) applies.
  const seBase     = net * 0.9235;
  const seSSPart   = 0.124;
  const seMedicare = 0.029;
  const ssWageBase = Number(config.ss_wage_base || 168600);

  // How much of THIS chunk's SE base is still under the SS cap?
  const ssRemaining = Math.max(0, ssWageBase - ytdSEBaseUsed);
  const seBaseAtSS  = Math.min(seBase, ssRemaining);
  const seBaseOverSS = Math.max(0, seBase - seBaseAtSS);
  const se = seBaseAtSS * (seSSPart + seMedicare) + seBaseOverSS * seMedicare;

  // Federal + state on the FULL net (not the SE-adjusted base). The
  // SE deduction (half of SE tax) reduces taxable income for federal
  // purposes — apply that small correction.
  const federalTaxable = Math.max(0, net - se / 2);
  const federal = federalTaxable * Number(config.federal_income_rate || 0);
  const state   = Math.max(0, net) * Number(config.state_income_rate || 0);

  return {
    se:    round(se),
    federal: round(federal),
    state: round(state),
    total: round(se + federal + state),
    ssCappedAt: seBaseAtSS < seBase ? ssRemaining : null,
  };
}

function round(n) { return Math.round(Number(n || 0) * 100) / 100; }
