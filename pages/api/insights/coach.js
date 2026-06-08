import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { logUsage } from '../../../lib/aiCost';

export const config = {
  api: {
    bodyParser: { sizeLimit: '32kb' }, // empty body in practice; keep it tight
  },
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cost-control policy: keep Sonnet (not Opus) for the monthly coach.
// Run is once-a-month per org, so the per-call cost ceiling is small;
// what matters is reasoning quality on the recommendation set, and
// Sonnet is the sweet spot. (The earlier date-suffixed alias
// claude-sonnet-4-20250514 was returning 404 — switched to the
// current canonical Sonnet ID.)
const COACH_MODEL = 'claude-sonnet-4-6';

const client = new Anthropic();

// Service-role client for the usage log (table has no RLS but the
// service key keeps writes server-only).
const sbService = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const SYSTEM_PROMPT = `You are a small-business coach for a field-service contractor — landscaping, HVAC, plumbing, electrical, handyman, cleaning, or similar trades. The owner of the business has shared their last 90+ days of operating data. They want pragmatic, specific recommendations they can act on this month.

Audience: a working owner-operator. They are good at the trade and short on time. They will not read an MBA paper. Each recommendation should fit on one screen of a phone.

Areas to consider (pick from these — don't invent new ones):
- pricing — when their job mix or margins suggest they're underpricing or could raise prices
- slow_months — patterns in seasonality and how to fill the slow stretch
- customer_retention — repeat-rate gaps, customers gone quiet, follow-up plays
- job_mix — which job types make more money, which to do less of, which to specialize in
- expense_reduction — categories that are eating margin, vendors to renegotiate

Rules:
- Return EXACTLY 4 or 5 recommendations, ordered by impact.
- Each recommendation has a short title (max ~8 words), a 2-3 sentence body, and one area tag.
- The body MUST reference at least one specific number from the data — a dollar amount, percentage, customer name, month, job type, or expense category — so it feels analyzed, not generic.
- Voice: direct, plain English. Talk to the owner like a friend who happens to know their books. No corporate-speak, no buzzwords, no exclamation points.
- If the data is genuinely too sparse for a particular area, skip that area rather than guessing.
- Return ONLY the JSON object, no preamble.`;

// Note: Claude's output_config json_schema only supports minItems
// values of 0 or 1, so we can't enforce "exactly 4 or 5" at the
// schema level. The count constraint lives in SYSTEM_PROMPT
// ("Return EXACTLY 4 or 5 recommendations, ordered by impact.")
// which the model honors in practice.
const SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area:  { type: 'string', enum: ['pricing','slow_months','customer_retention','job_mix','expense_reduction'] },
          title: { type: 'string' },
          body:  { type: 'string' },
        },
        required: ['area','title','body'],
        additionalProperties: false,
      },
    },
  },
  required: ['recommendations'],
  additionalProperties: false,
};

function firstOfMonth(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
}
function monthKey(d) {
  const x = new Date(d);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}`;
}
function monthName(d) {
  return new Date(d).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function buildSnapshot({ org, invoices, jobs, expenses, labor, leads, customers }) {
  const now = new Date();
  const periodStart = firstOfMonth(now);

  // -- Revenue by month (last 12 calendar months including current)
  const revByMonth = {};
  for (const inv of invoices) {
    const ref = inv.paid_date || inv.issued_date;
    if (!ref) continue;
    const k = monthKey(ref);
    revByMonth[k] = (revByMonth[k] || 0) + Number(inv.amount || 0);
  }
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - i, 1));
    const k = monthKey(d);
    months.push({ month: monthName(d), key: k, revenue: Math.round(revByMonth[k] || 0) });
  }

  // -- Lead conversion
  const wonLeads = leads.filter(l => l.status === 'won' || l.converted_customer_id).length;
  const totalLeadsClosed = leads.filter(l => ['won','lost'].includes(l.status)).length;
  const conversion = totalLeadsClosed > 0 ? Math.round((wonLeads / totalLeadsClosed) * 100) : null;

  // -- Average job value (completed jobs in last 90 days)
  const ninety = new Date(); ninety.setDate(ninety.getDate() - 90);
  const recentJobs = jobs.filter(j => new Date(j.created_at) >= ninety);
  const completedRecent = recentJobs.filter(j => j.status === 'completed' && Number(j.price) > 0);
  const avgJobValue = completedRecent.length
    ? Math.round(completedRecent.reduce((s, j) => s + Number(j.price), 0) / completedRecent.length)
    : 0;

  // -- Job profitability per job: invoice amount - (expenses tied to job) - (labor cost tied to job)
  const expByJob = {};
  for (const e of expenses) {
    if (e.job_id) expByJob[e.job_id] = (expByJob[e.job_id] || 0) + Number(e.amount || 0);
  }
  const laborByJob = {};
  for (const l of labor) {
    laborByJob[l.job_id] = (laborByJob[l.job_id] || 0) + Number(l.cost || 0);
  }
  const invByJob = {};
  for (const inv of invoices) {
    if (inv.job_id) invByJob[inv.job_id] = (invByJob[inv.job_id] || 0) + Number(inv.amount || 0);
  }
  const profitable = []; const unprofitable = [];
  for (const j of jobs) {
    const rev = invByJob[j.id] || 0;
    if (rev <= 0) continue;
    const cost = (expByJob[j.id] || 0) + (laborByJob[j.id] || 0);
    const margin = rev - cost;
    const marginPct = Math.round((margin / rev) * 100);
    const row = { title: j.title || 'Untitled job', revenue: Math.round(rev), cost: Math.round(cost), margin_pct: marginPct };
    if (margin < 0) unprofitable.push(row); else profitable.push(row);
  }
  profitable.sort((a,b) => b.margin_pct - a.margin_pct);
  unprofitable.sort((a,b) => a.margin_pct - b.margin_pct);

  // -- Customer lifetime value
  const custName = Object.fromEntries(customers.map(c => [c.id, c.name]));
  const custTotal = {};
  const custLast = {};
  for (const inv of invoices) {
    if (!inv.customer_id) continue;
    custTotal[inv.customer_id] = (custTotal[inv.customer_id] || 0) + Number(inv.amount || 0);
    const ref = inv.paid_date || inv.issued_date;
    if (ref && (!custLast[inv.customer_id] || ref > custLast[inv.customer_id])) custLast[inv.customer_id] = ref;
  }
  const topCustomers = Object.entries(custTotal)
    .sort((a,b) => b[1] - a[1]).slice(0,5)
    .map(([id, total]) => ({ name: custName[id] || 'Unknown', lifetime_value: Math.round(total) }));

  const sixtyAgo = new Date(); sixtyAgo.setDate(sixtyAgo.getDate() - 60);
  const dormant = Object.entries(custLast)
    .filter(([id, last]) => new Date(last) < sixtyAgo)
    .map(([id, last]) => ({ name: custName[id] || 'Unknown', last_seen: last, total_paid: Math.round(custTotal[id] || 0) }))
    .sort((a,b) => b.total_paid - a.total_paid).slice(0,5);

  const repeatCount = Object.values(custTotal).filter(v => v > 0).length;
  const repeatCustomers = customers.length > 0 ? customers.filter(c => (custTotal[c.id] || 0) > 0).length : 0;
  const avgLTV = repeatCustomers > 0
    ? Math.round(Object.values(custTotal).reduce((s,v) => s+v, 0) / repeatCustomers)
    : 0;

  // -- Expense breakdown
  const expByCat = {};
  for (const e of expenses) expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount || 0);
  const totalExp = Object.values(expByCat).reduce((s,v) => s+v, 0);
  const totalRev = invoices.reduce((s,i) => s + Number(i.amount || 0), 0);
  const expPctOfRevenue = totalRev > 0 ? Math.round((totalExp / totalRev) * 100) : 0;

  return {
    org_name: org.name,
    generated_for_month: monthName(periodStart),
    revenue_by_month: months,
    lead_conversion_pct: conversion,
    avg_job_value_last_90d: avgJobValue,
    most_profitable_jobs: profitable.slice(0,5),
    unprofitable_jobs: unprofitable.slice(0,5),
    top_customers_by_lifetime_value: topCustomers,
    dormant_customers_60d: dormant,
    customer_count: customers.length,
    customers_who_have_paid: repeatCustomers,
    avg_customer_lifetime_value: avgLTV,
    expense_by_category: Object.entries(expByCat).map(([k,v]) => ({ category: k, total: Math.round(v) })).sort((a,b) => b.total - a.total),
    total_expenses: Math.round(totalExp),
    expenses_as_pct_of_revenue: expPctOfRevenue,
  };
}

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });
  }

  const accessToken = bearerToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Missing auth token.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify user + foreman role.
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { data: mem } = await sb.from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });
  if (mem.role !== 'owner' && mem.role !== 'admin') {
    return res.status(403).json({ error: 'Foreman role required.' });
  }
  const orgId = mem.org_id;

  // Current period.
  const periodMonth = firstOfMonth(new Date());
  const periodIso = periodMonth.toISOString().slice(0, 10);

  // Idempotent: if we already have a row for this period, return it.
  const existing = await sb.from('insight_recommendations')
    .select('*').eq('org_id', orgId).eq('period_month', periodIso).maybeSingle();
  if (existing.data) {
    return res.status(200).json({ row: existing.data, generated: false });
  }

  // Eligibility: need 3 full calendar months of activity. We measure by the
  // earliest invoice or job. Either signal is fine — the goal is "they have a
  // real data history."
  const [firstInv, firstJob] = await Promise.all([
    sb.from('invoices').select('issued_date').eq('org_id', orgId).order('issued_date', { ascending: true }).limit(1).maybeSingle(),
    sb.from('jobs').select('created_at').eq('org_id', orgId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  const earliest = [
    firstInv.data?.issued_date && new Date(firstInv.data.issued_date),
    firstJob.data?.created_at && new Date(firstJob.data.created_at),
  ].filter(Boolean).sort((a,b) => a - b)[0] || null;

  if (!earliest) {
    return res.status(200).json({ not_ready: true, months_complete: 0, months_to_go: 3, next_run_after: null });
  }
  const months = (periodMonth.getUTCFullYear() - earliest.getUTCFullYear()) * 12
               + (periodMonth.getUTCMonth() - earliest.getUTCMonth());
  if (months < 3) {
    const next = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth() + 3, 1));
    return res.status(200).json({
      not_ready: true,
      months_complete: months,
      months_to_go: 3 - months,
      next_run_after: next.toISOString().slice(0, 10),
    });
  }

  // Gather data. Last 12 months for revenue trend, last 90 days for jobs/expenses/labor.
  const oneYearAgo = new Date(); oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
  const oneYearIso = oneYearAgo.toISOString().slice(0, 10);

  const [orgRes, invRes, jobsRes, expRes, laborRes, leadsRes, custRes] = await Promise.all([
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    sb.from('invoices').select('amount, status, issued_date, paid_date, job_id, customer_id').eq('org_id', orgId).gte('issued_date', oneYearIso),
    sb.from('jobs').select('id, title, status, price, created_at, scheduled_date, customer_id').eq('org_id', orgId).gte('created_at', oneYearIso),
    sb.from('expenses').select('category, amount, expense_date, job_id').eq('org_id', orgId).gte('expense_date', oneYearIso),
    sb.from('job_labor').select('job_id, cost, work_date').eq('org_id', orgId).gte('work_date', oneYearIso),
    sb.from('leads').select('status, estimated_value, converted_customer_id, created_at').eq('org_id', orgId).gte('created_at', oneYearIso),
    sb.from('customers').select('id, name').eq('org_id', orgId),
  ]);

  const snapshot = buildSnapshot({
    org:       orgRes.data || { name: 'this business' },
    invoices:  invRes.data  || [],
    jobs:      jobsRes.data || [],
    expenses:  expRes.data  || [],
    labor:     laborRes.data|| [],
    leads:     leadsRes.data|| [],
    customers: custRes.data || [],
  });

  let parsed;
  let response;
  try {
    response = await client.messages.create({
      model: COACH_MODEL,
      max_tokens: 2048,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Here is the operating data for ${snapshot.org_name} for the period ending ${snapshot.generated_for_month}. Generate the recommendations.\n\n${JSON.stringify(snapshot, null, 2)}`,
      }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    });
    const txt = response.content.find(b => b.type === 'text');
    if (!txt) throw new Error('No text content returned.');
    parsed = JSON.parse(txt.text);
  } catch (err) {
    let msg = err?.message || 'Coach generation failed.';
    if (err instanceof Anthropic.RateLimitError)      msg = 'Anthropic rate limit reached. Try again in a few minutes.';
    else if (err instanceof Anthropic.AuthenticationError) msg = 'Server API key is invalid.';
    return res.status(500).json({ error: msg });
  }

  const { data: inserted, error: insertErr } = await sb.from('insight_recommendations').insert({
    org_id: orgId,
    period_month: periodIso,
    recommendations: parsed.recommendations,
    data_snapshot: snapshot,
    model: COACH_MODEL,
  }).select().single();
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  // Best-effort usage log so the admin dashboard rolls coach spend
  // alongside chat + assistant spend. Never block the response on it.
  if (sbService) {
    logUsage(sbService, {
      source: 'coach',
      orgId,
      userId: user.id,
      model: COACH_MODEL,
      tokensIn:  response?.usage?.input_tokens  || 0,
      tokensOut: response?.usage?.output_tokens || 0,
    }).catch(() => {});
  }

  res.status(200).json({ row: inserted, generated: true });
}
