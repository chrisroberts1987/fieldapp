import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

// Color tokens kept inline-readable so designer + dev are working off the
// same palette as the source mockup at design/myforeman-landing-mockup_8.html.
const C = {
  bg:        '#0a0f1a',
  surface:   '#111827',
  card:      '#1a2438',
  border:    '#1e2e4a',
  borderHi:  '#2e3f60',
  blue:      '#4f9eff',
  blueDeep:  '#2a7de8',
  green:     '#2edf87',
  red:       '#f26060',
  yellow:    '#fbbf24',
  orange:    '#fb923c',
  cyan:      '#54d4f8',
  purple:    '#b197fc',
  text:      '#f0f4ff',
  subtext:   '#c8d4ee',
  muted:     '#7a8db0',
  dark:      '#3a4a66',
};

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [billing, setBilling] = useState('monthly');

  useEffect(() => {
    const standalone = typeof window !== 'undefined'
      && (window.matchMedia?.('(display-mode: standalone)')?.matches
          || window.navigator?.standalone === true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (standalone) {
        router.push(session ? '/dashboard' : '/login');
        return;
      }
      if (session && session.user?.email !== 'demo@myforemanhq.com') {
        router.push('/dashboard');
      } else {
        setChecking(false);
      }
    });
  }, []);

  if (checking) {
    return (
      <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.text,fontFamily:"'Inter',system-ui,sans-serif"}}>
        Loading...
      </div>
    );
  }

  const launchDemo = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'demo@myforemanhq.com',
      password: 'demo1234',
    });
    if (error) return;
    const meta = { ...(data?.user?.user_metadata || {}) };
    delete meta.onboarding_completed_at;
    delete meta.onboarding_skipped_at;
    await supabase.auth.updateUser({ data: meta });
    router.push('/dashboard');
  };

  return (
    <div style={{background:C.bg,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",overflowX:'hidden'}}>
      <Nav router={router}/>
      <Hero router={router} launchDemo={launchDemo}/>
      <Compare/>
      <Features/>
      <Workflow/>
      <CompareTable/>
      <Pricing billing={billing} setBilling={setBilling} router={router}/>
      <FinalCta router={router} launchDemo={launchDemo}/>
      <Footer/>

      <style jsx global>{`
        html, body { background: ${C.bg}; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; }

        .container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }

        .h1-hero {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(56px, 7vw, 104px);
          line-height: .88; letter-spacing: .04em;
          color: #fff; margin: 0 0 14px;
          text-shadow: 0 0 80px rgba(79,158,255,0.12);
        }
        .h1-hero .blue  { color: ${C.blue}; }
        .h1-hero .green { color: ${C.green}; }

        .h2-problem {
          font-size: clamp(28px, 3.4vw, 48px);
          font-weight: 900; line-height: 1.1; letter-spacing: -.02em;
          color: ${C.text}; margin: 0 0 20px;
        }
        .struck {
          color: ${C.dark};
          text-decoration: line-through;
          text-decoration-color: ${C.red};
          text-decoration-thickness: 3px;
        }
        .red-text { color: ${C.red}; }

        .eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          font-size: 11px; font-weight: 800; letter-spacing: .22em;
          text-transform: uppercase;
        }
        .eyebrow::before {
          content: ''; display: block; width: 32px; height: 2px;
          background: currentColor;
        }

        .btn-primary {
          background: linear-gradient(135deg, ${C.blue}, ${C.blueDeep});
          color: #fff; font-weight: 800; letter-spacing: .06em;
          text-transform: uppercase; border: none; border-radius: 12px;
          box-shadow: 0 8px 32px rgba(79,158,255,0.4);
          padding: 16px 32px; font-size: 15px;
        }
        .btn-primary:hover { transform: translateY(-1px); }

        .btn-ghost {
          background: rgba(255,255,255,0.03);
          color: ${C.subtext}; font-weight: 700;
          border: 1px solid ${C.borderHi}; border-radius: 12px;
          padding: 16px 24px; font-size: 14px;
        }

        .section-label {
          text-align: center;
          font-size: 11px; font-weight: 800;
          letter-spacing: .2em; text-transform: uppercase;
          color: ${C.muted};
          display: flex; align-items: center; justify-content: center;
          gap: 16px; margin: 0 0 48px;
        }
        .section-label::before, .section-label::after {
          content: ''; flex: 1; height: 1px;
          background: ${C.border}; max-width: 220px;
        }

        /* Hero phone */
        .phone-wrap { position: relative; }
        .phone {
          width: 300px; height: 620px; border-radius: 48px;
          border: 2.5px solid rgba(255,255,255,0.14);
          overflow: hidden; position: relative; background: #000;
          box-shadow:
            0 0 0 1px rgba(0,0,0,0.5),
            0 40px 120px rgba(0,0,0,0.8),
            0 0 80px rgba(79,158,255,0.2);
        }
        .phone img {
          width: 100%; height: 100%;
          object-fit: cover; object-position: top center; display: block;
        }
        .phone-notch {
          position: absolute; top: 0; left: 50%; transform: translateX(-50%);
          width: 120px; height: 32px; background: #000;
          border-radius: 0 0 22px 22px; z-index: 10;
        }
        .phone-glow {
          position: absolute; bottom: -60px; left: 50%; transform: translateX(-50%);
          width: 300px; height: 120px;
          background: radial-gradient(ellipse, rgba(79,158,255,0.35) 0%, transparent 70%);
          z-index: 0; pointer-events: none;
        }
        .feat-card {
          background: ${C.card};
          border: 1px solid ${C.border};
          border-radius: 14px;
          padding: 24px 20px;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 8px;
        }
        .feat-top-bar {
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
        }

        @media (max-width: 980px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 60px !important; }
          .phone { width: 260px; height: 540px; }
          .feat-grid { grid-template-columns: 1fr 1fr !important; }
          .price-grid { grid-template-columns: 1fr 1fr !important; }
          .all-features { grid-template-columns: 1fr 1fr !important; }
          .compare-grid { grid-template-columns: 1fr !important; }
          .container { padding: 0 20px; }
          .nav-links { display: none !important; }
          .wf-arrow { display: none !important; }
          .wf-steps { flex-wrap: wrap !important; justify-content: center !important; gap: 12px !important; }
        }
        @media (max-width: 560px) {
          .feat-grid { grid-template-columns: 1fr !important; }
          .price-grid { grid-template-columns: 1fr !important; }
          .all-features { grid-template-columns: 1fr !important; }
          .hero-ctas { flex-direction: column; align-items: stretch !important; }
          .hero-ctas button { width: 100%; }
          .social-proof { flex-wrap: wrap; gap: 16px !important; }
        }
      `}</style>
    </div>
  );
}

/* =====================================================
   NAV
   ===================================================== */
function Nav({ router }) {
  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      background:'rgba(10,15,26,0.85)',
      backdropFilter:'blur(20px)',
      WebkitBackdropFilter:'blur(20px)',
      borderBottom:`1px solid ${C.border}`,
      height:68,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 32px',
    }}>
      <Link href="/" style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{
          width:38, height:38,
          background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
          borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 16px rgba(79,158,255,0.4)',
        }}>
          <HardHatIcon/>
        </div>
        <div style={{display:'flex',flexDirection:'column',lineHeight:1}}>
          <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.1em',color:'#fff'}}>MY</span>
          <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.1em',color:C.blue,marginTop:-2}}>FOREMAN</span>
        </div>
      </Link>
      <div className="nav-links" style={{display:'flex',alignItems:'center',gap:32}}>
        <a href="#features" style={{fontSize:14,fontWeight:600,color:C.muted}}>Features</a>
        <a href="#pricing" style={{fontSize:14,fontWeight:600,color:C.muted}}>Pricing</a>
        <a href="#demo" style={{fontSize:14,fontWeight:600,color:C.muted}}>Demo</a>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button onClick={() => router.push('/login')} style={{
          fontSize:13, fontWeight:700, color:C.subtext,
          padding:'9px 18px', borderRadius:8,
          border:`1px solid ${C.borderHi}`, background:'transparent',
          letterSpacing:'.02em',
        }}>
          Sign In
        </button>
        <button onClick={() => router.push('/signup')} style={{
          fontSize:13, fontWeight:800, color:'#fff',
          padding:'10px 20px', borderRadius:8,
          background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
          border:'none',
          letterSpacing:'.04em', textTransform:'uppercase',
          boxShadow:'0 4px 16px rgba(79,158,255,0.35)',
        }}>
          Start Free Trial
        </button>
      </div>
    </nav>
  );
}

/* =====================================================
   HERO
   Problem-first hero: pain points + struck-through headline,
   then "ONE APP. LEAD TO PAID." with the phone screenshot on
   the right and two floating activity badges around it.
   ===================================================== */
function Hero({ router, launchDemo }) {
  return (
    <section style={{
      position:'relative', overflow:'hidden',
      paddingTop:68,
      display:'flex', alignItems:'center',
      minHeight:'100vh',
    }}>
      {/* Background effects */}
      <div style={{position:'absolute',inset:0,zIndex:0}}>
        <div style={{
          position:'absolute',inset:0,
          backgroundImage:'radial-gradient(circle, rgba(79,158,255,0.12) 1px, transparent 1px)',
          backgroundSize:'48px 48px',
          maskImage:'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,0,0,0.4) 0%, transparent 100%)',
          WebkitMaskImage:'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,0,0,0.4) 0%, transparent 100%)',
          opacity:0.5,
        }}/>
        <div style={{
          position:'absolute',top:'-20%',right:'-10%',
          width:'70vw',height:'70vw',
          background:'radial-gradient(circle, rgba(79,158,255,0.14) 0%, transparent 60%)',
        }}/>
        <div style={{
          position:'absolute',bottom:'-20%',left:'-10%',
          width:'60vw',height:'60vw',
          background:'radial-gradient(circle, rgba(46,223,135,0.09) 0%, transparent 60%)',
        }}/>
      </div>

      <div className="container" style={{position:'relative',zIndex:10,padding:'80px 32px',width:'100%'}}>
        <div className="hero-grid" style={{
          display:'grid',
          gridTemplateColumns:'1fr 420px',
          gap:80,
          alignItems:'center',
        }}>
          {/* Left: problem then solution */}
          <div>
            <div className="eyebrow" style={{color:C.red,marginBottom:24}}>
              <span>Sound Familiar?</span>
            </div>

            <h1 className="h2-problem">
              You&apos;re great at your trade.<br/>
              Your <span className="struck">tools</span> are <span className="red-text">failing you.</span>
            </h1>

            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:28}}>
              {[
                'Chasing unpaid invoices by text message',
                'Paying $150 a month and still hitting feature paywalls',
                'Leads falling through the cracks while you are on the job',
                'Juggling three different apps just to run one business',
              ].map(t => <PainItem key={t} text={t}/>)}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:16,margin:'4px 0 24px'}}>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${C.borderHi}, transparent)`}}/>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.16em',color:C.blue,whiteSpace:'nowrap'}}>
                THERE IS A BETTER WAY
              </div>
              <div style={{flex:1,height:1,background:`linear-gradient(270deg, ${C.borderHi}, transparent)`}}/>
            </div>

            <div className="eyebrow" style={{color:C.blue,marginBottom:16}}>
              <span>Introducing MyForeman</span>
            </div>

            <h2 className="h1-hero">
              ONE APP.<br/>
              <span className="blue">LEAD</span> TO <span className="green">PAID.</span>
            </h2>

            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
              <span style={{fontSize:18,fontWeight:800,fontStyle:'italic',color:C.subtext,whiteSpace:'nowrap'}}>
                &ldquo;The last app you&apos;ll ever need.&rdquo;
              </span>
              <div style={{flex:1,height:1,background:`linear-gradient(90deg, rgba(79,158,255,0.5), transparent)`}}/>
            </div>

            <p style={{fontSize:16,color:C.muted,lineHeight:1.7,marginBottom:36,maxWidth:560}}>
              <strong style={{color:C.subtext,fontWeight:700}}>Stop chasing. Stop juggling. Stop overpaying.</strong> MyForeman automates your entire field service business, from the moment a lead comes in to the second you get paid. Built for the job site, not the office.
            </p>

            <div className="hero-ctas" style={{display:'flex',alignItems:'center',gap:14,marginBottom:36}}>
              <button className="btn-primary" onClick={() => router.push('/signup')} style={{padding:'16px 36px',fontSize:16}}>
                Start Free Trial
              </button>
              <button className="btn-ghost" onClick={launchDemo} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:C.green}}>▶</span> See Live Demo
              </button>
            </div>

            <div style={{fontSize:12,color:C.muted,display:'flex',alignItems:'center',gap:8,marginBottom:24}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:C.green,boxShadow:'0 0 6px rgba(46,223,135,0.6)'}}/>
              14-day free trial · Setup in 10 minutes · Cancel anytime
            </div>

            <div className="social-proof" style={{display:'flex',alignItems:'center',gap:20,paddingTop:24,borderTop:`1px solid ${C.border}`}}>
              <ProofItem num="14" label="Day Free Trial"/>
              <div style={{width:1,height:40,background:C.borderHi}}/>
              <ProofItem num="$39" label="Starting Price"/>
              <div style={{width:1,height:40,background:C.borderHi}}/>
              <ProofItem num="10 MIN" label="Setup Time"/>
              <div style={{width:1,height:40,background:C.borderHi}}/>
              <ProofItem num="0" label="Feature Gates"/>
            </div>
          </div>

          {/* Right: phone */}
          <div style={{display:'flex',justifyContent:'center'}}>
            <div className="phone-wrap">
              <div className="phone-glow"/>
              <div className="phone">
                <img src="/hero-app-screenshot.png" alt="MyForeman app screenshot"/>
                <div className="phone-notch"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PainItem({ text }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      background:'rgba(242,96,96,0.07)',
      border:'1px solid rgba(242,96,96,0.18)',
      borderRadius:10,
      padding:'12px 16px',
    }}>
      <div style={{
        width:24,height:24,borderRadius:'50%',
        background:'rgba(242,96,96,0.2)',
        color:C.red,
        fontSize:12,fontWeight:900,
        display:'flex',alignItems:'center',justifyContent:'center',
        flexShrink:0,
      }}>✕</div>
      <span style={{fontSize:14,fontWeight:700,color:C.subtext}}>{text}</span>
    </div>
  );
}

function ProofItem({ num, label }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.04em',color:C.green}}>{num}</div>
      <div style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'.06em',textTransform:'uppercase'}}>{label}</div>
    </div>
  );
}

/* =====================================================
   COMPARE — Before MyForeman vs After
   ===================================================== */
function Compare() {
  const before = [
    'Chasing payments with texts for weeks',
    '$150 a month software with endless feature paywalls',
    'Losing leads because you were busy on a job',
    'No idea which jobs are actually profitable',
  ];
  const after = [
    'Invoice sent automatically when the job is done',
    'Everything included from $39 a month, no paywalls ever',
    'AI chat captures and books leads 24/7 for you',
    'AI Coach shows exactly where you make money',
  ];
  return (
    <section style={{background:C.surface,padding:'80px 0',borderTop:`1px solid ${C.border}`}}>
      <div className="container">
        <div className="section-label">Before vs. After</div>

        <div className="compare-grid" style={{
          maxWidth:1000, margin:'0 auto',
          display:'grid', gridTemplateColumns:'1fr 1fr', gap:16,
        }}>
          <div>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:'.18em',textTransform:'uppercase',color:C.red,marginBottom:12}}>
              Before MyForeman
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {before.map(t => <CmpRow key={t} bad text={t}/>)}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:800,letterSpacing:'.18em',textTransform:'uppercase',color:C.green,marginBottom:12}}>
              After MyForeman
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {after.map(t => <CmpRow key={t} text={t}/>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CmpRow({ bad, text }) {
  const color = bad ? C.red : C.green;
  return (
    <div style={{
      display:'flex',alignItems:'center',gap:10,
      borderRadius:10,padding:'14px 16px',
      background: bad ? 'rgba(242,96,96,.07)' : 'rgba(46,223,135,.07)',
      border: `1px solid ${bad ? 'rgba(242,96,96,.16)' : 'rgba(46,223,135,.16)'}`,
    }}>
      <div style={{
        width:24,height:24,borderRadius:'50%',
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:12,fontWeight:900,flexShrink:0,
        background: bad ? 'rgba(242,96,96,.2)' : 'rgba(46,223,135,.2)',
        color,
      }}>
        {bad ? '✕' : '✓'}
      </div>
      <span style={{fontSize:14,fontWeight:700,color:C.subtext}}>{text}</span>
    </div>
  );
}

/* =====================================================
   FEATURES — 6 cards in 3x2
   No icons. Stat + small label + name + description.
   ===================================================== */
function Features() {
  const cards = [
    { stat:'24/7',      label:'Always On',                       name:'Lead Capture',       color:C.blue,
      desc:'QR code + AI chat captures and books leads while you sleep. Share your link anywhere. Facebook, Google, job sites.' },
    { stat:'1 tap',     label:'Customer Approval',               name:'Smart Quotes',       color:C.green,
      desc:'Build a professional quote in minutes. The customer approves from their phone. The job gets created automatically.' },
    { stat:'Real time', label:'Live Tracking',                   name:'Job Management',     color:C.yellow,
      desc:'Dispatch crew, track job progress live, and document everything with before / after photos from the job site.' },
    { stat:'3 roles',   label:'Foreman · Supervisor · Crew',     name:'Crew Control',       color:C.orange,
      desc:'Role-based access, expense approvals, GPS mileage tracking, and crew dispatch all built in.' },
    { stat:'$0 chased', label:'Auto-Sent on Completion',         name:'Auto Invoicing',     color:C.cyan,
      desc:'Job marked done, invoice sent to your customer automatically. No more chasing payments by text.' },
    { stat:'Monthly',   label:'Business Analysis',               name:'AI Business Coach',  color:C.purple,
      desc:'Your AI coach analyzes revenue, expenses, and job profitability every month with specific recommendations to grow.' },
  ];
  return (
    <section id="features" style={{background:C.surface,padding:'40px 0 80px'}}>
      <div className="container">
        <div className="section-label">Everything Built In. Nothing Extra To Buy.</div>
        <div className="feat-grid" style={{
          maxWidth:1100, margin:'0 auto',
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14,
        }}>
          {cards.map(c => (
            <div key={c.name} className="feat-card">
              <div className="feat-top-bar" style={{background:c.color}}/>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,lineHeight:1,letterSpacing:'.04em',color:c.color,marginBottom:2}}>
                {c.stat}
              </div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',color:c.color,opacity:.7,marginBottom:8}}>
                {c.label}
              </div>
              <div style={{fontSize:15,fontWeight:800,color:C.text}}>{c.name}</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   WORKFLOW STRIP
   ===================================================== */
function Workflow() {
  const steps = ['Lead','Quote','Approved','Job','Done','Invoice','Paid','Review'];
  return (
    <section style={{background:C.surface,padding:'0 0 80px'}}>
      <div className="container">
        <div style={{
          maxWidth:1000, margin:'0 auto',
          background:'linear-gradient(135deg, rgba(79,158,255,.08), rgba(46,223,135,.04))',
          border:'1px solid rgba(79,158,255,.22)',
          borderRadius:16, padding:'28px 40px',
        }}>
          <div style={{
            fontSize:11,fontWeight:800,letterSpacing:'.18em',textTransform:'uppercase',color:C.blue,
            marginBottom:20,display:'flex',alignItems:'center',gap:8,
          }}>
            ⚡ Fully Automated Workflow
          </div>
          <div className="wf-steps" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            {steps.map((s, i) => (
              <span key={s} style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <div style={{
                    width:14,height:14,borderRadius:'50%',
                    background: i === steps.length - 1 ? C.green : C.blue,
                    boxShadow: i === steps.length - 1 ? '0 0 12px rgba(46,223,135,.5)' : '0 0 12px rgba(79,158,255,.5)',
                  }}/>
                  <div style={{
                    fontSize:12,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',
                    color: i === steps.length - 1 ? C.green : C.subtext,
                  }}>
                    {s}{i === steps.length - 1 ? ' ✓' : ''}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="wf-arrow" style={{color:C.borderHi,fontSize:20,marginBottom:18}}>→</div>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   PRICING — 4 cards + toggle + all-features grid
   ===================================================== */
function Pricing({ billing, setBilling, router }) {
  const annual = billing === 'annual';
  const plans = [
    {
      name:'Solo', monthly:39, annual:429, users:'1 User', sub:'Owner only',
      desc:'Perfect for the solo operator running every job yourself.',
      featured:false,
    },
    {
      name:'Crew', monthly:69, annual:759, users:'Up to 10 Users', sub:'Owner + crew members',
      desc:'For small crews ready to run a tighter operation.',
      featured:false,
    },
    {
      name:'Business', monthly:159, annual:1749, users:'Up to 25 Users', sub:'Owner + supervisors + crew',
      desc:'For established contractors with supervisors and a full crew.',
      featured:true,
    },
    {
      name:'Enterprise', monthly:null, annual:null, users:'25+ Users', sub:'Built around your crew size',
      desc:'For larger operations. We will build a plan around your crew size and budget.',
      featured:false,
    },
  ];
  const allFeatures = [
    'Lead capture & AI chat',
    'Smart quotes & approvals',
    'Job management',
    'Auto invoicing',
    'Crew management & roles',
    'Expense tracking',
    'GPS mileage tracking',
    'Tax center',
    'AI Business Coach',
    'Change orders',
    'Customer signatures',
    'Customer self-booking',
    'Google review automation',
    'Data import',
    'Photo documentation',
    'Multi-day jobs',
  ];

  return (
    <section id="pricing" style={{background:C.surface,padding:'80px 0',borderTop:`1px solid ${C.border}`}}>
      <div className="container">
        <div className="section-label">Pricing</div>

        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{
            display:'inline-flex',alignItems:'center',gap:8,
            background:'rgba(46,223,135,0.08)',
            border:'1px solid rgba(46,223,135,0.25)',
            borderRadius:99, padding:'8px 20px',
          }}>
            <div style={{width:7,height:7,borderRadius:'50%',background:C.green,boxShadow:'0 0 6px rgba(46,223,135,0.6)'}}/>
            <span style={{fontSize:12,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:C.green}}>
              Every plan includes all features. You only pay for your crew size.
            </span>
          </div>
        </div>

        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:12}}>
            <span
              onClick={() => setBilling('monthly')}
              style={{fontSize:13,fontWeight:annual?600:800,color:annual?C.muted:C.text,cursor:'pointer'}}>
              Monthly
            </span>
            <div
              onClick={() => setBilling(annual ? 'monthly' : 'annual')}
              style={{
                width:44,height:24,
                background:'rgba(79,158,255,0.2)',
                border:'1px solid rgba(79,158,255,0.4)',
                borderRadius:99, position:'relative', cursor:'pointer',
              }}>
              <div style={{
                width:18,height:18,
                background:C.blue, borderRadius:'50%',
                position:'absolute', top:2,
                left: annual ? 'auto' : 3,
                right: annual ? 3 : 'auto',
                transition:'all .15s',
              }}/>
            </div>
            <span
              onClick={() => setBilling('annual')}
              style={{fontSize:13,fontWeight:700,color:annual?C.blue:C.muted,cursor:'pointer'}}>
              Annual
              <span style={{
                background:'rgba(46,223,135,0.15)',
                border:'1px solid rgba(46,223,135,0.3)',
                color:C.green,fontSize:11,padding:'2px 8px',
                borderRadius:4,marginLeft:6,
              }}>
                1 Month Free
              </span>
            </span>
          </div>
        </div>

        <div className="price-grid" style={{
          display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:14, marginBottom:32,
        }}>
          {plans.map(p => <PlanCard key={p.name} plan={p} annual={annual} router={router}/>)}
        </div>

        <div style={{
          background:'rgba(30,42,66,0.6)',
          border:`1px solid ${C.borderHi}`,
          borderRadius:14, padding:'28px 32px',
          marginBottom:28,
        }}>
          <div style={{textAlign:'center',fontSize:11,fontWeight:800,letterSpacing:'.18em',textTransform:'uppercase',color:C.muted,marginBottom:20}}>
            Every Plan Includes All of These Features
          </div>
          <div className="all-features" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:12}}>
            {allFeatures.map(f => (
              <div key={f} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:C.subtext}}>
                <span style={{color:C.green,fontWeight:900,fontSize:15}}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        <div style={{
          textAlign:'center',fontSize:13,color:C.muted,
          display:'flex',alignItems:'center',justifyContent:'center',
          gap:24,flexWrap:'wrap',
        }}>
          <span>✓ 14-day free trial</span>
          <span>·</span>
          <span>✓ Cancel anytime</span>
          <span>·</span>
          <span>✓ Setup in 10 minutes</span>
          <span>·</span>
          <span>✓ All features on every plan</span>
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan, annual, router }) {
  const featured = plan.featured;
  const price = annual && plan.annual ? Math.round(plan.annual / 12) : plan.monthly;
  return (
    <div style={{
      background: featured ? 'linear-gradient(145deg,#1a2a48,#152038)' : C.card,
      border: featured ? '1.5px solid rgba(79,158,255,0.45)' : `1px solid ${C.borderHi}`,
      borderRadius:16, padding:'28px 24px',
      display:'flex', flexDirection:'column', gap:16,
      position:'relative',
      boxShadow: featured ? '0 0 40px rgba(79,158,255,0.12)' : 'none',
    }}>
      {featured && (
        <div style={{
          position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)',
          background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
          color:'#fff', fontSize:11, fontWeight:800,
          letterSpacing:'.12em', textTransform:'uppercase',
          padding:'6px 18px', borderRadius:99, whiteSpace:'nowrap',
        }}>
          Most Popular
        </div>
      )}
      <div>
        <div style={{
          fontSize:11,fontWeight:800,letterSpacing:'.16em',textTransform:'uppercase',
          color: featured ? C.blue : C.muted, marginBottom:8,
        }}>
          {plan.name}
        </div>
        {plan.monthly == null ? (
          <>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:40,lineHeight:1.1,color:C.text,letterSpacing:'.04em'}}>
              Custom
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>Tailored to your operation</div>
          </>
        ) : (
          <>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:52,lineHeight:1,color:C.text,letterSpacing:'.04em'}}>
              ${price}
              <span style={{fontSize:18,fontFamily:"'Inter',sans-serif",fontWeight:500,color:C.muted}}>/mo</span>
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>
              {annual ? `Billed $${plan.annual}/yr, save 1 month` : 'Billed monthly'}
            </div>
          </>
        )}
      </div>

      <div style={{
        background: featured ? 'rgba(79,158,255,0.12)' : 'rgba(79,158,255,0.08)',
        border: featured ? '1px solid rgba(79,158,255,0.3)' : '1px solid rgba(79,158,255,0.2)',
        borderRadius:8, padding:'10px 14px', textAlign:'center',
      }}>
        <div style={{fontSize:plan.users.length > 14 ? 18 : 22,fontWeight:900,color:C.text}}>{plan.users}</div>
        <div style={{fontSize:11,color:C.muted,marginTop:2}}>{plan.sub}</div>
      </div>

      <div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>{plan.desc}</div>

      <button
        onClick={() => router.push(plan.monthly == null ? '/contact' : '/signup')}
        style={{
          marginTop:'auto',
          background: featured ? `linear-gradient(135deg, ${C.blue}, ${C.blueDeep})` : (plan.monthly == null ? 'rgba(46,223,135,0.1)' : 'rgba(79,158,255,0.12)'),
          color: featured ? '#fff' : (plan.monthly == null ? C.green : C.blue),
          border: featured ? 'none' : `1px solid ${plan.monthly == null ? 'rgba(46,223,135,0.3)' : 'rgba(79,158,255,0.35)'}`,
          fontSize:14, fontWeight:800,
          letterSpacing:'.06em', textTransform:'uppercase',
          padding:14, borderRadius:10, width:'100%',
          boxShadow: featured ? '0 6px 20px rgba(79,158,255,0.35)' : 'none',
        }}>
        {plan.monthly == null ? 'Get a Quote' : 'Start Free Trial'}
      </button>
    </div>
  );
}

/* =====================================================
   COMPARE TABLE
   Three category buckets, not specific products. We
   deliberately don't name competitors. The middle column
   is the legacy CRM category as a whole.
   ===================================================== */
function CompareTable() {
  const rows = [
    { label:'Setup time',                           values:['None',   '4 to 8 hrs',   '10 min'] },
    { label:'Monthly cost',                         values:['$0',     '$99 to $300',  '$39 to $159'] },
    { label:'Lead to paid in one app',              values:['no',     'yes',          'yes'] },
    { label:'Mobile-first PWA',                     values:['no',     'partial',      'yes'] },
    { label:'Direct deposits, no platform cut',     values:['no',     'partial',      'yes'] },
    { label:'Switch from your old platform',        values:['no',     'partial',      '10 min import'] },
    { label:'Tax + accountant-ready exports',       values:['no',     'Add-on $$',    'yes'] },
    { label:'Auto-bills + chases overdue invoices', values:['no',     'partial',      'yes'] },
    { label:'AI business coach',                    values:['no',     'no',           'yes'], ai:true },
    { label:'Live demo',                            values:['N/A',    'Sales call',   'One tap'] },
  ];
  const cols      = ['Texts & sheets', 'Other apps', 'MyForeman'];
  const colsShort = ['Texts',          'Other apps', 'MyForeman'];

  return (
    <section style={{background:C.surface,padding:'80px 0',borderTop:`1px solid ${C.border}`}}>
      <div className="container">
        <h2 style={{
          fontFamily:"'Bebas Neue',Impact,sans-serif",
          fontSize:'clamp(32px, 4vw, 56px)',
          letterSpacing:'.04em', textAlign:'center',
          color:C.text, margin:'0 0 12px',
        }}>
          The Way It Should Have Always Been
        </h2>
        <p style={{textAlign:'center',color:C.muted,fontSize:15,marginBottom:36,maxWidth:620,marginLeft:'auto',marginRight:'auto'}}>
          Your work is professional. Your tools should be too.
        </p>

        <div className="cmp-table">
          <div className="cmp-row cmp-header">
            <div className="cmp-feature">&nbsp;</div>
            {cols.map((c, i) => (
              <div key={c} className={'cmp-col ' + (i === 2 ? 'cmp-us' : '')}>
                {i === 2 && <span style={{color:C.yellow,marginRight:4}}>⚡</span>}
                <span className="cmp-col-full">{c.toUpperCase()}</span>
                <span className="cmp-col-short">{colsShort[i].toUpperCase()}</span>
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div key={row.label} className={'cmp-row ' + (row.ai ? 'cmp-ai' : '')}>
              <div className="cmp-feature">
                {row.label}
                {row.ai && <span className="cmp-tag">AI</span>}
              </div>
              {row.values.map((v, ci) => (
                <div key={ci} className={'cmp-col ' + (ci === 2 ? 'cmp-us' : '')}>
                  <CmpCell value={v} isUs={ci === 2}/>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .cmp-table {
          background: ${C.surface};
          border: 1px solid ${C.borderHi};
          border-radius: 14px;
          overflow: hidden;
          max-width: 880px;
          margin: 0 auto;
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .cmp-row {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr 1fr;
          align-items: stretch;
        }
        .cmp-header {
          border-bottom: 1px solid ${C.borderHi};
          background: #0d1726;
        }
        .cmp-header .cmp-col {
          font-family: 'Bebas Neue', Impact, sans-serif;
          letter-spacing: .06em; color: ${C.muted};
          text-align: center;
          display: flex; align-items: center; justify-content: center;
        }
        .cmp-header .cmp-us {
          background: linear-gradient(180deg, rgba(79,158,255,0.20), rgba(79,158,255,0.06));
          color: ${C.text}; font-weight: 700;
          border-left: 1px solid rgba(79,158,255,0.35);
          border-right: 1px solid rgba(79,158,255,0.35);
        }
        .cmp-row + .cmp-row { border-top: 1px solid #1f2a40; }
        .cmp-row:nth-child(odd) { background: rgba(255,255,255,0.012); }
        .cmp-feature {
          color: ${C.subtext}; font-weight: 500;
          display: flex; align-items: center;
        }
        .cmp-col {
          text-align: center; color: ${C.subtext};
          display: flex; align-items: center; justify-content: center;
        }
        .cmp-us {
          background: rgba(79,158,255,0.06);
          border-left: 1px solid rgba(79,158,255,0.35);
          border-right: 1px solid rgba(79,158,255,0.35);
          color: ${C.text};
        }
        .cmp-ai .cmp-feature { color: ${C.yellow}; }
        .cmp-ai .cmp-us { background: rgba(251,191,36,0.08); }
        .cmp-tag {
          background: rgba(251,191,36,0.15);
          color: ${C.yellow};
          border: 1px solid rgba(251,191,36,0.4);
          border-radius: 999px;
          padding: 1px 7px;
          font-size: 9px; font-weight: 700; letter-spacing: .08em;
          margin-left: 6px;
        }
        .cmp-col-short { display: inline; }
        .cmp-col-full  { display: none; }
        .cmp-header .cmp-col { font-size: 11px; padding: 12px 6px; }
        .cmp-feature { padding: 10px 12px; font-size: 12px; line-height: 1.25; }
        .cmp-col { padding: 10px 6px; font-size: 12px; }
        @media (min-width: 768px) {
          .cmp-col-short { display: none; }
          .cmp-col-full  { display: inline; }
          .cmp-row { grid-template-columns: 1.6fr 1fr 1fr 1fr; }
          .cmp-header .cmp-col { font-size: 13px; letter-spacing: .08em; padding: 16px 14px; }
          .cmp-feature { padding: 13px 18px; font-size: 14px; }
          .cmp-col { padding: 13px; font-size: 14px; }
        }
      `}</style>
    </section>
  );
}

function CmpCell({ value, isUs }) {
  if (value === 'yes') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={isUs ? C.green : C.muted}
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      style={{display:'inline-block',verticalAlign:'middle'}}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  if (value === 'no') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={C.red}
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      style={{display:'inline-block',verticalAlign:'middle',opacity:0.75}}>
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
  if (value === 'partial') return (
    <span style={{color:C.yellow,fontWeight:600}}>Partial</span>
  );
  return (
    <span style={{color: isUs ? C.text : C.subtext,fontWeight: isUs ? 700 : 500,lineHeight:1.25}}>
      {value}
    </span>
  );
}

/* =====================================================
   FINAL CTA
   ===================================================== */
function FinalCta({ router, launchDemo }) {
  return (
    <section id="demo" style={{
      background:C.surface,padding:'96px 0',
      borderTop:`1px solid ${C.border}`,
      position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute',inset:0,
        background:'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(79,158,255,0.12), transparent 70%)',
        pointerEvents:'none',
      }}/>
      <div className="container" style={{position:'relative',zIndex:2,textAlign:'center'}}>
        <h2 style={{
          fontFamily:"'Bebas Neue',Impact,sans-serif",
          fontSize:'clamp(44px, 6vw, 84px)',
          letterSpacing:'.04em',color:'#fff',
          margin:'0 0 16px',lineHeight:1,
        }}>
          The last app you&apos;ll ever need.
        </h2>
        <p style={{fontSize:17,color:C.muted,maxWidth:600,margin:'0 auto 36px',lineHeight:1.6}}>
          Start your 14-day free trial today. No per-user fees, no feature gates. Set up in 10 minutes.
        </p>
        <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
          <button className="btn-primary" onClick={() => router.push('/signup')} style={{padding:'18px 40px',fontSize:16}}>
            Start Free Trial
          </button>
          <button className="btn-ghost" onClick={launchDemo} style={{display:'inline-flex',alignItems:'center',gap:8}}>
            <span style={{color:C.green}}>▶</span> See Demo
          </button>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   FOOTER
   ===================================================== */
function Footer() {
  return (
    <footer style={{padding:'40px 32px 32px',borderTop:`1px solid ${C.border}`,background:C.bg}}>
      <div style={{
        maxWidth:1280,margin:'0 auto',
        display:'flex',justifyContent:'space-between',alignItems:'center',
        gap:24,flexWrap:'wrap',
      }}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{
            width:32, height:32,
            background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
            borderRadius:8,
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <HardHatIcon size={18}/>
          </div>
          <div style={{display:'flex',flexDirection:'column',lineHeight:1}}>
            <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.1em',color:'#fff'}}>MY</span>
            <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.1em',color:C.blue,marginTop:-2}}>FOREMAN</span>
          </div>
        </Link>
        <div style={{display:'flex',gap:24,fontSize:13,color:C.muted,flexWrap:'wrap'}}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <div style={{fontSize:11,color:C.muted,textAlign:'right'}}>
          <a href="mailto:hello@myforemanhq.com">hello@myforemanhq.com</a>
          <div style={{marginTop:6}}>© {new Date().getFullYear()} MyForeman</div>
        </div>
      </div>
    </footer>
  );
}

/* =====================================================
   ICONS
   ===================================================== */
function HardHatIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3C9.5 3 4.5 8 4 14H28C27.5 8 22.5 3 16 3Z" fill="white"/>
      <rect x="3" y="14" width="26" height="5" rx="2.5" fill="white"/>
      <rect x="6" y="12" width="20" height="4" rx="1" fill="#4f9eff"/>
    </svg>
  );
}
