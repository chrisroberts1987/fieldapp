import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isForeman, isSupervisor, isCrew, isOffice, roleLabel } from '../../lib/role';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { isBlocked } from '../../lib/billing';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, role, loading: orgLoading } = useOrg(user);
  const [stats, setStats] = useState(null);
  const [crewData, setCrewData] = useState(null); // for supervisor/crew views

  const loadStats = async (oid) => {
    const now = new Date();
    const today = todayStr();
    const ytdStart     = new Date(now.getFullYear(), 0,                  1).toISOString().slice(0,10);
    const monthStartIso = new Date(now.getFullYear(), now.getMonth(),    1).toISOString().slice(0,10);
    const lastMonthStartIso = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0,10);
    const thirtyAgo    = new Date(now.getTime() - 30*24*3600*1000).toISOString().slice(0,10);
    const sevenAgo     = new Date(now.getTime() -  7*24*3600*1000).toISOString().slice(0,10);

    const [
      activeJobs, openLeads, customers, unpaidInvoices,
      paidThisMonth, paidLastMonth, paidYtd, expThisMonth, expLastMonth, expYtd,
      overdueInvoices, sentQuotes, staleLeads, pendingExp, pendingMi,
      todayJobs,
    ] = await Promise.all([
      supabase.from('jobs').select('id', { count:'exact', head:true })
        .eq('org_id', oid).in('status', ['scheduled','in_progress']),
      supabase.from('leads').select('id', { count:'exact', head:true })
        .eq('org_id', oid).in('status', ['new','contacted','qualified']),
      supabase.from('customers').select('id', { count:'exact', head:true })
        .eq('org_id', oid),
      supabase.from('invoices').select('amount')
        .eq('org_id', oid).eq('status', 'unpaid'),
      supabase.from('invoices').select('amount').eq('org_id', oid).eq('status', 'paid').gte('paid_date', monthStartIso),
      supabase.from('invoices').select('amount').eq('org_id', oid).eq('status', 'paid').gte('paid_date', lastMonthStartIso).lt('paid_date', monthStartIso),
      supabase.from('invoices').select('amount').eq('org_id', oid).eq('status', 'paid').gte('paid_date', ytdStart),
      supabase.from('expenses').select('amount').eq('org_id', oid).gte('expense_date', monthStartIso),
      supabase.from('expenses').select('amount').eq('org_id', oid).gte('expense_date', lastMonthStartIso).lt('expense_date', monthStartIso),
      supabase.from('expenses').select('amount').eq('org_id', oid).gte('expense_date', ytdStart),
      supabase.from('invoices').select('id, amount, issued_date')
        .eq('org_id', oid).eq('status', 'unpaid').lt('issued_date', thirtyAgo)
        .order('issued_date', { ascending:true }).limit(50),
      supabase.from('quotes').select('id, customer_name, amount, sent_at')
        .eq('org_id', oid).eq('status', 'sent')
        .order('sent_at', { ascending:true }).limit(50),
      supabase.from('leads').select('id, name, status, created_at, follow_up_date')
        .eq('org_id', oid).in('status', ['new','contacted'])
        .or(`created_at.lt.${sevenAgo},follow_up_date.lte.${today}`)
        .order('created_at', { ascending:true }).limit(50),
      supabase.from('expenses').select('id', { count:'exact', head:true })
        .eq('org_id', oid).eq('approval_status', 'pending'),
      supabase.from('mileage_logs').select('id', { count:'exact', head:true })
        .eq('org_id', oid).eq('approval_status', 'pending'),
      supabase.from('jobs').select('id, title, customer_id, status')
        .eq('org_id', oid).eq('scheduled_date', today).in('status', ['scheduled','in_progress'])
        .order('created_at', { ascending:true }).limit(20),
    ]);

    const sumAmt = rs => (rs.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const revenueMonth      = sumAmt(paidThisMonth);
    const revenueLastMonth  = sumAmt(paidLastMonth);
    const ytdRevenue        = sumAmt(paidYtd);
    const expensesMonth     = sumAmt(expThisMonth);
    const expensesLastMonth = sumAmt(expLastMonth);
    const ytdExpenses       = sumAmt(expYtd);
    const outstandingSum    = sumAmt(unpaidInvoices);
    const ytdPaidCount      = (paidYtd.data || []).length;

    setStats({
      revenueMonth, revenueLastMonth,
      expensesMonth, expensesLastMonth,
      netIncomeMonth:     revenueMonth - expensesMonth,
      netIncomeLastMonth: revenueLastMonth - expensesLastMonth,
      openLeads:        openLeads.count || 0,
      activeJobs:       activeJobs.count || 0,
      unpaidCount:      unpaidInvoices.data?.length || 0,
      outstandingSum,
      customers:        customers.count || 0,
      ytdRevenue,
      ytdExpenses,
      ytdNetIncome:     ytdRevenue - ytdExpenses,
      ytdInvoiceCount:  ytdPaidCount,
      avgInvoice:       ytdPaidCount > 0 ? ytdRevenue / ytdPaidCount : 0,
      // Action-needed feed
      overdue:          overdueInvoices.data || [],
      sentQuotes:       sentQuotes.data || [],
      staleLeads:       staleLeads.data || [],
      pendingApprovals: (pendingExp.count || 0) + (pendingMi.count || 0),
      todayJobs:        todayJobs.data || [],
    });
  };

  const loadCrewData = async (oid) => {
    const today = todayStr();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
    const [myJobs, todayJobs, poolJobs, pendingExp, pendingMi, myMileage, members] = await Promise.all([
      supabase.from('jobs').select('id, title, status, scheduled_date, customer_id, price').eq('org_id', oid).eq('assigned_to_user_id', user.id).in('status', ['scheduled','in_progress']).order('scheduled_date', { ascending:true, nullsFirst:false }),
      supabase.from('jobs').select('id, title, customer_id, status').eq('org_id', oid).eq('assigned_to_user_id', user.id).eq('scheduled_date', today),
      supabase.from('jobs').select('id', { count:'exact', head:true }).eq('org_id', oid).is('assigned_to_user_id', null).in('status', ['scheduled','in_progress']),
      supabase.from('expenses').select('id', { count:'exact', head:true }).eq('org_id', oid).eq('approval_status', 'pending'),
      supabase.from('mileage_logs').select('id', { count:'exact', head:true }).eq('org_id', oid).eq('approval_status', 'pending'),
      supabase.from('mileage_logs').select('miles').eq('org_id', oid).eq('user_id', user.id).gte('log_date', monthStart),
      supabase.from('org_members').select('user_id', { count:'exact', head:true }).eq('org_id', oid),
    ]);
    setCrewData({
      myJobs: myJobs.data || [],
      todayJobs: todayJobs.data || [],
      poolCount: poolJobs.count || 0,
      pendingExpenses: pendingExp.count || 0,
      pendingMileage: pendingMi.count || 0,
      myMilesMonth: (myMileage.data || []).reduce((s, m) => s + Number(m.miles || 0), 0),
      crewSize: members.count || 0,
    });
  };

  const refetchStats = () => {
    if (!orgId) return;
    if (isForeman(role)) loadStats(orgId);
    else loadCrewData(orgId);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      // Platform owner doesn't have a tenant org — send them to admin.
      if ((session.user.email || '').toLowerCase() === 'chris.roberts@myforemanhq.com') {
        router.push('/admin');
        return;
      }
      setUser(session.user);
      const token = typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('myforeman_post_signup_invite') : null;
      if (token) {
        supabase.rpc('accept_invite', { p_token: token }).finally(() => {
          sessionStorage.removeItem('myforeman_post_signup_invite');
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!orgId) {
      if (user && !orgLoading) router.push('/onboarding');
      return;
    }
    if (!role) return;
    // Trial ran out without a paid plan, or subscription was canceled
    // / expired — punt the owner straight to billing so they can fix
    // it. Crew + supervisor still get the dashboard so they can keep
    // working while the foreman sorts billing.
    if (isForeman(role) && isBlocked(org)) {
      router.push('/billing');
      return;
    }
    if (isForeman(role)) loadStats(orgId);
    else loadCrewData(orgId);
  }, [orgId, orgLoading, role, org?.subscription_status, org?.trial_ends_at]);

  useRefetchOnFocus(refetchStats, !!(orgId && role));

  // Foreman uses the rich financial stats; others use crewData.
  const ready = isForeman(role) ? stats : crewData;

  if (!user || orgLoading || !ready) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/dashboard"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0',fontSize:14}}>Loading dashboard...</div>
      </div>
    );
  }

  // Crew / Supervisor get a slimmed dashboard. No revenue, no tax estimates.
  if (!isForeman(role)) {
    return <SimpleDashboard role={role} user={user} org={org} crewData={crewData} router={router}/>;
  }

  const taxRate    = Number(org?.income_tax_rate || 25);
  const estTaxYtd  = Math.max(0, stats.ytdNetIncome) * taxRate / 100;
  const monthName  = new Date().toLocaleString(undefined, { month:'long' });
  const netDelta   = stats.netIncomeLastMonth !== 0
    ? ((stats.netIncomeMonth - stats.netIncomeLastMonth) / Math.abs(stats.netIncomeLastMonth)) * 100
    : (stats.netIncomeMonth !== 0 ? null : 0);
  const netColor   = stats.netIncomeMonth >= 0 ? '#2edf87' : '#f26060';
  const ytdNetColor = stats.ytdNetIncome >= 0 ? '#2edf87' : '#f26060';

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/dashboard"/>

      <main style={{maxWidth:1280,margin:'0 auto',padding:'28px 20px 0'}}>

        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Overview</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>
            {(org?.name || 'Your Business').toUpperCase()}
          </h1>
          <div style={{fontSize:13,color:'#7a8db0',marginTop:2}}>Signed in as {user.email}</div>
        </div>

        {/* Hero: net income */}
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:14,marginBottom:14}}>
          <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'24px 22px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at top right, ${netColor}1a, transparent 60%)`,pointerEvents:'none'}}/>
            <div style={{position:'relative'}}>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Net Income · {monthName}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:12,flexWrap:'wrap'}}>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:64,letterSpacing:'.02em',lineHeight:1,color:netColor}}>
                  {fmt$(stats.netIncomeMonth)}
                </div>
                {netDelta !== null && netDelta !== 0 && <DeltaPill value={netDelta}/>}
              </div>
              <div style={{marginTop:10,display:'flex',gap:18,flexWrap:'wrap',fontSize:13,color:'#c8d4ee'}}>
                <span>Revenue: <span style={{color:'#2edf87',fontWeight:600}}>{fmt$(stats.revenueMonth)}</span></span>
                <span>Expenses: <span style={{color:'#f26060',fontWeight:600}}>{fmt$(stats.expensesMonth)}</span></span>
                <span style={{color:'#7a8db0'}}>Last month net: <span style={{color:'#f0f4ff',fontWeight:600}}>{fmt$(stats.netIncomeLastMonth)}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="kpi-strip" style={{marginBottom:14}}>
          <Kpi label="Open Leads"      value={stats.openLeads}      color="#54d4f8" onClick={() => router.push('/leads')}/>
          <Kpi label="Active Jobs"     value={stats.activeJobs}     color="#4f9eff" onClick={() => router.push('/jobs')}/>
          <Kpi label="Unpaid Invoices" value={stats.unpaidCount}    color="#fbbf24" onClick={() => router.push('/invoices')}/>
          <Kpi label="Customers"       value={stats.customers}      color="#b197fc" onClick={() => router.push('/customers')}/>
        </div>

        {/* Financial overview */}
        <SectionHeader title="Financials" subtitle="Year to date" />
        <div data-tour="dashboard-financials">
          <div className="finance-grid" style={{marginBottom:14}}>
            <FinanceCard label="YTD Revenue"  value={fmt$(stats.ytdRevenue)}   color="#2edf87" sub={`${stats.ytdInvoiceCount} invoiced`} onClick={() => router.push('/invoices')}/>
            <FinanceCard label="YTD Expenses" value={fmt$(stats.ytdExpenses)}  color="#f26060" onClick={() => router.push('/expenses')}/>
            <FinanceCard label="YTD Net Income" value={fmt$(stats.ytdNetIncome)} color={ytdNetColor}/>
            <FinanceCard label="Est. Tax YTD" value={fmt$(estTaxYtd)}          color="#fbbf24" sub={`${taxRate}% of net`} onClick={() => router.push('/tax')}/>
          </div>

          <div className="finance-grid" style={{marginBottom:28}}>
            <FinanceCard label="Outstanding"  value={fmt$(stats.outstandingSum)} color="#fbbf24" sub={`${stats.unpaidCount} unpaid`} onClick={() => router.push('/invoices')}/>
            <FinanceCard label="Avg Invoice"  value={fmt$(stats.avgInvoice)}     color="#4f9eff" sub={`${stats.ytdInvoiceCount} invoiced`}/>
          </div>
        </div>

        {/* Action feed */}
        <ActionFeed stats={stats} router={router} />
      </main>

      <style jsx global>{`
        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .finance-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (min-width: 720px) {
          .kpi-strip { grid-template-columns: repeat(4, 1fr); gap: 14px; }
          .finance-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
        }
      `}</style>
    </div>
  );
}

function SimpleDashboard({ role, user, org, crewData, router }) {
  const supervisor = isSupervisor(role);
  const greeting = supervisor ? 'Supervisor view' : 'Your day';

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/dashboard"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>{greeting}</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>
            {(org?.name || 'Your business').toUpperCase()}
          </h1>
          <div style={{fontSize:13,color:'#7a8db0',marginTop:2}}>Signed in as {user.email} · <span style={{color:'#4f9eff',fontWeight:600}}>{roleLabel(role)}</span></div>
        </div>

        <div className="kpi-strip" style={{marginBottom:18}}>
          <Kpi label="My Jobs Today"      value={crewData.todayJobs.length}  color="#4f9eff" onClick={() => router.push('/jobs')}/>
          <Kpi label="Active Jobs"        value={crewData.myJobs.length}     color="#2edf87" onClick={() => router.push('/jobs')}/>
          {supervisor
            ? <Kpi label="Pending Approvals" value={crewData.pendingExpenses + crewData.pendingMileage} color="#fbbf24" onClick={() => router.push('/approvals')}/>
            : <Kpi label="Jobs in Pool"      value={crewData.poolCount}      color="#fbbf24" onClick={() => router.push('/jobs')}/>}
          {supervisor
            ? <Kpi label="Crew Size"      value={crewData.crewSize}          color="#b197fc" onClick={() => router.push('/crew')}/>
            : <Kpi label="Miles This Month" value={crewData.myMilesMonth.toFixed(1)} color="#54d4f8" onClick={() => router.push('/mileage')}/>}
        </div>

        {/* Today's jobs */}
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:10}}>{supervisor ? "TODAY'S CREW JOBS" : "TODAY'S JOBS"}</div>
        {crewData.todayJobs.length === 0 ? (
          <div style={{background:'#1e2a42',border:'1px dashed #2e3f60',borderRadius:12,padding:'20px',textAlign:'center',color:'#7a8db0',fontSize:13,marginBottom:18}}>
            Nothing scheduled for today.
            {!supervisor && crewData.poolCount > 0 && <> <a onClick={() => router.push('/jobs')} style={{color:'#4f9eff',cursor:'pointer',fontWeight:700}}>{crewData.poolCount} job{crewData.poolCount===1?'':'s'} in the pool</a> waiting to be claimed.</>}
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
            {crewData.todayJobs.map(j => (
              <div key={j.id} onClick={() => router.push('/jobs')}
                style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 14px',cursor:'pointer'}}>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff'}}>{j.title}</div>
                <div style={{fontSize:11,color:'#7a8db0',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>{j.status}</div>
              </div>
            ))}
          </div>
        )}

        {/* Active jobs list */}
        {crewData.myJobs.length > 0 && (
          <>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:10}}>{supervisor ? 'ACTIVE JOBS' : 'MY ACTIVE JOBS'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
              {crewData.myJobs.slice(0, 8).map(j => (
                <div key={j.id} onClick={() => router.push('/jobs')}
                  style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.title}</div>
                  <div style={{fontSize:11,color:'#7a8db0',whiteSpace:'nowrap'}}>{j.scheduled_date ? fmtDate(j.scheduled_date) : 'No date'}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Quick actions */}
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:10}}>QUICK ACTIONS</div>
        <div className="kpi-strip" style={{marginBottom:24}}>
          <ActionTile label="Log Mileage"  onClick={() => router.push('/mileage')}  color="#54d4f8"/>
          <ActionTile label="Log Expense"  onClick={() => router.push('/expenses')} color="#f26060"/>
          <ActionTile label="See Jobs"     onClick={() => router.push('/jobs')}     color="#4f9eff"/>
          {supervisor && <ActionTile label="Review Approvals" onClick={() => router.push('/approvals')} color="#fbbf24"/>}
        </div>
      </main>

      <style jsx global>{`
        .kpi-strip { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 720px) { .kpi-strip { grid-template-columns: repeat(4, 1fr); gap: 14px; } }
      `}</style>
    </div>
  );
}

function ActionTile({ label, onClick, color }) {
  return (
    <div onClick={onClick}
      style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'18px 14px',cursor:'pointer',transition:'border-color .15s',textAlign:'center'}}
      onMouseOver={e => e.currentTarget.style.borderColor = color}
      onMouseOut={e => e.currentTarget.style.borderColor = '#2e3f60'}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',color}}>{label.toUpperCase()}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10,marginTop:14}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff'}}>{title.toUpperCase()}</div>
      {subtitle && <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>{subtitle}</div>}
    </div>
  );
}

function Kpi({ label, value, color, onClick }) {
  return (
    <div onClick={onClick}
      style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px',cursor:onClick?'pointer':'default',transition:'border-color .15s'}}
      onMouseOver={e => onClick && (e.currentTarget.style.borderColor = color)}
      onMouseOut={e => e.currentTarget.style.borderColor = '#2e3f60'}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,letterSpacing:'.02em',color}}>{value}</div>
    </div>
  );
}

function FinanceCard({ label, value, color, sub, onClick }) {
  return (
    <div onClick={onClick}
      style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'16px 16px',cursor:onClick?'pointer':'default',transition:'border-color .15s'}}
      onMouseOver={e => onClick && (e.currentTarget.style.borderColor = color)}
      onMouseOut={e => e.currentTarget.style.borderColor = '#2e3f60'}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.02em',color}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>{sub}</div>}
    </div>
  );
}

function DeltaPill({ value }) {
  const up = value >= 0;
  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:4,
      background: up ? 'rgba(46,223,135,0.12)' : 'rgba(242,96,96,0.12)',
      color: up ? '#2edf87' : '#f26060',
      border:'1px solid ' + (up ? '#2edf8755' : '#f2606055'),
      padding:'4px 9px',borderRadius:999,
      fontSize:12,fontWeight:700,letterSpacing:'.05em',
    }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function ActionFeed({ stats, router }) {
  const today = todayStr();
  const daysOverdue = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

  const items = [];

  for (const inv of stats.overdue) {
    items.push({
      key: 'inv-' + inv.id,
      color: '#f26060',
      tag: 'Overdue',
      title: `${fmt$(inv.amount)} unpaid · ${daysOverdue(inv.issued_date)} days`,
      sub: `Invoice issued ${fmtDate(inv.issued_date)}`,
      cta: 'Send reminder',
      onClick: () => router.push(`/invoices/${inv.id}`),
      sortBy: -daysOverdue(inv.issued_date), // most overdue first
    });
  }

  if (stats.pendingApprovals > 0) {
    items.push({
      key: 'approvals',
      color: '#fbbf24',
      tag: 'Review',
      title: `${stats.pendingApprovals} crew submission${stats.pendingApprovals === 1 ? '' : 's'} waiting`,
      sub: 'Expenses and mileage from your crew',
      cta: 'Open approvals',
      onClick: () => router.push('/approvals'),
      sortBy: -40,
    });
  }

  for (const q of stats.sentQuotes) {
    const days = q.sent_at ? daysOverdue(q.sent_at) : 0;
    items.push({
      key: 'quote-' + q.id,
      color: '#4f9eff',
      tag: 'Awaiting',
      title: `${q.customer_name} · ${fmt$(q.amount)}`,
      sub: `Quote sent ${days} day${days === 1 ? '' : 's'} ago, no response`,
      cta: 'Follow up',
      onClick: () => router.push(`/quotes/${q.id}`),
      sortBy: -(20 + days),
    });
  }

  for (const l of stats.staleLeads) {
    const days = daysOverdue(l.created_at);
    const overdueFollowUp = l.follow_up_date && l.follow_up_date <= today;
    items.push({
      key: 'lead-' + l.id,
      color: '#54d4f8',
      tag: overdueFollowUp ? 'Follow up' : 'Stale',
      title: l.name,
      sub: overdueFollowUp
        ? `Follow-up was scheduled for ${fmtDate(l.follow_up_date)}`
        : `${l.status} for ${days} day${days === 1 ? '' : 's'} — no movement`,
      cta: 'Open lead',
      onClick: () => router.push('/leads'),
      sortBy: -(10 + days),
    });
  }

  for (const j of stats.todayJobs) {
    items.push({
      key: 'today-' + j.id,
      color: '#2edf87',
      tag: 'Today',
      title: j.title,
      sub: `Scheduled for today · ${j.status}`,
      cta: 'View job',
      onClick: () => router.push('/jobs'),
      sortBy: 0,
    });
  }

  items.sort((a, b) => a.sortBy - b.sortBy);

  return (
    <>
      <SectionHeader title="Action Needed" subtitle={items.length === 0 ? 'All caught up' : `${items.length} item${items.length === 1 ? '' : 's'}`} />
      <div data-tour="action-feed" style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,marginBottom:28,overflow:'hidden'}}>
        {items.length === 0 ? (
          <div style={{padding:'40px 24px',textAlign:'center',color:'#7a8db0'}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#2edf87',marginBottom:6}}>YOU'RE CLEAR</div>
            <div style={{fontSize:13}}>Nothing overdue, no quotes hanging, no submissions waiting. Go run the business.</div>
          </div>
        ) : (
          items.slice(0, 20).map(it => (
            <div key={it.key} onClick={it.onClick}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderTop:'1px solid #2e3f60',cursor:'pointer'}}
              onMouseOver={e => e.currentTarget.style.background = '#243355'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{width:8,height:8,borderRadius:4,background:it.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{background:it.color + '22',color:it.color,border:'1px solid ' + it.color + '66',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>{it.tag}</span>
                  <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.title}</div>
                </div>
                <div style={{fontSize:12,color:'#7a8db0',marginTop:3}}>{it.sub}</div>
              </div>
              <div style={{fontSize:11,color:it.color,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase',whiteSpace:'nowrap'}}>{it.cta} →</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
