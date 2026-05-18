import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';

export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId && user && !saving) router.push('/dashboard');
  }, [orgId, user]);

  const save = async () => {
    if (!company.trim()) { setError('Company name required'); return; }
    setSaving(true);
    setError('');
    const { error: rpcErr } = await supabase.rpc('create_org', { p_name: company });
    if (rpcErr) { setError(rpcErr.message); setSaving(false); return; }
    router.push('/dashboard');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user || orgLoading) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>Loading...</div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',sans-serif"}}>
      <div style={{marginBottom:32,textAlign:'center'}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:48,letterSpacing:'.12em',color:'#f0f4ff'}}>FIELDAPP</div>
        <div style={{fontSize:13,color:'#7a8db0',letterSpacing:'.06em'}}>ONE LAST STEP</div>
      </div>
      <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:16,padding:24,width:'100%',maxWidth:360}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.08em',marginBottom:8,color:'#f0f4ff'}}>NAME YOUR COMPANY</div>
        <div style={{fontSize:12,color:'#7a8db0',marginBottom:18,lineHeight:1.5}}>
          This is what you and your team will see across the app. You can change it later.
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Company Name</div>
          <input
            type="text" placeholder="Smith Lawn Care LLC" autoFocus
            value={company} onChange={e => setCompany(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            style={{width:'100%',background:'#1a2236',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit'}}
          />
        </div>

        {error && (
          <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
            {error}
          </div>
        )}

        <button
          onClick={save} disabled={saving || !company.trim()}
          style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'12px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',marginBottom:10,opacity:saving||!company.trim()?0.4:1}}>
          {saving ? 'Creating...' : 'CONTINUE'}
        </button>
        <button
          onClick={signOut}
          style={{width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'8px 0',fontSize:12,cursor:'pointer'}}>
          Sign out
        </button>
        <div style={{marginTop:14,fontSize:11,color:'#7a8db0',textAlign:'center'}}>
          Signed in as {user.email}
        </div>
      </div>
    </div>
  );
}
