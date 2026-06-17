import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import { fmtDate } from '../lib/helpers';
import { PLANS, trialDaysLeft, isBlocked } from '../lib/billing';
import TopNav from '../components/TopNav';

// /account — the canonical "manage my account" page reviewers expect.
// Pulls together the pieces that already exist elsewhere (subscription
// portal, password reset, account deletion) so testers and end users
// have one URL to hit instead of bouncing between /billing and
// /settings.

export default function Account() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { org, role, loading: orgLoading } = useOrg(user);
  const [busy, setBusy] = useState('');
  const [msg, setMsg]   = useState('');
  const [err, setErr]   = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  const isOwner = role === 'owner' || role === 'admin';

  const openPortal = async () => {
    if (!isOwner) { setErr('Only the org owner can manage billing.'); return; }
    setBusy('portal'); setErr(''); setMsg('');
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
      if (!r.ok || !body?.url) { setErr(body?.error || 'Could not open billing portal.'); setBusy(''); return; }
      window.location.href = body.url;
    } catch (e) {
      setErr(e?.message || 'Network error.');
      setBusy('');
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setBusy('reset'); setErr(''); setMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset` : undefined,
    });
    setBusy('');
    if (error) { setErr(error.message); return; }
    setMsg(`Password reset link sent to ${user.email}. Check your inbox.`);
  };

  const signOut = async () => {
    setBusy('signout');
    await supabase.auth.signOut();
    router.push('/login');
  };

  const deleteAccount = async () => {
    const ok1 = confirm(
      'This will permanently delete your account and all data. This cannot be undone.\n\n' +
      'If you are the sole owner of an organization, the business and all of its customers, ' +
      'jobs, invoices, and records will also be removed. Multi-user organizations are unaffected.'
    );
    if (!ok1) return;
    const typed = prompt('Type DELETE to confirm.');
    if ((typed || '').trim().toUpperCase() !== 'DELETE') return;
    setBusy('delete'); setErr(''); setMsg('');
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { setErr(error.message); setBusy(''); return; }
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user || orgLoading) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/account"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
      </div>
    );
  }

  const status   = org?.subscription_status || 'trialing';
  const tier     = org?.subscription_tier;
  const plan     = tier ? PLANS[tier] : null;
  const daysLeft = org ? trialDaysLeft(org) : null;
  const blocked  = org ? isBlocked(org) : false;
  const renewsOn = org?.subscription_current_period_end ? fmtDate(org.subscription_current_period_end.slice(0, 10)) : null;
  const cancelEnd = !!org?.subscription_cancel_at_period_end;
  const createdAt = user?.created_at ? fmtDate(user.created_at.slice(0, 10)) : null;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/account"/>

      <main style={{maxWidth:680,margin:'0 auto',padding:'24px 16px 0'}}>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Account</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>
            MY ACCOUNT
          </h1>
        </div>

        {msg && <Banner color="#2edf87" text={msg}/>}
        {err && <Banner color="#f26060" text={err}/>}

        <Section title="Profile">
          <Row label="Email" value={user.email}/>
          {org?.name && <Row label="Business" value={org.name}/>}
          {role && <Row label="Role" value={roleLabel(role)}/>}
          {createdAt && <Row label="Member since" value={createdAt}/>}
        </Section>

        <Section title="Subscription">
          {plan ? (
            <>
              <Row label="Plan" value={plan.name}/>
              <Row label="Status" value={<StatusPill status={status} blocked={blocked}/>}/>
              {status === 'trialing' && daysLeft !== null && (
                <Row label="Trial ends in" value={`${daysLeft} day${daysLeft === 1 ? '' : 's'}`}/>
              )}
              {renewsOn && (
                <Row label={cancelEnd ? 'Ends on' : 'Renews on'} value={renewsOn}/>
              )}
            </>
          ) : (
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,marginBottom:10}}>
              No active subscription on this account.
            </div>
          )}
          {isOwner && (
            <button onClick={openPortal} disabled={busy === 'portal'}
              style={primaryBtn(busy === 'portal')}>
              {busy === 'portal' ? 'OPENING...' : 'MANAGE SUBSCRIPTION'}
            </button>
          )}
          <div style={{fontSize:11,color:'#7a8db0',marginTop:8,lineHeight:1.5}}>
            Update payment method, view invoices, or cancel through the Stripe customer portal. Subscriptions are billed through Stripe, not the app store.
          </div>
        </Section>

        <Section title="Security">
          <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,marginBottom:10}}>
            Send a password reset link to your email. The link expires in one hour.
          </div>
          <button onClick={sendPasswordReset} disabled={busy === 'reset'}
            style={secondaryBtn(busy === 'reset')}>
            {busy === 'reset' ? 'SENDING...' : 'EMAIL PASSWORD RESET LINK'}
          </button>
        </Section>

        <Section title="Session">
          <button onClick={signOut} disabled={busy === 'signout'}
            style={secondaryBtn(busy === 'signout')}>
            {busy === 'signout' ? 'SIGNING OUT...' : 'SIGN OUT'}
          </button>
        </Section>

        <div style={{marginTop:18,background:'rgba(242,96,96,0.04)',border:'1px solid rgba(242,96,96,0.25)',borderRadius:12,padding:'16px 14px'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#f26060',marginBottom:6}}>DELETE ACCOUNT</div>
          <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,marginBottom:8}}>
            <strong style={{color:'#f0f4ff'}}>This permanently deletes your account and all data. This cannot be undone.</strong>
          </div>
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5,marginBottom:6}}>
            Removes the sign-in for <strong style={{color:'#f0f4ff'}}>{user.email}</strong>. If you are the sole owner of an organization, that business and everything in it (customers, jobs, invoices, quotes, expenses, mileage, photos) is removed too. Multi-user organizations stay intact.
          </div>
          <div style={{fontSize:11,color:'#7a8db0',lineHeight:1.5,marginBottom:12}}>
            Data is fully removed within 24 hours per GDPR. We can't undo this.
          </div>
          <button onClick={deleteAccount} disabled={busy === 'delete'}
            style={{background:'transparent',border:'1.5px solid #f26060',borderRadius:10,color:'#f26060',padding:'10px 16px',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.08em',fontWeight:700,cursor:'pointer',opacity:busy === 'delete' ? 0.5 : 1}}>
            {busy === 'delete' ? 'DELETING...' : 'DELETE MY ACCOUNT'}
          </button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'16px 14px',marginBottom:14}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',marginBottom:10,paddingBottom:8,borderBottom:'1px solid #2e3f60'}}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'6px 0',fontSize:13}}>
      <span style={{color:'#7a8db0'}}>{label}</span>
      <span style={{color:'#f0f4ff',fontWeight:600,textAlign:'right',wordBreak:'break-word',minWidth:0}}>{value}</span>
    </div>
  );
}

function Banner({ color, text }) {
  return (
    <div style={{background:`${color}1f`,border:`1px solid ${color}55`,borderRadius:10,padding:'10px 12px',marginBottom:14,fontSize:13,color,lineHeight:1.5}}>
      {text}
    </div>
  );
}

function StatusPill({ status, blocked }) {
  const palette = blocked
    ? { bg:'#f2606022', fg:'#f26060', border:'#f2606066' }
    : status === 'active'
      ? { bg:'#2edf8722', fg:'#2edf87', border:'#2edf8766' }
      : status === 'trialing'
        ? { bg:'#4f9eff22', fg:'#4f9eff', border:'#4f9eff66' }
        : { bg:'#fbbf2422', fg:'#fbbf24', border:'#fbbf2466' };
  return (
    <span style={{background:palette.bg,border:`1px solid ${palette.border}`,color:palette.fg,borderRadius:999,padding:'2px 10px',fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>
      {status}
    </span>
  );
}

function roleLabel(role) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  if (role === 'supervisor') return 'Supervisor';
  if (role === 'crew') return 'Crew';
  return role;
}

const primaryBtn = (busy) => ({
  background:'#4f9eff', color:'#fff', border:'none', borderRadius:10,
  padding:'11px 16px', fontFamily:"'Bebas Neue',sans-serif", fontSize:14,
  letterSpacing:'.08em', fontWeight:700, cursor: busy ? 'progress' : 'pointer',
  opacity: busy ? 0.6 : 1,
});

const secondaryBtn = (busy) => ({
  background:'transparent', color:'#4f9eff', border:'1.5px solid #4f9eff',
  borderRadius:10, padding:'10px 16px', fontFamily:"'Bebas Neue',sans-serif",
  fontSize:14, letterSpacing:'.08em', fontWeight:700,
  cursor: busy ? 'progress' : 'pointer', opacity: busy ? 0.6 : 1,
});
