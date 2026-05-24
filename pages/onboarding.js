import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import Logo from '../components/Logo';
import { validateUpload, ACCEPT_ATTR } from '../lib/uploads';

// Two-step onboarding:
//   Step 1: business profile (name, contact, logo, basics)
//   Step 2: how to get paid (Stripe Connect vs manual methods)
//
// We intentionally call attention to the difference between Stripe
// (fully automated — invoice auto-marks paid + feedback request fires
// on its own) and the manual methods (Venmo, Zelle, Cash App, etc —
// contractor still has to tap "Mark Paid" after the funds land).
// Surfacing this up-front saves the contractor from discovering it
// later when their workflow doesn't behave as expected.

export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [step, setStep] = useState(1);                  // 1 = profile, 2 = payments
  const [createdOrgId, setCreatedOrgId] = useState(null); // set after step 1
  const [form, setForm] = useState({
    name:'', owner_name:'', phone:'', business_email:'',
    address:'', license_number:'', default_tax_rate:'8.25',
    // Payment methods (step 2)
    venmo_handle:'', zelle_contact:'', cashapp_handle:'',
    paypal_handle:'', check_payable_to:'', check_mail_to:'',
    payment_notes:'',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      setForm(p => ({ ...p, business_email: p.business_email || session.user.email || '' }));
    });
  }, []);

  // If the user already has an org and isn't actively saving, route them
  // to the dashboard. Skip this redirect during step 2 — we created the
  // org server-side at the end of step 1, but the user isn't done yet.
  useEffect(() => {
    if (orgId && user && !saving && step === 1) router.push('/dashboard');
  }, [orgId, user, step]);

  // Pending invite token from /invite/[token] → /signup flow
  useEffect(() => {
    if (!user || orgId || saving) return;
    const token = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('myforeman_post_signup_invite') : null;
    if (!token) return;
    (async () => {
      const { error } = await supabase.rpc('accept_invite', { p_token: token });
      sessionStorage.removeItem('myforeman_post_signup_invite');
      if (!error) router.push('/dashboard');
    })();
  }, [user, orgId]);

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUpload(file, { images: true });
    if (err) { setError(err); return; }
    setError('');
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Step 1 → 2: create the org, upload logo, save profile, advance.
  const submitProfile = async () => {
    setError('');
    if (!form.name.trim())          { setError('Business name required'); return; }
    if (!form.owner_name.trim())    { setError('Owner name required'); return; }
    if (!form.phone.trim())         { setError('Phone required'); return; }
    if (!form.business_email.trim()){ setError('Business email required'); return; }
    if (!form.address.trim())       { setError('Business address required'); return; }
    const tax = Number(form.default_tax_rate);
    if (isNaN(tax) || tax < 0 || tax > 100) { setError('Default tax rate must be a number 0–100'); return; }

    setSaving(true);

    const { data: newOrgId, error: rpcErr } = await supabase.rpc('create_org', { p_name: form.name });
    if (rpcErr) { setError(rpcErr.message); setSaving(false); return; }

    let logo_url = null;
    if (logoFile) {
      const extByMime = { 'image/jpeg':'jpg', 'image/png':'png', 'image/heic':'heic', 'image/heif':'heif' };
      const ext = extByMime[logoFile.type] || 'png';
      const path = `${newOrgId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('org-logos')
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
      if (upErr) { setError('Logo upload failed: ' + upErr.message); setSaving(false); return; }
      const { data: pub } = supabase.storage.from('org-logos').getPublicUrl(path);
      logo_url = pub?.publicUrl || null;
    }

    const { error: updErr } = await supabase
      .from('organizations')
      .update({
        owner_name:       form.owner_name.trim(),
        phone:            form.phone.trim(),
        business_email:   form.business_email.trim(),
        address:          form.address.trim(),
        license_number:   form.license_number.trim() || null,
        default_tax_rate: tax,
        logo_url,
      })
      .eq('id', newOrgId);
    if (updErr) { setError('Saved company but profile update failed: ' + updErr.message); setSaving(false); return; }

    setCreatedOrgId(newOrgId);
    setSaving(false);
    setStep(2);
    window.scrollTo(0, 0);
  };

  // Step 2: save manual payment methods. Called by both "Save & Finish"
  // and "Connect Stripe" — the latter then redirects to Stripe.
  const saveManualMethods = async () => {
    if (!createdOrgId) return { ok: false, error: 'No org yet.' };
    const { error: updErr } = await supabase
      .from('organizations')
      .update({
        venmo_handle:     form.venmo_handle.trim()    || null,
        zelle_contact:    form.zelle_contact.trim()   || null,
        cashapp_handle:   form.cashapp_handle.trim()  || null,
        paypal_handle:    form.paypal_handle.trim()   || null,
        check_payable_to: form.check_payable_to.trim()|| null,
        check_mail_to:    form.check_mail_to.trim()   || null,
        payment_notes:    form.payment_notes.trim()   || null,
      })
      .eq('id', createdOrgId);
    return updErr ? { ok: false, error: updErr.message } : { ok: true };
  };

  const finishOnboarding = async () => {
    setError('');
    setSaving(true);
    const r = await saveManualMethods();
    setSaving(false);
    if (!r.ok) { setError(r.error || 'Save failed.'); return; }
    router.push('/dashboard');
  };

  const skipOnboarding = () => {
    router.push('/dashboard');
  };

  // Connect Stripe: save manual methods, then bounce to Stripe-hosted
  // onboarding. After Stripe, they return to /dashboard (not /settings).
  const connectStripe = async () => {
    setError('');
    setConnecting(true);
    try {
      const r = await saveManualMethods();
      if (!r.ok) { setError(r.error); setConnecting(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const resp = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ return_to: 'dashboard' }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.url) {
        setError(body?.error || 'Could not open Stripe.');
        setConnecting(false);
        return;
      }
      window.location.href = body.url;
    } catch (e) {
      setError(e?.message || 'Network error.');
      setConnecting(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user || (orgLoading && step === 1)) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",padding:'20px 16px 60px'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:14,gap:6}}>
        <Logo size="md" />
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase'}}>
          {step === 1 ? 'Set up your business' : 'How do you want to get paid?'}
        </div>
        <StepDots step={step}/>
      </div>

      {step === 1 && (
        <div style={{maxWidth:480,margin:'0 auto',background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:16,padding:'18px 16px'}}>
          <Section title="Business">
            <Field label="Business Name *">
              <input style={inputStyle} type="text" placeholder="Smith Lawn Care LLC"
                value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))}/>
            </Field>
            <Field label="Owner Name *">
              <input style={inputStyle} type="text" placeholder="John Smith"
                value={form.owner_name} onChange={e => setForm(p => ({...p, owner_name:e.target.value}))}/>
            </Field>
          </Section>

          <Section title="Contact">
            <Field label="Phone *">
              <input style={inputStyle} type="tel" placeholder="512-555-0100"
                value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))}/>
            </Field>
            <Field label="Business Email *">
              <input style={inputStyle} type="email" placeholder="billing@yourbiz.com"
                value={form.business_email} onChange={e => setForm(p => ({...p, business_email:e.target.value}))}/>
            </Field>
            <Field label="Business Address *">
              <textarea maxLength={2000} style={{...inputStyle, minHeight:64, resize:'vertical'}}
                placeholder="123 Main St&#10;Austin, TX 78701"
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
                  {logoFile ? 'Change logo' : 'Upload logo (optional)'}
                </div>
              </label>
            </div>
            <div style={{fontSize:11,color:'#7a8db0'}}>PNG or JPG, under 2 MB. Square works best.</div>
          </Section>

          <Section title="Details">
            <Field label="License Number (optional)">
              <input style={inputStyle} type="text" placeholder="TX-12345"
                value={form.license_number} onChange={e => setForm(p => ({...p, license_number:e.target.value}))}/>
            </Field>
            <Field label="Default Tax Rate (%)">
              <input style={inputStyle} type="number" inputMode="decimal" step="0.01" min="0" max="100"
                value={form.default_tax_rate} onChange={e => setForm(p => ({...p, default_tax_rate:e.target.value}))}/>
            </Field>
          </Section>

          {error && <ErrorBox text={error}/>}

          <button onClick={submitProfile} disabled={saving}
            style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',marginBottom:10,opacity:saving?0.5:1}}>
            {saving ? 'Setting up...' : 'CONTINUE'}
          </button>
          <button onClick={signOut}
            style={{width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'8px 0',fontSize:12,cursor:'pointer'}}>
            Sign out
          </button>
          <div style={{marginTop:12,fontSize:11,color:'#7a8db0',textAlign:'center'}}>
            Signed in as {user.email}
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{maxWidth:520,margin:'0 auto'}}>

          {/* Stripe card — primary, recommended */}
          <div style={{background:'linear-gradient(135deg, #1f2a47 0%, #1a2236 100%)',border:'1.5px solid #4f9eff66',borderRadius:16,padding:'18px 18px 16px',marginBottom:12,position:'relative'}}>
            <div style={{position:'absolute',top:12,right:12,background:'#4f9eff22',color:'#4f9eff',border:'1px solid #4f9eff66',borderRadius:999,padding:'2px 9px',fontSize:9,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>Recommended</div>

            <div style={{fontSize:11,color:'#4f9eff',letterSpacing:'.14em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Fully Automated</div>
            <h3 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.04em',margin:'0 0 8px',color:'#f0f4ff'}}>
              Connect Stripe
            </h3>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55,marginBottom:14}}>
              Customers pay invoices by credit card. The moment Stripe confirms the payment, MyForeman automatically marks the invoice paid and sends the customer a feedback request. You don't have to touch anything.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14,fontSize:12,color:'#c8d4ee'}}>
              <Check>Funds go to <strong>your</strong> Stripe account — we take zero.</Check>
              <Check>Auto-marks paid · auto-sends feedback request.</Check>
              <Check>Stripe handles refunds, disputes, payouts (2 biz days).</Check>
            </div>

            <button onClick={connectStripe} disabled={connecting || saving}
              style={{width:'100%',background:'#635bff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontWeight:700,fontSize:14,letterSpacing:'.04em',cursor:(connecting||saving)?'progress':'pointer',opacity:(connecting||saving)?0.7:1}}>
              {connecting ? 'OPENING STRIPE...' : 'CONNECT STRIPE'}
            </button>
            <div style={{fontSize:11,color:'#7a8db0',textAlign:'center',marginTop:8}}>
              Takes ~3 minutes. You'll need your business info and a bank account.
            </div>
          </div>

          <div style={{textAlign:'center',color:'#7a8db0',fontSize:11,letterSpacing:'.14em',fontWeight:600,textTransform:'uppercase',margin:'14px 0 12px'}}>
            — and / or —
          </div>

          {/* Manual methods card */}
          <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:16,padding:'18px 18px 16px',marginBottom:12}}>
            <div style={{fontSize:11,color:'#fbbf24',letterSpacing:'.14em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Manual Confirmation</div>
            <h3 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.04em',margin:'0 0 8px',color:'#f0f4ff'}}>
              Other ways to pay
            </h3>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55,marginBottom:12}}>
              Venmo, Zelle, Cash App, PayPal, check. These show on your customer's invoice page with tap-to-open links (where supported).
            </div>
            <div style={{background:'#fbbf2412',border:'1px solid #fbbf2433',borderRadius:8,padding:'10px 12px',marginBottom:14,fontSize:12,color:'#fbbf24',lineHeight:1.5}}>
              <strong>You'll need to mark the invoice paid yourself</strong> once the funds land. After you tap Mark Paid, the feedback request still fires automatically.
            </div>

            <Field label="Venmo handle">
              <input style={inputStyle} type="text" placeholder="@your-handle"
                value={form.venmo_handle} onChange={e => setForm(p => ({...p, venmo_handle:e.target.value}))}/>
            </Field>
            <Field label="Zelle (email or phone)">
              <input style={inputStyle} type="text" placeholder="you@business.com or 555-555-5555"
                value={form.zelle_contact} onChange={e => setForm(p => ({...p, zelle_contact:e.target.value}))}/>
            </Field>
            <Field label="Cash App $cashtag">
              <input style={inputStyle} type="text" placeholder="$YourCashtag"
                value={form.cashapp_handle} onChange={e => setForm(p => ({...p, cashapp_handle:e.target.value}))}/>
            </Field>
            <Field label="PayPal (handle or email)">
              <input style={inputStyle} type="text" placeholder="@your-handle or you@business.com"
                value={form.paypal_handle} onChange={e => setForm(p => ({...p, paypal_handle:e.target.value}))}/>
            </Field>
            <Field label="Check made payable to">
              <input style={inputStyle} type="text" placeholder="Your Business Name"
                value={form.check_payable_to} onChange={e => setForm(p => ({...p, check_payable_to:e.target.value}))}/>
            </Field>
            <Field label="Mail check to">
              <textarea maxLength={500} style={{...inputStyle, minHeight:60, resize:'vertical'}}
                placeholder="Street&#10;City, ST  ZIP"
                value={form.check_mail_to} onChange={e => setForm(p => ({...p, check_mail_to:e.target.value}))}/>
            </Field>
            <Field label="Other notes (optional)">
              <textarea maxLength={500} style={{...inputStyle, minHeight:50, resize:'vertical'}}
                placeholder="ACH instructions, Wise handle, anything else"
                value={form.payment_notes} onChange={e => setForm(p => ({...p, payment_notes:e.target.value}))}/>
            </Field>
          </div>

          {error && <ErrorBox text={error}/>}

          <button onClick={finishOnboarding} disabled={saving || connecting}
            style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:(saving||connecting)?'progress':'pointer',marginBottom:10,opacity:(saving||connecting)?0.5:1}}>
            {saving ? 'Saving...' : 'SAVE & FINISH'}
          </button>
          <button onClick={skipOnboarding}
            style={{width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 0',fontSize:12,cursor:'pointer'}}>
            Skip for now — set up payments later in Settings
          </button>
        </div>
      )}
    </div>
  );
}

function StepDots({ step }) {
  return (
    <div style={{display:'flex',gap:6,marginTop:2}}>
      {[1,2].map(n => (
        <div key={n} style={{
          width: n === step ? 18 : 6,
          height: 6, borderRadius: 6,
          background: n <= step ? '#4f9eff' : '#2e3f60',
          transition: 'width .2s',
        }}/>
      ))}
    </div>
  );
}

function Check({ children }) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:8,lineHeight:1.45}}>
      <span style={{color:'#2edf87',fontWeight:700,flexShrink:0}}>✓</span>
      <span>{children}</span>
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
      {text}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',marginBottom:8,paddingBottom:6,borderBottom:'1px solid #2e3f60'}}>{title}</div>
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
