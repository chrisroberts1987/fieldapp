import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import TopNav from '../components/TopNav';
import { validateUpload, ACCEPT_ATTR } from '../lib/uploads';
import { launchTour } from '../components/TourOverlay';
import { enablePushNotifications, disablePushNotifications, notificationPermission, isPushSupported } from '../lib/push/client';

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [user, orgLoading, orgId]);

  useEffect(() => {
    if (org && !form) {
      setForm({
        name:             org.name || '',
        slug:             org.slug || '',
        owner_name:       org.owner_name || '',
        phone:            org.phone || '',
        business_email:   org.business_email || '',
        address:          org.address || '',
        license_number:   org.license_number || '',
        default_tax_rate: org.default_tax_rate != null ? String(org.default_tax_rate) : '8.25',
        income_tax_rate:  org.income_tax_rate  != null ? String(org.income_tax_rate)  : '25',
        venmo_handle:     org.venmo_handle     || '',
        zelle_contact:    org.zelle_contact    || '',
        cashapp_handle:   org.cashapp_handle   || '',
        paypal_handle:    org.paypal_handle    || '',
        check_payable_to: org.check_payable_to || '',
        check_mail_to:    org.check_mail_to    || '',
        payment_notes:    org.payment_notes    || '',
        google_review_url: org.google_review_url || '',
        yelp_review_url:   org.yelp_review_url   || '',
      });
      setLogoPreview(org.logo_url || null);
    }
  }, [org]);

  const quoteUrl = (form?.slug && typeof window !== 'undefined')
    ? `${window.location.origin}/quote/${form.slug}`
    : '';
  const [copied, setCopied] = useState(false);
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(quoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUpload(file, { images: true });
    if (err) { setError(err); return; }
    setError('');
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setError('');
    if (!form.name.trim())           { setError('Business name required'); return; }
    if (!form.owner_name.trim())     { setError('Owner name required'); return; }
    if (!form.phone.trim())          { setError('Phone required'); return; }
    if (!form.business_email.trim()) { setError('Business email required'); return; }
    if (!form.address.trim())        { setError('Business address required'); return; }
    const tax = Number(form.default_tax_rate);
    if (isNaN(tax) || tax < 0 || tax > 100) { setError('Default tax rate must be a number 0–100'); return; }
    const incomeTax = Number(form.income_tax_rate);
    if (isNaN(incomeTax) || incomeTax < 0 || incomeTax > 100) { setError('Income tax rate must be a number 0–100'); return; }

    setSaving(true);

    let logo_url = org?.logo_url || null;
    if (logoFile) {
      // Derive the extension from the MIME type (not the user-supplied
      // filename) so we can't be tricked into writing a path like .html or .svg.
      const extByMime = { 'image/jpeg':'jpg', 'image/png':'png', 'image/heic':'heic', 'image/heif':'heif' };
      const ext = extByMime[logoFile.type] || 'png';
      const path = `${orgId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('org-logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
      if (upErr) { setError('Logo upload failed: ' + upErr.message); setSaving(false); return; }
      const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path);
      // Cache-bust by appending the time so the new logo shows immediately.
      logo_url = pub?.publicUrl ? `${pub.publicUrl}?t=${Date.now()}` : null;
    }

    // Slug: lowercase, alphanumeric + hyphens only.
    const newSlug = (form.slug || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!newSlug) { setError('Quote link must contain at least one letter or number'); setSaving(false); return; }

    const { error: updErr } = await supabase
      .from('organizations')
      .update({
        name:             form.name.trim(),
        slug:             newSlug,
        owner_name:       form.owner_name.trim(),
        phone:            form.phone.trim(),
        business_email:   form.business_email.trim(),
        address:          form.address.trim(),
        license_number:   form.license_number.trim() || null,
        default_tax_rate: tax,
        income_tax_rate:  incomeTax,
        logo_url,
        venmo_handle:     form.venmo_handle.trim()    || null,
        zelle_contact:    form.zelle_contact.trim()   || null,
        cashapp_handle:   form.cashapp_handle.trim()  || null,
        paypal_handle:    form.paypal_handle.trim()   || null,
        check_payable_to: form.check_payable_to.trim()|| null,
        check_mail_to:    form.check_mail_to.trim()   || null,
        payment_notes:    form.payment_notes.trim()   || null,
        google_review_url: form.google_review_url.trim() || null,
        yelp_review_url:   form.yelp_review_url.trim()   || null,
      })
      .eq('id', orgId);
    if (updErr) {
      if (updErr.code === '23505' || /duplicate|unique/i.test(updErr.message)) {
        setError('That quote link is already taken. Try a different one.');
      } else {
        setError(updErr.message);
      }
      setSaving(false);
      return;
    }
    setForm(p => ({ ...p, slug: newSlug }));

    setSaving(false);
    setLogoFile(null);
    setSavedAt(Date.now());
  };

  if (!user || orgLoading || !form) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/settings"/>

      <div style={{maxWidth:560,margin:'24px auto 14px',padding:'0 16px'}}>
        <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Settings</div>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>SETTINGS</h1>
      </div>

      <div style={{maxWidth:560,margin:'16px auto 0',padding:'0 16px'}}>

        <Section title="Public Quote Link">
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.55,marginBottom:10}}>
            Share this link anywhere: on your website, in texts, on social, in your voicemail. They'll fill out a quick form and land in your Leads pipeline.
          </div>
          <div style={{display:'flex',gap:6,marginBottom:8,alignItems:'stretch'}}>
            <input readOnly value={quoteUrl} style={{...inputStyle, flex:1, fontFamily:'monospace', fontSize:12}}/>
            <button onClick={copyUrl} disabled={!quoteUrl}
              style={{background:copied?'#2edf8722':'#4f9eff',border:copied?'1px solid #2edf87':'none',borderRadius:10,color:copied?'#2edf87':'#fff',padding:'0 14px',fontSize:12,fontWeight:700,letterSpacing:'.06em',cursor:'pointer',whiteSpace:'nowrap'}}>
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          {quoteUrl && (
            <a href={quoteUrl} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',fontSize:12,color:'#4f9eff',marginBottom:10}}>
              Preview ↗
            </a>
          )}
          <Field label="Customize the slug">
            <input style={inputStyle} type="text" value={form.slug}
              onChange={e => setForm(p => ({...p, slug:e.target.value}))}
              placeholder="smith-lawn-care"/>
          </Field>
          <div style={{fontSize:11,color:'#fbbf24'}}>Changing this breaks any links you've already shared.</div>
        </Section>

        <Section title="Business">
          <Field label="Business Name">
            <input style={inputStyle} type="text" value={form.name}
              onChange={e => setForm(p => ({...p, name:e.target.value}))}/>
          </Field>
          <Field label="Owner Name">
            <input style={inputStyle} type="text" value={form.owner_name}
              onChange={e => setForm(p => ({...p, owner_name:e.target.value}))}/>
          </Field>
        </Section>

        <Section title="Contact">
          <Field label="Phone">
            <input style={inputStyle} type="tel" value={form.phone}
              onChange={e => setForm(p => ({...p, phone:e.target.value}))}/>
          </Field>
          <Field label="Business Email">
            <input style={inputStyle} type="email" value={form.business_email}
              onChange={e => setForm(p => ({...p, business_email:e.target.value}))}/>
          </Field>
          <Field label="Business Address">
            <textarea maxLength={2000} style={{...inputStyle, minHeight:64, resize:'vertical'}}
              value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))}/>
          </Field>
        </Section>

        <Section title="Logo">
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
            <div style={{width:72,height:72,borderRadius:10,background:'#111827',border:'1.5px solid #2e3f60',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
              {logoPreview
                ? <img src={logoPreview} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                : <div style={{fontSize:10,color:'#7a8db0',textAlign:'center',padding:4}}>No logo</div>}
            </div>
            <label style={{flex:1}}>
              <input type="file" accept={ACCEPT_ATTR} onChange={pickLogo} style={{display:'none'}}/>
              <div style={{background:'transparent',border:'1.5px solid #2e3f60',borderRadius:10,padding:'10px 12px',color:'#c8d4ee',fontSize:13,cursor:'pointer',textAlign:'center'}}>
                {logoFile ? 'Change logo' : (logoPreview ? 'Replace logo' : 'Upload logo')}
              </div>
            </label>
          </div>
          <div style={{fontSize:11,color:'#7a8db0'}}>PNG or JPG, under 2 MB. Square works best.</div>
        </Section>

        <PaymentsSection org={org} user={user}/>

        <Section title="Other Payment Methods">
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.55,marginBottom:10}}>
            Fill in whichever methods you accept. They'll show on the customer's invoice page under "Other ways to pay". Leave the rest blank. After a customer pays via one of these, tap <strong>Mark Paid</strong> on the invoice and the feedback request will auto-send.
          </div>
          <Field label="Venmo handle">
            <input style={inputStyle} type="text" value={form.venmo_handle}
              onChange={e => setForm(p => ({...p, venmo_handle:e.target.value}))}
              placeholder="@your-handle"/>
          </Field>
          <Field label="Zelle (email or phone)">
            <input style={inputStyle} type="text" value={form.zelle_contact}
              onChange={e => setForm(p => ({...p, zelle_contact:e.target.value}))}
              placeholder="you@business.com or 555-555-5555"/>
          </Field>
          <Field label="Cash App $cashtag">
            <input style={inputStyle} type="text" value={form.cashapp_handle}
              onChange={e => setForm(p => ({...p, cashapp_handle:e.target.value}))}
              placeholder="$YourCashtag"/>
          </Field>
          <Field label="PayPal (paypal.me or email)">
            <input style={inputStyle} type="text" value={form.paypal_handle}
              onChange={e => setForm(p => ({...p, paypal_handle:e.target.value}))}
              placeholder="@your-handle or you@business.com"/>
          </Field>
          <Field label="Check made payable to">
            <input style={inputStyle} type="text" value={form.check_payable_to}
              onChange={e => setForm(p => ({...p, check_payable_to:e.target.value}))}
              placeholder="Your Business Name"/>
          </Field>
          <Field label="Mail check to">
            <textarea maxLength={500} style={{...inputStyle, minHeight:60, resize:'vertical'}}
              value={form.check_mail_to}
              onChange={e => setForm(p => ({...p, check_mail_to:e.target.value}))}
              placeholder="Street&#10;City, ST  ZIP"/>
          </Field>
          <Field label="Other notes (optional)">
            <textarea maxLength={500} style={{...inputStyle, minHeight:50, resize:'vertical'}}
              value={form.payment_notes}
              onChange={e => setForm(p => ({...p, payment_notes:e.target.value}))}
              placeholder="ACH instructions, Wise handle, anything else"/>
          </Field>
        </Section>

        <Section title="Details">
          <Field label="License Number">
            <input style={inputStyle} type="text" value={form.license_number}
              onChange={e => setForm(p => ({...p, license_number:e.target.value}))}/>
          </Field>
          <Field label="Sales Tax Rate (%)">
            <input style={inputStyle} type="number" inputMode="decimal" step="0.01" min="0" max="100"
              value={form.default_tax_rate}
              onChange={e => setForm(p => ({...p, default_tax_rate:e.target.value}))}/>
          </Field>
          <Field label="Income Tax Rate (%)">
            <input style={inputStyle} type="number" inputMode="decimal" step="0.01" min="0" max="100"
              value={form.income_tax_rate}
              onChange={e => setForm(p => ({...p, income_tax_rate:e.target.value}))}/>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>Used by the Tax view to estimate quarterly/annual taxes. 25% is a sensible default for most US sole proprietors; ask your accountant.</div>
          </Field>
        </Section>

        <Section title="Public reviews">
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5,marginBottom:12}}>
            When a customer rates you 4 or 5 stars, they're redirected to leave a public review. Negative ratings stay private — only you see them.
          </div>
          <Field label="Google review URL">
            <input style={inputStyle} type="url" placeholder="https://g.page/r/..."
              value={form.google_review_url}
              onChange={e => setForm(p => ({...p, google_review_url:e.target.value}))}/>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>From your Google Business profile → "Get more reviews" → "Share review form".</div>
          </Field>
          <Field label="Yelp review URL (optional)">
            <input style={inputStyle} type="url" placeholder="https://www.yelp.com/biz/..."
              value={form.yelp_review_url}
              onChange={e => setForm(p => ({...p, yelp_review_url:e.target.value}))}/>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>Used as a fallback if no Google URL is set.</div>
          </Field>
        </Section>

        {error && (
          <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
            {error}
          </div>
        )}
        {savedAt > 0 && !error && (
          <div style={{background:'rgba(46,223,135,.12)',border:'1px solid rgba(46,223,135,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#2edf87',textAlign:'center'}}>
            Saved.
          </div>
        )}

        <button onClick={save} disabled={saving}
          style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',marginBottom:24,opacity:saving?0.5:1}}>
          {saving ? 'Saving...' : 'SAVE CHANGES'}
        </button>

        <button onClick={() => launchTour(router)}
          style={{width:'100%',background:'transparent',color:'#c8d4ee',border:'1px solid #2e3f60',borderRadius:10,padding:'11px 0',fontSize:13,fontWeight:600,letterSpacing:'.04em',cursor:'pointer',marginBottom:14}}>
          Replay welcome tour
        </button>

        <PushToggle/>

        <Section title="Switch to MyForeman">
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.55,marginBottom:12}}>
            Bringing your business over from Jobber, Housecall Pro, QuickBooks, or a spreadsheet? Import your customers, jobs, and invoices in a few minutes. We never overwrite anything you already have.
          </div>
          <button onClick={() => router.push('/import')}
            style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'12px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:'.08em',cursor:'pointer'}}>
            IMPORT DATA
          </button>
        </Section>

        <DangerZone user={user} router={router}/>

        <div style={{marginTop:18,paddingTop:16,borderTop:'1px solid #2e3f60',display:'flex',gap:16,justifyContent:'center',fontSize:12,color:'#7a8db0',flexWrap:'wrap'}}>
          <a onClick={() => router.push('/terms')}   style={{color:'#7a8db0',cursor:'pointer',textDecoration:'none'}}>Terms of Service</a>
          <a onClick={() => router.push('/privacy')} style={{color:'#7a8db0',cursor:'pointer',textDecoration:'none'}}>Privacy Policy</a>
          <a onClick={() => router.push('/contact')} style={{color:'#7a8db0',cursor:'pointer',textDecoration:'none'}}>Contact</a>
        </div>
      </div>
    </div>
  );
}

// Stripe Connect onboarding + status. Owner-only. The org row we're
// passed already includes the stripe_connect_* columns via useOrg.
function PaymentsSection({ org, user }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusOverride, setStatusOverride] = useState(null);

  // After the user returns from Stripe onboarding, refresh status
  // automatically. The redirect_url adds ?connect=return or
  // ?connect=refresh — either way we want to re-check.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.connect === 'return' || router.query.connect === 'refresh') {
      refreshStatus();
      // Clean the URL so subsequent renders don't re-trigger.
      router.replace('/settings', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.connect]);

  const isOwner = true; // settings page already gates org membership; only owner can run start endpoint server-side anyway
  const accountId       = statusOverride?.account_id || org?.stripe_connect_account_id;
  const chargesEnabled  = statusOverride?.charges_enabled ?? !!org?.stripe_connect_charges_enabled;
  const payoutsEnabled  = statusOverride?.payouts_enabled ?? !!org?.stripe_connect_payouts_enabled;
  const requirementsDue = statusOverride?.requirements_due ?? !!org?.stripe_connect_requirements_due;

  const status =
    !accountId                                ? 'not_started'
    : chargesEnabled && payoutsEnabled        ? 'live'
    : (requirementsDue || !chargesEnabled)    ? 'pending'
    : 'pending';

  const beginOnboarding = async () => {
    setBusy(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in first.');
      const r = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || 'Could not start onboarding.');
      window.location.href = body.url;
    } catch (e) {
      setErr(e?.message || 'Something went wrong.');
      setBusy(false);
    }
  };

  const refreshStatus = async () => {
    setRefreshing(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in first.');
      const r = await fetch('/api/stripe/connect/status', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || 'Status check failed.');
      setStatusOverride(body);
    } catch (e) {
      setErr(e?.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Section title="Customer Card Payments">
      <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.55,marginBottom:12}}>
        Let your customers pay invoices with a credit card via the Pay Now link. Funds land in <strong>your</strong> Stripe account. We never touch your customer money. You'll handle refunds, disputes, and payouts directly in Stripe.
      </div>

      {status === 'not_started' && (
        <>
          <button onClick={beginOnboarding} disabled={busy}
            style={{width:'100%',background:'#635bff',border:'none',borderRadius:10,color:'#fff',padding:'12px 0',fontWeight:700,fontSize:14,letterSpacing:'.04em',cursor:busy?'progress':'pointer',opacity:busy?0.7:1}}>
            {busy ? 'Opening Stripe...' : 'Set Up Card Payments'}
          </button>
          <div style={{fontSize:11,color:'#7a8db0',textAlign:'center',marginTop:8,lineHeight:1.5}}>
            Stripe walks you through setup in ~2 minutes. If you already have a Stripe account you can sign in; if not, you'll create one with your business info and bank account on the same screen.
          </div>
        </>
      )}

      {status === 'pending' && (
        <>
          <div style={{background:'#fbbf2422',border:'1px solid #fbbf2466',borderRadius:8,padding:'10px 12px',marginBottom:10,fontSize:12,color:'#fbbf24'}}>
            <strong>Stripe needs more info.</strong> {chargesEnabled ? 'Almost there. Confirm payout details.' : 'Complete a few onboarding steps to start accepting cards.'}
          </div>
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <button onClick={beginOnboarding} disabled={busy}
              style={{flex:1,background:'#635bff',border:'none',borderRadius:10,color:'#fff',padding:'10px 0',fontWeight:700,fontSize:13,letterSpacing:'.04em',cursor:busy?'progress':'pointer',opacity:busy?0.7:1}}>
              {busy ? 'Opening...' : 'Continue Setup'}
            </button>
            <button onClick={refreshStatus} disabled={refreshing}
              style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 14px',fontWeight:600,fontSize:13,cursor:refreshing?'progress':'pointer'}}>
              {refreshing ? '...' : 'Refresh'}
            </button>
          </div>
        </>
      )}

      {status === 'live' && (
        <>
          <div style={{background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:8,padding:'10px 12px',marginBottom:10,fontSize:12,color:'#2edf87'}}>
            <strong>Connected and live.</strong> Customers can pay your invoices by card. Payouts land in your bank on Stripe's schedule (usually 2 business days).
          </div>
          <div style={{display:'flex',gap:8}}>
            <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
              style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 0',fontWeight:600,fontSize:13,textAlign:'center',textDecoration:'none'}}>
              Open Stripe Dashboard ↗
            </a>
            <button onClick={refreshStatus} disabled={refreshing}
              style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 14px',fontWeight:600,fontSize:13,cursor:refreshing?'progress':'pointer'}}>
              {refreshing ? '...' : 'Refresh'}
            </button>
          </div>
        </>
      )}

      {err && (
        <div style={{marginTop:10,background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',fontSize:12,color:'#f26060'}}>
          {err}
        </div>
      )}
    </Section>
  );
}

function DangerZone({ user, router }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const isAdmin = (user?.email || '').toLowerCase() === 'chris.roberts@myforemanhq.com';

  const remove = async () => {
    const ok1 = confirm(
      'This will permanently delete your account and all data. This cannot be undone.\n\n' +
      'If you are the sole owner of an organization, the business and all of its customers, ' +
      'jobs, invoices, and records will also be removed. Multi-user organizations are unaffected.'
    );
    if (!ok1) return;
    const typed = prompt('Type DELETE to confirm.');
    if ((typed || '').trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true); setErr('');
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { setErr(error.message); setDeleting(false); return; }
    await supabase.auth.signOut();
    router.push('/');
  };

  // Platform-owner only: clear the user_metadata flags that mark the
  // welcome tour as completed/skipped, then bounce to /dashboard so
  // TourOverlay picks them up and re-fires. Lets the platform owner
  // re-test the tour without nuking their account.
  const resetOnboarding = async () => {
    if (resetting) return;
    setResetting(true); setResetMsg(''); setErr('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          onboarding_completed_at: null,
          onboarding_skipped_at: null,
        },
      });
      if (error) throw error;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('myforeman_tour_force', '1');
      }
      setResetMsg('Onboarding reset. Redirecting...');
      setTimeout(() => router.push('/dashboard'), 600);
    } catch (e) {
      setErr(e?.message || 'Reset failed.');
      setResetting(false);
    }
  };

  return (
    <>
      {isAdmin && (
        <div style={{marginTop:18,background:'rgba(79,158,255,0.04)',border:'1px solid rgba(79,158,255,0.25)',borderRadius:12,padding:'16px 14px'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#4f9eff',marginBottom:6}}>ADMIN TOOLS</div>
          <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5,marginBottom:12}}>
            Clear the welcome-tour flag so the interactive walkthrough fires again on the next dashboard load. Used to test tour changes without deleting your account.
          </div>
          {resetMsg && <div style={{background:'rgba(46,223,135,.12)',border:'1px solid rgba(46,223,135,.3)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'#2edf87'}}>{resetMsg}</div>}
          <button onClick={resetOnboarding} disabled={resetting}
            style={{background:'transparent',border:'1.5px solid #4f9eff',borderRadius:10,color:'#4f9eff',padding:'10px 16px',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.08em',fontWeight:700,cursor:'pointer',opacity:resetting?0.5:1}}>
            {resetting ? 'RESETTING...' : 'RESET ONBOARDING'}
          </button>
        </div>
      )}

      <div style={{marginTop:18,background:'rgba(242,96,96,0.04)',border:'1px solid rgba(242,96,96,0.25)',borderRadius:12,padding:'16px 14px'}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#f26060',marginBottom:6}}>DANGER ZONE</div>
        <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.5,marginBottom:8}}>
          <strong style={{color:'#f0f4ff'}}>This will permanently delete your account and all data. This cannot be undone.</strong>
        </div>
        <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5,marginBottom:6}}>
          Deletes the sign-in for <strong style={{color:'#f0f4ff'}}>{user.email}</strong>. If you are the sole owner of an organization, that business and everything in it (customers, jobs, invoices, quotes, expenses, mileage, photos) is removed too. Multi-user organizations stay intact.
        </div>
        <div style={{fontSize:11,color:'#7a8db0',lineHeight:1.5,marginBottom:12}}>
          Data is fully removed within 24 hours per GDPR. We can't undo this.
        </div>
        {err && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'#f26060'}}>{err}</div>}
        <button onClick={remove} disabled={deleting}
          style={{background:'transparent',border:'1.5px solid #f26060',borderRadius:10,color:'#f26060',padding:'10px 16px',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.08em',fontWeight:700,cursor:'pointer',opacity:deleting?0.5:1}}>
          {deleting ? 'DELETING...' : 'DELETE MY ACCOUNT'}
        </button>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{marginBottom:14,background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px 6px'}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};

const loadingStyle = {
  minHeight:'100vh', background:'#111827', display:'flex',
  alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif',
};

function PushToggle() {
  const [perm, setPerm] = useState('default');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!isPushSupported()) { setPerm('unsupported'); return; }
    setPerm(notificationPermission());
  }, []);

  if (perm === 'unsupported') return null;

  const enable = async () => {
    setBusy(true); setHint('');
    const r = await enablePushNotifications();
    setBusy(false);
    setPerm(notificationPermission());
    if (!r.ok) setHint(r.error || 'Could not enable.');
  };
  const disable = async () => {
    setBusy(true); setHint('');
    await disablePushNotifications();
    setBusy(false);
    setHint('Notifications turned off on this device.');
  };

  const granted = perm === 'granted';
  const denied  = perm === 'denied';

  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 14px',marginBottom:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600}}>Push notifications</div>
          <div style={{fontSize:11,color:'#7a8db0',marginTop:2,lineHeight:1.4}}>
            Get pinged on this device when a lead comes in, a quote gets approved, an invoice is paid, or a job is assigned to you.
          </div>
        </div>
        {denied ? (
          <div style={{fontSize:11,color:'#fbbf24',maxWidth:240,textAlign:'right'}}>
            Blocked in your browser. Allow notifications in browser settings and reload.
          </div>
        ) : granted ? (
          <button onClick={disable} disabled={busy}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.04em',fontFamily:'inherit'}}>
            Turn Off
          </button>
        ) : (
          <button onClick={enable} disabled={busy}
            style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:700,letterSpacing:'.04em',fontFamily:'inherit'}}>
            {busy ? 'Turning on…' : 'Turn On'}
          </button>
        )}
      </div>
      {hint && <div style={{fontSize:11,color:'#fbbf24',marginTop:8}}>{hint}</div>}
    </div>
  );
}
