import { useRouter } from 'next/router';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

const TABS = [
  { label:'Dashboard', route:'/dashboard' },
  { label:'Leads',     route:'/leads' },
  { label:'Customers', route:'/customers' },
  { label:'Jobs',      route:'/jobs' },
  { label:'Expenses',  route:'/expenses' },
  { label:'Invoices',  route:'/invoices' },
  { label:'Tax',       route:'/tax' },
  { label:'Crew',      route:'/crew' },
  { label:'Insights',  route:'/insights' },
];

export default function TopNav({ active }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div style={{position:'sticky',top:0,zIndex:50,background:'#0d1726',borderBottom:'1px solid #1f2a40'}}>
      <div style={{maxWidth:1280,margin:'0 auto',padding:'10px 16px',display:'flex',alignItems:'center',gap:14}}>
        <div onClick={() => router.push('/dashboard')} style={{cursor:'pointer',flexShrink:0}}>
          <Logo size="sm" />
        </div>

        <nav className="topnav-tabs" style={{display:'flex',gap:2,flex:1,overflowX:'auto',scrollbarWidth:'none'}}>
          {TABS.map(t => {
            const isActive = t.route === active;
            return (
              <button key={t.route} onClick={() => router.push(t.route)}
                style={{
                  background: isActive ? 'rgba(79,158,255,0.12)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #4f9eff' : '2px solid transparent',
                  color: isActive ? '#f0f4ff' : '#7a8db0',
                  padding:'10px 14px',
                  fontSize:13,
                  fontWeight: isActive ? 700 : 600,
                  letterSpacing:'.05em',
                  cursor:'pointer',
                  whiteSpace:'nowrap',
                  fontFamily:'inherit',
                }}>
                {t.label.toUpperCase()}
              </button>
            );
          })}
        </nav>

        <div style={{position:'relative',flexShrink:0}}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.05em'}}>
            ⋯
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:60}}/>
              <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,minWidth:160,padding:6,zIndex:70,boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
                <MenuItem label="Settings"  onClick={() => { setMenuOpen(false); router.push('/settings'); }} />
                <MenuItem label="Sign Out" onClick={signOut} danger />
              </div>
            </>
          )}
        </div>
      </div>
      <style jsx global>{`
        .topnav-tabs::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{display:'block',width:'100%',textAlign:'left',background:'transparent',border:'none',color: danger ? '#f26060' : '#f0f4ff',padding:'8px 12px',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
      onMouseEnter={e => e.currentTarget.style.background = '#2e3f60'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {label}
    </button>
  );
}
