import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => {
    // Installed PWA users don't want the marketing page; punt them
    // straight into the app.
    const standalone = typeof window !== 'undefined'
      && (window.matchMedia?.('(display-mode: standalone)')?.matches
          || window.navigator?.standalone === true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (standalone) {
        router.push(session ? '/dashboard' : '/login');
        return;
      }
      // Signed-in users go to their dashboard. Demo viewers stay on
      // the marketing page so closing the tab doesn't trap them in
      // the demo on next visit.
      if (session && session.user?.email !== 'demo@myforemanhq.com') {
        router.push('/dashboard');
      } else {
        setChecking(false);
      }
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
      <Hero router={router} supabase={supabase}/>
      <Compare/>
      <Workflow/>
      <Features/>
      <AIShowcase router={router}/>
      <Pricing billing={billing} setBilling={setBilling} router={router}/>
      <FooterSection/>

      <style jsx global>{`
        html, body { background: #111827; }
        a { color: inherit; }

        .hero-section {
          position: relative; overflow: hidden;
          padding: 18px 0 72px;
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
          width: 760px; height: 760px; border-radius: 50%;
          background: radial-gradient(circle, rgba(79,158,255,0.18), transparent 60%);
          pointer-events: none;
        }
        .hero-headline {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 62px; letter-spacing: 0.04em; line-height: 0.95;
          margin: 0 0 16px; color: #f0f4ff;
        }
        .hero-headline .accent { color: #4f9eff; }
        .hero-subhead {
          font-size: 16px; line-height: 1.55; color: #c8d4ee;
          max-width: 580px; margin: 0 auto 28px;
        }
        @media (min-width: 720px) {
          .hero-headline { font-size: 104px; }
          .hero-subhead { font-size: 19px; }
          .hero-section { padding: 18px 0 88px; }
        }
        @media (min-width: 1024px) {
          .hero-headline { font-size: 128px; }
        }

        .section { padding: 64px 20px; }
        .section.alt {
          background: #0d1726;
          border-top: 1px solid #1f2a40;
          border-bottom: 1px solid #1f2a40;
        }
        .section-inner { max-width: 1080px; margin: 0 auto; }
        .section-headline {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 34px; letter-spacing: 0.04em; line-height: 1.05;
          margin: 0 0 10px; color: #f0f4ff;
        }
        .section-lede {
          font-size: 15px; line-height: 1.55; color: #c8d4ee;
          max-width: 560px; margin: 0 0 32px;
        }
        @media (min-width: 720px) {
          .section { padding: 92px 24px; }
          .section-headline { font-size: 50px; }
          .section-lede { font-size: 17px; }
        }

        .workflow-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 720px)  { .workflow-grid { grid-template-columns: repeat(5, 1fr); gap: 12px; } }

        .feature-grid {
          display: grid; grid-template-columns: 1fr; gap: 12px;
        }
        @media (min-width: 720px)  { .feature-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; } }
        @media (min-width: 1024px) { .feature-grid { grid-template-columns: repeat(3, 1fr); } }

        .pricing-grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 22px; align-items: stretch; }
        @media (min-width: 880px) { .pricing-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; } }

        .footer-row { display: flex; flex-direction: column; gap: 22px; align-items: flex-start; }
        @media (min-width: 720px) { .footer-row { flex-direction: row; align-items: center; justify-content: space-between; } }
      `}</style>
    </div>
  );
}

/* =====================================================
   HERO — two CTAs only. No anchor scroll button.
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
    const meta = { ...(data?.user?.user_metadata || {}) };
    delete meta.onboarding_completed_at;
    delete meta.onboarding_skipped_at;
    await supabase.auth.updateUser({ data: meta });
    router.push('/dashboard');
  };

  return (
    <section className="hero-section">
      <div className="hero-grid-bg"/>
      <div className="hero-glow"/>

      <nav style={{position:'relative',zIndex:2,display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:1200,margin:'0 auto',padding:'0 20px',gap:12}}>
        <Logo size="sm"/>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button onClick={() => router.push('/login')}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.06em'}}>
            SIGN IN
          </button>
          <button onClick={() => router.push('/signup')}
            style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 16px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em'}}>
            START FREE
          </button>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:2,maxWidth:880,margin:'0 auto',padding:'56px 20px 0',textAlign:'center'}}>
        <div style={{display:'inline-block',marginBottom:20,padding:'6px 14px',background:'rgba(79,158,255,0.10)',border:'1px solid rgba(79,158,255,0.3)',borderRadius:999,fontSize:11,letterSpacing:'.12em',fontWeight:700,color:'#4f9eff',textTransform:'uppercase'}}>
          Built for the trades
        </div>
        <h1 className="hero-headline">
          FROM LEAD<br/>TO <span className="accent">PAID.</span>
        </h1>
        <p className="hero-subhead">
          Run your field service business from the booking link to the signed receipt. One app. Mobile-first. We email customers their quotes, invoices, and overdue reminders so you don't have to.
        </p>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={() => router.push('/signup')}
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'14px 26px',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em'}}>
            START 14-DAY FREE TRIAL
          </button>
          <button onClick={launchDemo} disabled={demoBusy}
            style={{background:'transparent',border:'1.5px solid #2edf87',borderRadius:10,color:'#2edf87',padding:'14px 26px',cursor:demoBusy?'wait':'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',opacity:demoBusy?0.6:1}}>
            {demoBusy ? 'OPENING…' : 'LIVE DEMO →'}
          </button>
        </div>
        <div style={{marginTop:14,fontSize:12,color:'#7a8db0',letterSpacing:'.03em'}}>
          Demo opens instantly. No card, no signup.
        </div>
        {demoErr && <div style={{marginTop:10,fontSize:12,color:'#f26060'}}>Couldn't open demo: {demoErr}</div>}
      </div>
    </section>
  );
}

/* =====================================================
   COMPARE — trimmed to the rows that actually win deals.
   No duplicate CTA at bottom.
   ===================================================== */
function Compare() {
  // Category-level differentiators, not specific features (those
  // live in the Features section below — repeating them here was
  // the duplication problem). One row per "thing you'd ask in a
  // buying meeting."
  const rows = [
    { label:'Setup time',                          values:['None',   '4–8 hrs',     '10 min'] },
    { label:'Monthly cost',                        values:['$0',     '$99–$300',    '$39–$159'] },
    { label:'Lead → Paid in one app',              values:['no',     'yes',         'yes'] },
    { label:'Mobile-first PWA',                    values:['no',     'partial',     'yes'] },
    { label:'Direct deposits, no platform cut',    values:['no',     'partial',     'yes'] },
    { label:'Switch from your old platform',       values:['no',     'partial',     '10 min import'] },
    { label:'Tax + accountant-ready exports',      values:['no',     'Add-on $$',   'yes'] },
    { label:'Auto-bills + chases overdue invoices', values:['no',     'partial',     'yes'] },
    { label:'AI business coach',                   values:['no',     'no',          'yes'], ai:true },
    { label:'Live demo',                           values:['N/A',    'Sales call',  'One tap'] },
  ];
  const cols      = ['Texts & sheets', 'Jobber / HCP', 'MyForeman'];
  const colsShort = ['Texts',          'Old-school',   'MyForeman'];

  return (
    <section className="section alt">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center',maxWidth:780,margin:'0 auto 10px'}}>
          The way it should have always been.
        </h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 32px',maxWidth:620}}>
          Your work is professional. Your tools should be too.
        </p>

        <div className="compare-table">
          <div className="compare-row compare-header">
            <div className="compare-feature">&nbsp;</div>
            {cols.map((c, i) => (
              <div key={c} className={'compare-col ' + (i === 2 ? 'compare-us' : '')}>
                {i === 2 && <span style={{color:'#fbbf24',marginRight:4}}>⚡</span>}
                <span className="compare-col-full">{c.toUpperCase()}</span>
                <span className="compare-col-short">{colsShort[i].toUpperCase()}</span>
              </div>
            ))}
          </div>
          {rows.map((row) => (
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
      </div>

      <style jsx>{`
        .compare-table {
          background: #111827; border: 1px solid #2e3f60; border-radius: 14px;
          overflow: hidden; max-width: 880px; margin: 0 auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .compare-row { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; align-items: stretch; }
        .compare-header { border-bottom: 1px solid #2e3f60; background: #0d1726; }
        .compare-header .compare-col {
          font-family: 'Bebas Neue', Impact, sans-serif;
          letter-spacing: .06em; color: #7a8db0;
          text-align: center;
          display: flex; align-items: center; justify-content: center;
        }
        .compare-header .compare-us {
          background: linear-gradient(180deg,rgba(79,158,255,0.20),rgba(79,158,255,0.06));
          color: #f0f4ff; font-weight: 700;
          border-left: 1px solid rgba(79,158,255,0.35);
          border-right: 1px solid rgba(79,158,255,0.35);
        }
        .compare-row + .compare-row { border-top: 1px solid #1f2a40; }
        .compare-row:nth-child(odd) { background: rgba(255,255,255,0.012); }
        .compare-feature { color: #c8d4ee; font-weight: 500; display: flex; align-items: center; }
        .compare-col { text-align: center; color: #c8d4ee; display: flex; align-items: center; justify-content: center; }
        .compare-us {
          background: rgba(79,158,255,0.06);
          border-left: 1px solid rgba(79,158,255,0.35);
          border-right: 1px solid rgba(79,158,255,0.35);
          color: #f0f4ff;
        }
        .compare-ai .compare-feature { color: #fbbf24; }
        .compare-ai .compare-us { background: rgba(251,191,36,0.08); }
        .compare-tag {
          background: rgba(251,191,36,0.15); color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.4); border-radius: 999px;
          padding: 1px 7px; font-size: 9px; font-weight: 700; letter-spacing: .08em; margin-left: 6px;
        }
        .compare-col-short { display: inline; }
        .compare-col-full  { display: none; }
        @media (min-width: 768px) {
          .compare-col-short { display: none; }
          .compare-col-full  { display: inline; }
        }
        .compare-header .compare-col { font-size: 11px; padding: 12px 6px; }
        .compare-feature              { padding: 10px 10px; font-size: 12px; line-height: 1.25; }
        .compare-col                  { padding: 10px 6px; font-size: 12px; }
        @media (min-width: 768px) {
          .compare-row { grid-template-columns: 1.6fr 1fr 1fr 1fr; }
          .compare-header .compare-col { font-size: 13px; letter-spacing: .08em; padding: 16px 14px; }
          .compare-feature              { padding: 13px 18px; font-size: 14px; }
          .compare-col                  { padding: 13px; font-size: 14px; }
        }
      `}</style>
    </section>
  );
}

function CompareCell({ value, isUs }) {
  if (value === 'yes') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isUs ? '#2edf87' : '#7a8db0'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'middle'}}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  if (value === 'no') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f26060" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline-block',verticalAlign:'middle',opacity:0.75}}>
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
  if (value === 'partial') return <span style={{color:'#fbbf24',fontWeight:600}}>Partial</span>;
  return <span style={{color:isUs?'#f0f4ff':'#c8d4ee',fontWeight:isUs?700:500,lineHeight:1.25}}>{value}</span>;
}

/* =====================================================
   WORKFLOW — five steps, tight copy.
   ===================================================== */
function Workflow() {
  // Workflow is the chronological story (lead to paid). Features
  // section below is the by-feature deep dive. To avoid duplication,
  // each stage gets a short value sentence, not a full feature pitch.
  const steps = [
    { label:'Lead',     color:'#54d4f8', icon:<PhoneIcon/>,  desc:'Booking link, quote form, QR code on the truck. Every channel lands in one pipeline, tagged by source.' },
    { label:'Quote',    color:'#b197fc', icon:<ScrollIcon/>, desc:'Build line-item quotes from your price book. Customers approve on their phone. Job is auto-created.' },
    { label:'Work',     color:'#4f9eff', icon:<WrenchIcon/>, desc:'On the way emails the customer. Time clock and mileage auto-track. Customer signs off on the screen.' },
    { label:'Invoice',  color:'#fbbf24', icon:<DocIcon/>,    desc:'Bill fires the second a job completes. Pay Now link in the email. Card, Venmo, Zelle, Cash App.' },
    { label:'Paid',     color:'#2edf87', icon:<CheckIcon/>,  desc:'Money lands in your Stripe. Review request goes out. Books update for tax season.' },
  ];
  return (
    <section className="section">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center'}}>One app. The whole job.</h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 32px'}}>
          Every step of the funnel, in one place. Nothing falls through the cracks.
        </p>
        <div className="workflow-grid">
          {steps.map((s, i) => (
            <div key={s.label} style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'18px 16px',display:'flex',flexDirection:'column',gap:10,alignItems:'flex-start',textAlign:'left',position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
                <div style={{width:44,height:44,borderRadius:10,background:s.color+'22',border:'1px solid '+s.color+'66',display:'flex',alignItems:'center',justifyContent:'center',color:s.color}}>
                  {s.icon}
                </div>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:14,color:'#7a8db0',letterSpacing:'.08em'}}>0{i+1}</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:s.color}}>
                {s.label.toUpperCase()}
              </div>
              <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   FEATURES — six cards that lead with the new stuff.
   Drops the noisy 9-card grid that turned mobile into a scroll.
   ===================================================== */
function Features() {
  const cards = [
    {
      icon: <LinkIcon/>,
      title: 'Leads from everywhere',
      body: "Booking link customers fill out themselves. Quote-request link for fast pricing. QR code for yard signs, trucks, business cards. Phone, walk-in, and referral get tagged by source so you know what's actually working.",
    },
    {
      icon: <DownloadIcon/>,
      title: 'Switch in 10 minutes',
      body: 'Bring your customers, quotes, jobs, invoices, expenses, and mileage from Jobber, Housecall Pro, QuickBooks, or any spreadsheet. One pass, validate-first preview, missing customers auto-create as you go. Nothing lost.',
    },
    {
      icon: <TruckIcon/>,
      title: '"On my way" auto-tracks',
      body: 'One tap emails the customer their crew name and ETA, starts the time clock, and starts the GPS trip. Mark the job complete and mileage logs itself with real driving distance.',
    },
    {
      icon: <SignIcon/>,
      title: 'Customer signs off',
      body: "Finger on the screen at completion. Signature lands on the invoice, emailed receipt, and the customer portal. Disputes don't happen when the receipt has their name on it.",
    },
    {
      icon: <BoltIcon/>,
      title: 'Auto-invoice, chase, review',
      body: 'Job marked complete: invoice fires with a Pay Now link. One week past due: friendly reminder. Two weeks: firmer one. A month: final notice. Once they pay, a review request goes out. You stop chasing checks.',
    },
    {
      icon: <CardIcon/>,
      title: 'Cards + Venmo + Zelle + Cash App',
      body: 'Customers pay any way they want. Cards run through your own Stripe (we take no cut). Cash App, Venmo, Zelle, PayPal, and check info land on the invoice with tap-to-pay deeplinks.',
    },
    {
      icon: <CycleIcon/>,
      title: 'Recurring + multi-day + portal',
      body: 'Set a maintenance plan once, jobs materialize on cadence. Multi-day jobs span the calendar correctly. Customer portal shows quotes, scheduled visits, and unpaid invoices. No login needed.',
    },
    {
      icon: <ChartIcon/>,
      title: 'Tax + accountant exports',
      body: 'Quarterly tax estimates that account for income, expenses, and IRS mileage. Accountant CSV and QuickBooks Online CSV exports at year-end. Your books, ready when they ask.',
    },
  ];

  return (
    <section className="section alt">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center',maxWidth:740,margin:'0 auto 10px'}}>
          Built to run itself.
        </h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 32px',maxWidth:620}}>
          Automation that quietly handles the busywork so you can spend the day on the job, not the laptop.
        </p>

        <div className="feature-grid">
          {cards.map((c, i) => (
            <div key={i} className={'feature-card ' + (c.ai ? 'feature-card-ai' : '')}>
              {c.ai && <span className="feature-ai-tag">AI</span>}
              <div className={'feature-icon ' + (c.ai ? 'feature-icon-ai' : '')}>{c.icon}</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',color:'#f0f4ff',marginTop:4,marginBottom:6}}>
                {c.title.toUpperCase()}
              </div>
              <div style={{fontSize:13.5,lineHeight:1.55,color:'#c8d4ee'}}>{c.body}</div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .feature-card {
          background: #1e2a42;
          border: 1px solid #2e3f60;
          border-radius: 14px;
          padding: 22px 20px;
          position: relative;
          transition: border-color .2s, transform .2s;
        }
        .feature-card:hover { border-color: #4f9eff; transform: translateY(-2px); }
        .feature-card-ai {
          background: linear-gradient(160deg, rgba(251,191,36,0.06) 0%, #1e2a42 55%);
          border-color: rgba(251,191,36,0.35);
        }
        .feature-card-ai:hover { border-color: rgba(251,191,36,0.7); }
        .feature-ai-tag {
          position: absolute; top: 14px; right: 14px;
          background: rgba(251,191,36,0.15); color: #fbbf24;
          border: 1px solid rgba(251,191,36,0.45);
          border-radius: 999px; padding: 2px 9px;
          font-size: 10px; font-weight: 700; letter-spacing: .1em;
        }
        .feature-icon {
          width: 42px; height: 42px; border-radius: 10px;
          background: rgba(79,158,255,0.12);
          border: 1px solid rgba(79,158,255,0.35);
          color: #4f9eff;
          display: flex; align-items: center; justify-content: center;
        }
        .feature-icon-ai {
          background: rgba(251,191,36,0.12);
          border-color: rgba(251,191,36,0.45);
          color: #fbbf24;
        }
      `}</style>
    </section>
  );
}

/* =====================================================
   AI SHOWCASE — real example insights so "AI business coach"
   isn't vaporware copy. Each card looks like a real chat bubble
   from the in-app insights feed. Numbers are illustrative but
   formatted exactly the way the live AI ships them.
   ===================================================== */
function AIShowcase({ router }) {
  // Four AI capabilities, four insight examples to back up the coach.
  const tools = [
    {
      title: 'AI Receptionist',
      sub: 'On your booking link',
      body: 'Customers chat with an AI to book a service. It asks the right qualifying questions, picks a date, and drops the lead in your queue.',
    },
    {
      title: 'In-app Assistant',
      sub: '✨ One tap, every page',
      body: 'Tap the sparkle button. Type "log $40 fuel" or "what\'s my net this month." It runs the action or answers from your data.',
    },
    {
      title: 'Invoice Import',
      sub: 'Snap a photo',
      body: 'Take a picture of a vendor bill or contractor PDF. AI pulls the customer, total, dates, and line items in seconds. No retyping.',
    },
    {
      title: 'Monthly Business Coach',
      sub: 'Reads your books',
      body: 'Once a month, MyForeman reads your revenue, jobs, customers, and expenses and ships 4 to 5 specific plays with dollar figures attached. See examples below.',
    },
  ];
  const insights = [
    {
      tag: 'Pricing',
      tagColor: '#2edf87',
      title: "You're underpriced on lawn care.",
      body: "Your average lawn-care job in your area runs $187. Competitors are charging $215+. A $199 price point won't lose customers and adds about $340/mo across your 25 active accounts.",
      impact: '+$4,080/yr',
    },
    {
      tag: 'Retention',
      tagColor: '#4f9eff',
      title: '8 customers ghosted you this year.',
      body: "8 customers who used you in 2024 haven't booked again. 6 of them left 5-star reviews. Send the \"haven't seen you in a while\" nudge. Historical conversion on that template is ~30%.",
      impact: '~$1,200 win-back',
    },
    {
      tag: 'Profitability',
      tagColor: '#fbbf24',
      title: 'Spring cleanups are losing you money.',
      body: 'Your spring cleanups have an effective hourly rate of $42/hr after labor and materials. Your gutter cleanings hit $148/hr. Raise spring cleanup pricing or move those bodies to gutters in March.',
      impact: '3.5x margin gap',
    },
    {
      tag: 'Cash flow',
      tagColor: '#f26060',
      title: '$2,847 sitting in unpaid invoices.',
      body: 'Six invoices (#1042-1047) are an average of 19 days old. Auto-reminders already went out at day 7. Worth a personal call on the two over $800. Those convert ~3x better than another email.',
      impact: 'Collect this week',
    },
  ];
  return (
    <section className="section ai-showcase">
      <div className="section-inner">
        <div style={{textAlign:'center',marginBottom:8}}>
          <span style={{display:'inline-block',padding:'6px 14px',background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.45)',borderRadius:999,fontSize:11,letterSpacing:'.12em',fontWeight:700,color:'#fbbf24',textTransform:'uppercase'}}>
            ⚡ AI built for the trades
          </span>
        </div>
        <h2 className="section-headline" style={{textAlign:'center',maxWidth:780,margin:'12px auto 10px'}}>
          Four AI tools that actually do the work.
        </h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 28px',maxWidth:640}}>
          Not chatbots that talk. Tools that book leads, log your expenses, read vendor bills, and tell you where the money is.
        </p>

        <div className="ai-tools-grid">
          {tools.map((t, i) => (
            <div key={i} className="ai-tool-card">
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.04em',color:'#fbbf24',marginBottom:2}}>
                {t.title.toUpperCase()}
              </div>
              <div style={{fontSize:11,color:'#fbbf24',letterSpacing:'.06em',fontWeight:700,textTransform:'uppercase',marginBottom:8,opacity:0.7}}>
                {t.sub}
              </div>
              <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55}}>{t.body}</div>
            </div>
          ))}
        </div>

        <div style={{marginTop:36,marginBottom:14,textAlign:'center',fontSize:11,letterSpacing:'.14em',fontWeight:700,color:'#fbbf24',textTransform:'uppercase'}}>
          The monthly coach in action
        </div>
        <div className="insight-grid">
          {insights.map((it, i) => (
            <div key={i} className="insight-card">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,gap:8}}>
                <span style={{background:it.tagColor+'1f',color:it.tagColor,border:`1px solid ${it.tagColor}66`,borderRadius:999,padding:'3px 10px',fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                  {it.tag}
                </span>
                <span style={{fontSize:11,color:it.tagColor,fontWeight:700,letterSpacing:'.04em'}}>{it.impact}</span>
              </div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.03em',color:'#f0f4ff',lineHeight:1.15,marginBottom:8}}>
                {it.title}
              </div>
              <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55}}>{it.body}</div>
            </div>
          ))}
        </div>

        <div style={{textAlign:'center',marginTop:28,fontSize:12,color:'#7a8db0'}}>
          Sample output. Your actual recommendations come from your books, not these.
        </div>
      </div>

      <style jsx>{`
        .ai-showcase {
          background:
            radial-gradient(ellipse 60% 50% at 50% 0%, rgba(251,191,36,0.08), transparent 70%),
            #0d1726;
          border-top: 1px solid #1f2a40;
          border-bottom: 1px solid #1f2a40;
        }
        .ai-tools-grid { display: grid; grid-template-columns: 1fr; gap: 12px; max-width: 960px; margin: 0 auto; }
        @media (min-width: 760px) { .ai-tools-grid { grid-template-columns: 1fr 1fr; gap: 14px; } }
        @media (min-width: 1024px) { .ai-tools-grid { grid-template-columns: repeat(4, 1fr); } }
        .ai-tool-card {
          background: linear-gradient(160deg, rgba(251,191,36,0.08) 0%, #1e2a42 60%);
          border: 1px solid rgba(251,191,36,0.45);
          border-radius: 12px; padding: 16px;
        }
        .insight-grid { display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 920px; margin: 0 auto; }
        @media (min-width: 760px) { .insight-grid { grid-template-columns: 1fr 1fr; gap: 18px; } }
        .insight-card {
          background: linear-gradient(160deg, rgba(251,191,36,0.05) 0%, #1e2a42 60%);
          border: 1px solid rgba(251,191,36,0.30);
          border-radius: 14px; padding: 18px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        }
      `}</style>
    </section>
  );
}

/* =====================================================
   PRICING — three plans. Annual is 11x monthly (1 mo free).
   ===================================================== */
function Pricing({ billing, setBilling, router }) {
  const plans = [
    { name:'Solo',     monthly:39,  users:'1 user',          subtitle:'For owner-operators' },
    { name:'Crew',     monthly:69,  users:'Up to 10 users',  subtitle:'For service crews', popular:true },
    { name:'Business', monthly:159, users:'Up to 25 users',  subtitle:'For multi-crew shops' },
  ];
  return (
    <section className="section">
      <div className="section-inner">
        <h2 className="section-headline" style={{textAlign:'center'}}>Simple pricing. Every feature.</h2>
        <p className="section-lede" style={{textAlign:'center',margin:'0 auto 22px'}}>
          One plan per crew size. No feature gates. No add-on tier for the stuff you actually need.
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
          {billing === 'annual' ? '1 MONTH FREE' : ' '}
        </div>

        <div className="pricing-grid">
          {plans.map(p => <PricingCard key={p.name} plan={p} billing={billing} router={router}/>)}
        </div>

        <p style={{textAlign:'center',fontSize:13,color:'#7a8db0',marginTop:22}}>
          14-day free trial. Full product. Import your existing customers + jobs from Jobber, HCP, or QuickBooks in minutes.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ plan, billing, router }) {
  const isAnnual = billing === 'annual';
  const annualTotal = plan.monthly * 11;
  const displayPrice = isAnnual ? Math.round(annualTotal / 12) : plan.monthly;
  const popular = plan.popular;

  return (
    <div style={{
      background: popular ? '#1e2a42' : '#111827',
      border: popular ? '2px solid #4f9eff' : '1.5px solid #2e3f60',
      borderRadius: 16,
      padding: '26px 22px 22px',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transform: popular ? 'translateY(-4px)' : 'none',
      boxShadow: popular ? '0 12px 32px rgba(79,158,255,0.15)' : 'none',
    }}>
      {popular && (
        <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'#4f9eff',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:'.14em',padding:'4px 12px',borderRadius:999,whiteSpace:'nowrap'}}>
          MOST POPULAR
        </div>
      )}
      <div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',color:'#f0f4ff'}}>
          {plan.name.toUpperCase()}
        </div>
        <div style={{fontSize:12,color:'#7a8db0',marginTop:2}}>{plan.subtitle}</div>
      </div>
      <div>
        <div style={{display:'flex',alignItems:'baseline',gap:6}}>
          <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:52,color:'#f0f4ff',letterSpacing:'.02em',lineHeight:1}}>
            ${displayPrice}
          </span>
          <span style={{fontSize:13,color:'#7a8db0'}}>/month</span>
        </div>
        <div style={{fontSize:11,color: isAnnual ? '#2edf87' : '#7a8db0',marginTop:6,fontWeight:isAnnual?700:400,letterSpacing:isAnnual?'.04em':0}}>
          {isAnnual ? `$${annualTotal} billed annually` : 'Billed monthly'}
        </div>
      </div>
      <div style={{fontSize:14,color:'#c8d4ee',fontWeight:600}}>{plan.users}</div>
      <button onClick={() => router.push('/signup')}
        style={{background: popular?'#4f9eff':'transparent',color: popular?'#fff':'#c8d4ee',border: popular?'none':'1px solid #2e3f60',borderRadius:10,padding:'13px 0',cursor:'pointer',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.08em',fontWeight:700}}>
        START FREE TRIAL
      </button>
      <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:4,paddingTop:14,borderTop:'1px solid #2e3f60'}}>
        {[
          'Every feature, no add-on tiers',
          'Unlimited customers, jobs, invoices',
          'Branded customer emails',
          'PWA on iPhone + Android',
          '14-day free trial',
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
    <footer style={{padding:'40px 20px 32px',borderTop:'1px solid #1f2a40'}}>
      <div className="footer-row" style={{maxWidth:1080,margin:'0 auto'}}>
        <div>
          <Logo size="sm"/>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',marginTop:8,fontWeight:600,textTransform:'uppercase'}}>
            From lead to paid
          </div>
        </div>
        <div style={{display:'flex',gap:24,fontSize:13,color:'#7a8db0',flexWrap:'wrap',justifyContent:'center'}}>
          <a href="/contact" style={{color:'#7a8db0',textDecoration:'none'}}>Contact</a>
          <a href="/privacy" style={{color:'#7a8db0',textDecoration:'none'}}>Privacy</a>
          <a href="/terms"   style={{color:'#7a8db0',textDecoration:'none'}}>Terms</a>
        </div>
        <div style={{fontSize:11,color:'#7a8db0',textAlign:'center'}}>
          <a href="mailto:hello@myforemanhq.com" style={{color:'#7a8db0',textDecoration:'none'}}>hello@myforemanhq.com</a>
          <div style={{marginTop:6}}>© {new Date().getFullYear()} MyForeman</div>
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
function TruckIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 16V4h13v12M14 8h5l3 4v4h-8"/>
    <circle cx="6.5" cy="18" r="2"/>
    <circle cx="17.5" cy="18" r="2"/>
  </svg>
);}
function CardIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
    <line x1="6" y1="15" x2="10" y2="15"/>
  </svg>
);}
function LinkIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1"/>
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1"/>
  </svg>
);}
function SignIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
    <path d="M14.06 6.19l3.75 3.75"/>
  </svg>
);}
function DownloadIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);}
function CycleIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/>
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/>
  </svg>
);}
function ChartIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"/>
    <line x1="18" y1="20" x2="18" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>
);}
