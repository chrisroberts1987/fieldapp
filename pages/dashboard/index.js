import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { fmt$ } from '../../lib/helpers';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ activeJobs:0, unpaidInvoices:0, revenueMonth:0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      loadStats(session.user.id);
    });
  }, []);

  const loadStats = async (uid) => {
    setStatsLoading(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const end   = new Date(now.getFullYear(), now.getMonth()+1, 1).toISOString().slice(0,10);

    const [active, unpaid, paid] = await Promise.all([
      supabase.from('jobs').select('id', { count:'exact', head:true })
        .eq('owner_id', uid).in('status', ['scheduled','in_progress']),
      supabase.from('invoices').select('id', { count:'exact', head:true })
        .eq('owner_id', uid).eq('status', 'unpaid'),
      supabase.from('invoices').select('amount')
        .eq('owner_id', uid).eq('status', 'paid')
        .gte('paid_date', start).lt('paid_date', end),
    ]);

    const revenueMonth = (paid.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    setStats({
      activeJobs: active.count || 0,
      unpaidInvoices: unpaid.count || 0,
      revenueMonth,
    });
    setStatsLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user) return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>
      Loading...
    </div>
  );

  const monthLabel = new Date().toLocaleString(undefined, { month:'long' });

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <div style={{background:'#1a2236',borderBottom:'1.5px solid #2e3f60',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'.1em'}}>FIELDAPP</div>
        <button onClick={signOut} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#7a8db0',padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600}}>
          Sign Out
        </button>
      </div>
      <div style={{padding:20}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:6}}>DASHBOARD</div>
        <div style={{fontSize:13,color:'#7a8db0',marginBottom:20}}>Welcome, {user.email}</div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          <StatCard
            label="Active Jobs"
            value={statsLoading ? '—' : stats.activeJobs}
            color="#4f9eff"
            onClick={() => router.push('/jobs')}
          />
          <StatCard
            label="Unpaid Invoices"
            value={statsLoading ? '—' : stats.unpaidInvoices}
            color="#fbbf24"
            onClick={() => router.push('/invoices')}
          />
        </div>
        <div style={{marginBottom:24}}>
          <StatCard
            label={`Revenue · ${monthLabel}`}
            value={statsLoading ? '—' : fmt$(stats.revenueMonth)}
            color="#2edf87"
            onClick={() => router.push('/invoices')}
            big
          />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
          {[
            { label:'Customers', color:'#54d4f8', route:'/customers' },
            { label:'Jobs',      color:'#4f9eff', route:'/jobs' },
            { label:'Invoices',  color:'#2edf87', route:'/invoices' },
            { label:'Crew',      color:'#fb923c', route:'/crew' },
            { label:'Insights',  color:'#b197fc', route:'/insights' },
          ].map(item => (
            <div key={item.label}
              onClick={() => router.push(item.route)}
              style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'20px 16px',cursor:'pointer',transition:'border-color .15s'}}
              onMouseOver={e => e.currentTarget.style.borderColor=item.color}
              onMouseOut={e => e.currentTarget.style.borderColor='#2e3f60'}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',color:item.color}}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick, big }) {
  return (
    <div onClick={onClick}
      style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding: big ? '16px 18px' : '14px 14px',cursor:'pointer',transition:'border-color .15s'}}
      onMouseOver={e => e.currentTarget.style.borderColor=color}
      onMouseOut={e => e.currentTarget.style.borderColor='#2e3f60'}>
      <div style={{fontSize:11,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize: big ? 36 : 28,letterSpacing:'.04em',color}}>{value}</div>
    </div>
  );
}
