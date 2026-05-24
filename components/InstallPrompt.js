import { useEffect, useState } from 'react';

// First-visit modal that walks the user through adding MyForeman to
// their phone's home screen. Different copy for iOS Safari (which
// requires manual Share → Add to Home Screen) vs Android Chrome
// (which fires beforeinstallprompt for a one-tap install).
//
// Dismissed state persists in localStorage so it only shows once.
// We also auto-hide if the app is already running standalone (it's
// already installed).

const LS_DISMISSED = 'myforeman_install_prompt_dismissed';

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
    // Don't show: not on mobile, already installed, already dismissed,
    // or on a guest/customer-facing flow (quote form, quote approval,
    // public invoice, feedback) where the visitor isn't a contractor.
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (localStorage.getItem(LS_DISMISSED) === '1') return;
    const path = window.location.pathname || '';
    if (/^\/(inv|q|quote|feedback|invite|login|signup|reset|privacy|terms|contact)(\/|$)/.test(path)) return;

    const p = detectPlatform();
    if (!p) return;
    setPlatform(p);

    // For Android we wait for the beforeinstallprompt event before
    // showing — that way we know the browser is ready to install.
    if (p === 'android') {
      const handler = (e) => {
        e.preventDefault();
        setDeferred(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      // If the event has already fired before this hook runs, the
      // browser may still re-dispatch on focus. Short delay also
      // gives Chrome time to fire it.
      const t = setTimeout(() => {
        // If the event didn't fire (already installed in a different
        // mode, or unsupported), show the generic Android instructions.
        if (!deferred) setShow(true);
      }, 1500);
      return () => { window.removeEventListener('beforeinstallprompt', handler); clearTimeout(t); };
    }

    // iOS — show after a brief delay so it doesn't clip the first paint.
    if (p === 'ios') {
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
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
