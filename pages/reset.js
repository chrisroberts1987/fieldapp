import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Reset() {
  const router = useRouter();
  // 'email' = enter your email · 'sent' = check your inbox · 'set' = set new password
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives from the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStep('set');
    });
    return () => subscription.unsubscribe();
  }, []);

  const sendReset = async () => {
    setError('');
    if (!email.trim()) { setError('Email required'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep('sent');
  };

  const setNewPassword = async () => {
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/dashboard');
  };

  return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',sans-serif"}}>
      <div style={{marginBottom:32,display:'flex',justifyContent:'center'}}>
        <Logo size="lg" tagline />
      </div>
      <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>

        {step === 'email' && (
          <>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',marginBottom:6,color:'#f0f4ff'}}>FORGOT PASSWORD?</div>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,marginBottom:16}}>
              Enter the email tied to your account. We'll send a link to reset your password.
            </div>
            <Field label="Email">
              <input style={inputStyle} type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReset()}/>
            </Field>
            {error && <ErrorBox text={error}/>}
            <button onClick={sendReset} disabled={loading || !email}
              style={{...btnPrimary, opacity:(loading||!email)?0.4:1}}>
              {loading ? 'Sending...' : 'SEND RESET LINK'}
            </button>
            <button onClick={() => router.push('/login')} style={btnGhost}>
              BACK TO SIGN IN
            </button>
          </>
        )}

        {step === 'sent' && (
          <>
            <div style={{width:48,height:48,margin:'4px auto 14px',borderRadius:24,background:'#2edf8722',border:'2px solid #2edf87',display:'flex',alignItems:'center',justifyContent:'center',color:'#2edf87',fontSize:22,fontWeight:700}}>✓</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',marginBottom:6,color:'#f0f4ff',textAlign:'center'}}>CHECK YOUR EMAIL</div>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55,marginBottom:16,textAlign:'center'}}>
              We sent a reset link to <strong style={{color:'#f0f4ff'}}>{email}</strong>. Open it from this device — clicking the link will bring you back here to set a new password.
            </div>
            <button onClick={() => router.push('/login')} style={btnGhost}>BACK TO SIGN IN</button>
          </>
        )}

        {step === 'set' && (
          <>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',marginBottom:6,color:'#f0f4ff'}}>SET NEW PASSWORD</div>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,marginBottom:16}}>
              Pick something at least 8 characters.
            </div>
            <Field label="New Password">
              <input style={inputStyle} type="password" placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)}/>
            </Field>
            <Field label="Confirm">
              <input style={inputStyle} type="password" placeholder="Type it again"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setNewPassword()}/>
            </Field>
            {error && <ErrorBox text={error}/>}
            <button onClick={setNewPassword} disabled={loading || !password || !confirm}
              style={{...btnPrimary, opacity:(loading||!password||!confirm)?0.4:1}}>
              {loading ? 'Updating...' : 'UPDATE PASSWORD'}
            </button>
          </>
        )}

      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>{label}</div>
      {children}
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
      {text}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#1a2236', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
const btnPrimary = {
  width:'100%', background:'#4f9eff', color:'#fff', border:'none', borderRadius:10,
  padding:'12px 0', fontFamily:"'Bebas Neue',sans-serif", fontSize:18, letterSpacing:'.08em', cursor:'pointer', marginBottom:8,
};
const btnGhost = {
  width:'100%', background:'transparent', color:'#7a8db0', border:'1px solid #2e3f60', borderRadius:10,
  padding:'10px 0', fontFamily:"'Bebas Neue',sans-serif", fontSize:16, letterSpacing:'.08em', cursor:'pointer',
};
