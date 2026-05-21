import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import TopNav from '../components/TopNav';
import { validateUpload, ACCEPT_ATTR } from '../lib/uploads';
import { launchOnboarding } from '../components/OnboardingTour';

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
            Share this link with anyone — on your website, in texts, on social, in your voicemail. They'll fill out a quick form and land in your Leads pipeline.
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

        <button onClick={() => launchOnboarding(router)}
          style={{width:'100%',background:'transparent',color:'#c8d4ee',border:'1px solid #2e3f60',borderRadius:10,padding:'11px 0',fontSize:13,fontWeight:600,letterSpacing:'.04em',cursor:'pointer',marginBottom:24}}>
          Replay welcome tour
        </button>

        <DangerZone user={user} router={router}/>
      </div>
    </div>
  );
}

function DangerZone({ user, router }) {
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');

  const remove = async () => {
    const ok1 = confirm('Delete your account? This permanently removes your sign-in. Customer/job/invoice history you created stays with the business, but you will lose access immediately.');
    if (!ok1) return;
    const typed = prompt('Type DELETE to confirm.');
    if ((typed || '').trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true); setErr('');
    const { error } = await supabase.rpc('delete_my_account');
    if (error) { setErr(error.message); setDeleting(false); return; }
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <div style={{marginTop:18,background:'rgba(242,96,96,0.04)',border:'1px solid rgba(242,96,96,0.25)',borderRadius:12,padding:'16px 14px'}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.1em',color:'#f26060',marginBottom:6}}>DANGER ZONE</div>
      <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5,marginBottom:12}}>
        Deletes your sign-in for <strong style={{color:'#f0f4ff'}}>{user.email}</strong>. Customers, jobs, invoices, and other business records you created stay with the business — their "created by" reference just goes blank. This action is permanent and cannot be undone.
      </div>
      {err && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'#f26060'}}>{err}</div>}
      <button onClick={remove} disabled={deleting}
        style={{background:'transparent',border:'1.5px solid #f26060',borderRadius:10,color:'#f26060',padding:'10px 16px',fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:'.08em',fontWeight:700,cursor:'pointer',opacity:deleting?0.5:1}}>
        {deleting ? 'DELETING...' : 'DELETE MY ACCOUNT'}
      </button>
    </div>
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
