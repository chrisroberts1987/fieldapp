import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function PublicQuote() {
  const router = useRouter();
  const { slug } = router.query;

  const [biz, setBiz] = useState(null);    // { id, name, logo_url } or null
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', address:'', notes:'' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!router.isReady || !slug) return;
    (async () => {
      const { data } = await supabase.rpc('get_public_org_by_slug', { p_slug: slug });
      setBiz(data || null);
      setLoaded(true);
    })();
  }, [router.isReady, slug]);

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Your name is required'); return; }
    if (!form.phone.trim()) { setError('A phone number is required so we can get back to you'); return; }
    setSubmitting(true);
    const { error: rpcErr } = await supabase.rpc('create_lead_from_quote', {
      p_slug:    slug,
      p_name:    form.name,
      p_phone:   form.phone,
      p_email:   form.email || null,
      p_address: form.address || null,
      p_notes:   form.notes || null,
    });
    if (rpcErr) { setError(rpcErr.message); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (!loaded) {
    return <div style={loadingStyle}>Loading...</div>;
  }
  if (!biz) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{textAlign:'center',maxWidth:360}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:8}}>NOT FOUND</div>
          <div style={{fontSize:14,color:'#7a8db0'}}>This quote link doesn't exist or has been changed. Check with the business and try again.</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{maxWidth:420,textAlign:'center'}}>
          <BizHeader biz={biz}/>
          <div style={{width:60,height:60,margin:'24px auto 14px',borderRadius:30,background:'#2edf8722',border:'2px solid #2edf87',display:'flex',alignItems:'center',justifyContent:'center',color:'#2edf87',fontSize:28,fontWeight:700}}>✓</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'.06em',marginBottom:10}}>REQUEST SENT</div>
          <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>
            Thanks, {form.name.split(' ')[0]}. {biz.name} got your message and will be in touch soon.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",padding:'24px 16px 60px'}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>
        <BizHeader biz={biz}/>

        <div style={{marginTop:18,marginBottom:18,textAlign:'center'}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'.06em'}}>REQUEST A QUOTE</div>
          <div style={{fontSize:13,color:'#7a8db0',marginTop:4}}>Tell us what you need. We'll reach out shortly.</div>
        </div>

        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'16px 14px'}}>
          <Field label="Your Name *">
            <input style={inputStyle} type="text" autoComplete="name" placeholder="First and last"
              value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))}/>
          </Field>
          <Field label="Phone *">
            <input style={inputStyle} type="tel" autoComplete="tel" placeholder="512-555-0100"
              value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))}/>
          </Field>
          <Field label="Email">
            <input style={inputStyle} type="email" autoComplete="email" placeholder="email@example.com"
              value={form.email} onChange={e => setForm(p => ({...p, email:e.target.value}))}/>
          </Field>
          <Field label="Service Address">
            <input style={inputStyle} type="text" autoComplete="street-address" placeholder="Where the work is needed"
              value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))}/>
          </Field>
          <Field label="What do you need?">
            <textarea style={{...inputStyle, minHeight:90, resize:'vertical', fontFamily:'inherit'}}
              placeholder="Describe the work and any details (timing, size of job, photos available, etc.)"
              value={form.notes} onChange={e => setForm(p => ({...p, notes:e.target.value}))}/>
          </Field>

          {error && (
            <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060',textAlign:'center'}}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={submitting}
            style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',opacity:submitting?0.5:1}}>
            {submitting ? 'Sending...' : 'REQUEST QUOTE'}
          </button>
          <div style={{marginTop:10,fontSize:11,color:'#7a8db0',textAlign:'center'}}>
            Your info goes directly to {biz.name}.
          </div>
        </div>

        <div style={{marginTop:32,fontSize:11,color:'#7a8db0',textAlign:'center'}}>
          Powered by MyForeman
        </div>
      </div>
    </div>
  );
}

function BizHeader({ biz }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'4px 0'}}>
      {biz.logo_url && (
        <img src={biz.logo_url} alt="" style={{width:60,height:60,borderRadius:10,objectFit:'contain',background:'#0d1726',border:'1px solid #2e3f60'}}/>
      )}
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'.04em',lineHeight:1.05,color:'#f0f4ff'}}>{biz.name}</div>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',fontWeight:600,textTransform:'uppercase',marginTop:2}}>Request a quote</div>
      </div>
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
