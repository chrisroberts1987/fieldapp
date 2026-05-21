import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard');
      else setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif"}}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <Hero router={router} supabase={supabase} />
      <Compare router={router} />
      <Workflow />
      <Automation />
      <Pricing billing={billing} setBilling={setBilling} router={router} />
      <FooterSection />

      <style jsx global>{`
        html, body { background: #111827; }
        a { color: inherit; }

        .hero-section {
          position: relative;
          overflow: hidden;
          padding-top: 18px;
          padding-bottom: 96px;
        }
        .hero-grid-bg {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(79,158,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,158,255,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 25%, transparent 75%);
                  mask-image: radial-gradient(ellipse 80% 60% at 50% 30%, #000 25%, transparent 75%);
          pointer-events: none;
        }
        .hero-glow {
          position: absolute; left: 50%; top: -240px;
          transform: translateX(-50%);
          width: 760px; height: 760px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(79,158,255,0.18), transparent 60%);
          pointer-events: none;
        }
        .hero-headline {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 62px;
          letter-spacing: 0.04em;
          line-height: 0.95;
          margin: 0 0 18px;
          color: #f0f4ff;
        }
        .hero-headline .accent { color: #4f9eff; }
        .hero-subhead {
          font-size: 17px;
          line-height: 1.55;
          color: #c8d4ee;
          max-width: 620px;
          margin: 0 auto 32px;
        }
        @media (min-width: 720px) {
          .hero-headline { font-size: 104px; }
          .hero-subhead { font-size: 20px; }
        }
        @media (min-width: 1024px) {
          .hero-headline { font-size: 128px; }
        }

        .section {
          padding: 80px 20px;
        }
        .section.alt { background: #0d1726; border-top: 1px solid #1f2a40; border-bottom: 1px solid #1f2a40; }
        .section-inner { max-width: 1080px; margin: 0 auto; }
        .section-headline {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 36px;
          letter-spacing: 0.04em;
          line-height: 1.05;
          margin: 0 0 12px;
          color: #f0f4ff;
        }
        .section-lede {
          font-size: 15px;
          line-height: 1.55;
          color: #c8d4ee;
          max-width: 580px;
          margin: 0 0 36px;
        }
        @media (min-width: 720px) {
          .section { padding: 110px 24px; }
          .section-headline { font-size: 56px; }
          .section-lede { font-size: 17px; }
        }

        .workflow-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 720px) { .workflow-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .workflow-grid { grid-template-columns: repeat(5, 1fr); } }

        .pricing-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-top: 28px;
          align-items: stretch;
        }
        @media (min-width: 880px) {
          .pricing-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; }
        }

        .footer-row {
          display: flex;
          flex-direction: column;
          gap: 24px;
          align-items: flex-start;
        }
        @media (min-width: 720px) {
          .footer-row { flex-direction: row; align-items: center; justify-content: space-between; }
        }
      `}</style>
    </div>
  );
}

/* =====================================================
   HERO
   ===================================================== */
function Hero({ router, supabase }) {
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoErr, setDemoErr] = useState(null);
  const launchDemo = async () => {
    setDemoErr(null); setDemoBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo@myforemanhq.com',
      password: 'demo1234',
    });
    if (error) { setDemoErr(error.message); setDemoBusy(false); return; }

    // Wipe the onboarding-seen flags so every demo viewer gets the
    // first-time tour, not just the first person of the day. The demo
    // user has no real ongoing state worth preserving on these fields.
    const meta = { ...(data?.user?.user_metadata || {}) };
    delete meta.onboarding_completed_at;
    delete meta.onboarding_skipped_at;
    await supabase.auth.updateUser({ data: meta });

    router.push('/dashboard');
  };

  return (
    <section className="hero-section">
      <div className="hero-grid-bg" />
      <div className="hero-glow" />

      <nav style={{position:'relative',zIndex:2,display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:1200,margin:'0 auto',padding:'0 20px',gap:12}}>
        <Logo size="sm" />
        <div style={{display:'flex',gap:10}}>
          <button onClick={() => router.push('/login')}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.06em'}}>
            SIGN IN
          </button>
          <button onClick={() => router.push('/signup')}
            style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 16px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em'}}>
            START FREE TRIAL
          </button>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:2,maxWidth:900,margin:'0 auto',padding:'72px 20px 0',textAlign:'center'}}>
        <div style={{display:'inline-block',marginBottom:24,padding:'6px 14px',background:'rgba(79,158,255,0.10)',border:'1px solid rgba(79,158,255,0.3)',borderRadius:999,fontSize:11,letterSpacing:'.12em',fontWeight:700,color:'#4f9eff',textTransform:'uppercase'}}>
          Real work deserves better tools.
        </div>
        <h1 className="hero-headline">
          FROM LEAD<br/>TO <span className="accent">PAID.</span>
        </h1>
        <p className="hero-subhead">
          MyForeman runs your field service business from first call to final payment, with AI insights that help you grow.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={() => router.push('/signup')}
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'15px 28px',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em'}}>
            START 14-DAY FREE TRIAL
          </button>
          <button onClick={launchDemo} disabled={demoBusy}
            style={{background:'transparent',border:'1.5px solid #2edf87',borderRadius:10,color:'#2edf87',padding:'15px 28px',cursor:demoBusy?'wait':'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',opacity:demoBusy?0.6:1}}>
            {demoBusy ? 'OPENING DEMO…' : 'SEE LIVE DEMO →'}
          </button>
          <a href="#workflow"
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'15px 28px',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
            SEE HOW IT WORKS
          </a>
        </div>
        <div style={{marginTop:18,fontSize:12,color:'#7a8db0',letterSpacing:'.03em'}}>
          Card required for the free trial. The live demo opens instantly. No signup, no card.
        </div>
        {demoErr && <div style={{marginTop:10,fontSize:12,color:'#f26060'}}>Couldn't open demo: {demoErr}</div>}
      </div>
    </section>
  );
}

/* =====================================================
   PAIN
   ===================================================== */
function Compare({ router }) {
  // Each row: [label, [col1, col2, col3], { ai?: highlight as AI row }]
  // Values: 'yes' | 'no' | 'partial' | any plain string (rendered as text).
  const rows = [
    { label:'Setup time',             values:['None',    '4–8 hrs',     '10 minutes'] },
    { label:'Monthly cost',           values:['$0',      '$99–$300',    '$29–$149'] },
    { label:'Mobile-first',           values:['no',      'partial',     'yes'] },
    { label:'Lead → Paid workflow',   values:['no',      'yes',         'yes'] },
    { label:'AI invoice import',      values:['no',      'no',          'yes'], ai:true },
    { label:'AI business coach',      values:['no',      'no',          'yes'], ai:true },
    { label:'Auto-invoice on done',   values:['no',      'partial',     'yes'] },
    { label:'Crew + approvals',       values:['Manual',  'yes',         'yes'] },
    { label:'Mileage + tax',          values:['no',      'Add-on $$',   'yes'] },
    { label:'Branded customer email', values:['no',      'yes',         'yes'] },
    { label:'Live demo',              values:['N/A',     'Sales call',  'One tap'] },
  ];
  const cols = ['Texts & sheets', 'Old-school field software', 'MyForeman'];

  return (
    <section className="section alt">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center',maxWidth:820,margin:'0 auto 12px'}}>
          The Way It Should Have Always Been
        </h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 40px',maxWidth:680}}>
          Your work is professional. Your tools should be too.
        </p>

        {/* Desktop table */}
        <div className="compare-table">
          <div className="compare-row compare-header">
            <div className="compare-feature">&nbsp;</div>
            {cols.map((c, i) => (
              <div key={c} className={'compare-col ' + (i === 2 ? 'compare-us' : '')}>
                {i === 2 && <span style={{color:'#fbbf24',marginRight:6}}>⚡</span>}
                {c.toUpperCase()}
              </div>
            ))}
          </div>
          {rows.map((row, ri) => (
            <div key={row.label} className={'compare-row ' + (row.ai ? 'compare-ai' : '')}>
              <div className="compare-feature">{row.label}{row.ai && <span className="compare-tag">AI</span>}</div>
              {row.values.map((v, ci) => (
                <div key={ci} className={'compare-col ' + (ci === 2 ? 'compare-us' : '')}>
                  <CompareCell value={v} isUs={ci === 2}/>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Mobile stacked cards */}
        <div className="compare-mobile">
          {rows.map(row => (
            <div key={row.label} className={'compare-card ' + (row.ai ? 'compare-card-ai' : '')}>
              <div className="compare-card-label">
                {row.label}
                {row.ai && <span className="compare-tag">AI</span>}
              </div>
              {row.values.map((v, i) => (
                <div key={i} className={'compare-card-row ' + (i === 2 ? 'compare-card-us' : '')}>
                  <span className="compare-card-col">{cols[i]}</span>
                  <span className="compare-card-val"><CompareCell value={v} isUs={i === 2}/></span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',marginTop:42}}>
          <button onClick={() => router.push('/signup')}
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'15px 28px',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em'}}>
            START 14-DAY FREE TRIAL
          </button>
          <a href="#workflow"
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'15px 28px',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
            SEE HOW IT WORKS
          </a>
        </div>
      </div>

      <style jsx>{`
        .compare-table { display: none; }
        .compare-mobile { display: flex; flex-direction: column; gap: 12px; }
        .compare-card {
          background: #111827; border: 1px solid #2e3f60; border-radius: 12px;
          padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
        }
        .compare-card-ai { border-color: rgba(251,191,36,0.45); background: linear-gradient(180deg,rgba(251,191,36,0.05),transparent 60%),#111827; }
        .compare-card-label {
          font-family: 'Bebas Neue', Impact, sans-serif; font-size: 18px;
          letter-spacing: .06em; color: #f0f4ff; display: flex; align-items: center; gap: 8px;
          padding-bottom: 6px; border-bottom: 1px solid #2e3f60;
        }
        .compare-card-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 4px 0; gap: 12px;
        }
        .compare-card-us { background: rgba(79,158,255,0.07); border-radius: 6px; margin: 0 -8px; padding: 4px 8px; }
        .compare-card-col { font-size: 12px; color: #7a8db0; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
        .compare-card-val { font-size: 14px; color: #f0f4ff; }
        .compare-tag {
          background: rgba(251,191,36,0.15); color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.4); border-radius: 999px;
          padding: 1px 7px; font-size: 9px; font-weight: 700; letter-spacing: .08em; margin-left: 6px;
        }
        @media (min-width: 768px) {
          .compare-mobile { display: none; }
          .compare-table {
            display: block;
            background: #111827;
            border: 1px solid #2e3f60; border-radius: 16px;
            overflow: hidden; max-width: 920px; margin: 0 auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          }
          .compare-row {
            display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr;
            align-items: center;
          }
          .compare-header {
            border-bottom: 1px solid #2e3f60; background: #0d1726;
          }
          .compare-header .compare-col {
            font-family: 'Bebas Neue', Impact, sans-serif; font-size: 13px;
            letter-spacing: .08em; color: #7a8db0;
            padding: 18px 14px; text-align: center;
          }
          .compare-header .compare-us {
            background: linear-gradient(180deg,rgba(79,158,255,0.20),rgba(79,158,255,0.06));
            color: #f0f4ff; font-weight: 700;
            border-left: 1px solid rgba(79,158,255,0.35);
            border-right: 1px solid rgba(79,158,255,0.35);
          }
          .compare-row + .compare-row { border-top: 1px solid #1f2a40; }
          .compare-row:nth-child(odd) { background: rgba(255,255,255,0.012); }
          .compare-feature {
            padding: 14px 18px;
            font-size: 14px; color: #c8d4ee; font-weight: 500;
            display: flex; align-items: center;
          }
          .compare-col {
            padding: 14px;
            text-align: center;
            font-size: 14px; color: #c8d4ee;
          }
          .compare-us {
            background: rgba(79,158,255,0.06);
            border-left: 1px solid rgba(79,158,255,0.35);
            border-right: 1px solid rgba(79,158,255,0.35);
            color: #f0f4ff;
          }
          .compare-ai .compare-feature { color: #fbbf24; }
          .compare-ai .compare-us { background: rgba(251,191,36,0.08); }
        }
      `}</style>
    </section>
  );
}

function CompareCell({ value, isUs }) {
  if (value === 'yes') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isUs ? '#2edf87' : '#7a8db0'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'middle'}}>
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  if (value === 'no') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f26060" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'middle',opacity:0.75}}>
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    );
  }
  if (value === 'partial') {
    return <span style={{color:'#fbbf24',fontSize:13,fontWeight:600,letterSpacing:'.02em'}}>Partial</span>;
  }
  return <span style={{color:isUs?'#f0f4ff':'#c8d4ee',fontWeight:isUs?700:500}}>{value}</span>;
}

/* =====================================================
   WORKFLOW
   ===================================================== */
function Workflow() {
  const steps = [
    { label:'Lead',     color:'#54d4f8', icon:<PhoneIcon/>,  desc:'Capture every quote request from your shareable link, phone, or referrals.' },
    { label:'Estimate', color:'#b197fc', icon:<ScrollIcon/>, desc:'Send a clean quote that closes. Convert it to a job when accepted.' },
    { label:'Job',      color:'#4f9eff', icon:<WrenchIcon/>, desc:'Schedule the work. Track crew, status, dates, and pricing.' },
    { label:'Invoice',  color:'#fbbf24', icon:<DocIcon/>,    desc:'Branded invoices the customer can pay from their phone.' },
    { label:'Paid',     color:'#2edf87', icon:<CheckIcon/>,  desc:'Reconciled, recorded, and rolled into your monthly revenue.' },
  ];
  return (
    <section id="workflow" className="section">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center'}}>One app. The whole job.</h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 44px'}}>
          Every step of running a field service business, end to end. Nothing falls through the cracks.
        </p>
        <div className="workflow-grid">
          {steps.map((s, i) => (
            <div key={s.label} style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'22px 18px',display:'flex',flexDirection:'column',gap:12,position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{width:42,height:42,borderRadius:9,background:s.color+'22',border:'1px solid '+s.color+'66',display:'flex',alignItems:'center',justifyContent:'center',color:s.color}}>
                  {s.icon}
                </div>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,color:'#7a8db0',letterSpacing:'.08em'}}>
                  0{i+1}
                </div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.06em',color:s.color}}>
                {s.label.toUpperCase()}
              </div>
              <div style={{fontSize:13,lineHeight:1.55,color:'#c8d4ee'}}>
                {s.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   AUTOMATION / AI
   ===================================================== */
function Automation() {
  const cards = [
    {
      ai: true,
      icon: <AiSparkleIcon/>,
      title: 'AI invoice import',
      body: 'Snap a photo of any invoice. Vendor bills, receipts, contractor PDFs all work. AI pulls the customer, total, dates, and line items in seconds. No more typing.',
    },
    {
      ai: true,
      icon: <CoachIcon/>,
      title: 'Monthly AI business coach',
      body: 'Every month MyForeman analyzes your revenue, jobs, and customers and delivers 4 to 5 specific recommendations. Pricing, slow months, retention. Actionable, not generic.',
    },
    {
      icon: <BoltIcon/>,
      title: 'Auto-invoice on completion',
      body: 'Mark a job done. The invoice fires automatically with the right amount, customer, and notes. Zero clicks between the work and the bill.',
    },
    {
      icon: <StarIcon/>,
      title: 'Auto-feedback after payment',
      body: 'The moment an invoice gets paid, the customer receives a personalized feedback link. Reviews roll in on autopilot.',
    },
    {
      icon: <TruckIcon/>,
      title: 'Mileage + tax tracking',
      body: 'Log trips, watch the IRS deduction calculate live. Quarterly tax estimates that account for income, expenses, and mileage. Accountant-ready CSV when you need it.',
    },
    {
      icon: <MailIcon/>,
      title: 'Branded customer emails',
      body: 'Every quote, invoice, and feedback request goes out under your business name. Replies route to your inbox. MyForeman stays invisible to your customers.',
    },
  ];

  return (
    <section className="section">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center',maxWidth:760,margin:'0 auto 12px'}}>
          Built to run itself.
        </h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 44px',maxWidth:640}}>
          AI and automation that quietly handle the busywork so you can spend your day on the job, not the laptop.
        </p>

        <div className="auto-grid">
          {cards.map((c, i) => (
            <div key={i} className={'auto-card ' + (c.ai ? 'auto-card-ai' : '')}>
              {c.ai && <span className="auto-ai-tag">AI</span>}
              <div className={'auto-icon ' + (c.ai ? 'auto-icon-ai' : '')}>{c.icon}</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.04em',color:'#f0f4ff',marginBottom:8,marginTop:4}}>
                {c.title.toUpperCase()}
              </div>
              <div style={{fontSize:14,lineHeight:1.55,color:'#c8d4ee'}}>
                {c.body}
              </div>
            </div>
          ))}
        </div>

      </div>

      <style jsx>{`
        .auto-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .auto-card {
          background: #1e2a42;
          border: 1px solid #2e3f60;
          border-radius: 14px;
          padding: 24px 22px;
          position: relative;
          transition: border-color .2s, transform .2s;
        }
        .auto-card:hover { border-color: #4f9eff; transform: translateY(-2px); }
        .auto-card-ai {
          background: linear-gradient(160deg, rgba(251,191,36,0.06) 0%, #1e2a42 55%);
          border-color: rgba(251,191,36,0.35);
        }
        .auto-card-ai:hover { border-color: rgba(251,191,36,0.7); }
        .auto-ai-tag {
          position: absolute; top: 16px; right: 16px;
          background: rgba(251,191,36,0.15); color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.45);
          border-radius: 999px; padding: 2px 9px;
          font-size: 10px; font-weight: 700; letter-spacing: .1em;
        }
        .auto-icon {
          width: 44px; height: 44px; border-radius: 10px;
          background: rgba(79,158,255,0.12);
          border: 1px solid rgba(79,158,255,0.35);
          color: #4f9eff;
          display: flex; align-items: center; justify-content: center;
        }
        .auto-icon-ai {
          background: rgba(251,191,36,0.12);
          border-color: rgba(251,191,36,0.45);
          color: #fbbf24;
        }
        @media (min-width: 720px) {
          .auto-grid { grid-template-columns: repeat(2, 1fr); gap: 18px; }
        }
        @media (min-width: 1024px) {
          .auto-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </section>
  );
}

/* =====================================================
   PRICING
   ===================================================== */
function Pricing({ billing, setBilling, router }) {
  const plans = [
    { name:'Solo',     monthly:29,  users:'1 user',          subtitle:'For owner-operators' },
    { name:'Crew',     monthly:69,  users:'Up to 7 users',   subtitle:'For service crews', popular:true },
    { name:'Business', monthly:149, users:'Up to 15 users',  subtitle:'For multi-crew shops' },
  ];
  return (
    <section className="section alt">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center'}}>Simple pricing. No feature gates.</h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 24px'}}>
          Every plan includes everything. Pay for your crew size.
        </p>

        <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
          <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:999,padding:4,display:'flex',gap:4}}>
            <button onClick={() => setBilling('monthly')}
              style={{background:billing==='monthly'?'#4f9eff':'transparent',border:'none',borderRadius:999,color:billing==='monthly'?'#fff':'#7a8db0',padding:'8px 20px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em'}}>
              MONTHLY
            </button>
            <button onClick={() => setBilling('annual')}
              style={{background:billing==='annual'?'#4f9eff':'transparent',border:'none',borderRadius:999,color:billing==='annual'?'#fff':'#7a8db0',padding:'8px 20px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em'}}>
              ANNUAL
            </button>
          </div>
        </div>
        <div style={{textAlign:'center',height:16,fontSize:11,fontWeight:700,letterSpacing:'.12em',color:'#2edf87'}}>
          {billing === 'annual' ? '2 MONTHS FREE' : ' '}
        </div>

        <div className="pricing-grid">
          {plans.map(p => <PricingCard key={p.name} plan={p} billing={billing} router={router} />)}
        </div>

        <p style={{textAlign:'center',fontSize:13,color:'#7a8db0',marginTop:28}}>
          14-day free trial. Full product. No feature limits.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ plan, billing, router }) {
  const isAnnual = billing === 'annual';
  const annualTotal = plan.monthly * 10;
  const displayPrice = isAnnual ? Math.round(annualTotal / 12) : plan.monthly;
  const popular = plan.popular;

  return (
    <div style={{
      background: popular ? '#1e2a42' : '#111827',
      border: popular ? '2px solid #4f9eff' : '1.5px solid #2e3f60',
      borderRadius: 16,
      padding: '28px 22px 24px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      transform: popular ? 'translateY(-4px)' : 'none',
      boxShadow: popular ? '0 12px 32px rgba(79,158,255,0.15)' : 'none',
    }}>
      {popular && (
        <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#4f9eff',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:'.14em',padding:'4px 12px',borderRadius:999,whiteSpace:'nowrap'}}>
          MOST POPULAR
        </div>
      )}
      <div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.06em',color:'#f0f4ff'}}>
          {plan.name.toUpperCase()}
        </div>
        <div style={{fontSize:12,color:'#7a8db0',marginTop:2}}>
          {plan.subtitle}
        </div>
      </div>
      <div>
        <div style={{display:'flex',alignItems:'baseline',gap:6}}>
          <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:56,color:'#f0f4ff',letterSpacing:'.02em',lineHeight:1}}>
            ${displayPrice}
          </span>
          <span style={{fontSize:14,color:'#7a8db0'}}>/month</span>
        </div>
        <div style={{fontSize:11,color: isAnnual ? '#2edf87' : '#7a8db0',marginTop:6,fontWeight:isAnnual?700:400,letterSpacing:isAnnual?'.04em':0}}>
          {isAnnual ? `$${annualTotal} billed annually` : 'Billed monthly'}
        </div>
      </div>
      <div style={{fontSize:14,color:'#c8d4ee',fontWeight:600}}>
        {plan.users}
      </div>
      <button onClick={() => router.push('/signup')}
        style={{background: popular?'#4f9eff':'transparent',color: popular?'#fff':'#c8d4ee',border: popular?'none':'1px solid #2e3f60',borderRadius:10,padding:'14px 0',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',fontWeight:700}}>
        START FREE TRIAL
      </button>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4,paddingTop:16,borderTop:'1px solid #2e3f60'}}>
        {[
          'Lead-to-paid pipeline',
          'Branded invoices',
          'Public quote form',
          'AI insights',
          'Unlimited customers, jobs, invoices',
        ].map(f => (
          <div key={f} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#c8d4ee'}}>
            <span style={{color:'#2edf87',flexShrink:0,fontWeight:700}}>✓</span> {f}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   FOOTER
   ===================================================== */
function FooterSection() {
  return (
    <footer style={{padding:'48px 20px 36px',borderTop:'1px solid #1f2a40'}}>
      <div className="footer-row" style={{maxWidth:1080,margin:'0 auto'}}>
        <div>
          <Logo size="sm" />
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',marginTop:8,fontWeight:600,textTransform:'uppercase'}}>
            From lead to paid
          </div>
        </div>
        <div style={{display:'flex',gap:24,fontSize:13,color:'#7a8db0'}}>
          <a href="/privacy" style={{color:'#7a8db0',textDecoration:'none'}}>Privacy</a>
          <a href="/terms" style={{color:'#7a8db0',textDecoration:'none'}}>Terms</a>
          <a href="mailto:hello@myforeman.app" style={{color:'#7a8db0',textDecoration:'none'}}>Contact</a>
        </div>
        <div style={{fontSize:11,color:'#7a8db0'}}>
          © {new Date().getFullYear()} MyForeman
        </div>
      </div>
    </footer>
  );
}

/* =====================================================
   ICONS
   ===================================================== */
function PhoneIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);}
function WrenchIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);}
function ScrollIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <path d="M14 2v6h6"/>
    <path d="M8 13h8M8 17h5"/>
  </svg>
);}
function DocIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M8 7h8M8 11h8M8 15h5"/>
  </svg>
);}
function CheckIcon() { return (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l4 4 10-10"/>
  </svg>
);}
function AiSparkleIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z"/>
    <path d="M19 14l.8 2.3L22 17l-2.2.7L19 20l-.8-2.3L16 17l2.2-.7L19 14z"/>
  </svg>
);}
function CoachIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
  </svg>
);}
function BoltIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);}
function StarIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2"/>
  </svg>
);}
function TruckIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 16V4h13v12M14 8h5l3 4v4h-8"/>
    <circle cx="6.5" cy="18" r="2"/>
    <circle cx="17.5" cy="18" r="2"/>
  </svg>
);}
function MailIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <polyline points="2 7 12 13 22 7"/>
  </svg>
);}
