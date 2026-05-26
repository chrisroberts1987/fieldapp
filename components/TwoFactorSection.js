// 2FA management UI for the settings page. Uses Supabase Auth's
// built-in MFA TOTP factors:
//
//   1. supabase.auth.mfa.enroll({ factorType: 'totp' })
//      → returns { id, totp: { qr_code, secret, uri } }
//   2. user scans QR in Authenticator / 1Password / etc.
//   3. supabase.auth.mfa.challenge({ factorId })
//   4. supabase.auth.mfa.verify({ factorId, challengeId, code })
//   5. supabase.auth.mfa.unenroll({ factorId }) to remove
//
// Requires MFA to be enabled in the Supabase dashboard
// (Auth → MFA → Time-based one-time password). Until that's flipped,
// the enroll() call returns a "MFA disabled" error, which we surface.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function TwoFactorSection() {
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(null); // { factorId, qr, secret, challengeId }
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk]       = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setError(''); setOk(''); setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator' });
    setBusy(false);
    if (error) {
      const msg = /not enabled|mfa.*disabled/i.test(error.message)
        ? 'Two-factor isn\'t enabled on the backend yet. Ask the platform admin to flip it on in the Supabase dashboard (Auth → MFA → TOTP).'
        : error.message;
      setError(msg);
      return;
    }
    // Pre-create a challenge so verify can go straight through.
    const { data: ch } = await supabase.auth.mfa.challenge({ factorId: data.id });
    setEnrolling({
      factorId: data.id,
      qr: data.totp?.qr_code,
      secret: data.totp?.secret,
      challengeId: ch?.id,
    });
  };

  const verify = async () => {
    if (!enrolling || !code) return;
    setError(''); setBusy(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: enrolling.challengeId,
      code,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setOk('Two-factor enabled.');
    setEnrolling(null);
    setCode('');
    await load();
  };

  const remove = async (factorId) => {
    if (!confirm('Turn off two-factor for this account?')) return;
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    setOk('Two-factor disabled.');
    await load();
  };

  const verified = factors.filter(f => f.status === 'verified');
  const hasMfa = verified.length > 0;

  return (
    <div style={{marginBottom:14,background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',marginBottom:10,fontWeight:700}}>TWO-FACTOR LOGIN</div>
      {loading ? (
        <div style={{fontSize:13,color:'#7a8db0'}}>Loading...</div>
      ) : hasMfa ? (
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#2edf87',marginBottom:8}}>
            <span style={{width:8,height:8,borderRadius:4,background:'#2edf87'}}/> Two-factor is ON
          </div>
          <div style={{fontSize:12,color:'#7a8db0',marginBottom:10}}>
            You'll be prompted for a code from your authenticator app on each sign-in.
          </div>
          {verified.map(f => (
            <div key={f.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'#111827',borderRadius:8,marginBottom:6}}>
              <div style={{fontSize:13}}>{f.friendly_name || 'Authenticator'}</div>
              <button onClick={() => remove(f.id)} disabled={busy}
                style={{background:'transparent',border:'1px solid #f26060',borderRadius:7,color:'#f26060',padding:'5px 10px',fontSize:11,fontWeight:600,letterSpacing:'.04em',cursor:'pointer'}}>
                Disable
              </button>
            </div>
          ))}
        </div>
      ) : !enrolling ? (
        <div>
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.55,marginBottom:10}}>
            Add a second login step so even a stolen password can't get into your account. You'll need an authenticator app (Google Authenticator, 1Password, Authy, etc).
          </div>
          <button onClick={startEnroll} disabled={busy}
            style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,letterSpacing:'.04em',cursor:'pointer',fontSize:13}}>
            {busy ? '…' : 'TURN ON 2FA'}
          </button>
        </div>
      ) : (
        <div>
          <div style={{fontSize:12,color:'#c8d4ee',marginBottom:8}}>
            1. Open your authenticator app and scan this QR.<br/>
            2. Enter the 6-digit code it shows below.
          </div>
          {enrolling.qr && (
            <div style={{background:'#fff',padding:10,borderRadius:8,display:'inline-block',marginBottom:10}}>
              <img src={enrolling.qr} alt="2FA QR code" style={{display:'block',width:160,height:160}}/>
            </div>
          )}
          {enrolling.secret && (
            <div style={{fontSize:11,color:'#7a8db0',marginBottom:10,fontFamily:'monospace'}}>
              Can't scan? Enter this secret manually: {enrolling.secret}
            </div>
          )}
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
            inputMode="numeric" placeholder="123456" maxLength={6}
            style={{width:'100%',background:'#111827',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:18,letterSpacing:'.3em',padding:'10px 12px',textAlign:'center',fontFamily:'monospace',marginBottom:8}}/>
          <div style={{display:'flex',gap:8}}>
            <button onClick={verify} disabled={busy || code.length !== 6}
              style={{flex:1,background:'#2edf87',border:'none',borderRadius:8,color:'#111827',padding:'10px 0',fontWeight:700,fontSize:13,letterSpacing:'.06em',cursor:'pointer',opacity:(busy || code.length !== 6) ? 0.5 : 1}}>
              CONFIRM
            </button>
            <button onClick={() => { setEnrolling(null); setCode(''); setError(''); }}
              style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#7a8db0',padding:'10px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'8px 12px',marginTop:10,fontSize:12,color:'#f26060'}}>{error}</div>}
      {ok    && <div style={{background:'rgba(46,223,135,.12)',border:'1px solid rgba(46,223,135,.3)',borderRadius:8,padding:'8px 12px',marginTop:10,fontSize:12,color:'#2edf87'}}>{ok}</div>}
    </div>
  );
}
