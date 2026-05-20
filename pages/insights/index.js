import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { fmt$, fmtDate } from '../../lib/helpers';
import { isForeman } from '../../lib/role';
import TopNav from '../../components/TopNav';

const AREA_LABEL = {
  pricing:             'Pricing',
  slow_months:         'Slow months',
  customer_retention:  'Customer retention',
  job_mix:             'Job mix',
  expense_reduction:   'Expense reduction',
};
const AREA_COLOR = {
  pricing:             '#fbbf24',
  slow_months:         '#a78bfa',
  customer_retention:  '#4f9eff',
  job_mix:             '#2edf87',
  expense_reduction:   '#f26060',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(d) { const x = new Date(d); return `${MONTH_NAMES[x.getUTCMonth()]} ${x.getUTCFullYear()}`; }
function shortMonth(d) { const x = new Date(d); return MONTH_NAMES[x.getUTCMonth()]; }
function firstOfMonthIso(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function nextRunDateLabel() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export default function Insights() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);

  const [invoices,  setInvoices]  = useState(null);
  const [jobs,      setJobs]      = useState(null);
  const [expenses,  setExpenses]  = useState(null);
  const [labor,     setLabor]     = useState(null);
  const [leads,     setLeads]     = useState(null);
  const [customers, setCustomers] = useState(null);

  const [coachRow,    setCoachRow]    = useState(null);
  const [coachStatus, setCoachStatus] = useState({ phase: 'idle' });

  const loadAll = async (oid) => {
    const oneYearAgo = new Date(); oneYearAgo.setMonth(oneYearAgo.getMonth() - 14);
    const iso = oneYearAgo.toISOString().slice(0, 10);
    const [inv, j, e, l, ld, c] = await Promise.all([
      supabase.from('invoices').select('amount, status, issued_date, paid_date, job_id, customer_id').eq('org_id', oid),
      supabase.from('jobs').select('id, title, status, price, created_at, scheduled_date, customer_id').eq('org_id', oid),
      supabase.from('expenses').select('category, amount, expense_date, job_id').eq('org_id', oid).gte('expense_date', iso),
      supabase.from('job_labor').select('job_id, cost, work_date').eq('org_id', oid).gte('work_date', iso),
      supabase.from('leads').select('status, estimated_value, converted_customer_id, created_at').eq('org_id', oid),
      supabase.from('customers').select('id, name, created_at').eq('org_id', oid),
    ]);
    setInvoices(inv.data || []);
    setJobs(j.data || []);
    setExpenses(e.data || []);
    setLabor(l.data || []);
    setLeads(ld.data || []);
    setCustomers(c.data || []);
  };

  const loadCoachRow = async (oid) => {
    const periodIso = firstOfMonthIso(new Date());
    const { data } = await supabase.from('insight_recommendations')
      .select('*').eq('org_id', oid).eq('period_month', periodIso).maybeSingle();
    return data;
  };

  const ensureCoach = async (oid) => {
    const existing = await loadCoachRow(oid);
    if (existing) { setCoachRow(existing); setCoachStatus({ phase: 'ready' }); return; }
    // No row this month — try to generate.
    setCoachStatus({ phase: 'generating' });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCoachStatus({ phase: 'error', message: 'Not signed in.' }); return; }
    try {
      const r = await fetch('/api/insights/coach', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      const body = await r.json();
      if (!r.ok) { setCoachStatus({ phase: 'error', message: body?.error || 'Coach failed.' }); return; }
      if (body.not_ready) { setCoachStatus({ phase: 'not_ready', months_complete: body.months_complete, months_to_go: body.months_to_go }); return; }
      setCoachRow(body.row); setCoachStatus({ phase: 'ready' });
    } catch (e) {
      setCoachStatus({ phase: 'error', message: e.message || 'Network error.' });
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId && isForeman(role)) { loadAll(orgId); ensureCoach(orgId); }
    else if (orgId && !isForeman(role)) router.push('/dashboard');
    else if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [orgId, orgLoading, role]);

  useRefetchOnFocus(() => { if (orgId) loadAll(orgId); }, !!orgId);

  // ---------- DERIVED ----------
  const analytics = useMemo(() => {
    if (!invoices || !jobs || !expenses || !labor || !leads || !customers) return null;

    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const sameMonthLY = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));

    const inMonth = (iso, m) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getUTCFullYear() === m.getUTCFullYear() && d.getUTCMonth() === m.getUTCMonth();
    };
    const revIn = (m) => invoices
      .filter(inv => inMonth(inv.paid_date || inv.issued_date, m))
      .reduce((s, inv) => s + Number(inv.amount || 0), 0);
    const revThis = revIn(thisMonth);
    const revLast = revIn(lastMonth);
    const revLastYear = revIn(sameMonthLY);

    // YoY growth: trailing 12 months vs prior 12 months total.
    const t12Start  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
    const t24Start  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 24, 1));
    const between = (iso, a, b) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= a && d < b;
    };
    const trailing12 = invoices.filter(inv => between(inv.paid_date || inv.issued_date, t12Start, now)).reduce((s,i) => s + Number(i.amount || 0), 0);
    const trailing24 = invoices.filter(inv => between(inv.paid_date || inv.issued_date, t24Start, t12Start)).reduce((s,i) => s + Number(i.amount || 0), 0);
    const yoy = trailing24 > 0 ? Math.round(((trailing12 - trailing24) / trailing24) * 100) : null;

    // Average job value — trailing 90d (completed)
    const ninety = new Date(); ninety.setDate(ninety.getDate() - 90);
    const completedJobs = jobs.filter(j => j.status === 'completed' && Number(j.price) > 0);
    const recentCompleted = completedJobs.filter(j => new Date(j.created_at) >= ninety);
    const avgJobValue = recentCompleted.length
      ? recentCompleted.reduce((s,j) => s + Number(j.price), 0) / recentCompleted.length : 0;
    const previousPeriod = completedJobs.filter(j => {
      const d = new Date(j.created_at); const a = new Date(); a.setDate(a.getDate() - 180); const b = new Date(); b.setDate(b.getDate() - 90);
      return d >= a && d < b;
    });
    const prevAvg = previousPeriod.length
      ? previousPeriod.reduce((s,j) => s + Number(j.price), 0) / previousPeriod.length : 0;
    const avgJobDelta = prevAvg > 0 ? Math.round(((avgJobValue - prevAvg) / prevAvg) * 100) : null;

    // Lead conversion (lifetime: won / (won+lost))
    const wonLeads  = leads.filter(l => l.status === 'won' || l.converted_customer_id).length;
    const lostLeads = leads.filter(l => l.status === 'lost').length;
    const closedLeads = wonLeads + lostLeads;
    const conversion = closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 100) : null;

    // Trailing-12-month bar series
    const months12 = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months12.push({ key: firstOfMonthIso(m), label: shortMonth(m), revenue: revIn(m) });
    }
    const maxMonthRev = Math.max(1, ...months12.map(m => m.revenue));

    // Best/slow months historically (this & previous year, by calendar month)
    const monthSum = Array.from({length:12}, () => ({ total: 0, count: 0 }));
    for (const inv of invoices) {
      const ref = inv.paid_date || inv.issued_date;
      if (!ref) continue;
      const d = new Date(ref);
      const idx = d.getUTCMonth();
      monthSum[idx].total += Number(inv.amount || 0);
      monthSum[idx].count += 1;
    }
    const ranked = monthSum
      .map((m, idx) => ({ idx, avg: m.count > 0 ? m.total / m.count : 0, total: m.total }))
      .filter(m => m.total > 0)
      .sort((a,b) => b.total - a.total);
    const bestMonth = ranked[0] ? MONTH_NAMES[ranked[0].idx] : null;
    const slowMonth = ranked.length > 1 ? MONTH_NAMES[ranked[ranked.length - 1].idx] : null;

    // Predict the upcoming slow month: look at next 3 months by avg revenue.
    const upcoming = [];
    for (let i = 1; i <= 3; i++) {
      const idx = (now.getUTCMonth() + i) % 12;
      upcoming.push({ idx, avg: monthSum[idx].total });
    }
    upcoming.sort((a,b) => a.avg - b.avg);
    const upcomingSlow = upcoming[0] && upcoming[0].avg > 0 ? MONTH_NAMES[upcoming[0].idx] : null;

    // Job profitability — only count jobs that have an invoice
    const expByJob = {};
    for (const e of expenses) { if (e.job_id) expByJob[e.job_id] = (expByJob[e.job_id] || 0) + Number(e.amount || 0); }
    const laborByJob = {};
    for (const l of labor) { laborByJob[l.job_id] = (laborByJob[l.job_id] || 0) + Number(l.cost || 0); }
    const invByJob = {};
    for (const inv of invoices) { if (inv.job_id) invByJob[inv.job_id] = (invByJob[inv.job_id] || 0) + Number(inv.amount || 0); }
    const jobProfit = jobs
      .filter(j => (invByJob[j.id] || 0) > 0)
      .map(j => {
        const rev = invByJob[j.id] || 0;
        const cost = (expByJob[j.id] || 0) + (laborByJob[j.id] || 0);
        const margin = rev - cost;
        return { id: j.id, title: j.title || 'Untitled', revenue: rev, cost, margin, margin_pct: rev > 0 ? Math.round((margin/rev)*100) : 0 };
      });
    const profitable    = [...jobProfit].sort((a,b) => b.margin_pct - a.margin_pct).slice(0, 5);
    const unprofitable  = jobProfit.filter(j => j.margin < 0).sort((a,b) => a.margin - b.margin).slice(0, 5);

    // Most common job types — naive: bucket by first ~25 chars of title (lowercased)
    const typeCount = {};
    for (const j of jobs) {
      if (j.status !== 'completed') continue;
      const k = (j.title || 'Untitled').trim().toLowerCase().slice(0, 30);
      typeCount[k] = (typeCount[k] || 0) + 1;
    }
    const topTypes = Object.entries(typeCount).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([k,v]) => ({ title: k, count: v }));

    // Customer LTV
    const custName = Object.fromEntries(customers.map(c => [c.id, c.name]));
    const custPaid = {};
    const custLastDate = {};
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      custPaid[inv.customer_id] = (custPaid[inv.customer_id] || 0) + Number(inv.amount || 0);
      const ref = inv.paid_date || inv.issued_date;
      if (ref && (!custLastDate[inv.customer_id] || ref > custLastDate[inv.customer_id])) custLastDate[inv.customer_id] = ref;
    }
    const topCustomers = Object.entries(custPaid)
      .sort((a,b) => b[1] - a[1]).slice(0, 5)
      .map(([id, total]) => ({ id, name: custName[id] || 'Unknown', total }));
    const sixtyAgo = new Date(); sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const dormantCustomers = Object.entries(custLastDate)
      .filter(([id, last]) => new Date(last) < sixtyAgo)
      .map(([id, last]) => ({ id, name: custName[id] || 'Unknown', last_seen: last, total: custPaid[id] || 0 }))
      .sort((a,b) => b.total - a.total).slice(0, 8);

    // Customer counts (invoice volume per customer): repeats = >=2, oneTime = 1
    const custInvCount = {};
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      custInvCount[inv.customer_id] = (custInvCount[inv.customer_id] || 0) + 1;
    }
    const paidCustomerIds = Object.keys(custInvCount);
    const repeatCount = paidCustomerIds.filter(id => custInvCount[id] >= 2).length;
    const oneTimeCount = paidCustomerIds.filter(id => custInvCount[id] === 1).length;
    const avgLTV = paidCustomerIds.length
      ? paidCustomerIds.reduce((s, id) => s + (custPaid[id] || 0), 0) / paidCustomerIds.length : 0;

    // Expenses
    const expByCat = {};
    for (const e of expenses) expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount || 0);
    const expCatList = Object.entries(expByCat)
      .map(([category, total]) => ({ category, total }))
      .sort((a,b) => b.total - a.total);
    const totalExpAllTime = expCatList.reduce((s, x) => s + x.total, 0);

    // Trailing 6 months expense trend
    const expBy6 = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const totalThis = expenses
        .filter(e => inMonth(e.expense_date, m))
        .reduce((s,e) => s + Number(e.amount || 0), 0);
      expBy6.push({ label: shortMonth(m), total: totalThis });
    }
    const maxExp6 = Math.max(1, ...expBy6.map(m => m.total));

    const totalRev12 = months12.reduce((s,m) => s + m.revenue, 0);
    const totalExp12 = expBy6.reduce((s,m) => s + m.total, 0);
    const expPctOfRev = totalRev12 > 0 ? Math.round((totalExp12 / totalRev12) * 100) : 0;

    return {
      revThis, revLast, revLastYear, yoy, trailing12,
      avgJobValue, avgJobDelta, conversion,
      months12, maxMonthRev,
      bestMonth, slowMonth, upcomingSlow,
      profitable, unprofitable, topTypes,
      topCustomers, dormantCustomers, repeatCount, oneTimeCount, avgLTV,
      expCatList, totalExpAllTime, expBy6, maxExp6, expPctOfRev,
    };
  }, [invoices, jobs, expenses, labor, leads, customers]);

  if (!user || orgLoading || (!isForeman(role) && role !== null)) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/insights"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading insights…</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/insights"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading insights…</div>
      </div>
    );
  }

  const a = analytics;
  const momDelta = a.revLast > 0 ? Math.round(((a.revThis - a.revLast) / a.revLast) * 100) : null;
  const yoyMonthDelta = a.revLastYear > 0 ? Math.round(((a.revThis - a.revLastYear) / a.revLastYear) * 100) : null;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/insights"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Insights</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0'}}>INSIGHTS</h1>
          <div style={{fontSize:13,color:'#7a8db0',marginTop:2}}>Business intelligence for {new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}</div>
        </div>

        <Section title="Business Health">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:14}}>
            <Kpi label="Revenue this month" value={fmt$(a.revThis)} sub={momDelta == null ? '— vs last month' : `${momDelta >= 0 ? '+' : ''}${momDelta}% vs last month`} positive={momDelta != null && momDelta >= 0}/>
            <Kpi label="Last month" value={fmt$(a.revLast)} sub={`${MONTH_NAMES[(new Date().getMonth()+11)%12]} total`}/>
            <Kpi label="Same month last year" value={fmt$(a.revLastYear)} sub={yoyMonthDelta == null ? 'no comparison' : `${yoyMonthDelta >= 0 ? '+' : ''}${yoyMonthDelta}% YoY`} positive={yoyMonthDelta != null && yoyMonthDelta >= 0}/>
            <Kpi label="YoY growth (trailing 12)" value={a.yoy == null ? '—' : `${a.yoy >= 0 ? '+' : ''}${a.yoy}%`} sub={fmt$(a.trailing12) + ' trailing 12mo'} positive={a.yoy != null && a.yoy >= 0}/>
            <Kpi label="Average job value" value={fmt$(a.avgJobValue)} sub={a.avgJobDelta == null ? '90-day avg' : `${a.avgJobDelta >= 0 ? '+' : ''}${a.avgJobDelta}% vs prior 90d`} positive={a.avgJobDelta != null && a.avgJobDelta >= 0}/>
            <Kpi label="Lead conversion" value={a.conversion == null ? '—' : `${a.conversion}%`} sub="of closed leads won"/>
          </div>

          <div style={cardStyle}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.08em',color:'#7a8db0',marginBottom:10}}>REVENUE — TRAILING 12 MONTHS</div>
            <BarChart data={a.months12} max={a.maxMonthRev} color="#4f9eff"/>
          </div>
        </Section>

        <Section title="Job Intelligence">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:10}}>
            <div style={cardStyle}>
              <div style={cardHeader}>MOST PROFITABLE JOBS</div>
              {a.profitable.length === 0
                ? <Empty>No completed-and-invoiced jobs yet.</Empty>
                : a.profitable.map(j => (
                    <Row key={j.id} title={j.title} sub={`${fmt$(j.revenue)} rev`} pill={`${j.margin_pct}% margin`} pillColor="#2edf87"/>
                  ))
              }
            </div>

            <div style={cardStyle}>
              <div style={cardHeader}>MOST COMMON JOB TYPES</div>
              {a.topTypes.length === 0
                ? <Empty>No completed jobs yet.</Empty>
                : a.topTypes.map(t => (
                    <Row key={t.title} title={t.title} sub="" pill={`${t.count} job${t.count === 1 ? '' : 's'}`} pillColor="#4f9eff"/>
                  ))
              }
            </div>

            <div style={cardStyle}>
              <div style={cardHeader}>SEASONALITY</div>
              <Stat label="Best month historically"   value={a.bestMonth || '—'}/>
              <Stat label="Slowest month historically" value={a.slowMonth || '—'}/>
              <Stat label="Predicted slow month ahead" value={a.upcomingSlow || '—'} hint="Of the next 3 months, this one has the lowest historical revenue. Plan promotions or maintenance work."/>
            </div>

            <div style={cardStyle}>
              <div style={cardHeader}>JOBS THAT LOST MONEY</div>
              {a.unprofitable.length === 0
                ? <Empty>None — every invoiced job covered its costs.</Empty>
                : a.unprofitable.map(j => (
                    <Row key={j.id} title={j.title} sub={`${fmt$(j.revenue)} in, ${fmt$(j.cost)} out`} pill={fmt$(j.margin)} pillColor="#f26060"/>
                  ))
              }
            </div>
          </div>
        </Section>

        <Section title="Customer Intelligence">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:10,marginBottom:10}}>
            <div style={cardStyle}>
              <div style={cardHeader}>TOP CUSTOMERS BY LIFETIME VALUE</div>
              {a.topCustomers.length === 0
                ? <Empty>No paying customers yet.</Empty>
                : a.topCustomers.map(c => (
                    <Row key={c.id} title={c.name} sub="" pill={fmt$(c.total)} pillColor="#fbbf24"/>
                  ))
              }
            </div>

            <div style={cardStyle}>
              <div style={cardHeader}>QUIET CUSTOMERS — 60+ DAYS</div>
              <div style={{fontSize:12,color:'#7a8db0',marginBottom:8}}>Send a follow-up. These customers paid before and have gone silent.</div>
              {a.dormantCustomers.length === 0
                ? <Empty>Everyone's been active lately.</Empty>
                : a.dormantCustomers.map(c => (
                    <Row key={c.id} title={c.name} sub={`last seen ${fmtDate(c.last_seen)}`} pill={fmt$(c.total)} pillColor="#a78bfa"/>
                  ))
              }
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
            <Kpi label="Average lifetime value" value={fmt$(a.avgLTV)} sub="per paying customer"/>
            <Kpi label="Repeat customers" value={a.repeatCount.toString()} sub={`${a.oneTimeCount} one-time, ${a.repeatCount + a.oneTimeCount} total`}/>
            <Kpi label="Repeat rate" value={a.repeatCount + a.oneTimeCount > 0 ? `${Math.round((a.repeatCount / (a.repeatCount + a.oneTimeCount)) * 100)}%` : '—'} sub="of paying customers"/>
          </div>
        </Section>

        <Section title="Expense Intelligence">
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:10,marginBottom:10}}>
            <div style={cardStyle}>
              <div style={cardHeader}>BIGGEST CATEGORIES</div>
              {a.expCatList.length === 0
                ? <Empty>No expenses logged.</Empty>
                : a.expCatList.slice(0, 6).map(cat => {
                    const pct = a.totalExpAllTime > 0 ? Math.round((cat.total / a.totalExpAllTime) * 100) : 0;
                    return (
                      <div key={cat.category} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #2e3f60'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'#f0f4ff',textTransform:'capitalize'}}>{cat.category}</div>
                          <div style={{flex:1,height:6,background:'#0d1726',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pct}%`,background:'#f26060'}}/>
                          </div>
                        </div>
                        <div style={{fontSize:12,color:'#c8d4ee',fontWeight:600,marginLeft:10,fontVariantNumeric:'tabular-nums'}}>{fmt$(cat.total)}</div>
                      </div>
                    );
                  })
              }
            </div>

            <div style={cardStyle}>
              <div style={cardHeader}>MONTH-OVER-MONTH TREND</div>
              <BarChart data={a.expBy6.map(m => ({ label: m.label, revenue: m.total }))} max={a.maxExp6} color="#f26060"/>
            </div>
          </div>

          <Kpi label="Expenses as % of revenue" value={`${a.expPctOfRev}%`} sub="trailing 12 months — lower is healthier"/>
        </Section>

        <Section title="AI Coach">
          <CoachCard status={coachStatus} row={coachRow}/>
        </Section>
      </main>
    </div>
  );
}

// ---------- UI helpers ----------

function Section({ title, children }) {
  return (
    <div style={{marginTop:28}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.08em',color:'#f0f4ff',marginBottom:10}}>{title.toUpperCase()}</div>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, positive }) {
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'12px 14px'}}>
      <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:'#f0f4ff',letterSpacing:'.02em',lineHeight:1.1,marginTop:4}}>{value}</div>
      {sub && <div style={{fontSize:11,color: positive == null ? '#7a8db0' : (positive ? '#2edf87' : '#f26060'),marginTop:3,fontWeight:600}}>{sub}</div>}
    </div>
  );
}

function Row({ title, sub, pill, pillColor }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #2e3f60',gap:10}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textTransform: title.length > 0 && title === title.toLowerCase() ? 'capitalize' : 'none'}}>{title}</div>
        {sub && <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{sub}</div>}
      </div>
      <span style={{background:pillColor + '22',color:pillColor,border:'1px solid ' + pillColor + '66',borderRadius:999,padding:'3px 10px',fontSize:11,fontWeight:700,letterSpacing:'.04em',whiteSpace:'nowrap'}}>{pill}</span>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div style={{padding:'8px 0',borderBottom:'1px solid #2e3f60'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
        <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.04em'}}>{label}</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#f0f4ff'}}>{value}</div>
      </div>
      {hint && <div style={{fontSize:11,color:'#7a8db0',marginTop:4,lineHeight:1.4}}>{hint}</div>}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{fontSize:12,color:'#7a8db0',padding:'12px 0',textAlign:'center'}}>{children}</div>;
}

function BarChart({ data, max, color }) {
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height:140,paddingTop:8}}>
      {data.map((m, i) => {
        const h = Math.max(2, Math.round((m.revenue / (max || 1)) * 120));
        return (
          <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
            <div title={fmt$(m.revenue)} style={{width:'100%',background:color,height:h,borderRadius:4,opacity:m.revenue > 0 ? 1 : 0.18}}/>
            <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.04em'}}>{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function CoachCard({ status, row }) {
  if (status.phase === 'idle' || status.phase === 'generating') {
    return (
      <div style={cardStyle}>
        <div style={{padding:'28px 12px',textAlign:'center',color:'#7a8db0'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.08em',color:'#f0f4ff',marginBottom:8}}>
            {status.phase === 'generating' ? 'GENERATING THIS MONTH’S ANALYSIS…' : 'PREPARING ANALYSIS…'}
          </div>
          <div style={{fontSize:12}}>This takes about 10–20 seconds the first time you open Insights each month.</div>
        </div>
      </div>
    );
  }

  if (status.phase === 'not_ready') {
    return (
      <div style={cardStyle}>
        <div style={{padding:'24px 12px',textAlign:'center'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',color:'#fbbf24',marginBottom:8}}>AI COACH UNLOCKS SOON</div>
          <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.6,maxWidth:480,margin:'0 auto'}}>
            The Coach needs at least 3 months of operating data to give recommendations worth acting on.
            You're <strong style={{color:'#f0f4ff'}}>{status.months_complete} of 3 months</strong> in —
            <strong style={{color:'#f0f4ff'}}> {status.months_to_go} more month{status.months_to_go === 1 ? '' : 's'} to go.</strong>
          </div>
        </div>
      </div>
    );
  }

  if (status.phase === 'error') {
    return (
      <div style={{...cardStyle, borderColor:'#f2606066'}}>
        <div style={{padding:'18px 12px',textAlign:'center',color:'#f26060',fontSize:13}}>
          Couldn't generate this month's analysis: {status.message}
        </div>
      </div>
    );
  }

  if (status.phase === 'ready' && row) {
    return (
      <div style={cardStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12,paddingBottom:10,borderBottom:'1px solid #2e3f60'}}>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>Last analysis</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#f0f4ff',letterSpacing:'.04em'}}>{new Date(row.generated_at).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>Next run</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#f0f4ff',letterSpacing:'.04em'}}>{nextRunDateLabel()}</div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {(row.recommendations || []).map((rec, i) => {
            const color = AREA_COLOR[rec.area] || '#4f9eff';
            return (
              <div key={i} style={{borderLeft:`3px solid ${color}`,padding:'10px 14px',background:'#0d1726',borderRadius:'0 8px 8px 0'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{background:color + '22',color:color,border:`1px solid ${color}66`,borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>{AREA_LABEL[rec.area] || rec.area}</span>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:'.04em',color:'#f0f4ff'}}>{rec.title}</div>
                </div>
                <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55}}>{rec.body}</div>
              </div>
            );
          })}
        </div>

        <div style={{fontSize:11,color:'#7a8db0',marginTop:12,textAlign:'center',lineHeight:1.5}}>
          Generated by Claude using your real business data. A new analysis runs automatically on the 1st of each month.
        </div>
      </div>
    );
  }

  return null;
}

const cardStyle = { background:'#1e2a42', border:'1px solid #2e3f60', borderRadius:12, padding:'14px 16px' };
const cardHeader = { fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:'.08em', color:'#7a8db0', marginBottom:8 };
