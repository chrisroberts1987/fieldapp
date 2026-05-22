import { useState } from 'react';
import { useRouter } from 'next/router';
import Logo from '../components/Logo';

export default function Contact() {
  const router = useRouter();
  const [form, setForm] = useState({ name:'', email:'', subject:'', message:'', website:'' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.name.trim())                          { setError('Name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('A valid email is required.'); return; }
    if (!form.subject.trim())                       { setError('Subject is required.'); return; }
    if (form.message.trim().length < 5)             { setError('Tell us a little more in the message.'); return; }

    setSending(true);
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body?.error || 'Something went wrong. Try again.'); setSending(false); return; }
      setDone(true);
      setSending(false);
    } catch (err) {
      setError(err?.message || 'Network error.');
      setSending(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:1200,margin:'0 auto',padding:'24px 20px 0',gap:12}}>
        <a onClick={() => router.push('/')} style={{cursor:'pointer'}}>
          <Logo size="sm" />
        </a>
        <button onClick={() => router.push('/')}
          style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.06em'}}>
          ← BACK
        </button>
      </nav>

      <main style={{maxWidth:560,margin:'0 auto',padding:'48px 20px 80px'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.18em',fontWeight:700,textTransform:'uppercase',marginBottom:8}}>Contact</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:52,letterSpacing:'.03em',margin:0,lineHeight:1.05}}>
            GET IN TOUCH
          </h1>
          <p style={{fontSize:15,color:'#c8d4ee',lineHeight:1.55,margin:'16px auto 0',maxWidth:440}}>
            Question, feature request, or stuck on something? Drop us a note and we'll get back to you within one business day.
          </p>
        </div>

        {done ? (
          <div style={{background:'#1e2a42',border:'1px solid #2edf8755',borderRadius:14,padding:'28px 22px',textAlign:'center'}}>
            <div style={{fontSize:34,marginBottom:6,color:'#2edf87'}}>✓</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:8}}>
              MESSAGE SENT
            </div>
            <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>
              Thanks, {form.name.split(' ')[0] || 'we got it'}. Someone from MyForeman will reply to <strong style={{color:'#f0f4ff'}}>{form.email}</strong> within one business day.
            </div>
            <button onClick={() => router.push('/')}
              style={{marginTop:18,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'12px 22px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.06em',cursor:'pointer'}}>
              BACK TO HOME
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:14,padding:'22px 20px'}}>
            <Field label="Name">
              <input type="text" autoComplete="name" value={form.name} onChange={e => update('name', e.target.value)} maxLength={120} required style={inputStyle} placeholder="Your full name"/>
            </Field>
            <Field label="Email">
              <input type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} maxLength={254} required style={inputStyle} placeholder="you@example.com"/>
            </Field>
            <Field label="Subject">
              <input type="text" value={form.subject} onChange={e => update('subject', e.target.value)} maxLength={200} required style={inputStyle} placeholder="What's this about?"/>
            </Field>
            <Field label="Message">
              <textarea value={form.message} onChange={e => update('message', e.target.value)} maxLength={4000} required rows={6}
                style={{...inputStyle, minHeight:140, resize:'vertical', fontFamily:'inherit'}}
                placeholder="Tell us what's going on."/>
            </Field>

            {/* Honeypot — real users never see or fill this */}
            <div style={{position:'absolute',left:'-9999px',top:'auto',width:1,height:1,overflow:'hidden'}} aria-hidden="true">
              <label>Don't fill this out
                <input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={e => update('website', e.target.value)}/>
              </label>
            </div>

            {error && (
              <div style={{background:'rgba(242,96,96,.10)',border:'1px solid rgba(242,96,96,.35)',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:13,color:'#f26060'}}>
                {error}
              </div>
            )}

            <button type="submit" disabled={sending}
              style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'14px 18px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',cursor:sending?'wait':'pointer',opacity:sending?0.6:1}}>
              {sending ? 'SENDING…' : 'SEND MESSAGE'}
            </button>

            <div style={{fontSize:11,color:'#7a8db0',marginTop:14,textAlign:'center',lineHeight:1.5}}>
              Or email us directly:{' '}
              <a href="mailto:support@myforemanhq.com" style={{color:'#4f9eff',textDecoration:'none'}}>support@myforemanhq.com</a>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:6}}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#111827',
  border: '1.5px solid #2e3f60',
  borderRadius: 10,
  color: '#f0f4ff',
  fontSize: 14,
  padding: '11px 12px',
  outline: 'none',
  fontFamily: 'inherit',
};
