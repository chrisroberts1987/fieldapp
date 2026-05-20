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
      <Pain />
      <Workflow />
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

        .pain-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 720px) {
          .pain-grid { grid-template-columns: repeat(3, 1fr); gap: 20px; }
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
    const { error } = await supabase.auth.signInWithPassword({
      email: 'demo@myforemanhq.com',
      password: 'demo1234',
    });
    if (error) { setDemoErr(error.message); setDemoBusy(false); return; }
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
          Built for handymen, contractors, and service crews
        </div>
        <h1 className="hero-headline">
          FROM LEAD<br/>TO <span className="accent">PAID.</span>
        </h1>
        <p className="hero-subhead">
          MyForeman runs your field service business from first call to final payment — with AI insights that help you grow.
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
          Card required for the free trial. The live demo opens instantly — no signup, no card.
        </div>
        {demoErr && <div style={{marginTop:10,fontSize:12,color:'#f26060'}}>Couldn't open demo: {demoErr}</div>}
      </div>
    </section>
  );
}

/* =====================================================
   PAIN
   ===================================================== */
function Pain() {
  const pains = [
    { icon:<CashIcon/>,     text:'Chasing payments with no paper trail' },
    { icon:<NotebookIcon/>, text:'Quoting jobs off the top of your head' },
    { icon:<ChartIcon/>,    text:"No idea which jobs are actually profitable" },
  ];
  return (
    <section className="section alt">
      <div className="section-inner" style={{textAlign:'center'}}>
        <h2 className="section-headline" style={{textAlign:'center',maxWidth:780,margin:'0 auto 40px'}}>
          Still running your business from texts and spreadsheets?
        </h2>
        <div className="pain-grid">
          {pains.map((p, i) => (
            <div key={i} style={{background:'#111827',border:'1px solid #2e3f60',borderRadius:14,padding:'28px 22px',textAlign:'left',display:'flex',flexDirection:'column',gap:14}}>
              <div style={{width:48,height:48,borderRadius:10,background:'rgba(242,96,96,0.12)',border:'1px solid rgba(242,96,96,0.3)',display:'flex',alignItems:'center',justifyContent:'center',color:'#f26060'}}>
                {p.icon}
              </div>
              <div style={{fontSize:17,lineHeight:1.4,color:'#f0f4ff',fontWeight:500}}>
                {p.text}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   WORKFLOW
   ===================================================== */
function Workflow() {
  const steps = [
    { label:'Lead',     color:'#54d4f8', icon:<PhoneIcon/>,  desc:'Capture every quote request from your shareable link, phone, or referrals.' },
    { label:'Job',      color:'#4f9eff', icon:<WrenchIcon/>, desc:'Schedule the work. Track crew, status, dates, and pricing.' },
    { label:'Estimate', color:'#b197fc', icon:<ScrollIcon/>, desc:'Send a clean quote that closes. Convert it to a job when accepted.' },
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
function CashIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <circle cx="12" cy="12" r="3"/>
    <path d="M6 12h.01M18 12h.01"/>
  </svg>
);}
function NotebookIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4z"/>
    <path d="M8 8h8M8 12h8M8 16h5"/>
    <path d="M4 4v18"/>
  </svg>
);}
function ChartIcon() { return (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="M7 14l4-4 4 4 5-7"/>
  </svg>
);}
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
