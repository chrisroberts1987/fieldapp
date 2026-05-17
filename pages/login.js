import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function Login() {
const router = useRouter();
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const signIn = async () => {
setLoading(true); setError('');
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) { setError(error.message); setLoading(false); }
else router.push('/dashboard');
};

const signUp = async () => {
setLoading(true); setError('');
const { error } = await supabase.auth.signUp({ email, password });
if (error) { setError(error.message); setLoading(false); }
else router.push('/dashboard');
};

return (
<div style={{minHeight:'100vh',background:'#111827',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',sans-serif"}}>
<div style={{marginBottom:32,textAlign:'center'}}>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:48,letterSpacing:'.12em',color:'#f0f4ff'}}>FIELDAPP</div>
<div style={{fontSize:13,color:'#7a8db0',letterSpacing:'.06em'}}>FIELD SERVICE MANAGEMENT</div>
</div>
<div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:16,padding:24,width:'100%',maxWidth:340}}>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',marginBottom:18,color:'#f0f4ff'}}>SIGN IN</div>
<div style={{marginBottom:12}}>
<div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Email</div>
<input
style={{width:'100%',background:'#1a2236',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit'}}
type="email" placeholder="you@example.com"
value={email} onChange={e => setEmail(e.target.value)}
onKeyDown={e => e.key === 'Enter' && signIn()}
/>
</div>
<div style={{marginBottom:16}}>
<div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Password</div>
<input
style={{width:'100%',background:'#1a2236',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit'}}
type="password" placeholder="••••••••"
value={password} onChange={e => setPassword(e.target.value)}
onKeyDown={e => e.key === 'Enter' && signIn()}
/>
</div>
{error && (
<div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
{error}
</div>
)}
<button
onClick={signIn} disabled={loading || !email || !password}
style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',marginBottom:8,opacity:loading||!email||!password?0.4:1}}>
{loading ? 'Signing in...' : 'SIGN IN'}
</button>
<button
onClick={signUp} disabled={loading || !email || !password}
style={{width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'.08em',cursor:'pointer',opacity:loading||!email||!password?0.4:1}}>
CREATE ACCOUNT
</button>
<div style={{marginTop:16,fontSize:11,color:'#7a8db0',textAlign:'center'}}>
New here? Enter your email and a password then hit Create Account.
</div>
</div>
</div>
);
}