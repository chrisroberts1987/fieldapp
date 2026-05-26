import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// First-visit modal that walks the user through adding MyForeman to
// their phone's home screen. Different copy for iOS Safari (which
// requires manual Share → Add to Home Screen) vs Android Chrome
// (which fires beforeinstallprompt for a one-tap install).
//
// Only fires when:
//   - User is signed in (no auth = guest = don't prompt)
//   - On /dashboard (post-signup landing, not the marketing page)
//   - Mobile (no point on desktop)
//   - Not already installed (display-mode standalone)
//   - Not dismissed previously (localStorage)
//
// The /dashboard gate alone keeps the prompt off the landing page,
// signup/login, and every public guest route. It only pops once the
// contractor is actually inside their account and likely to want it.

const LS_DISMISSED = 'myforeman_install_prompt_dismissed';
const ALLOWED_PATHS = new Set(['/dashboard']);

function detectPlatform() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua) && !window.MSStream) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null; // desktop / other — don't prompt
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [deferred, setDeferred] = useState(null); // BeforeInstallPromptEvent

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (localStorage.getItem(LS_DISMISSED) === '1') return;

    // Only on /dashboard. Landing page, signup, login, and every
    // public guest route stay clean.
    const path = window.location.pathname || '';
    if (!ALLOWED_PATHS.has(path)) return;

    const p = detectPlatform();
    if (!p) return;

    // Require an active session — guests viewing /dashboard while
    // signed out get redirected anyway, but be defensive in case
    // the redirect hasn't fired yet.
    let cancelled = false;
    let cleanup = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;

      // Don't fire while the welcome tour is still running for a
      // first-time user. Both popping at once is confusing. After
      // the contractor finishes (or skips) the tour, user_metadata
      // gets stamped; on their next /dashboard visit the prompt is
      // free to appear.
      const meta = session.user?.user_metadata || {};
      const tourFinished = meta.onboarding_completed_at || meta.onboarding_skipped_at;
      if (!tourFinished) return;

      setPlatform(p);

      // Wait a moment so the dashboard has time to settle before we
      // pop the modal. 4 seconds gives the contractor a glance at
      // their app before we ask them to install it.
      if (p === 'android') {
        const handler = (e) => {
          e.preventDefault();
          if (cancelled) return;
          setDeferred(e);
          setShow(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        const t = setTimeout(() => {
          if (cancelled) return;
          // If beforeinstallprompt didn't fire by now, fall back to
          // the manual-instructions card.
          if (!deferred) setShow(true);
        }, 4000);
        cleanup = () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(t); };
      } else if (p === 'ios') {
        const t = setTimeout(() => { if (!cancelled) setShow(true); }, 4000);
        cleanup = () => clearTimeout(t);
      }
    })();

    return () => { cancelled = true; if (cleanup) cleanup(); };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(LS_DISMISSED, '1'); } catch {}
    setShow(false);
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') dismiss();
      return;
    }
    // No deferred prompt available — leave it on screen so the user
    // can read the manual instructions.
  };

  if (!show) return null;

  return (
    <div role="dialog" aria-modal="true"
      style={{
        position:'fixed', inset:0, zIndex:9000,
        background:'rgba(8,11,20,0.78)',
        display:'flex', alignItems:'flex-end', justifyContent:'center',
        padding:'14px',
        backdropFilter:'blur(4px)',
      }}>
      <div style={{
        width:'100%', maxWidth:480,
        background:'#1a2236',
        border:'1px solid #2e3f60',
        borderRadius:14,
        boxShadow:'0 20px 50px rgba(0,0,0,0.55)',
        padding:'18px 18px calc(18px + env(safe-area-inset-bottom, 0px))',
        color:'#f0f4ff',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
          <img src="/icons/icon-96.png" alt="" width="44" height="44" style={{borderRadius:10,display:'block'}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>Add to Home Screen</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',lineHeight:1,marginTop:2}}>
              GET THE MYFOREMAN APP
            </div>
          </div>
          <button onClick={dismiss} aria-label="Close"
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#7a8db0',width:28,height:28,cursor:'pointer',fontSize:14,padding:0,lineHeight:1,fontFamily:'inherit'}}>
            ✕
          </button>
        </div>

        {platform === 'ios' && (
          <>
            <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55,marginBottom:14}}>
              Install MyForeman on your iPhone so it opens like a real app, full-screen and one tap away.
            </div>
            <Steps steps={[
              { icon: <ShareIcon/>,   text: "Tap the Share button in Safari's toolbar." },
              { icon: <PlusIcon/>,    text: "Scroll down and tap Add to Home Screen." },
              { icon: <CheckIcon/>,   text: "Tap Add. The MyForeman icon appears on your home screen." },
            ]}/>
          </>
        )}

        {platform === 'android' && (
          <>
            <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55,marginBottom:14}}>
              Install MyForeman to your home screen for fast, full-screen access.
            </div>
            {deferred ? (
              <button onClick={install}
                style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:17,letterSpacing:'.06em',cursor:'pointer',marginBottom:10}}>
                INSTALL APP
              </button>
            ) : (
              <Steps steps={[
                { icon: <MenuIcon/>,  text: "Tap the ⋮ menu in Chrome's top right." },
                { icon: <PlusIcon/>,  text: 'Tap "Install app" or "Add to Home screen."' },
                { icon: <CheckIcon/>, text: "Confirm. MyForeman appears in your app drawer." },
              ]}/>
            )}
          </>
        )}

        <button onClick={dismiss}
          style={{width:'100%',background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'11px 0',fontSize:13,fontWeight:600,letterSpacing:'.05em',cursor:'pointer',fontFamily:'inherit',marginTop:6}}>
          Got it
        </button>
      </div>
    </div>
  );
}

function Steps({ steps }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:6}}>
      {steps.map((s, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:10}}>
          <div style={{width:30,height:30,borderRadius:6,background:'rgba(79,158,255,0.12)',border:'1px solid rgba(79,158,255,0.3)',color:'#4f9eff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {s.icon}
          </div>
          <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.4}}>{s.text}</div>
        </div>
      ))}
    </div>
  );
}

function svg(d) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
}
function ShareIcon() { return svg(<><path d="M12 2v14"/><polyline points="7 7 12 2 17 7"/><path d="M5 21h14a2 2 0 0 0 2-2v-7"/><path d="M3 12v7a2 2 0 0 0 2 2"/></>); }
function PlusIcon()  { return svg(<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>); }
function CheckIcon() { return svg(<polyline points="20 6 9 17 4 12"/>); }
function MenuIcon()  { return svg(<><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></>); }
