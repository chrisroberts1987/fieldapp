import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { TOUR_STEPS } from '../lib/tour/steps';
import { enablePushNotifications, notificationPermission } from '../lib/push/client';

// Global, single-mount tour. Lives in pages/_app.js so it persists
// across page navigations and can drive the user from screen to
// screen. State is local React state — the tour is contained to one
// session, no DB roundtrip per step.
//
// Demo behavior: for the shared demo account we never write a
// "tour seen" flag, so every visit triggers the walkthrough fresh.

const SS_FORCE_KEY = 'myforeman_tour_force';
const DEMO_EMAIL   = 'demo@myforemanhq.com';

// Routes where the tour is allowed to live (avoids firing on the
// landing page, login, signup, public quote, feedback, etc).
const TOUR_ROUTES = new Set([
  '/dashboard', '/leads', '/quotes', '/jobs', '/invoices',
  '/insights', '/customers', '/expenses', '/mileage', '/crew',
  '/approvals', '/tax', '/settings',
]);

export default function TourOverlay() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [hasOrg, setHasOrg] = useState(null); // null = unknown, true/false = known
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);     // bounding rect of current target
  const [missing, setMissing] = useState(false);
  const navigatingRef = useRef(false);
  // Per-session "user already dismissed" flag — needed because the
  // demo user has no persisted metadata, so without this the auto-
  // start effect would immediately re-trigger after Skip.
  const dismissedThisSessionRef = useRef(false);

  // ----- 1. Track signed-in user -----
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);

  // ----- 1b. Probe for org membership -----
  // Avoids launching the tour for a freshly-confirmed user who's
  // about to be redirected to /onboarding — the tour would briefly
  // mount on /dashboard, then unmount as the redirect fires, causing
  // a flash. We only auto-start once we know the user has an org.
  useEffect(() => {
    if (!user) { setHasOrg(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setHasOrg(!!data);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ----- 2. Auto-start logic -----
  useEffect(() => {
    if (!user) return;
    if (hasOrg !== true) return; // not yet known, or no org — don't fire
    if (!TOUR_ROUTES.has(router.pathname)) return;
    if (active) return;
    if (dismissedThisSessionRef.current) return; // user dismissed/finished — stay closed
    const isDemo = user.email === DEMO_EMAIL;
    const forced = typeof window !== 'undefined' && sessionStorage.getItem(SS_FORCE_KEY) === '1';
    const seen = user.user_metadata?.onboarding_completed_at || user.user_metadata?.onboarding_skipped_at;
    if (forced) {
      sessionStorage.removeItem(SS_FORCE_KEY);
      dismissedThisSessionRef.current = false;
      setStep(0); setActive(true); return;
    }
    if (isDemo || !seen) {
      setStep(0); setActive(true);
    }
  }, [user, hasOrg, router.pathname, active]);

  const current = TOUR_STEPS[step];

  // ----- 3. Navigate the user to the step's page when needed -----
  useEffect(() => {
    if (!active || !current) return;
    if (router.pathname !== current.page && !navigatingRef.current) {
      navigatingRef.current = true;
      router.push(current.page).finally(() => { navigatingRef.current = false; });
    }
  }, [active, current?.id, current?.page, router.pathname]);

  // ----- 4. Measure target element (with polling for slow renders) -----
  const measure = useCallback(() => {
    if (!active || !current) return;
    if (router.pathname !== current.page) return;
    if (!current.target) { setRect(null); setMissing(false); return; }
    const el = document.querySelector(current.target);
    if (!el) { setRect(null); return false; }
    const r = el.getBoundingClientRect();
    // Round so the spotlight rectangle aligns cleanly with the
    // device pixel grid — sub-pixel values were leaving a faint gap
    // on mobile.
    setRect({
      top:    Math.round(r.top),
      left:   Math.round(r.left),
      width:  Math.round(r.width),
      height: Math.round(r.height),
      bottom: Math.round(r.bottom),
      right:  Math.round(r.right),
    });
    setMissing(false);
    return true;
  }, [active, current, router.pathname]);

  useEffect(() => {
    if (!active || !current) return;
    if (router.pathname !== current.page) return;
    if (!current.target) { setRect(null); setMissing(false); return; }

    // Retry up to 3 seconds for elements that mount async (e.g. waiting
    // on Supabase data).
    setRect(null); setMissing(false);
    let cancelled = false;
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      const ok = measure();
      if (ok || ++attempts > 30) {
        if (!ok) setMissing(true);
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
    return () => { cancelled = true; };
  }, [active, current?.id, router.pathname, measure]);

  // ----- 5. Recompute on resize / scroll / layout shifts -----
  useEffect(() => {
    if (!active || !current?.target) return;
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);

    // ResizeObserver catches the case where the target's own size or
    // its layout context shifts after we first measured — common on
    // mobile when a flex-wrap row collapses or expands.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      const el = document.querySelector(current.target);
      if (el) {
        ro = new ResizeObserver(() => measure());
        ro.observe(el);
        ro.observe(document.body);
      }
    }

    // Double rAF catches the case where the page is still settling
    // into final layout right after we first attached the listeners.
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => measure());
      return () => cancelAnimationFrame(raf2);
    });

    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      cancelAnimationFrame(raf1);
      ro?.disconnect();
    };
  }, [active, current?.target, measure]);

  // ----- 6. Scroll target into view (instant, not smooth — a smooth
  // scroll meant the spotlight was chasing the moving element which
  // looked off on mobile) -----
  useEffect(() => {
    if (!rect) return;
    const vh = window.innerHeight;
    if (rect.top < 80 || rect.bottom > vh - 220) {
      const el = document.querySelector(current.target);
      el?.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [rect, current?.target]);

  // ----- 7. Persist dismissal (skip for demo user) -----
  const writeFlag = async (field) => {
    if (!user || user.email === DEMO_EMAIL) return;
    const meta = { ...(user.user_metadata || {}), [field]: new Date().toISOString() };
    await supabase.auth.updateUser({ data: meta });
  };

  // ----- 8. Step controls -----
  const finish = async (field) => {
    dismissedThisSessionRef.current = true;
    setActive(false);
    // Persist for non-demo users only. Fire-and-forget so the UI
    // closes instantly; if the network roundtrip is slow we don't
    // want the user staring at a stuck modal.
    writeFlag(field).catch(() => {});

    // After a tour COMPLETION (not skip), nudge for notification
    // permission. Demo users can opt in too — granting on the demo
    // account works for that browser session.
    if (field === 'onboarding_completed_at' && notificationPermission() === 'default') {
      setTimeout(() => { enablePushNotifications().catch(() => {}); }, 600);
    }
  };
  const next = async () => {
    const last = step === TOUR_STEPS.length - 1;
    const action = current?.primaryAction;
    if (action === 'settings') {
      await finish('onboarding_completed_at');
      router.push('/settings');
      return;
    }
    if (action === 'finish' || last) {
      await finish('onboarding_completed_at');
      return;
    }
    setStep(s => Math.min(TOUR_STEPS.length - 1, s + 1));
  };
  const secondary = async () => {
    const action = current?.secondaryAction;
    if (action === 'finish') {
      await finish('onboarding_completed_at');
      return;
    }
  };
  const skip = async () => {
    await finish('onboarding_skipped_at');
  };

  if (!active || !current) return null;
  if (!TOUR_ROUTES.has(router.pathname)) return null;

  // Mid-navigation: the step has advanced to a new page but router
  // hasn't caught up yet. Keep the dark backdrop on screen so the
  // transition reads as a smooth cross-fade instead of a flash to
  // the bare app and back to the overlay. Tooltip/spotlight don't
  // render until the new page is mounted and the target measures.
  const inTransition = router.pathname !== current.page;

  const isModal = !current.target;
  const totalSteps = TOUR_STEPS.length;
  const progressPct = ((step + 1) / totalSteps) * 100;

  if (inTransition) {
    return <div className="tour-modal-backdrop" aria-hidden="true" style={{pointerEvents:'none'}}/>;
  }

  return (
    <>
      {isModal ? (
        <ModalCard
          step={step + 1} total={totalSteps}
          progressPct={progressPct}
          title={current.title}
          body={current.body}
          primary={current.primary}
          secondary={current.secondary}
          onPrimary={next}
          onSecondary={secondary}
          onSkip={skip}
        />
      ) : (
        <Spotlight
          rect={rect} missing={missing}
          step={step + 1} total={totalSteps}
          progressPct={progressPct}
          title={current.title}
          body={current.body}
          primary={current.primary}
          onPrimary={next}
          onSkip={skip}
        />
      )}
    </>
  );
}

// =============================================================
// Modal step (welcome + final). Centered card, dimmed backdrop.
// =============================================================
function ModalCard({ step, total, progressPct, title, body, primary, secondary, onPrimary, onSecondary, onSkip }) {
  return (
    <div className="tour-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tour-modal-card">
        <ProgressBar pct={progressPct}/>
        <Header step={step} total={total} onSkip={onSkip}/>
        <div style={{padding:'12px 26px 22px'}}>
          <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,letterSpacing:'.03em',color:'#f0f4ff',margin:'4px 0 12px',lineHeight:1.1}}>
            {title.toUpperCase()}
          </h2>
          <p style={{fontSize:15,lineHeight:1.55,color:'#c8d4ee',margin:0}}>{body}</p>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8,padding:'0 20px 20px'}}>
          <button onClick={onPrimary}
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 18px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer'}}>
            {primary.toUpperCase()}
          </button>
          {secondary && (
            <button onClick={onSecondary}
              style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'11px 18px',fontSize:13,fontWeight:600,letterSpacing:'.05em',cursor:'pointer',fontFamily:'inherit'}}>
              {secondary}
            </button>
          )}
        </div>
      </div>
      <style jsx>{`
        .tour-modal-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(8,11,20,0.78);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: fadeIn .2s ease-out;
        }
        .tour-modal-card {
          width: 100%; max-width: 460px;
          background: #1a2236;
          border: 1px solid #2e3f60;
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.55);
          animation: slideUp .25s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

// =============================================================
// Spotlight step. Cuts a transparent hole around the target via a
// box-shadow trick on a fixed-position div, then positions a tooltip
// on whichever side of the target has more room.
// =============================================================
function Spotlight({ rect, missing, step, total, progressPct, title, body, primary, onPrimary, onSkip }) {
  const PAD = 4;

  if (missing) {
    // Element didn't render in time — fall back to a centered card so
    // we never block the user with a broken-looking overlay.
    return (
      <ModalCard
        step={step} total={total} progressPct={progressPct}
        title={title} body={body} primary={primary}
        onPrimary={onPrimary} onSkip={onSkip}
      />
    );
  }

  // Spotlight target hasn't measured yet (page just navigated in).
  // Render the dark backdrop so the cross-fade with the in-transition
  // state stays seamless — the ring + tooltip slide in once we have
  // a rect.
  if (!rect) {
    return <div className="tour-modal-backdrop" aria-hidden="true" style={{pointerEvents:'none'}}/>;
  }

  const top    = rect.top - PAD;
  const left   = rect.left - PAD;
  const width  = rect.width + PAD * 2;
  const height = rect.height + PAD * 2;

  return (
    <>
      {/* Dim layer — the huge box-shadow paints everything outside the spotlight */}
      <div style={{
        position:'fixed', top, left, width, height,
        borderRadius: 10, pointerEvents: 'none', zIndex: 9998,
        boxShadow: '0 0 0 9999px rgba(8,11,20,0.78)',
      }}/>

      {/* Outline ring on the spotlight itself */}
      <div style={{
        position:'fixed', top, left, width, height,
        borderRadius: 10, pointerEvents: 'none', zIndex: 9999,
        outline: '2px solid #4f9eff',
        outlineOffset: 0,
        animation: 'tourRingPulse 2s ease-in-out infinite',
      }}/>

      {/* Tooltip — fixed at the bottom of the viewport so it's always
          visible with its Next button reachable regardless of where the
          target sits on the page. Accounts for the mobile bottom nav
          (~64px) + iOS safe-area inset. */}
      <div style={{
        position:'fixed', left: '50%',
        bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)', maxWidth: 460,
        background: '#1a2236',
        border: '1px solid #2e3f60',
        borderRadius: 14,
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        zIndex: 10000,
        animation: 'tourTipIn .2s ease-out',
      }}>
        <ProgressBar pct={progressPct}/>
        <Header step={step} total={total} onSkip={onSkip}/>
        <div style={{padding:'10px 18px 14px'}}>
          <h3 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',color:'#f0f4ff',margin:'2px 0 8px',lineHeight:1.15}}>
            {title.toUpperCase()}
          </h3>
          <p style={{fontSize:14,lineHeight:1.5,color:'#c8d4ee',margin:'0 0 12px'}}>{body}</p>
          <button onClick={onPrimary}
            style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'12px 14px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.06em',cursor:'pointer'}}>
            {primary.toUpperCase()} →
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes tourRingPulse {
          0%, 100% { outline-color: rgba(79,158,255,0.85); }
          50%      { outline-color: rgba(79,158,255,0.35); }
        }
        @keyframes tourTipIn {
          from { transform: translate(-50%, 8px); opacity: 0; }
          to   { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{height:3,background:'#0d1726',borderRadius:'14px 14px 0 0',overflow:'hidden'}}>
      <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#4f9eff,#2edf87)',transition:'width .25s'}}/>
    </div>
  );
}

function Header({ step, total, onSkip }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 18px 0'}}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:700}}>
        Step {step} of {total}
      </div>
      <button onClick={onSkip}
        style={{background:'transparent',border:'none',color:'#7a8db0',fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer',padding:'2px 6px'}}>
        Skip tour
      </button>
    </div>
  );
}

// Public sentinel used by Settings to replay the tour from any page.
export function launchTour(router) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SS_FORCE_KEY, '1');
  router.push('/dashboard');
}
