import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { fmt$, fmtDate } from '../../lib/helpers';
import { roleLabel, roleColor } from '../../lib/role';
import { FullPageLoading } from '../../components/PageStates';

export default function PublicInvite() {
  const router = useRouter();
  const { token } = router.query;
  const [invite, setInvite] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!router.isReady || !token) return;
    (async () => {
      const { data } = await supabase.rpc('get_public_invite', { p_token: token });
      setInvite(data || null);
      setLoaded(true);
    })();
  }, [router.isReady, token]);

  const accept = async () => {
    setError(''); setAccepting(true);
    const { error } = await supabase.rpc('accept_invite', { p_token: token });
    setAccepting(false);
    if (error) { setError(error.message); return; }
    setAccepted(true);
    setTimeout(() => router.push('/dashboard'), 1200);
  };

  // If not signed in, route them to signup with a return URL.
  const goSignup = () => {
    sessionStorage.setItem('myforeman_post_signup_invite', token);
    router.push('/signup');
  };
  const goLogin = () => {
    sessionStorage.setItem('myforeman_post_signup_invite', token);
    router.push('/login');
  };

  if (!loaded || !authChecked) {
    return <FullPageLoading/>;
  }
  if (!invite) {
    return (
      <Screen biz={null}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:8}}>INVITE NOT FOUND</div>
        <div style={{fontSize:14,color:'#7a8db0',lineHeight:1.55}}>This link is invalid or has been revoked.</div>
      </Screen>
    );
  }
  if (invite.accepted_at && !accepted) {
    return (
      <Screen biz={{ name: invite.org_name, logo: invite.org_logo_url }}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:8}}>ALREADY ACCEPTED</div>
        <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>This invite was already used. If you need access, ask your foreman to send a fresh one.</div>
      </Screen>
    );
  }
  if (accepted) {
    return (
      <Screen biz={{ name: invite.org_name, logo: invite.org_logo_url }}>
        <div style={{width:60,height:60,margin:'12px auto 14px',borderRadius:30,background:'#2edf8722',border:'2px solid #2edf87',display:'flex',alignItems:'center',justifyContent:'center',color:'#2edf87',fontSize:28,fontWeight:700}}>✓</div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:8}}>WELCOME</div>
        <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>You're in. Taking you to the dashboard…</div>
      </Screen>
    );
  }

  const c = roleColor(invite.role);

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",padding:'24px 16px 40px'}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>
        <BizHeader biz={{ name: invite.org_name, logo: invite.org_logo_url }}/>

        <div style={{marginTop:18,marginBottom:18,textAlign:'center'}}>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>You're invited</div>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.04em',marginTop:4}}>JOIN {invite.org_name.toUpperCase()}</div>
        </div>

        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'20px 18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #2e3f60'}}>
            <span style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>Role</span>
            <span style={{fontSize:13,fontWeight:700,letterSpacing:'.06em',padding:'4px 10px',borderRadius:999,background:c+'22',color:c,border:'1px solid '+c+'66',textTransform:'uppercase'}}>{roleLabel(invite.role)}</span>
          </div>
          {invite.hourly_pay_rate != null && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #2e3f60'}}>
              <span style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>Pay rate</span>
              <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,color:'#2edf87'}}>{fmt$(invite.hourly_pay_rate)} / hr</span>
            </div>
          )}
          {(invite.invite_email || invite.invite_phone) && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0'}}>
              <span style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>Invited as</span>
              <span style={{fontSize:13,color:'#f0f4ff'}}>{invite.invite_email || invite.invite_phone}</span>
            </div>
          )}

          <div style={{marginTop:14}}>
            {user ? (
              <>
                <div style={{fontSize:12,color:'#c8d4ee',marginBottom:10,lineHeight:1.5}}>
                  Signed in as <strong style={{color:'#f0f4ff'}}>{user.email}</strong>. Accepting will add you to {invite.org_name}.
                </div>
                {error && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'#f26060'}}>{error}</div>}
                <button onClick={accept} disabled={accepting}
                  style={{width:'100%',background:'#2edf87',color:'#0d1726',border:'none',borderRadius:12,padding:'14px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',fontWeight:700,cursor:'pointer',opacity:accepting?0.5:1}}>
                  {accepting ? 'JOINING...' : 'ACCEPT INVITE'}
                </button>
              </>
            ) : (
              <>
                <div style={{fontSize:13,color:'#c8d4ee',marginBottom:14,lineHeight:1.5,textAlign:'center'}}>
                  Create an account or sign in to accept this invite.
                </div>
                <button onClick={goSignup}
                  style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:12,padding:'14px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',fontWeight:700,cursor:'pointer',marginBottom:8}}>
                  CREATE ACCOUNT
                </button>
                <button onClick={goLogin}
                  style={{width:'100%',background:'transparent',color:'#c8d4ee',border:'1px solid #2e3f60',borderRadius:12,padding:'12px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',fontWeight:700,cursor:'pointer'}}>
                  I ALREADY HAVE AN ACCOUNT
                </button>
              </>
            )}
          </div>

          {invite.expires_at && (
            <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid #2e3f60',fontSize:11,color:'#7a8db0',textAlign:'center'}}>
              Invite expires {fmtDate(invite.expires_at.slice(0,10))}
            </div>
          )}
        </div>

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#7a8db0'}}>Powered by MyForeman</div>
      </div>
    </div>
  );
}

function BizHeader({ biz }) {
  if (!biz) return null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'4px 0'}}>
      {biz.logo && <img src={biz.logo} alt="" style={{width:54,height:54,objectFit:'contain',borderRadius:10,background:'#0d1726',border:'1px solid #2e3f60'}}/>}
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',lineHeight:1.05,color:'#f0f4ff'}}>{biz.name}</div>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase',marginTop:2}}>Your invitation</div>
      </div>
    </div>
  );
}

function Screen({ biz, children }) {
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{maxWidth:420,textAlign:'center'}}>
        {biz && <BizHeader biz={biz}/>}
        <div style={{marginTop:20}}>{children}</div>
      </div>
    </div>
  );
}

const loadingStyle = {
  minHeight:'100vh', background:'#111827', display:'flex',
  alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif',
};
