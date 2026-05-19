import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { fmt$ } from '../../lib/helpers';
import TopNav from '../../components/TopNav';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId) loadStats(orgId);
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  const loadStats = async (oid) => {
    const now = new Date();
    const monthStart   = new Date(now.getFullYear(), now.getMonth(),     1);
    const ytdStart     = new Date(now.getFullYear(), 0,                  1).toISOString().slice(0,10);
    const sixMoStart   = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0,10);

    const [activeJobs, openLeads, customers, unpaidInvoices, paidLast6mo] = await Promise.all([
      supabase.from('jobs').select('id', { count:'exact', head:true })
        .eq('org_id', oid).in('status', ['scheduled','in_progress']),
      supabase.from('leads').select('id', { count:'exact', head:true })
        .eq('org_id', oid).in('status', ['new','contacted','qualified']),
      supabase.from('customers').select('id', { count:'exact', head:true })
        .eq('org_id', oid),
      supabase.from('invoices').select('amount')
        .eq('org_id', oid).eq('status', 'unpaid'),
      supabase.from('invoices').select('amount, paid_date')
        .eq('org_id', oid).eq('status', 'paid')
        .gte('paid_date', sixMoStart),
    ]);

    // Bucket paid invoices by YYYY-MM for the trailing 6 months.
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.push({
        key: d.toISOString().slice(0,7),
        label: d.toLocaleString(undefined, { month:'short' }),
        amount: 0,
      });
    }
    const paid = paidLast6mo.data || [];
    for (const inv of paid) {
      const k = (inv.paid_date || '').slice(0,7);
      const b = monthly.find(x => x.key === k);
      if (b) b.amount += Number(inv.amount || 0);
    }

    const ytdPaid = paid.filter(p => p.paid_date >= ytdStart);
    const ytdRevenue = ytdPaid.reduce((s, r) => s + Number(r.amount || 0), 0);
    const avgInvoice = ytdPaid.length > 0 ? ytdRevenue / ytdPaid.length : 0;
    const outstandingSum = (unpaidInvoices.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);

    setStats({
      revenueMonth:     monthly[5].amount,
      revenueLastMonth: monthly[4].amount,
      monthly,
      openLeads:        openLeads.count || 0,
      activeJobs:       activeJobs.count || 0,
      unpaidCount:      unpaidInvoices.data?.length || 0,
      outstandingSum,
      customers:        customers.count || 0,
      ytdRevenue,
      ytdInvoiceCount:  ytdPaid.length,
      avgInvoice,
    });
  };

  if (!user || orgLoading || !stats) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/dashboard"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0',fontSize:14}}>Loading dashboard...</div>
      </div>
    );
  }

  const taxRate    = Number(org?.income_tax_rate || 25);
  const estTaxYtd  = stats.ytdRevenue * taxRate / 100;
  const monthName  = new Date().toLocaleString(undefined, { month:'long' });
  const delta      = stats.revenueLastMonth > 0
    ? ((stats.revenueMonth - stats.revenueLastMonth) / stats.revenueLastMonth) * 100
    : (stats.revenueMonth > 0 ? null : 0);

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

        {/* Hero revenue */}
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:14,marginBottom:14}}>
          <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'24px 22px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at top right, rgba(46,223,135,0.10), transparent 60%)',pointerEvents:'none'}}/>
            <div style={{position:'relative'}}>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Revenue · {monthName}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:12,flexWrap:'wrap'}}>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:64,letterSpacing:'.02em',lineHeight:1,color:'#2edf87'}}>
                  {fmt$(stats.revenueMonth)}
                </div>
                {delta !== null && delta !== 0 && (
                  <DeltaPill value={delta}/>
                )}
              </div>
              <div style={{marginTop:8,fontSize:13,color:'#c8d4ee'}}>
                Last month: <span style={{color:'#f0f4ff',fontWeight:600}}>{fmt$(stats.revenueLastMonth)}</span>
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
        <div className="finance-grid" style={{marginBottom:28}}>
          <FinanceCard label="YTD Revenue"        value={fmt$(stats.ytdRevenue)} color="#2edf87"/>
          <FinanceCard label="Outstanding"        value={fmt$(stats.outstandingSum)} color="#fbbf24" sub={`${stats.unpaidCount} unpaid`}/>
          <FinanceCard label="Avg Invoice"        value={fmt$(stats.avgInvoice)} color="#4f9eff" sub={`${stats.ytdInvoiceCount} invoiced`}/>
          <FinanceCard label="Est. Tax YTD"       value={fmt$(estTaxYtd)} color="#f26060" sub={`${taxRate}% of revenue`} onClick={() => router.push('/tax')}/>
        </div>

        {/* Chart */}
        <SectionHeader title="Revenue trend" subtitle="Last 6 months" />
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'20px 18px 14px',marginBottom:28}}>
          <RevenueChart monthly={stats.monthly}/>
        </div>
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

function RevenueChart({ monthly }) {
  const max = Math.max(1, ...monthly.map(m => m.amount));
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:8,height:180}}>
      {monthly.map((m, i) => {
        const pct = (m.amount / max);
        const h = Math.max(6, pct * 100);
        const isCurrent = i === monthly.length - 1;
        const c = isCurrent ? '#2edf87' : '#4f9eff';
        return (
          <div key={m.key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,height:'100%'}}>
            <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',width:'100%'}}>
              <div style={{
                background: c + '33',
                border: '1px solid ' + c + '88',
                borderRadius:6,
                width:'100%',
                height: pct === 0 ? 6 : `${h}%`,
                minHeight: 6,
                position:'relative',
              }}>
                {m.amount > 0 && (
                  <div style={{position:'absolute',top:-22,left:0,right:0,textAlign:'center',fontSize:10,fontWeight:700,color:c,letterSpacing:'.02em'}}>
                    {fmt$(m.amount).replace(/\.00$/, '')}
                  </div>
                )}
              </div>
            </div>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',fontWeight:600,textTransform:'uppercase'}}>{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}
