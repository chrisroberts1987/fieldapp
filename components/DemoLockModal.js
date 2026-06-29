import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

// Full-screen modal that pops whenever the demo user tries to write.
// State lives in a module-level variable so any code path (Supabase
// fetch interceptor, custom hooks, anywhere) can fire it via the
// exported showDemoLock() — no React context plumbing required.

let setOpenFn = null;

export function showDemoLock() {
  if (setOpenFn) setOpenFn(true);
}

export default function DemoLockModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpenFn = setOpen;
    return () => { setOpenFn = null; };
  }, []);

  if (!open) return null;

  const signUp = async () => {
    // Sign the demo user out first so the new account can be created
    // fresh. /signup will be a clean slate for them.
    try { await supabase.auth.signOut(); } catch {}
    setOpen(false);
    router.push('/signup');
  };

  const stayBrowsing = () => setOpen(false);

  return (
    <div role="dialog" aria-modal="true"
      onClick={stayBrowsing}
      style={{position:'fixed',inset:0,zIndex:9800,background:'rgba(8,11,20,0.82)',display:'flex',alignItems:'center',justifyContent:'center',padding:14,backdropFilter:'blur(4px)'}}>
      <div onClick={e => e.stopPropagation()}
        style={{width:'100%',maxWidth:440,background:'#1a2236',border:'1px solid #2edf8744',borderRadius:14,boxShadow:'0 20px 50px rgba(0,0,0,0.55)',padding:24,color:'#f0f4ff',textAlign:'center'}}>
        <div style={{background:'#2edf8722',color:'#2edf87',border:'1px solid #2edf8766',borderRadius:999,padding:'4px 12px',fontSize:10,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',display:'inline-block',marginBottom:14}}>
          Demo account
        </div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.03em',marginBottom:10,lineHeight:1.1}}>
          Sign up free to keep your changes
        </div>
        <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55,marginBottom:20}}>
          This is the public demo account, so we keep the data clean for the next visitor. Spin up your own account in 30 seconds and any work you do is yours forever.
        </div>
        <div style={{display:'flex',gap:10,flexDirection:'column'}}>
          <button onClick={signUp}
            style={{background:'#2edf87',border:'none',borderRadius:10,color:'#0d1726',padding:'12px 18px',fontSize:14,fontWeight:700,letterSpacing:'.04em',cursor:'pointer',fontFamily:'inherit'}}>
            START MY FREE TRIAL
          </button>
          <button onClick={stayBrowsing}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 18px',fontSize:12,fontWeight:600,letterSpacing:'.04em',cursor:'pointer',fontFamily:'inherit'}}>
            Keep browsing the demo
          </button>
        </div>
      </div>
    </div>
  );
}
