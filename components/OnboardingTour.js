import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

// Full-screen, 8-step walkthrough triggered on first dashboard load.
// Completion is persisted to auth.users.user_metadata so it only fires
// once per user — no migration needed. Re-openable from Settings via
// the launchOnboarding() exported helper.

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to MyForeman',
    body: "You're about to run your entire business from one place. We'll show you how it works in 60 seconds.",
    primary: { label: 'Show Me' },
    secondary: { label: 'Skip Tour', action: 'skip' },
  },
  {
    id: 'workflow',
    title: 'From Lead to Paid, Automatically',
    body: 'MyForeman automates your entire business workflow. A lead comes in, you send a quote. The customer approves it and a job is created automatically. The job gets done and an invoice is sent automatically. The invoice gets paid and your financials update automatically and a review request goes to your customer.',
    flow: ['Lead', 'Quote', 'Job', 'Invoice', 'Paid'],
    primary: { label: "That's what I need" },
  },
  {
    id: 'leads',
    title: 'Leads Come to You',
    body: 'Share your QR code or lead form link on Facebook, your website, or anywhere online. New leads land directly in your app and you get notified instantly.',
    chip: { label: 'Leads', color: '#54d4f8', icon: PhoneIcon },
    primary: { label: 'Next' },
  },
  {
    id: 'quotes',
    title: 'Quote in Minutes',
    body: 'Build a professional quote with line items, labor, and materials. Send it to your customer with one tap. They approve it from their phone, no back and forth.',
    chip: { label: 'Quotes', color: '#b197fc', icon: ScrollIcon },
    primary: { label: 'Next' },
  },
  {
    id: 'jobs',
    title: 'Dispatch Your Crew',
    body: 'Approved quotes become jobs automatically. Assign them to crew members or let crew claim them from the job pool. Everyone knows exactly what to do and where to be.',
    chip: { label: 'Jobs', color: '#4f9eff', icon: WrenchIcon },
    primary: { label: 'Next' },
  },
  {
    id: 'invoices',
    title: 'Get Paid Faster',
    body: 'When a job is marked complete, an invoice is sent to your customer automatically. Track payment status in real time. No more chasing checks.',
    chip: { label: 'Invoices', color: '#fbbf24', icon: ReceiptIcon },
    primary: { label: 'Next' },
  },
  {
    id: 'insights',
    title: 'Know Your Business',
    body: 'MyForeman tracks everything: revenue, job profitability, best customers, slow months. After 3 months your AI Coach kicks in with personalized recommendations to help you grow.',
    chip: { label: 'Insights', color: '#2edf87', icon: ChartIcon },
    primary: { label: 'Next' },
  },
  {
    id: 'setup',
    title: 'One Last Thing',
    body: 'Add your business name, logo, and contact info. It takes 2 minutes and appears on every quote and invoice you send.',
    primary: { label: 'Set Up My Profile', action: 'settings' },
    secondary: { label: "I'll do it later", action: 'finish' },
  },
];

// Public sentinel used to bypass the metadata check (Settings replay).
const FORCE_KEY = 'myforeman_tour_force';

export function launchOnboarding(router) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(FORCE_KEY, '1');
  router.push('/dashboard');
}

export default function OnboardingTour() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUser(session.user);
      const meta = session.user.user_metadata || {};
      const forced = typeof window !== 'undefined' && sessionStorage.getItem(FORCE_KEY) === '1';
      if (forced) {
        sessionStorage.removeItem(FORCE_KEY);
        setStep(0);
        setOpen(true);
        return;
      }
      if (!meta.onboarding_completed_at && !meta.onboarding_skipped_at) {
        setStep(0);
        setOpen(true);
      }
    })();
  }, []);

  if (!open || !user) return null;

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const markCompleted = async () => {
    setBusy(true);
    await supabase.auth.updateUser({
      data: { ...(user.user_metadata || {}), onboarding_completed_at: new Date().toISOString() },
    });
    setBusy(false);
    setOpen(false);
  };
  const markSkipped = async () => {
    setBusy(true);
    await supabase.auth.updateUser({
      data: { ...(user.user_metadata || {}), onboarding_skipped_at: new Date().toISOString() },
    });
    setBusy(false);
    setOpen(false);
  };

  const handlePrimary = async () => {
    if (current.primary.action === 'settings') {
      await markCompleted();
      router.push('/settings');
      return;
    }
    if (current.primary.action === 'finish' || isLast) {
      await markCompleted();
      return;
    }
    setStep(s => Math.min(total - 1, s + 1));
  };
  const handleSecondary = async () => {
    if (!current.secondary) return;
    if (current.secondary.action === 'skip') {
      await markSkipped();
      return;
    }
    if (current.secondary.action === 'finish') {
      await markCompleted();
      return;
    }
  };

  const progressPct = ((step + 1) / total) * 100;

  return (
    <div className="onb-backdrop" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="onb-card">
        {/* Progress bar */}
        <div style={{height:4,background:'#0d1726',borderRadius:'14px 14px 0 0',overflow:'hidden'}}>
          <div style={{height:'100%',width:`${progressPct}%`,background:'linear-gradient(90deg,#4f9eff,#2edf87)',transition:'width .25s'}}/>
        </div>

        {/* Header strip */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px 4px'}}>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:700}}>
            Step {step + 1} of {total}
          </div>
          <button onClick={markSkipped} disabled={busy}
            style={{background:'transparent',border:'none',color:'#7a8db0',fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',cursor:'pointer',padding:'4px 8px'}}>
            Skip tour
          </button>
        </div>

        {/* Body */}
        <div style={{padding:'12px 28px 28px',overflowY:'auto',flex:1}}>
          <h2 id="onb-title" style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.03em',color:'#f0f4ff',margin:'8px 0 14px',lineHeight:1.1}}>
            {current.title.toUpperCase()}
          </h2>
          <p style={{fontSize:15,lineHeight:1.6,color:'#c8d4ee',margin:'0 0 22px'}}>{current.body}</p>

          {/* Tab spotlight chip (steps with chip) */}
          {current.chip && <TabChip chip={current.chip}/>}

          {/* Workflow visualization (step 2) */}
          {current.flow && <FlowVisual steps={current.flow}/>}
        </div>

        {/* Footer buttons */}
        <div style={{display:'flex',flexDirection:'column',gap:8,padding:'0 20px 22px'}}>
          <button onClick={handlePrimary} disabled={busy}
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'14px 18px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:busy?0.5:1}}>
            {current.primary.label.toUpperCase()}
          </button>
          {current.secondary && (
            <button onClick={handleSecondary} disabled={busy}
              style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'12px 18px',fontSize:13,fontWeight:600,letterSpacing:'.05em',cursor:'pointer',opacity:busy?0.5:1,fontFamily:'inherit'}}>
              {current.secondary.label}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .onb-backdrop {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(8,11,20,0.86);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: fadeIn .2s ease-out;
        }
        .onb-card {
          width: 100%; max-width: 520px;
          background: #1a2236;
          border: 1px solid #2e3f60;
          border-radius: 14px;
          display: flex; flex-direction: column;
          max-height: calc(100dvh - 32px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.55);
          animation: slideUp .25s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 540px) {
          .onb-backdrop { padding: 0; align-items: stretch; }
          .onb-card { max-width: 100%; border-radius: 0; max-height: 100dvh; }
        }
      `}</style>
    </div>
  );
}

function TabChip({ chip }) {
  const Icon = chip.icon;
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'#0d1726',border:'1px solid ' + chip.color + '55',borderRadius:12,marginBottom:8}}>
      <div style={{
        width:38,height:38,borderRadius:9,
        background: chip.color + '22',
        border: '1px solid ' + chip.color + '88',
        color: chip.color,
        display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
        boxShadow: `0 0 0 4px ${chip.color}22`,
      }}>
        <Icon/>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:600}}>Look for the tab</div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:chip.color,lineHeight:1}}>
          {chip.label.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function FlowVisual({ steps }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center',justifyContent:'center',marginTop:4,marginBottom:8,padding:'14px 12px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:12}}>
      {steps.map((s, i) => (
        <span key={s} style={{display:'inline-flex',alignItems:'center',gap:6}}>
          <span style={{
            background: i === steps.length - 1 ? 'rgba(46,223,135,0.15)' : 'rgba(79,158,255,0.12)',
            border: '1px solid ' + (i === steps.length - 1 ? '#2edf8788' : '#4f9eff66'),
            color: i === steps.length - 1 ? '#2edf87' : '#c8d4ee',
            borderRadius: 999,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>{s}</span>
          {i < steps.length - 1 && <span style={{color:'#7a8db0',fontSize:14}}>→</span>}
        </span>
      ))}
    </div>
  );
}

// Inline icons (same set as TopNav so styling matches)
function svg(d) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>{d}</svg>;
}
function PhoneIcon()   { return svg(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.95.36 1.88.7 2.77a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.31-1.27a2 2 0 0 1 2.11-.45c.89.34 1.82.57 2.77.7A2 2 0 0 1 22 16.92Z"/>); }
function ScrollIcon()  { return svg(<><path d="M8 21h12a2 2 0 0 0 2-2v-2H10"/><path d="M19 17V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3h10"/><path d="M15 8h-5"/><path d="M15 12h-5"/></>); }
function WrenchIcon()  { return svg(<path d="M14.7 6.3a4.5 4.5 0 0 0 4 6.36l-9.3 9.3a2.12 2.12 0 0 1-3-3l9.3-9.3a4.5 4.5 0 0 0-1-3.36Z"/>); }
function ReceiptIcon() { return svg(<><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2l-1 2-3-2-3 2-3-2-3 2-3-2Z"/><path d="M8 7h8M8 11h8M8 15h5"/></>); }
function ChartIcon()   { return svg(<polyline points="3 17 9 11 13 15 21 7"/>); }
