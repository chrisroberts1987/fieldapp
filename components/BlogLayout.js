import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { HorizontalLogo } from './Logo';
import { HamburgerIcon, CloseIcon } from './NavIcons';

// Shared layout for /blog/index and /blog/[slug]. Re-uses the same
// dark theme + Bebas/Inter typography + nav and footer as the rest
// of the marketing site, plus article-appropriate body typography
// (longer reading width, larger body font, generous line height).

const C = {
  bg:        '#0a0f1a',
  surface:   '#111827',
  card:      '#1a2438',
  border:    '#1e2e4a',
  borderHi:  '#2e3f60',
  blue:      '#4f9eff',
  blueDeep:  '#2a7de8',
  green:     '#2edf87',
  yellow:    '#fbbf24',
  text:      '#f0f4ff',
  subtext:   '#c8d4ee',
  muted:     '#7a8db0',
};

export { C as BLOG_COLORS };

export default function BlogLayout({ children }) {
  return (
    <div style={{background:C.bg,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",overflowX:'hidden',minHeight:'100vh'}}>
      <Nav/>
      {children}
      <Footer/>

      <style jsx global>{`
        html, body { background: ${C.bg}; margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; }
        .blog-container { max-width: 760px; margin: 0 auto; padding: 0 24px; }
        .blog-h1 {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: clamp(36px, 5vw, 56px);
          line-height: 1.05; letter-spacing: .03em;
          color: #fff; margin: 0 0 14px;
        }
        .blog-h2 {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.25; letter-spacing: -.01em;
          color: #fff; margin: 40px 0 14px;
        }
        .blog-h3 {
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.3;
          color: #fff; margin: 28px 0 10px;
        }
        .blog-p {
          font-size: 17px; line-height: 1.7;
          color: ${C.subtext}; margin: 0 0 16px;
        }
        .blog-ul, .blog-ol {
          font-size: 17px; line-height: 1.7;
          color: ${C.subtext}; margin: 0 0 18px;
          padding-left: 22px;
        }
        .blog-ul li, .blog-ol li { margin: 0 0 8px; }
        .blog-card {
          background: ${C.card}; border: 1px solid ${C.border};
          border-radius: 14px; padding: 22px 20px;
          transition: border-color .15s, transform .15s;
        }
        .blog-card:hover {
          border-color: ${C.borderHi};
        }
        @media (max-width: 1100px) {
          .nav-links { display: none !important; }
          .nav-hamburger { display: inline-flex !important; }
          .nav-signin { display: none !important; }
        }
        @media (max-width: 720px) {
          .blog-container { padding: 0 18px; }
          .blog-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Nav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const links = [
    { href:'/contractor-software', label:'Trades',  highlight:false },
    { href:'/compare',             label:'Compare', highlight:false },
    { href:'/blog',                label:'Blog',    highlight:true  },
    { href:'/#pricing',            label:'Pricing', highlight:false },
    { href:'/contact',             label:'Contact', highlight:false },
  ];

  return (
    <>
      <nav style={{
        position:'fixed',top:0,left:0,right:0,zIndex:100,
        background:'rgba(10,15,26,0.85)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderBottom:`1px solid ${C.border}`,
        height:64,display:'flex',alignItems:'center',
        justifyContent:'space-between',padding:'0 20px',gap:12,
      }}>
        <Link href="/" aria-label="MyForeman home" onClick={close} style={{display:'inline-flex',alignItems:'center',flexShrink:0}}>
          <HorizontalLogo height={32}/>
        </Link>
        <div className="nav-links" style={{display:'flex',alignItems:'center',gap:24}}>
          {links.map(l => (
            <Link key={l.label} href={l.href} style={{fontSize:14,fontWeight:600,color: l.highlight ? C.blue : C.muted}}>{l.label}</Link>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <button className="nav-signin" onClick={() => router.push('/login')} style={{
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
          <button
            className="nav-hamburger"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            style={{
              background:'transparent', border:`1px solid ${C.borderHi}`,
              borderRadius:8, color:C.text, width:38, height:38,
              padding:0, cursor:'pointer', display:'none',
              alignItems:'center', justifyContent:'center',
            }}
          >
            {open ? <CloseIcon/> : <HamburgerIcon/>}
          </button>
        </div>
      </nav>
      {open && (
        <div style={{
          position:'fixed', top:64, left:0, right:0, zIndex:99,
          background:'rgba(10,15,26,0.98)',
          backdropFilter:'blur(20px)',
          WebkitBackdropFilter:'blur(20px)',
          borderBottom:`1px solid ${C.border}`,
          padding:'18px 20px 22px',
          display:'flex', flexDirection:'column', gap:4,
        }}>
          {links.map(l => (
            <Link key={l.label} href={l.href} onClick={close}
              style={{padding:'12px 8px',color: l.highlight ? C.blue : C.text,fontSize:16,fontWeight:600,borderRadius:8}}>
              {l.label}
            </Link>
          ))}
          <div style={{height:1, background:C.border, margin:'10px 0'}}/>
          <button onClick={() => { close(); router.push('/login'); }} style={{
            background:'transparent', border:`1px solid ${C.borderHi}`,
            color:C.text, borderRadius:10, padding:'12px 14px',
            fontSize:15, fontWeight:600, textAlign:'left', cursor:'pointer',
          }}>Sign In</button>
        </div>
      )}
    </>
  );
}

function Footer() {
  return (
    <footer style={{padding:'40px 32px 32px',borderTop:`1px solid ${C.border}`,background:C.bg,marginTop:80}}>
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
