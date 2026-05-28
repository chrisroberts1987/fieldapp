import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import { fmt$, fmtDate } from '../lib/helpers';
import TopNav from '../components/TopNav';
import { PLANS, PLAN_ORDER, isBlocked, trialDaysLeft } from '../lib/billing';

// Subscription management page. Shows current plan + status, lets
// the owner start/switch plans (Stripe Checkout) or manage their
// existing subscription (Stripe Customer Portal: payment method,
// invoice history, cancel).

export default function Billing() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { org, role, loading: orgLoading } = useOrg(user);
  const [billing, setBilling] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  const isOwner = role === 'owner' || role === 'admin';

  const startCheckout = async (tier) => {
    if (!isOwner) { setErr('Only the org owner can change billing.'); return; }
    setBusy(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/stripe/checkout-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier, billing }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body?.url) { setErr(body?.error || `Could not start checkout (${r.status}).`); setBusy(false); return; }
      window.location.href = body.url;
    } catch (e) {
      setErr(e?.message || 'Network error.');
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (!isOwner) { setErr('Only the org owner can manage billing.'); return; }
    setBusy(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body?.url) { setErr(body?.error || 'Could not open billing portal.'); setBusy(false); return; }
      window.location.href = body.url;
    } catch (e) {
      setErr(e?.message || 'Network error.');
      setBusy(false);
    }
  };

  if (!user || orgLoading || !org) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/billing"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading…</div>
      </div>
    );
  }

  const status     = org.subscription_status || 'trialing';
  const tier       = org.subscription_tier;
  const daysLeft   = trialDaysLeft(org);
  const blocked    = isBlocked(org);
  const renewsOn   = org.subscription_current_period_end ? fmtDate(org.subscription_current_period_end.slice(0, 10)) : null;
  const cancelEnd  = !!org.subscription_cancel_at_period_end;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/billing"/>

      <main style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 0'}}>
        <div style={{marginBottom:18}}>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'0'}}>BILLING</h1>
        </div>

        {router.query.started === '1' && (
          <Banner color="#2edf87" text="Subscription started. Stripe is confirming the payment. Your plan will appear here in a moment."/>
        )}
        {router.query.cancelled === '1' && (
          <Banner color="#fbbf24" text="Checkout cancelled. You can try again whenever you're ready."/>
        )}
        {err && <Banner color="#f26060" text={err}/>}

        {/* Current state */}
        <div style={{background:'#1e2a42',border:'1.5px solid '+(blocked?'#f2606055':'#2e3f60'),borderRadius:14,padding:'18px 18px',marginBottom:18}}>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>Current Plan</div>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:6}}>
            <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,letterSpacing:'.04em',margin:0,lineHeight:1.05}}>
              {tier ? (PLANS[tier]?.name || tier).toUpperCase() : (status === 'trialing' ? 'FREE TRIAL' : 'NO PLAN')}
            </h2>
            <StatusPill status={status} daysLeft={daysLeft} cancelEnd={cancelEnd}/>
          </div>
          {tier && PLANS[tier] && (
            <div style={{fontSize:13,color:'#c8d4ee',marginTop:6}}>
              {PLANS[tier].users}{renewsOn ? ` · ${cancelEnd ? 'Ends' : 'Renews'} ${renewsOn}` : ''}
            </div>
          )}
          {!tier && status === 'trialing' && (
            <div style={{fontSize:13,color:'#c8d4ee',marginTop:6}}>
              {daysLeft === 0
                ? 'Your trial ended. Choose a plan below to keep using MyForeman.'
                : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial. Pick a plan whenever you're ready.`}
            </div>
          )}

          {(tier || org.stripe_customer_id) && (
            <button onClick={openPortal} disabled={busy || !isOwner}
              style={{marginTop:14,background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:600,letterSpacing:'.04em',fontFamily:'inherit'}}>
              Manage card, invoices, cancel
            </button>
          )}
        </div>

        {/* Plan picker (only if not on an active paid plan, or wanting to switch) */}
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
          <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:999,padding:4,display:'flex',gap:4}}>
            <button onClick={() => setBilling('monthly')}
              style={{background:billing==='monthly'?'#4f9eff':'transparent',border:'none',borderRadius:999,color:billing==='monthly'?'#fff':'#7a8db0',padding:'8px 18px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em',fontFamily:'inherit'}}>
              MONTHLY
            </button>
            <button onClick={() => setBilling('annual')}
              style={{background:billing==='annual'?'#4f9eff':'transparent',border:'none',borderRadius:999,color:billing==='annual'?'#fff':'#7a8db0',padding:'8px 18px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.06em',fontFamily:'inherit'}}>
              ANNUAL
            </button>
          </div>
        </div>
        {billing === 'annual' && (
          <div style={{textAlign:'center',fontSize:11,fontWeight:700,letterSpacing:'.12em',color:'#2edf87',marginBottom:10}}>1 MONTH FREE</div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:10,marginBottom:18}}>
          {PLAN_ORDER.map(k => {
            const p = PLANS[k];
            const monthly = billing === 'annual' ? Math.round(p.annual / 12) : p.monthly;
            const isCurrent = tier === p.key && (status === 'active' || status === 'trialing');
            return (
              <div key={k} style={{
                background:'#1e2a42',
                border: '1.5px solid ' + (p.popular ? '#4f9eff' : '#2e3f60'),
                borderRadius:14, padding:'18px 16px', position:'relative',
              }}>
                {p.popular && <span style={{position:'absolute',top:-10,left:14,background:'#4f9eff',color:'#fff',fontSize:10,fontWeight:700,letterSpacing:'.08em',padding:'3px 9px',borderRadius:999,textTransform:'uppercase'}}>Most Popular</span>}
                <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>{p.name}</div>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.02em',color:'#f0f4ff',marginTop:4,lineHeight:1}}>
                  ${monthly}
                  <span style={{fontSize:13,color:'#7a8db0',marginLeft:4}}>/mo</span>
                </div>
                {billing === 'annual' && (
                  <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>${p.annual} billed annually</div>
                )}
                <div style={{fontSize:12,color:'#c8d4ee',marginTop:8}}>{p.users}</div>
                <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{p.subtitle}</div>
                <button onClick={() => startCheckout(p.key)} disabled={busy || !isOwner || isCurrent}
                  style={{
                    width:'100%', marginTop:14,
                    background: isCurrent ? '#2edf8722' : (p.popular ? '#4f9eff' : 'transparent'),
                    border: isCurrent ? '1px solid #2edf8766' : (p.popular ? 'none' : '1px solid #2e3f60'),
                    borderRadius:10,
                    color: isCurrent ? '#2edf87' : (p.popular ? '#fff' : '#c8d4ee'),
                    padding:'11px 0',
                    fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:14, letterSpacing:'.06em',
                    cursor: isCurrent ? 'default' : (busy || !isOwner ? 'not-allowed' : 'pointer'),
                    opacity: (busy || !isOwner) && !isCurrent ? 0.5 : 1,
                  }}>
                  {isCurrent ? 'CURRENT PLAN'
                    : !isOwner ? 'OWNER ONLY'
                    : tier ? `SWITCH TO ${p.name.toUpperCase()}`
                    : `START ${p.name.toUpperCase()}`}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{fontSize:11,color:'#7a8db0',textAlign:'center',padding:'10px 0',lineHeight:1.6}}>
          Secure billing by Stripe. Cancel anytime from the manage panel above.
          {!isOwner && <><br/>You're not the org owner. Ask them to make billing changes.</>}
        </div>
      </main>
    </div>
  );
}

function StatusPill({ status, daysLeft, cancelEnd }) {
  const map = {
    active:    { c:'#2edf87', label:'Active' },
    trialing:  { c:'#fbbf24', label: daysLeft != null ? `Trial · ${daysLeft}d left` : 'Trial' },
    past_due:  { c:'#f26060', label:'Past due' },
    canceled:  { c:'#7a8db0', label:'Canceled' },
    unpaid:    { c:'#f26060', label:'Unpaid' },
    expired:   { c:'#f26060', label:'Expired' },
    incomplete:{ c:'#7a8db0', label:'Incomplete' },
    incomplete_expired:{ c:'#7a8db0', label:'Expired' },
  };
  const v = map[status] || { c:'#7a8db0', label: status };
  const label = cancelEnd && status === 'active' ? 'Ending soon' : v.label;
  return (
    <span style={{background:v.c+'22',color:v.c,border:'1px solid '+v.c+'66',borderRadius:999,padding:'3px 10px',fontSize:11,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
      {label}
    </span>
  );
}

function Banner({ color, text }) {
  return (
    <div style={{margin:'0 0 14px',padding:'10px 14px',background:color+'15',border:'1px solid '+color+'55',borderRadius:10,fontSize:13,color}}>
      {text}
    </div>
  );
}
