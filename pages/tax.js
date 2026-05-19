import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import { useRefetchOnFocus } from '../lib/useFocus';
import { fmt$, fmtDate } from '../lib/helpers';
import TopNav from '../components/TopNav';

export default function Tax() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [year, setYear] = useState(new Date().getFullYear());
  const [paid, setPaid] = useState(null);
  const [expenses, setExpenses] = useState(null);

  const loadYear = async (oid, y) => {
    const start = `${y}-01-01`;
    const end   = `${y+1}-01-01`;
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('invoices').select('amount, paid_date')
        .eq('org_id', oid).eq('status', 'paid')
        .gte('paid_date', start).lt('paid_date', end),
      supabase.from('expenses').select('amount, expense_date')
        .eq('org_id', oid)
        .gte('expense_date', start).lt('expense_date', end),
    ]);
    setPaid(p || []);
    setExpenses(e || []);
  };

  const refetchTax = () => { if (orgId) loadYear(orgId, year); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId) loadYear(orgId, year);
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading, year]);

  useRefetchOnFocus(refetchTax, !!orgId);

  if (!user || orgLoading || !paid || !expenses) {
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
    const qExpenses = expenses
      .filter(e => e.expense_date >= q.start && e.expense_date < q.end)
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const netIncome = revenue - qExpenses;
    const taxDue = Math.max(0, netIncome) * taxRate / 100;
    return { ...q, revenue, expenses: qExpenses, netIncome, taxDue };
  });

  const ytdRevenue  = paid.reduce((s, r) => s + Number(r.amount || 0), 0);
  const ytdExpenses = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const ytdNetIncome = ytdRevenue - ytdExpenses;
  const annualTax    = Math.max(0, ytdNetIncome) * taxRate / 100;
  const totalPaid    = paid.length;

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

        {ytdRevenue === 0 && ytdExpenses === 0 && (
          <div style={{background:'rgba(79,158,255,0.10)',border:'1px solid rgba(79,158,255,0.3)',borderRadius:10,padding:'14px 16px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,flex:1,minWidth:200}}>
              No revenue or expenses logged yet for {year}. Import prior invoices to fill in your history.
            </div>
            <button onClick={() => router.push('/invoices/import')} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 14px',fontWeight:700,cursor:'pointer',fontSize:12,letterSpacing:'.04em'}}>
              IMPORT INVOICES
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:10,padding:'12px 14px',marginBottom:24,display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{color:'#fbbf24',fontSize:14,lineHeight:1.4}}>⚠</span>
          <div style={{fontSize:12,color:'#fbbf24',lineHeight:1.55}}>
            <strong>Estimate only.</strong> Projection = (revenue − expenses) × your configured tax rate. It does not separate self-employment from income tax, account for state tax, factor in deductions beyond logged expenses, or handle vehicle/home-office allowances. Talk to an accountant before filing.
          </div>
        </div>

        {/* Annual summary */}
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'24px 22px',marginBottom:14,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at top right, rgba(242,96,96,0.10), transparent 60%)',pointerEvents:'none'}}/>
          <div style={{position:'relative'}}>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>{year} Estimated Tax</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:56,letterSpacing:'.02em',lineHeight:1,color:'#f26060'}}>{fmt$(annualTax)}</div>
            <div style={{marginTop:8,fontSize:13,color:'#c8d4ee'}}>
              {fmt$(ytdRevenue)} revenue − {fmt$(ytdExpenses)} expenses = <span style={{color: ytdNetIncome >= 0 ? '#2edf87' : '#f26060',fontWeight:600}}>{fmt$(ytdNetIncome)} net</span> · taxed at {taxRate}%
            </div>
            {nextDue && (
              <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid #2e3f60',display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase'}}>Next Payment Due</div>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.04em',lineHeight:1.1,color:'#fbbf24',marginTop:2}}>
                    {nextDue.due.toLocaleDateString(undefined, { month:'long', day:'numeric' })}
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',fontWeight:600}}>{nextDue.label}</div>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,color:'#f26060'}}>{fmt$(nextDue.taxDue)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Revenue / Expenses summary row */}
        <div className="annual-row" style={{marginBottom:24}}>
          <SummaryTile label="Revenue"  value={fmt$(ytdRevenue)}   color="#2edf87" sub={`${totalPaid} paid invoice${totalPaid===1?'':'s'}`}/>
          <SummaryTile label="Expenses" value={fmt$(ytdExpenses)}  color="#f26060" sub={`${expenses.length} expense${expenses.length===1?'':'s'}`}/>
          <SummaryTile label="Net Income" value={fmt$(ytdNetIncome)} color={ytdNetIncome >= 0 ? '#2edf87' : '#f26060'} sub={`${ytdRevenue > 0 ? Math.round((ytdNetIncome/ytdRevenue)*100) : 0}% margin`}/>
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
                <QLine label="Revenue"    value={fmt$(q.revenue)}   color="#2edf87"/>
                <QLine label="Expenses"   value={fmt$(q.expenses)}  color="#f26060"/>
                <QLine label="Net Income" value={fmt$(q.netIncome)} color={q.netIncome >= 0 ? '#2edf87' : '#f26060'} bold/>
                <div style={{margin:'10px 0 12px',borderTop:'1px solid #2e3f60'}}/>
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
        .annual-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        @media (min-width: 640px) {
          .annual-row { grid-template-columns: repeat(3, 1fr); gap: 12px; }
        }
      `}</style>
    </div>
  );
}

function QLine({ label, value, color, bold }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
      <span style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>{label}</span>
      <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize: bold ? 20 : 17,color,letterSpacing:'.02em'}}>{value}</span>
    </div>
  );
}

function SummaryTile({ label, value, color, sub }) {
  return (
    <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.02em',color}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>{sub}</div>}
    </div>
  );
}
