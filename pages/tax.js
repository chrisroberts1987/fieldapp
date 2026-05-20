import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import { useRefetchOnFocus } from '../lib/useFocus';
import { fmt$, fmtDate, IRS_RATE } from '../lib/helpers';
import TopNav from '../components/TopNav';

// Per-category deductibility (matches pages/expenses/index.js).
const CAT_DEDUCTIBLE = {
  materials:100, fuel:100, labor:100, equipment:100, vehicle:100,
  insurance:100, office:100, marketing:100, advertising:100,
  meals:50, lodging:100, other:100,
};
const deductibleFor = cat => CAT_DEDUCTIBLE[cat] ?? 100;

export default function Tax() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [year, setYear] = useState(new Date().getFullYear());
  const [paid, setPaid] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [mileage, setMileage] = useState(null);

  const loadYear = async (oid, y) => {
    const start = `${y}-01-01`;
    const end   = `${y+1}-01-01`;
    const [{ data: p }, { data: e }, { data: m }] = await Promise.all([
      supabase.from('invoices').select('amount, paid_date')
        .eq('org_id', oid).eq('status', 'paid')
        .gte('paid_date', start).lt('paid_date', end),
      supabase.from('expenses').select('amount, expense_date, category, vendor, description')
        .eq('org_id', oid)
        .gte('expense_date', start).lt('expense_date', end),
      supabase.from('mileage_logs').select('miles, log_date, purpose')
        .eq('org_id', oid).eq('purpose', 'business')
        .gte('log_date', start).lt('log_date', end),
    ]);
    setPaid(p || []);
    setExpenses(e || []);
    setMileage(m || []);
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

  if (!user || orgLoading || !paid || !expenses || !mileage) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/tax"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading tax view...</div>
      </div>
    );
  }

  const taxRate = Number(org?.income_tax_rate || 25);

  // Per expense, the IRS-deductible amount = amount × deductible%.
  const expDeductible = e => Number(e.amount || 0) * deductibleFor(e.category) / 100;

  const quarters = [
    { label:'Q1', periodLabel:'Jan – Mar', start:`${year}-01-01`, end:`${year}-04-01`, due:new Date(year, 3, 15) },
    { label:'Q2', periodLabel:'Apr – May', start:`${year}-04-01`, end:`${year}-06-01`, due:new Date(year, 5, 15) },
    { label:'Q3', periodLabel:'Jun – Aug', start:`${year}-06-01`, end:`${year}-09-01`, due:new Date(year, 8, 15) },
    { label:'Q4', periodLabel:'Sep – Dec', start:`${year}-09-01`, end:`${year+1}-01-01`, due:new Date(year+1, 0, 15) },
  ].map(q => {
    const inRange = (d) => d >= q.start && d < q.end;
    const revenue = paid.filter(p => inRange(p.paid_date)).reduce((s, r) => s + Number(r.amount || 0), 0);
    const qExpensesRaw = expenses.filter(e => inRange(e.expense_date)).reduce((s, r) => s + Number(r.amount || 0), 0);
    const qExpensesDeductible = expenses.filter(e => inRange(e.expense_date)).reduce((s, r) => s + expDeductible(r), 0);
    const qMiles = mileage.filter(m => inRange(m.log_date)).reduce((s, r) => s + Number(r.miles || 0), 0);
    const qMileageDeduction = qMiles * IRS_RATE;
    const totalDeductible = qExpensesDeductible + qMileageDeduction;
    const netIncome = revenue - totalDeductible;
    const taxDue = Math.max(0, netIncome) * taxRate / 100;
    return { ...q, revenue, expenses: qExpensesRaw, expensesDeductible: qExpensesDeductible, miles: qMiles, mileageDeduction: qMileageDeduction, netIncome, taxDue };
  });

  const ytdRevenue            = paid.reduce((s, r) => s + Number(r.amount || 0), 0);
  const ytdExpensesRaw        = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const ytdExpensesDeductible = expenses.reduce((s, r) => s + expDeductible(r), 0);
  const ytdMiles              = mileage.reduce((s, r) => s + Number(r.miles || 0), 0);
  const ytdMileageDeduction   = ytdMiles * IRS_RATE;
  const ytdDeductible         = ytdExpensesDeductible + ytdMileageDeduction;
  const ytdNetIncome          = ytdRevenue - ytdDeductible;
  const annualTax             = Math.max(0, ytdNetIncome) * taxRate / 100;
  const totalPaid             = paid.length;

  const downloadCSV = () => {
    const lines = [];
    lines.push(`MyForeman tax export — ${year}`);
    lines.push(`Business: ${org?.name || ''}`);
    lines.push(`Generated: ${new Date().toISOString().slice(0,10)}`);
    lines.push('');
    lines.push('### INCOME (paid invoices)');
    lines.push('paid_date,amount');
    paid.forEach(p => lines.push(`${p.paid_date},${Number(p.amount||0).toFixed(2)}`));
    lines.push(`,Subtotal: ${ytdRevenue.toFixed(2)}`);
    lines.push('');
    lines.push('### EXPENSES');
    lines.push('expense_date,category,vendor,description,amount,deductible_pct,deductible_amount');
    expenses.forEach(e => {
      const ded = deductibleFor(e.category);
      const csvEscape = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
      lines.push([
        e.expense_date,
        e.category,
        csvEscape(e.vendor || ''),
        csvEscape(e.description || ''),
        Number(e.amount||0).toFixed(2),
        ded,
        expDeductible(e).toFixed(2),
      ].join(','));
    });
    lines.push(`,,,,Subtotal raw,${ytdExpensesRaw.toFixed(2)}`);
    lines.push(`,,,,Subtotal deductible,${ytdExpensesDeductible.toFixed(2)}`);
    lines.push('');
    lines.push('### MILEAGE (business miles only)');
    lines.push(`Total business miles,${ytdMiles.toFixed(1)}`);
    lines.push(`IRS rate per mile,${IRS_RATE.toFixed(2)}`);
    lines.push(`Mileage deduction,${ytdMileageDeduction.toFixed(2)}`);
    lines.push('');
    lines.push('### SUMMARY');
    lines.push(`Gross revenue,${ytdRevenue.toFixed(2)}`);
    lines.push(`Total deductions,${ytdDeductible.toFixed(2)}`);
    lines.push(`Net income,${ytdNetIncome.toFixed(2)}`);
    lines.push(`Income tax rate (configured),${taxRate}%`);
    lines.push(`Estimated tax,${annualTax.toFixed(2)}`);
    lines.push('');
    lines.push('### QUARTERLY');
    lines.push('quarter,period,revenue,expenses_deductible,mileage_deduction,net_income,estimated_tax,deadline');
    quarters.forEach(q => {
      lines.push([
        q.label, q.periodLabel,
        q.revenue.toFixed(2),
        q.expensesDeductible.toFixed(2),
        q.mileageDeduction.toFixed(2),
        q.netIncome.toFixed(2),
        q.taxDue.toFixed(2),
        q.due.toISOString().slice(0,10),
      ].join(','));
    });
    lines.push('');
    lines.push('Note: estimate only. Does not separately calculate self-employment tax,');
    lines.push('state tax, or deductions outside what is logged in MyForeman.');

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `myforeman-tax-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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

        {ytdRevenue === 0 && ytdExpensesRaw === 0 && ytdMiles === 0 && (
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
              {fmt$(ytdRevenue)} revenue − {fmt$(ytdDeductible)} deductions = <span style={{color: ytdNetIncome >= 0 ? '#2edf87' : '#f26060',fontWeight:600}}>{fmt$(ytdNetIncome)} net</span> · taxed at {taxRate}%
            </div>
            <div style={{marginTop:6,fontSize:11,color:'#7a8db0',lineHeight:1.55}}>
              Deductions: {fmt$(ytdExpensesDeductible)} expenses{ytdExpensesDeductible !== ytdExpensesRaw && <> (of {fmt$(ytdExpensesRaw)} logged — meals 50%)</>} + {fmt$(ytdMileageDeduction)} mileage ({ytdMiles.toFixed(1)} mi × ${IRS_RATE.toFixed(2)})
            </div>
            <div style={{marginTop:14}}>
              <button onClick={downloadCSV}
                style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 14px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:13,letterSpacing:'.06em',fontWeight:700,cursor:'pointer'}}>
                EXPORT FOR ACCOUNTANT (CSV)
              </button>
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
        <div className="annual-row" style={{marginBottom:14}}>
          <SummaryTile label="Revenue"   value={fmt$(ytdRevenue)}            color="#2edf87" sub={`${totalPaid} paid invoice${totalPaid===1?'':'s'}`}/>
          <SummaryTile label="Expenses (deductible)" value={fmt$(ytdExpensesDeductible)} color="#f26060" sub={`${expenses.length} logged · ${fmt$(ytdExpensesRaw)} raw`}/>
          <SummaryTile label="Mileage deduction" value={fmt$(ytdMileageDeduction)} color="#4f9eff" sub={`${ytdMiles.toFixed(1)} biz mi × $${IRS_RATE.toFixed(2)}`}/>
        </div>
        <div className="annual-row" style={{marginBottom:24}}>
          <SummaryTile label="Total deductions" value={fmt$(ytdDeductible)} color="#fbbf24"/>
          <SummaryTile label="Net income" value={fmt$(ytdNetIncome)} color={ytdNetIncome >= 0 ? '#2edf87' : '#f26060'} sub={`${ytdRevenue > 0 ? Math.round((ytdNetIncome/ytdRevenue)*100) : 0}% margin`}/>
          <SummaryTile label="Estimated tax" value={fmt$(annualTax)} color="#f26060" sub={`at ${taxRate}%`}/>
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
                <QLine label="Revenue"    value={fmt$(q.revenue)}                color="#2edf87"/>
                <QLine label="Expenses"   value={fmt$(q.expensesDeductible)}     color="#f26060"/>
                <QLine label="Mileage ded." value={fmt$(q.mileageDeduction)}    color="#4f9eff"/>
                <QLine label="Net Income" value={fmt$(q.netIncome)}              color={q.netIncome >= 0 ? '#2edf87' : '#f26060'} bold/>
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
