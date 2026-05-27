import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { FullPageLoading } from '../../components/PageStates';
import { toast } from '../../components/Toast';

const STATUSES = [
  { key:'new',        label:'New',        color:'#4f9eff' },
  { key:'contacted',  label:'Contacted',  color:'#fbbf24' },
  { key:'qualified',  label:'Qualified',  color:'#b197fc' },
  { key:'won',        label:'Won',        color:'#2edf87' },
  { key:'lost',       label:'Lost',       color:'#7a8db0' },
];
const statusMeta = k => STATUSES.find(s => s.key === k) || STATUSES[0];

const SOURCES = [
  { key:'call',         label:'Phone Call' },
  { key:'website',      label:'Website' },
  { key:'self_booking', label:'Self-Booking' },
  { key:'referral',     label:'Referral' },
  { key:'walk_in',      label:'Walk-in' },
  { key:'other',        label:'Other' },
];
const sourceLabel = k => SOURCES.find(s => s.key === k)?.label || 'Other';

const EMPTY = {
  name:'', phone:'', email:'', address:'',
  source:'call', status:'new',
  estimated_value:'', follow_up_date:'', notes:'',
};

export default function Leads() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [copied, setCopied] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY);

  const loadLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from('leads').select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId) loadLeads();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  useRefetchOnFocus(loadLeads, !!orgId);

  const openNew = () => { setForm(EMPTY); setSheet('new'); };
  const openEdit = (l) => {
    setForm({
      name: l.name || '',
      phone: l.phone || '',
      email: l.email || '',
      address: l.address || '',
      source: l.source || 'other',
      status: l.status || 'new',
      estimated_value: l.estimated_value ?? '',
      follow_up_date: l.follow_up_date || '',
      notes: l.notes || '',
    });
    setSheet(l);
  };

  const save = async () => {
    if (!form.name.trim() || !orgId) return;
    setSaving(true);
    const payload = {
      ...form,
      estimated_value: form.estimated_value === '' ? 0 : Number(form.estimated_value),
      follow_up_date: form.follow_up_date || null,
    };
    if (sheet === 'new') {
      await supabase.from('leads').insert({ ...payload, owner_id: user.id, org_id: orgId });
    } else {
      await supabase.from('leads').update(payload).eq('id', sheet.id);
    }
    await loadLeads();
    setSaving(false);
    setSheet(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    setLeads(l => l.filter(x => x.id !== id));
  };

  const generateQuote = async (lead) => {
    if (!orgId) return;
    const { data, error } = await supabase.from('quotes').insert({
      org_id: orgId,
      owner_id: user.id,
      lead_id: lead.id,
      customer_id: lead.converted_customer_id || null,
      customer_name: lead.name,
      customer_email: lead.email,
      customer_phone: lead.phone,
      title: lead.notes ? lead.notes.slice(0, 80) : 'Quote for ' + lead.name,
      description: lead.notes,
      amount: lead.estimated_value || 0,
    }).select('id').single();
    if (error) { toast.error('Could not create quote: ' + error.message); return; }
    router.push(`/quotes/${data.id}`);
  };

  const convertToCustomer = async (lead) => {
    if (lead.converted_customer_id) {
      router.push('/customers');
      return;
    }
    if (!confirm(`Convert ${lead.name} to a customer?`)) return;
    const { data: c, error } = await supabase.from('customers').insert({
      org_id: orgId,
      owner_id: user.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      notes: lead.notes,
    }).select('id').single();
    if (error) { toast.error('Could not convert: ' + error.message); return; }
    await supabase.from('leads').update({
      status: 'won',
      converted_customer_id: c.id,
    }).eq('id', lead.id);
    await loadLeads();
  };

  const visible = leads.filter(l => filter === 'all' || l.status === filter);

  if (loading) return (
    <FullPageLoading/>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/leads"/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',margin:'24px 16px 14px'}}>
        <div>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Leads</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>LEADS</h1>
        </div>
        <button data-tour="page-cta" onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>+ NEW</button>
      </div>

      {org?.slug && typeof window !== 'undefined' && (() => {
        // QR + share now point at /book/<slug> — the same link
        // surfaced in Settings. Customers either chat with the AI
        // receptionist or fall back to the form. One link, one
        // experience, no confusion.
        const url = `${window.location.origin}/book/${org.slug}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=220x220&margin=12&color=0d1726&bgcolor=ffffff`;
        const copy = async () => {
          try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(()=>setCopied(false),1800); } catch {}
        };
        const smsHref  = `sms:?body=${encodeURIComponent(`Book a service with ${org?.name || 'us'}: ${url}`)}`;
        const mailHref = `mailto:?subject=${encodeURIComponent(`Book a service with ${org?.name || 'us'}`)}&body=${encodeURIComponent(`Tap this link any time to book a service: ${url}`)}`;
        return (
          <div data-tour="lead-share-card" className="share-card" style={{margin:'10px 16px 4px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px',display:'flex',gap:14,alignItems:'flex-start'}}>
            <a href={qrUrl} target="_blank" rel="noopener noreferrer" title="Open large QR in new tab — right-click to save"
              style={{display:'block',background:'#fff',borderRadius:10,padding:6,lineHeight:0,flexShrink:0}}>
              <img src={qrUrl} alt="Booking QR" width="110" height="110" style={{display:'block',borderRadius:6}}/>
            </a>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:11,letterSpacing:'.1em',fontWeight:700,color:'#fbbf24',textTransform:'uppercase',marginBottom:4}}>Capture leads automatically</div>
              <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.45,marginBottom:8}}>
                Print this QR or share the link. Customers chat with AI or use the form — leads land here either way.
              </div>
              <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                <input readOnly value={url} style={{flex:1,minWidth:0,background:'#111827',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',fontSize:11,padding:'6px 8px',outline:'none',fontFamily:'monospace'}}/>
                <button onClick={copy}
                  style={{flexShrink:0,background:copied?'#2edf8722':'#4f9eff',border:copied?'1px solid #2edf87':'none',borderRadius:8,color:copied?'#2edf87':'#fff',padding:'6px 12px',fontSize:11,fontWeight:700,letterSpacing:'.05em',cursor:'pointer',whiteSpace:'nowrap'}}>
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
              <div style={{display:'flex',gap:6}}>
                <a href={smsHref}  style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'6px 0',fontSize:10,fontWeight:700,letterSpacing:'.06em',textAlign:'center',textDecoration:'none'}}>TEXT</a>
                <a href={mailHref} style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'6px 0',fontSize:10,fontWeight:700,letterSpacing:'.06em',textAlign:'center',textDecoration:'none'}}>EMAIL</a>
                <a href={qrUrl} download={`${org?.slug || 'myforeman'}-qr.png`} style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'6px 0',fontSize:10,fontWeight:700,letterSpacing:'.06em',textAlign:'center',textDecoration:'none'}}>SAVE QR</a>
              </div>
            </div>
            <style jsx>{`
              /* Narrow screens: QR shrinks + stacks the input row so the
                 COPY button isn't crammed off the edge. */
              @media (max-width: 460px) {
                .share-card { flex-direction: column; align-items: stretch; }
                .share-card > a { align-self: center; }
              }
            `}</style>
          </div>
        );
      })()}

      <div style={{display:'flex',gap:6,padding:'10px 12px',overflowX:'auto'}}>
        {[{ key:'all', label:'All' }, ...STATUSES].map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key)}
            style={{
              background: filter===opt.key ? '#2e3f60' : 'transparent',
              border:'1px solid #2e3f60', borderRadius:999, color:'#f0f4ff',
              padding:'6px 12px', fontSize:12, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
            }}>{opt.label}</button>
        ))}
      </div>

      {visible.length === 0 && (
        <div style={{textAlign:'center',padding:'60px 24px',color:'#7a8db0'}}>
          <div style={{fontSize:36,marginBottom:8}}>📞</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>
            {leads.length === 0 ? 'No Leads Yet' : 'Nothing in this filter'}
          </div>
          <div style={{fontSize:13}}>{leads.length === 0 ? 'Tap + New to log your first lead.' : 'Try a different filter.'}</div>
        </div>
      )}

      {visible.map(l => {
        const s = statusMeta(l.status);
        const converted = !!l.converted_customer_id;
        return (
          <div key={l.id} onClick={() => openEdit(l)}
            style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,margin:'6px 16px',padding:'13px 14px',cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3,gap:8}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.name}</div>
              <span style={{background:s.color+'22',color:s.color,border:'1px solid '+s.color+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',whiteSpace:'nowrap'}}>{s.label.toUpperCase()}</span>
              <button onClick={e => { e.stopPropagation(); del(l.id); }} style={{background:'transparent',border:'none',color:'#f26060',cursor:'pointer',fontSize:14,fontWeight:700,padding:'8px 10px',minWidth:36,minHeight:36,borderRadius:6}}>✕</button>
            </div>
            {(l.phone || l.email) && (
              <div style={{fontSize:12,color:'#c8d4ee'}}>
                {l.phone}{l.phone && l.email ? ' · ' : ''}{l.email}
              </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11,color:'#7a8db0',gap:8,flexWrap:'wrap'}}>
              <span>
                {l.source === 'self_booking' && <span style={{color:'#a855f7',fontWeight:700,letterSpacing:'.04em'}}>📅 BOOKING</span>}
                {l.source !== 'self_booking' && sourceLabel(l.source)}
                {l.follow_up_date ? ' · Follow up ' + fmtDate(l.follow_up_date) : ''}
              </span>
              {l.estimated_value > 0 && <span style={{color:'#2edf87',fontWeight:600}}>~{fmt$(l.estimated_value)}</span>}
            </div>
            {(l.service_name || l.requested_date) && (
              <div style={{fontSize:11,color:'#a855f7',marginTop:3,fontWeight:600}}>
                {l.service_name && <>Wants: {l.service_name}</>}
                {l.requested_date && <> · {fmtDate(l.requested_date)}{l.requested_time ? ' @ ' + String(l.requested_time).slice(0,5) : ''}</>}
              </div>
            )}
            {l.notes && <div style={{fontSize:11,color:'#fbbf24',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Note: {l.notes}</div>}
            <div style={{display:'flex',gap:6,marginTop:8}}>
              <button onClick={e => { e.stopPropagation(); generateQuote(l); }}
                style={{flex:1,background:'#4f9eff22',border:'1px solid #4f9eff66',borderRadius:8,color:'#4f9eff',padding:'7px 0',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'.05em'}}>
                GENERATE QUOTE
              </button>
              {!converted && (
                <button onClick={e => { e.stopPropagation(); convertToCustomer(l); }}
                  style={{flex:1,background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:8,color:'#2edf87',padding:'7px 0',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'.05em'}}>
                  CONVERT TO CUSTOMER
                </button>
              )}
            </div>
            {converted && (
              <div style={{marginTop:8,padding:'6px 0',fontSize:11,color:'#7a8db0',textAlign:'center',letterSpacing:'.04em'}}>
                ✓ Customer created
              </div>
            )}
          </div>
        );
      })}

      {sheet && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>{sheet==='new'?'NEW LEAD':'EDIT LEAD'}</div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Name</div>
              <input style={inputStyle} type="text" placeholder="Homeowner or business name"
                value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))}/>
            </div>

            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Phone</div>
                <input style={inputStyle} type="tel" placeholder="512-555-0100"
                  value={form.phone} onChange={e => setForm(p => ({...p, phone:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Email</div>
                <input style={inputStyle} type="email" placeholder="email@example.com"
                  value={form.email} onChange={e => setForm(p => ({...p, email:e.target.value}))}/>
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Address</div>
              <input style={inputStyle} type="text" placeholder="Job site or mailing"
                value={form.address} onChange={e => setForm(p => ({...p, address:e.target.value}))}/>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Source</div>
              <select value={form.source} onChange={e => setForm(p => ({...p, source:e.target.value}))} style={inputStyle}>
                {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Status</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                {STATUSES.map(s => (
                  <button key={s.key} onClick={() => setForm(p => ({...p, status:s.key}))}
                    style={{
                      background: form.status===s.key ? s.color+'22' : 'transparent',
                      border:'1.5px solid '+(form.status===s.key ? s.color : '#2e3f60'),
                      color: form.status===s.key ? s.color : '#c8d4ee',
                      borderRadius:10, padding:'10px 4px', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'.04em',
                    }}>{s.label}</button>
                ))}
              </div>
            </div>

            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Est. Value ($)</div>
                <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00"
                  value={form.estimated_value} onChange={e => setForm(p => ({...p, estimated_value:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Follow-up Date</div>
                <input style={inputStyle} type="date"
                  value={form.follow_up_date} onChange={e => setForm(p => ({...p, follow_up_date:e.target.value}))}/>
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Notes</div>
              <textarea maxLength={2000} value={form.notes}
                onChange={e => setForm(p => ({...p, notes:e.target.value}))}
                placeholder="What they need, when, budget, special considerations..."
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving || !form.name.trim()}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving ? 'Saving...' : 'Save Lead'}
              </button>
              <button onClick={() => setSheet(null)}
                style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'13px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
