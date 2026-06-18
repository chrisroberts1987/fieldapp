import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { HorizontalLogo } from './Logo';

// Shared layout for SEO landing pages (trade pages, competitor
// comparison pages, the contractor-software hub). Re-uses the same
// dark theme + Bebas / Inter typography + blue/green accents as the
// marketing homepage. Pass an SEO config + content blocks and the
// component handles nav, hero, features, optional comparison table,
// pricing, CTA, and footer.

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
  text:      '#f0f4ff',
  subtext:   '#c8d4ee',
  muted:     '#7a8db0',
};

export default function SeoLanding({
  title,
  description,
  canonicalPath,
  h1,
  h1Highlight,
  heroEyebrow,
  heroSub,
  features = [],
  comparison = null,
  trades = null,
  ctaTitle = 'Start your free 14-day trial',
  ctaSub  = 'No credit card required. Cancel anytime.',
}) {
  const router = useRouter();
  const startTrial = () => router.push('/signup');
  const seeDemo    = () => router.push('/login');

  const ogImage = `https://myforemanhq.com/api/og?title=${encodeURIComponent(h1 + (h1Highlight ? ' ' + h1Highlight : ''))}&eyebrow=${encodeURIComponent(heroEyebrow || 'Contractor Software')}`;
  const canonical = canonicalPath ? `https://myforemanhq.com${canonicalPath}` : null;

  const softwareLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MyForeman',
    operatingSystem: 'Web, iOS, Android',
    applicationCategory: 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: '39.00',
      priceCurrency: 'USD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '39.00',
        priceCurrency: 'USD',
        unitText: 'MONTH',
      },
    },
    description,
    url: canonical || 'https://myforemanhq.com',
  };

  return (
    <div style={{background:C.bg,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",overflowX:'hidden',minHeight:'100vh'}}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description}/>
        <meta property="og:title" content={title}/>
        <meta property="og:description" content={description}/>
        <meta property="og:type" content="website"/>
        <meta property="og:image" content={ogImage}/>
        <meta property="og:image:width" content="1200"/>
        <meta property="og:image:height" content="630"/>
        {canonical && <meta property="og:url" content={canonical}/>}
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:title" content={title}/>
        <meta name="twitter:description" content={description}/>
        <meta name="twitter:image" content={ogImage}/>
        {canonical && <link rel="canonical" href={canonical}/>}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}
        />
      </Head>

      <Nav/>

      <Hero
        eyebrow={heroEyebrow}
        h1={h1}
        h1Highlight={h1Highlight}
        sub={heroSub}
        onStart={startTrial}
        onDemo={seeDemo}
      />

      {features.length > 0 && <Features features={features}/>}

      {comparison && <ComparisonTable comparison={comparison}/>}

      {trades && <TradeGrid trades={trades}/>}

      <Pricing onStart={startTrial}/>

      <FinalCta title={ctaTitle} sub={ctaSub} onStart={startTrial} onDemo={seeDemo}/>

      <Footer/>

      <style jsx global>{`
        html, body { background: ${C.bg}; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; }
        .container { max-width: 1280px; margin: 0 auto; padding: 0 32px; }
        .seo-h1 {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(44px, 6vw, 80px);
          line-height: .92; letter-spacing: .04em;
          color: #fff; margin: 0 0 18px;
          text-shadow: 0 0 80px rgba(79,158,255,0.14);
        }
        .seo-h1 .blue { color: ${C.blue}; }
        .seo-h2 {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(30px, 4vw, 48px);
          line-height: 1; letter-spacing: .04em;
          margin: 0 0 14px; color: #fff;
        }
        .seo-h3 {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 22px; letter-spacing: .04em;
          margin: 0 0 8px; color: #fff;
        }
        .eyebrow {
          font-size: 11px; font-weight: 800; letter-spacing: .22em;
          text-transform: uppercase; color: ${C.muted};
        }
        .btn-primary {
          background: linear-gradient(135deg, ${C.blue}, ${C.blueDeep});
          color: #fff; font-weight: 800; letter-spacing: .06em;
          text-transform: uppercase; border-radius: 12px;
          padding: 16px 28px; font-size: 14px; border: none;
          box-shadow: 0 8px 32px rgba(79,158,255,0.4); cursor: pointer;
        }
        .btn-ghost {
          background: rgba(255,255,255,0.03); color: ${C.subtext};
          font-weight: 700; border: 1px solid ${C.borderHi};
          border-radius: 12px; padding: 16px 24px; font-size: 14px;
          cursor: pointer;
        }
        .seo-card {
          background: ${C.card}; border: 1px solid ${C.border};
          border-radius: 14px; padding: 22px 20px;
        }
        @media (max-width: 1100px) {
          .nav-links { display: none !important; }
        }
        @media (max-width: 980px) {
          .container { padding: 0 20px; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Nav() {
  const router = useRouter();
  return (
    <nav style={{
      position:'fixed',top:0,left:0,right:0,zIndex:100,
      background:'rgba(10,15,26,0.85)',
      backdropFilter:'blur(20px)',
      WebkitBackdropFilter:'blur(20px)',
      borderBottom:`1px solid ${C.border}`,
      height:64,display:'flex',alignItems:'center',
      justifyContent:'space-between',padding:'0 20px',gap:12,
    }}>
      <Link href="/" aria-label="MyForeman home" style={{display:'inline-flex',alignItems:'center',flexShrink:0}}>
        <HorizontalLogo height={32}/>
      </Link>
      <div className="nav-links" style={{display:'flex',alignItems:'center',gap:24}}>
        <Link href="/contractor-software" style={{fontSize:14,fontWeight:600,color:C.muted}}>Trades</Link>
        <Link href="/compare" style={{fontSize:14,fontWeight:600,color:C.muted}}>Compare</Link>
        <Link href="/blog" style={{fontSize:14,fontWeight:600,color:C.muted}}>Blog</Link>
        <Link href="/#pricing" style={{fontSize:14,fontWeight:600,color:C.muted}}>Pricing</Link>
        <Link href="/contact" style={{fontSize:14,fontWeight:600,color:C.muted}}>Contact</Link>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <button onClick={() => router.push('/login')} style={{
          fontSize:13,fontWeight:600,color:C.subtext,
          padding:'8px 14px',borderRadius:8,
          background:'transparent',border:'none',
          letterSpacing:'.02em',cursor:'pointer',
        }}>Sign In</button>
        <button onClick={() => router.push('/signup')} style={{
          fontSize:12,fontWeight:800,color:'#fff',
          padding:'9px 16px',borderRadius:8,
          background:`linear-gradient(135deg, ${C.blue}, ${C.blueDeep})`,
          border:'none',letterSpacing:'.04em',textTransform:'uppercase',
          boxShadow:'0 4px 16px rgba(79,158,255,0.35)',whiteSpace:'nowrap',
        }}>Start Free Trial</button>
      </div>
    </nav>
  );
}

function Hero({ eyebrow, h1, h1Highlight, sub, onStart, onDemo }) {
  return (
    <section style={{position:'relative',overflow:'hidden',paddingTop:64,minHeight:'80vh',display:'flex',alignItems:'center'}}>
      <div style={{position:'absolute',inset:0,zIndex:0}}>
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
      <div className="container" style={{position:'relative',zIndex:10,padding:'100px 32px 80px',width:'100%'}}>
        <div style={{maxWidth:880}}>
          {eyebrow && (
            <div className="eyebrow" style={{color:C.blue,marginBottom:18}}>{eyebrow}</div>
          )}
          <h1 className="seo-h1">
            {h1Highlight ? (<>{h1} <span className="blue">{h1Highlight}</span></>) : h1}
          </h1>
          <p style={{fontSize:18,color:C.subtext,lineHeight:1.6,maxWidth:720,marginBottom:28}}>
            {sub}
          </p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
            <button className="btn-primary" onClick={onStart}>Start Free Trial</button>
            <button className="btn-ghost" onClick={onDemo}>
              <span style={{color:C.green,marginRight:8}}>▶</span>See Demo
            </button>
            <span style={{fontSize:13,color:C.muted,marginLeft:8}}>
              From <strong style={{color:C.text}}>$39/mo</strong> · 14-day free trial · No credit card
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features({ features }) {
  return (
    <section style={{padding:'80px 0',borderTop:`1px solid ${C.border}`}}>
      <div className="container">
        <div style={{textAlign:'center',marginBottom:48}}>
          <div className="eyebrow" style={{color:C.blue,marginBottom:14}}>What you get</div>
          <h2 className="seo-h2">Built for the work you actually do.</h2>
        </div>
        <div className="grid-3" style={{
          display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18,
        }}>
          {features.map((f, i) => (
            <div key={i} className="seo-card" style={{position:'relative',overflow:'hidden'}}>
              <div style={{
                position:'absolute',top:0,left:0,right:0,height:3,
                background:`linear-gradient(90deg, ${C.blue}, ${C.green})`,
              }}/>
              <h3 className="seo-h3">{f.title}</h3>
              <p style={{fontSize:14,color:C.subtext,lineHeight:1.6,margin:0}}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonTable({ comparison }) {
  const { competitor, rows } = comparison;
  return (
    <section style={{padding:'80px 0',borderTop:`1px solid ${C.border}`,background:C.surface}}>
      <div className="container">
        <div style={{textAlign:'center',marginBottom:36}}>
          <div className="eyebrow" style={{color:C.green,marginBottom:14}}>Honest comparison</div>
          <h2 className="seo-h2">MyForeman vs {competitor}</h2>
          <p style={{fontSize:15,color:C.subtext,maxWidth:680,margin:'12px auto 0',lineHeight:1.6}}>
            Apples-to-apples. The features below are commonly cited in {competitor}'s public pricing and reviews. Verify pricing directly with {competitor} before switching.
          </p>
        </div>
        <div style={{
          background:C.card,border:`1px solid ${C.borderHi}`,
          borderRadius:16,overflow:'hidden',
          boxShadow:'0 20px 60px rgba(0,0,0,0.25)',
        }}>
          <div style={{
            display:'grid',gridTemplateColumns:'2fr 1fr 1fr',
            background:'rgba(79,158,255,0.08)',borderBottom:`1px solid ${C.borderHi}`,
            padding:'14px 18px',fontSize:11,fontWeight:800,letterSpacing:'.12em',
            textTransform:'uppercase',color:C.muted,
          }}>
            <div>Feature</div>
            <div style={{textAlign:'center',color:C.blue}}>MyForeman</div>
            <div style={{textAlign:'center'}}>{competitor}</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{
              display:'grid',gridTemplateColumns:'2fr 1fr 1fr',
              padding:'14px 18px',
              borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${C.border}`,
              fontSize:14,color:C.subtext,alignItems:'center',
            }}>
              <div style={{fontWeight:600,color:C.text}}>{r.feature}</div>
              <div style={{textAlign:'center',color:C.green,fontWeight:600}}>{r.mf}</div>
              <div style={{textAlign:'center',color:C.muted}}>{r.them}</div>
            </div>
          ))}
        </div>
        <p style={{fontSize:11,color:C.muted,textAlign:'center',marginTop:14,lineHeight:1.6}}>
          Competitor pricing and feature availability change frequently. Last reviewed against publicly listed pricing.
        </p>
      </div>
    </section>
  );
}

function TradeGrid({ trades }) {
  return (
    <section style={{padding:'80px 0',borderTop:`1px solid ${C.border}`}}>
      <div className="container">
        <div style={{textAlign:'center',marginBottom:40}}>
          <div className="eyebrow" style={{color:C.blue,marginBottom:14}}>Built for your trade</div>
          <h2 className="seo-h2">Software for every contractor.</h2>
        </div>
        <div className="grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {trades.map(t => (
            <Link key={t.href} href={t.href} className="seo-card" style={{
              display:'block',transition:'border-color .15s, transform .15s',
              cursor:'pointer',
            }}>
              <div style={{fontSize:11,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:C.blue,marginBottom:8}}>
                {t.label}
              </div>
              <h3 className="seo-h3">{t.title}</h3>
              <p style={{fontSize:13,color:C.subtext,lineHeight:1.6,margin:'6px 0 0'}}>
                {t.body}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ onStart }) {
  return (
    <section style={{padding:'80px 0',borderTop:`1px solid ${C.border}`,background:C.surface}}>
      <div className="container" style={{textAlign:'center'}}>
        <div className="eyebrow" style={{color:C.green,marginBottom:14}}>Simple pricing</div>
        <h2 className="seo-h2">One flat price. Every feature.</h2>
        <p style={{fontSize:15,color:C.subtext,maxWidth:560,margin:'12px auto 32px',lineHeight:1.6}}>
          No tiered feature paywalls. AI insights, scheduling, invoicing, payments, and customer portal all included.
        </p>
        <div style={{
          maxWidth:420,margin:'0 auto',
          background:'linear-gradient(145deg, #1a2a48, #152038)',
          border:'1.5px solid rgba(79,158,255,0.45)',
          borderRadius:16,padding:'28px 24px',
          boxShadow:'0 0 40px rgba(79,158,255,0.12)',
        }}>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:'.2em',textTransform:'uppercase',color:C.blue,marginBottom:8}}>Solo</div>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:56,letterSpacing:'.02em',lineHeight:1,color:C.text}}>
            $39<span style={{fontSize:18,color:C.muted,marginLeft:4}}>/mo</span>
          </div>
          <p style={{fontSize:13,color:C.subtext,margin:'14px 0 20px',lineHeight:1.5}}>
            Everything you need to run the business. One user. Unlimited customers, jobs, and invoices.
          </p>
          <button className="btn-primary" onClick={onStart} style={{width:'100%'}}>Start 14-day free trial</button>
          <p style={{fontSize:11,color:C.muted,margin:'10px 0 0'}}>Crew + Business plans available for teams.</p>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ title, sub, onStart, onDemo }) {
  return (
    <section style={{padding:'80px 0',borderTop:`1px solid ${C.border}`}}>
      <div className="container" style={{textAlign:'center'}}>
        <h2 className="seo-h2" style={{fontSize:'clamp(34px,5vw,64px)'}}>{title}</h2>
        <p style={{fontSize:16,color:C.subtext,maxWidth:560,margin:'14px auto 28px',lineHeight:1.6}}>{sub}</p>
        <div style={{display:'inline-flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
          <button className="btn-primary" onClick={onStart}>Start Free Trial</button>
          <button className="btn-ghost" onClick={onDemo}>
            <span style={{color:C.green,marginRight:8}}>▶</span>See Demo
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{padding:'40px 32px 32px',borderTop:`1px solid ${C.border}`,background:C.bg}}>
      <div style={{
        maxWidth:1280,margin:'0 auto',
        display:'flex',justifyContent:'space-between',alignItems:'center',
        gap:24,flexWrap:'wrap',
      }}>
        <Link href="/" aria-label="MyForeman home" style={{display:'inline-flex',alignItems:'center'}}>
          <HorizontalLogo height={32}/>
        </Link>
        <div style={{display:'flex',gap:24,fontSize:13,color:C.muted,flexWrap:'wrap'}}>
          <Link href="/contractor-software">Trades</Link>
          <Link href="/compare">Compare</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/#pricing">Pricing</Link>
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
