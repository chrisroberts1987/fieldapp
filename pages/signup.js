import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Signup() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    setError('');
    if (!company.trim()) { setError('Company name required'); return; }
    if (!email.trim() || !password) { setError('Email and password required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    // If email confirmation is required, signUp returns a user but no session.
    // The org_id must be created when the user is actually authenticated, so
    // wait briefly and try to get the session.
    if (!authData.session) {
      setError('Account created. Check your email to confirm, then sign in.');
      setLoading(false);
      return;
    }

    const { data: orgId, error: rpcErr } = await supabase.rpc('create_org', { p_name: company });
    if (rpcErr) { setError('Account created but company setup failed: ' + rpcErr.message); setLoading(false); return; }

    router.push('/dashboard');
  };

  return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',sans-serif"}}>
      <div style={{marginBottom:32,display:'flex',justifyContent:'center'}}>
        <Logo size="lg" tagline />
      </div>
      <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:16,padding:24,width:'100%',maxWidth:340}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',marginBottom:18,color:'#f0f4ff'}}>CREATE ACCOUNT</div>

        <Field label="Company Name">
          <input
            style={inputStyle}
            type="text" placeholder="Smith Lawn Care LLC"
            value={company} onChange={e => setCompany(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            style={inputStyle}
            type="email" placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            style={inputStyle}
            type="password" placeholder="At least 8 characters"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && signUp()}
          />
        </Field>

        {error && (
          <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
            {error}
          </div>
        )}

        <button
          onClick={signUp} disabled={loading || !company || !email || !password}
          style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',marginBottom:8,opacity:loading||!company||!email||!password?0.4:1}}>
          {loading ? 'Creating...' : 'CREATE ACCOUNT'}
        </button>
        <button
          onClick={() => router.push('/login')}
          style={{width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'.08em',cursor:'pointer'}}>
          ALREADY HAVE AN ACCOUNT? SIGN IN
        </button>
        <div style={{marginTop:14,fontSize:11,color:'#7a8db0',textAlign:'center',lineHeight:1.5}}>
          Free 14-day trial. Card required — cancel anytime, no charge during your trial.
        </div>
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

const inputStyle = {
  width:'100%', background:'#1a2236', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
