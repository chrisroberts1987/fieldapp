import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

// Bump this when Terms / Privacy materially change. We store the
// version + timestamp on the user record at signup so we can prove
// what the customer agreed to and prompt re-acceptance on a bump.
const TOS_VERSION = '2026-05-26';

export default function Signup() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    setError('');
    // If they're accepting an invite, they don't need to enter a company name —
    // they're joining an existing one.
    const inviteToken = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('myforeman_post_signup_invite') : null;

    if (!inviteToken && !company.trim()) { setError('Company name required'); return; }
    if (!email.trim() || !password) { setError('Email and password required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!tosAccepted) { setError('Please agree to the Terms of Service and Privacy Policy to continue.'); return; }

    setLoading(true);

    // Stamp the TOS acceptance on the user record so we have a
    // permanent record of what they agreed to and when. Goes into
    // raw_user_meta_data and survives email confirmation.
    const tosMeta = {
      tos_accepted_at: new Date().toISOString(),
      tos_version: TOS_VERSION,
    };
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: tosMeta },
    });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    if (!authData.session) {
      setError('Account created. Check your email to confirm, then sign in. Your invite will be accepted automatically.');
      setLoading(false);
      return;
    }

    // Accept invite path: skip create_org.
    if (inviteToken) {
      const { error: invErr } = await supabase.rpc('accept_invite', { p_token: inviteToken });
      sessionStorage.removeItem('myforeman_post_signup_invite');
      if (invErr) { setError('Account created but invite acceptance failed: ' + invErr.message); setLoading(false); return; }
      router.push('/dashboard');
      return;
    }

    const { error: rpcErr } = await supabase.rpc('create_org', { p_name: company });
    if (rpcErr) { setError('Account created but company setup failed: ' + rpcErr.message); setLoading(false); return; }

    router.push('/dashboard');
  };

  const canSubmit = email && password && tosAccepted && !loading
                    && (company || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('myforeman_post_signup_invite')));

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

        <label htmlFor="tos-accept"
          style={{
            display:'flex',gap:10,alignItems:'flex-start',
            padding:'10px 12px',marginBottom:12,
            background:'#1a2236',border:'1.5px solid ' + (tosAccepted ? '#2edf87' : '#2e3f60'),
            borderRadius:10,cursor:'pointer',
            transition:'border-color .15s',
          }}>
          <input
            id="tos-accept"
            type="checkbox"
            checked={tosAccepted}
            onChange={e => setTosAccepted(e.target.checked)}
            style={{
              marginTop:2,width:18,height:18,flexShrink:0,
              accentColor:'#2edf87',cursor:'pointer',
            }}
          />
          <span style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5}}>
            I agree to the{' '}
            <a onClick={(e) => { e.preventDefault(); window.open('/terms','_blank'); }}
               style={{color:'#4f9eff',cursor:'pointer',textDecoration:'underline'}}>Terms of Service</a>
            {' '}and{' '}
            <a onClick={(e) => { e.preventDefault(); window.open('/privacy','_blank'); }}
               style={{color:'#4f9eff',cursor:'pointer',textDecoration:'underline'}}>Privacy Policy</a>.
          </span>
        </label>

        {error && (
          <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
            {error}
          </div>
        )}

        <button
          onClick={signUp} disabled={!canSubmit}
          style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',marginBottom:8,opacity:!canSubmit?0.4:1}}>
          {loading ? 'Creating...' : 'CREATE ACCOUNT'}
        </button>
        <button
          onClick={() => router.push('/login')}
          style={{width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'.08em',cursor:'pointer'}}>
          ALREADY HAVE AN ACCOUNT? SIGN IN
        </button>
        <div style={{marginTop:14,fontSize:11,color:'#7a8db0',textAlign:'center',lineHeight:1.5}}>
          Free 14-day trial. Card required, cancel anytime, no charge during your trial.
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
