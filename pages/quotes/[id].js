import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { sendEmail } from '../../lib/email/client';

export default function QuoteDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [quote, setQuote] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: q }, { data: c }] = await Promise.all([
      supabase.from('quotes').select('*').eq('id', id).eq('org_id', orgId).maybeSingle(),
      supabase.from('customers').select('id,name,email,phone').eq('org_id', orgId).order('name'),
    ]);
    setQuote(q || null);
    setCustomers(c || []);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (!router.isReady || !id || !orgId) return;
    load();
  }, [router.isReady, id, orgId]);

  useRefetchOnFocus(load, !!(id && orgId));

  const update = (key, value) => setQuote(q => ({ ...q, [key]: value }));

  const pickCustomer = (cid) => {
    const c = customers.find(x => x.id === cid);
    setQuote(q => ({
      ...q,
      customer_id: cid || null,
      customer_name: c?.name || q.customer_name,
      customer_email: c?.email || q.customer_email,
      customer_phone: c?.phone || q.customer_phone,
    }));
  };

  const save = async () => {
    setError('');
    if (!quote.title?.trim() || !quote.customer_name?.trim()) {
      setError('Title and customer name are required.');
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.from('quotes').update({
      title: quote.title.trim(),
      description: quote.description,
      amount: Number(quote.amount) || 0,
      customer_id: quote.customer_id || null,
      customer_name: quote.customer_name.trim(),
      customer_email: quote.customer_email || null,
      customer_phone: quote.customer_phone || null,
      valid_until: quote.valid_until || null,
      notes: quote.notes || null,
    }).eq('id', id);
    if (e) setError(e.message);
    setSaving(false);
  };

  const markSent = async () => {
    await save();
    await supabase.from('quotes').update({ status:'sent', sent_at: new Date().toISOString() }).eq('id', id);

    if (quote?.customer_email) {
      const approvalUrlNow = `${window.location.origin}/q/${quote.approval_token}`;
      const r = await sendEmail({
        type: 'quote_sent',
        to: quote.customer_email,
        data: {
          customerName: quote.customer_name,
          quoteTitle:   quote.title,
          amount:       quote.amount,
          approvalUrl:  approvalUrlNow,
          validUntil:   quote.valid_until ? fmtDate(quote.valid_until) : null,
        },
      });
      if (!r.ok) alert('Quote marked sent, but the email didn\'t go out: ' + r.error);
    }
    await load();
  };

  const approvalUrl = (typeof window !== 'undefined' && quote?.approval_token)
    ? `${window.location.origin}/q/${quote.approval_token}` : '';

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(approvalUrl); setCopied(true); setTimeout(()=>setCopied(false),1800); } catch {}
  };

  const smsHref  = quote ? `sms:${quote.customer_phone || ''}?body=${encodeURIComponent(`Hi ${quote.customer_name?.split(' ')[0]||''}, here's your quote: ${approvalUrl}`)}` : '';
  const mailHref = quote ? `mailto:${quote.customer_email || ''}?subject=${encodeURIComponent('Your quote from us')}&body=${encodeURIComponent(`Hi ${quote.customer_name||''},\n\nHere's the quote we discussed: ${approvalUrl}\n\nTap the link to review and approve.\n\nThanks.`)}` : '';

  if (!user || orgLoading || !quote) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/quotes"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
      </div>
    );
  }

  const isDraft = quote.status === 'draft';
  const isSent  = quote.status === 'sent';
  const isClosed = ['approved','declined','expired'].includes(quote.status);

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/quotes"/>

      <main style={{maxWidth:760,margin:'0 auto',padding:'24px 20px 0'}}>
        <div style={{marginBottom:18,display:'flex',alignItems:'center',gap:10}}>
          <button onClick={() => router.push('/quotes')} style={{background:'none',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:20,padding:'0 4px'}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Quote</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.04em',color:'#f0f4ff'}}>
              {(quote.title || 'UNTITLED').toUpperCase()}
            </div>
          </div>
          <StatusPill status={quote.status}/>
        </div>

        {isClosed && (
          <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 14px',marginBottom:14,fontSize:13,color:'#c8d4ee'}}>
            {quote.status === 'approved' && <>Customer approved this quote{quote.approved_at && <> on {fmtDate(quote.approved_at.slice(0,10))}</>}.{quote.converted_job_id && <> Job <a onClick={() => router.push('/jobs')} style={{color:'#4f9eff',cursor:'pointer'}}>created</a>.</>}</>}
            {quote.status === 'declined' && <>Customer declined this quote{quote.declined_at && <> on {fmtDate(quote.declined_at.slice(0,10))}</>}.</>}
            {quote.status === 'expired' && <>This quote has expired.</>}
          </div>
        )}

        <Section title="Customer">
          <div style={{margin:'8px 0'}}>
            <div style={fieldLabel}>Select Customer</div>
            <select value={quote.customer_id || ''} onChange={e => pickCustomer(e.target.value)} style={inputStyle} disabled={isClosed}>
              <option value="">— none —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>
              <div style={fieldLabel}>Name *</div>
              <input type="text" value={quote.customer_name || ''} onChange={e => update('customer_name', e.target.value)} style={inputStyle} disabled={isClosed}/>
            </div>
            <div>
              <div style={fieldLabel}>Phone</div>
              <input type="tel" value={quote.customer_phone || ''} onChange={e => update('customer_phone', e.target.value)} style={inputStyle} disabled={isClosed}/>
            </div>
          </div>
          <div style={{marginTop:8}}>
            <div style={fieldLabel}>Email</div>
            <input type="email" value={quote.customer_email || ''} onChange={e => update('customer_email', e.target.value)} style={inputStyle} disabled={isClosed}/>
          </div>
        </Section>

        <Section title="Quote">
          <div>
            <div style={fieldLabel}>Title *</div>
            <input type="text" value={quote.title || ''} onChange={e => update('title', e.target.value)} style={inputStyle} disabled={isClosed} placeholder="e.g. Full landscape spring cleanup"/>
          </div>
          <div style={{marginTop:8}}>
            <div style={fieldLabel}>Description / Scope</div>
            <textarea maxLength={2000} value={quote.description || ''} onChange={e => update('description', e.target.value)} style={{...inputStyle, minHeight:90, resize:'vertical', fontFamily:'inherit'}} disabled={isClosed} placeholder="What's included, dates, special considerations..."/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
            <div>
              <div style={fieldLabel}>Amount ($) *</div>
              <input type="number" inputMode="decimal" value={quote.amount ?? ''} onChange={e => update('amount', e.target.value)} style={inputStyle} disabled={isClosed}/>
            </div>
            <div>
              <div style={fieldLabel}>Valid Until</div>
              <input type="date" value={quote.valid_until || ''} onChange={e => update('valid_until', e.target.value)} style={inputStyle} disabled={isClosed}/>
            </div>
          </div>
          <div style={{marginTop:8}}>
            <div style={fieldLabel}>Internal Notes (not shown to customer)</div>
            <textarea maxLength={2000} value={quote.notes || ''} onChange={e => update('notes', e.target.value)} style={{...inputStyle, minHeight:50, resize:'vertical', fontFamily:'inherit'}} disabled={isClosed}/>
          </div>
        </Section>

        {!isClosed && (
          <Section title="Send & share">
            <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5,marginBottom:10}}>
              When you mark this quote sent, the link below becomes live and the customer can approve from any device. You can also tap the SMS / Email shortcuts to open your phone's messaging app pre-filled with the approval link.
            </div>
            <div style={{display:'flex',gap:6,marginBottom:8,alignItems:'stretch'}}>
              <input readOnly value={approvalUrl} style={{...inputStyle, flex:1, fontFamily:'monospace', fontSize:12}}/>
              <button onClick={copyLink} disabled={!approvalUrl}
                style={{background:copied?'#2edf8722':'#4f9eff',border:copied?'1px solid #2edf87':'none',borderRadius:10,color:copied?'#2edf87':'#fff',padding:'0 14px',fontSize:12,fontWeight:700,letterSpacing:'.06em',cursor:'pointer',whiteSpace:'nowrap'}}>
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>
            <div style={{display:'flex',gap:6,marginBottom:6}}>
              <a href={smsHref}  style={{...btnGhost, flex:1, textAlign:'center', textDecoration:'none', opacity: quote.customer_phone ? 1 : 0.4, pointerEvents: quote.customer_phone ? 'auto' : 'none'}}>TEXT THE LINK</a>
              <a href={mailHref} style={{...btnGhost, flex:1, textAlign:'center', textDecoration:'none', opacity: quote.customer_email ? 1 : 0.4, pointerEvents: quote.customer_email ? 'auto' : 'none'}}>EMAIL THE LINK</a>
            </div>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:6}}>Automated email + SMS sending coming when you wire up Resend + Twilio. For now use your phone's apps.</div>
          </Section>
        )}

        {error && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12,color:'#f26060'}}>{error}</div>}

        {!isClosed && (
          <div style={{display:'flex',gap:8,marginTop:8,marginBottom:24}}>
            <button onClick={save} disabled={saving} style={{...btnPrimary, flex:1, opacity:saving?0.5:1}}>{saving?'SAVING...':'SAVE'}</button>
            <button onClick={markSent} disabled={saving || isSent || !quote.title || !quote.customer_name} style={{...btnAccent, flex:1, opacity:(saving||isSent)?0.5:1}}>
              {isSent ? '✓ MARKED SENT' : 'MARK AS SENT'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = {
    draft:    { color:'#7a8db0', label:'DRAFT' },
    sent:     { color:'#4f9eff', label:'SENT' },
    approved: { color:'#2edf87', label:'APPROVED' },
    declined: { color:'#f26060', label:'DECLINED' },
    expired:  { color:'#fbbf24', label:'EXPIRED' },
  }[status] || { color:'#7a8db0', label:'UNKNOWN' };
  return (
    <span style={{background:meta.color+'22',color:meta.color,border:'1px solid '+meta.color+'66',borderRadius:999,padding:'4px 10px',fontSize:11,fontWeight:700,letterSpacing:'.06em'}}>
      {meta.label}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{marginBottom:14,background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',marginBottom:10,fontWeight:700}}>{title.toUpperCase()}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
const fieldLabel = {
  fontSize:11, fontWeight:600, letterSpacing:'.08em',
  textTransform:'uppercase', color:'#7a8db0', marginBottom:5,
};
const btnPrimary = { background:'#4f9eff', border:'none', borderRadius:10, color:'#fff', padding:'12px 16px', cursor:'pointer', fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:15, letterSpacing:'.08em', fontWeight:700 };
const btnAccent  = { background:'#2edf87', border:'none', borderRadius:10, color:'#0d1726', padding:'12px 16px', cursor:'pointer', fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:15, letterSpacing:'.08em', fontWeight:700 };
const btnGhost   = { background:'transparent', border:'1px solid #2e3f60', borderRadius:10, color:'#c8d4ee', padding:'10px 14px', cursor:'pointer', fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:13, letterSpacing:'.06em', fontWeight:700 };
