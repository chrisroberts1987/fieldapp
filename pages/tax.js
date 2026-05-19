import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import { fmt$, fmtDate } from '../lib/helpers';
import TopNav from '../components/TopNav';

export default function Tax() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [year, setYear] = useState(new Date().getFullYear());
  const [paid, setPaid] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId) loadPaid(orgId, year);
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading, year]);

  const loadPaid = async (oid, y) => {
    const start = `${y}-01-01`;
    const end   = `${y+1}-01-01`;
    const { data } = await supabase.from('invoices')
      .select('amount, paid_date')
      .eq('org_id', oid).eq('status', 'paid')
      .gte('paid_date', start).lt('paid_date', end);
    setPaid(data || []);
  };

  if (!user || orgLoading || !paid) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/tax"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading tax view...</div>
      </div>
    );
  }

  const taxRate = Number(org?.income_tax_rate || 25);
  // IRS estimated-tax periods for the selected year.
  const quarters = [
    { label:'Q1', periodLabel:'Jan – Mar', start:`${year}-01-01`, end:`${year}-04-01`, due:new Date(year, 3, 15) },
    { label:'Q2', periodLabel:'Apr – May', start:`${year}-04-01`, end:`${year}-06-01`, due:new Date(year, 5, 15) },
    { label:'Q3', periodLabel:'Jun – Aug', start:`${year}-06-01`, end:`${year}-09-01`, due:new Date(year, 8, 15) },
    { label:'Q4', periodLabel:'Sep – Dec', start:`${year}-09-01`, end:`${year+1}-01-01`, due:new Date(year+1, 0, 15) },
  ].map(q => {
    const revenue = paid
      .filter(p => p.paid_date >= q.start && p.paid_date < q.end)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    return { ...q, revenue, taxDue: revenue * taxRate / 100 };
  });

  const ytdRevenue = paid.reduce((s, r) => s + Number(r.amount || 0), 0);
  const annualTax  = ytdRevenue * taxRate / 100;
  const totalPaid  = paid.length;

  const today      = new Date();
  const nextDue    = quarters.find(q => q.due >= today) || null;

  const isCurrent = (q) => today >= new Date(q.start) && today < new Date(q.end);
  const isPast    = (q) => today >= q.due;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/tax"/>

      <main style={{maxWidth:1280,margin:'0 auto',padding:'28px 20px 0'}}>

        <div style={{marginBottom:24,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Taxes</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>
              ESTIMATED TAXES · {year}
            </h1>
            <div style={{fontSize:13,color:'#7a8db0',marginTop:4}}>
              Tax rate: <span style={{color:'#f0f4ff',fontWeight:600}}>{taxRate}%</span> · <a onClick={() => router.push('/settings')} style={{color:'#4f9eff',cursor:'pointer',textDecoration:'underline'}}>change</a>
            </div>
          </div>
          <div style={{display:'flex',gap:6,background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:999,padding:4}}>
            <button onClick={() => setYear(year - 1)}
              style={{background:'transparent',border:'none',color:'#c8d4ee',padding:'6px 12px',borderRadius:999,cursor:'pointer',fontSize:12,fontWeight:700}}>
              ‹ {year - 1}
            </button>
            <span style={{background:'#4f9eff',color:'#fff',padding:'6px 14px',borderRadius:999,fontSize:12,fontWeight:700,letterSpacing:'.04em'}}>
              {year}
            </span>
            <button onClick={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()}
              style={{background:'transparent',border:'none',color: year >= new Date().getFullYear() ? '#3a4a6a' : '#c8d4ee',padding:'6px 12px',borderRadius:999,cursor: year >= new Date().getFullYear() ? 'default' : 'pointer',fontSize:12,fontWeight:700}}>
              {year + 1} ›
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:10,padding:'12px 14px',marginBottom:24,display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{color:'#fbbf24',fontSize:14,lineHeight:1.4}}>⚠</span>
          <div style={{fontSize:12,color:'#fbbf24',lineHeight:1.55}}>
            <strong>Estimate only.</strong> This is a rough projection based on paid revenue × your configured rate. It does not account for deductions, expenses, self-employment tax separately, or state tax. Talk to an accountant before filing.
          </div>
        </div>

        {/* Annual summary */}
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'24px 22px',marginBottom:24,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at top right, rgba(242,96,96,0.10), transparent 60%)',pointerEvents:'none'}}/>
          <div style={{position:'relative',display:'grid',gridTemplateColumns:'1fr',gap:18}} className="annual-grid">
            <div>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>{year} Revenue</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:48,letterSpacing:'.02em',lineHeight:1,color:'#2edf87'}}>{fmt$(ytdRevenue)}</div>
              <div style={{marginTop:6,fontSize:12,color:'#7a8db0'}}>{totalPaid} paid invoice{totalPaid===1?'':'s'}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Estimated Tax</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:48,letterSpacing:'.02em',lineHeight:1,color:'#f26060'}}>{fmt$(annualTax)}</div>
              <div style={{marginTop:6,fontSize:12,color:'#7a8db0'}}>at {taxRate}% rate</div>
            </div>
            {nextDue && (
              <div>
                <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Next Payment Due</div>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.04em',lineHeight:1.05,color:'#fbbf24'}}>
                  {nextDue.due.toLocaleDateString(undefined, { month:'long', day:'numeric' })}
                </div>
                <div style={{marginTop:6,fontSize:12,color:'#7a8db0'}}>{nextDue.label} · {fmt$(nextDue.taxDue)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Quarterly grid */}
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:12}}>QUARTERLY BREAKDOWN</div>
        <div className="quarter-grid">
          {quarters.map(q => {
            const current = isCurrent(q);
            const past    = isPast(q);
            const borderColor = current ? '#4f9eff' : '#2e3f60';
            const borderWidth = current ? 2 : 1.5;
            return (
              <div key={q.label} style={{
                background:'#1e2a42',
                border: `${borderWidth}px solid ${borderColor}`,
                borderRadius:14,
                padding:'18px 16px',
                position:'relative',
              }}>
                {current && (
                  <div style={{position:'absolute',top:-10,left:14,background:'#4f9eff',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:'.12em',padding:'3px 10px',borderRadius:999}}>
                    CURRENT
                  </div>
                )}
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.06em',color:current?'#4f9eff':'#f0f4ff'}}>
                    {q.label}
                  </div>
                  <div style={{fontSize:11,color:'#7a8db0',fontWeight:600}}>{q.periodLabel}</div>
                </div>
                <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Revenue</div>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,color:'#2edf87',lineHeight:1.1,marginBottom:12}}>
                  {fmt$(q.revenue)}
                </div>
                <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600,marginBottom:4}}>Estimated Tax</div>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,color:'#f26060',lineHeight:1.1,marginBottom:14}}>
                  {fmt$(q.taxDue)}
                </div>
                <div style={{paddingTop:10,borderTop:'1px solid #2e3f60',fontSize:11,color: past ? '#7a8db0' : '#fbbf24',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{textTransform:'uppercase',letterSpacing:'.08em',fontWeight:700}}>
                    {past ? 'Period closed' : 'Due'}
                  </span>
                  <span style={{color:'#f0f4ff',fontWeight:600}}>
                    {q.due.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <style jsx global>{`
        .quarter-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 640px) {
          .quarter-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .quarter-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; }
          .annual-grid { grid-template-columns: 1fr 1fr 1fr !important; }
        }
        @media (min-width: 640px) {
          .annual-grid { grid-template-columns: 1fr 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
