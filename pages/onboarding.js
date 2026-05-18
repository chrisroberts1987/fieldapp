import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';
import Logo from '../components/Logo';

export default function Onboarding() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [form, setForm] = useState({
    name:'', owner_name:'', phone:'', business_email:'',
    address:'', license_number:'', default_tax_rate:'8.25',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      setForm(p => ({ ...p, business_email: p.business_email || session.user.email || '' }));
    });
  }, []);

  useEffect(() => {
    if (orgId && user && !saving) router.push('/dashboard');
  }, [orgId, user]);

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2 MB'); return; }
    setError('');
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
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
      const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase();
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

    router.push('/dashboard');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user || orgLoading) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",padding:'20px 16px 60px'}}>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:18,gap:6}}>
        <Logo size="md" />
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase'}}>Set up your business</div>
      </div>

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
            <textarea style={{...inputStyle, minHeight:64, resize:'vertical'}}
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
              <input type="file" accept="image/*" onChange={pickLogo} style={{display:'none'}}/>
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

        {error && (
          <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
            {error}
          </div>
        )}

        <button onClick={save} disabled={saving}
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
