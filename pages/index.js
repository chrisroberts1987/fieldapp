import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard');
      else setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",display:'flex',flexDirection:'column'}}>
      <div style={{padding:'18px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <Logo size="sm" />
        <button onClick={() => router.push('/login')}
          style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.06em'}}>
          SIGN IN
        </button>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'24px 20px',maxWidth:680,margin:'0 auto',width:'100%'}}>

        <div style={{marginBottom:14}}>
          <Logo size="xl" tagline />
        </div>

        <p style={{fontSize:17,lineHeight:1.5,color:'#c8d4ee',marginTop:24,marginBottom:0,maxWidth:560}}>
          Run your field service business from first call to final payment — with AI insights that help you grow.
        </p>

        <p style={{fontSize:14,lineHeight:1.55,color:'#7a8db0',marginTop:18,marginBottom:0,maxWidth:560}}>
          Built for handymen, contractors, and small crews who are done managing their business from texts and spreadsheets.
        </p>

        <div style={{marginTop:36,display:'flex',flexDirection:'column',gap:10,maxWidth:340}}>
          <button onClick={() => router.push('/signup')}
            style={{background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'14px 20px',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer'}}>
            START FREE TRIAL
          </button>
          <button onClick={() => router.push('/login')}
            style={{background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 20px',fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'.08em',cursor:'pointer'}}>
            ALREADY HAVE AN ACCOUNT? SIGN IN
          </button>
          <div style={{fontSize:11,color:'#7a8db0',marginTop:6}}>14-day free trial. No card required.</div>
        </div>
      </div>

      <div style={{padding:'18px 20px',borderTop:'1px solid #1f2a40',fontSize:11,color:'#7a8db0',textAlign:'center'}}>
        © {new Date().getFullYear()} MyForeman
      </div>
    </div>
  );
}
