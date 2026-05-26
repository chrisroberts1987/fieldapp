// Public self-booking page. URL: /book/<org-slug>. No auth.
// Customer picks a service (from the org's catalog), preferred
// date + time, leaves contact info, and it lands as a self_booking
// lead in the contractor's leads queue with a notification.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

export default function BookingPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({
    name:'', phone:'', email:'', address:'',
    service_id:'', requested_date:'', requested_time:'',
    notes:'',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: d } = await supabase.rpc('get_booking_page', { p_org_slug: slug });
      setData(d || null);
      setLoaded(true);
    })();
  }, [slug]);

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Please tell us your name.'); return; }
    if (!form.phone.trim() && !form.email.trim()) {
      setError('A phone OR email so we can reach you.'); return;
    }
    setSubmitting(true);
    const svc = (data?.services || []).find(s => s.id === form.service_id);
    const { data: resp, error: rpcErr } = await supabase.rpc('submit_self_booking', {
      p_org_slug:      slug,
      p_name:          form.name,
      p_phone:         form.phone || null,
      p_email:         form.email || null,
      p_address:       form.address || null,
      p_service_name:  svc ? svc.name : null,
      p_requested_date: form.requested_date || null,
      p_requested_time: form.requested_time || null,
      p_notes:         form.notes || null,
    });
    setSubmitting(false);
    if (rpcErr || !resp?.ok) { setError(rpcErr?.message || 'Could not submit. Try again.'); return; }
    setDone(true);
  };

  if (!loaded) return <div style={loadingStyle}>Loading...</div>;
  if (!data) return (
    <div style={pageBg}>
      <div style={{textAlign:'center',padding:'80px 20px',color:'#7a8db0'}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',marginBottom:8,color:'#f0f4ff'}}>NOT FOUND</div>
        <div style={{fontSize:14}}>This booking page is invalid or no longer exists.</div>
      </div>
    </div>
  );

  const { org, services } = data;

  if (done) {
    return (
      <div style={pageBg}>
        <div style={{maxWidth:480,margin:'0 auto',padding:'40px 20px',textAlign:'center'}}>
          <BizHeader org={org}/>
          <div style={{width:60,height:60,margin:'30px auto 14px',borderRadius:30,background:'#2edf8722',border:'2px solid #2edf87',display:'flex',alignItems:'center',justifyContent:'center',color:'#2edf87',fontSize:28,fontWeight:700}}>✓</div>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.06em',color:'#f0f4ff'}}>WE'LL BE IN TOUCH</div>
          <div style={{fontSize:14,color:'#c8d4ee',marginTop:10,lineHeight:1.55}}>
            Thanks, {form.name.split(' ')[0]}. {org.name} got your request and will reach out{form.phone ? ' by phone or text' : ''}{form.email ? (form.phone ? ' or email' : ' by email') : ''} to confirm.
          </div>
          {form.requested_date && (
            <div style={{marginTop:18,padding:'12px 14px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,fontSize:13,color:'#c8d4ee'}}>
              You requested <strong>{form.requested_date}</strong>{form.requested_time ? ` at ${form.requested_time}` : ''}. They'll confirm or suggest an alternate.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <div style={{maxWidth:520,margin:'0 auto',padding:'24px 16px 40px'}}>
        <BizHeader org={org}/>

        <div style={{marginTop:18,marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',color:'#f0f4ff'}}>BOOK A SERVICE</div>
          <div style={{fontSize:13,color:'#c8d4ee',marginTop:4,lineHeight:1.5}}>
            Fill this out and {org.name} will reach out to confirm. Usually within a day.
          </div>
        </div>

        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'16px'}}>
          <Field label="Your name *">
            <input style={input} type="text" placeholder="Full name" maxLength={120}
              value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))}/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <Field label="Phone">
              <input style={input} type="tel" placeholder="555-555-0100" maxLength={40}
                value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))}/>
            </Field>
            <Field label="Email">
              <input style={input} type="email" placeholder="you@example.com" maxLength={120}
                value={form.email} onChange={e => setForm(p => ({...p, email:e.target.value}))}/>
            </Field>
          </div>
          <Field label="Service address">
            <input style={input} type="text" placeholder="Street, City, State ZIP" maxLength={240}
              value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))}/>
          </Field>

          {services.length > 0 && (
            <Field label="What do you need?">
              <select style={input} value={form.service_id}
                onChange={e => setForm(p => ({...p, service_id:e.target.value}))}>
                <option value="">— pick one —</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.unit_price ? ` (from $${Number(s.unit_price).toFixed(0)}/${s.unit})` : ''}</option>
                ))}
                <option value="other">Something else (describe below)</option>
              </select>
            </Field>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <Field label="Preferred date">
              <input style={input} type="date" min={new Date().toISOString().slice(0,10)}
                value={form.requested_date} onChange={e => setForm(p => ({...p, requested_date:e.target.value}))}/>
            </Field>
            <Field label="Preferred time">
              <input style={input} type="time"
                value={form.requested_time} onChange={e => setForm(p => ({...p, requested_time:e.target.value}))}/>
            </Field>
          </div>

          <Field label="Anything to add? (optional)">
            <textarea maxLength={2000} value={form.notes}
              onChange={e => setForm(p => ({...p, notes:e.target.value}))}
              placeholder="Access, gate codes, dogs, what's going wrong..."
              style={{...input, resize:'vertical', minHeight:80, fontFamily:'inherit'}}/>
          </Field>

          {error && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'#f26060'}}>{error}</div>}

          <button onClick={submit} disabled={submitting}
            style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'14px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',opacity:submitting?0.6:1}}>
            {submitting ? 'Sending…' : 'REQUEST APPOINTMENT'}
          </button>

          <div style={{fontSize:11,color:'#7a8db0',marginTop:10,textAlign:'center'}}>
            We'll confirm by phone, text, or email before anyone shows up.
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:20,fontSize:11,color:'#7a8db0'}}>
          Powered by <a href="https://myforemanhq.com" style={{color:'#4f9eff'}}>MyForeman</a>
        </div>
      </div>
    </div>
  );
}

function BizHeader({ org }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'4px 0'}}>
      {org.logo_url && <img src={org.logo_url} alt="" style={{width:54,height:54,objectFit:'contain',borderRadius:10,background:'#0d1726',border:'1px solid #2e3f60'}}/>}
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',lineHeight:1.05,color:'#f0f4ff'}}>{org.name}</div>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase',marginTop:2}}>Online booking</div>
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

const pageBg = { minHeight:'100vh', background:'#111827', color:'#f0f4ff', fontFamily:"'Inter',system-ui,sans-serif" };
const input  = { width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10, color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit' };
const loadingStyle = { minHeight:'100vh', background:'#111827', display:'flex', alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif' };
