import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { fmt$, fmtDate } from '../../lib/helpers';
import TopNav from '../../components/TopNav';

export default function CustomerDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);

  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs]         = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotes, setQuotes]     = useState([]);
  const [properties, setProperties] = useState([]);
  const [recurring, setRecurring]   = useState([]);
  const [loading, setLoading]   = useState(true);

  // Modal state for the property + recurring plan editors
  const [propertyForm, setPropertyForm]   = useState(null);
  const [recurringForm, setRecurringForm] = useState(null);
  const [sendingPortalLink, setSendingPortalLink] = useState(false);

  // Edit sheet state — same form shape as the list page's sheet
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);

  const loadAll = async () => {
    if (!orgId || !id) return;
    setLoading(true);
    const [{ data: c }, { data: j }, { data: inv }, { data: q }, { data: props }, { data: rec }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).eq('org_id', orgId).maybeSingle(),
      supabase.from('jobs').select('*').eq('customer_id', id).eq('org_id', orgId).order('scheduled_date', { ascending:false, nullsFirst:false }),
      supabase.from('invoices').select('*').eq('customer_id', id).eq('org_id', orgId).order('issued_date', { ascending:false, nullsFirst:false }),
      supabase.from('quotes').select('id, title, amount, status, sent_at, approved_at, declined_at, created_at').eq('customer_id', id).eq('org_id', orgId).order('created_at', { ascending:false }),
      supabase.from('customer_properties').select('*').eq('customer_id', id).order('is_primary', { ascending:false }),
      supabase.from('recurring_jobs').select('*').eq('customer_id', id).order('next_run_date'),
    ]);
    setCustomer(c || null);
    setJobs(j || []);
    setInvoices(inv || []);
    setQuotes(q || []);
    setProperties(props || []);
    setRecurring(rec || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId && id) loadAll();
    else if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [orgId, orgLoading, id]);

  useRefetchOnFocus(loadAll, !!(orgId && id));

  const stats = useMemo(() => {
    const paid     = invoices.filter(i => i.status === 'paid');
    const unpaid   = invoices.filter(i => i.status === 'unpaid');
    const ltv      = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
    const out      = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0);
    const lastDates = [
      ...invoices.map(i => i.paid_date || i.issued_date),
      ...jobs.map(j => j.scheduled_date),
    ].filter(Boolean).sort();
    const lastInteraction = lastDates.length ? lastDates[lastDates.length - 1] : null;
    return {
      ltv, out,
      jobsTotal: jobs.length,
      jobsCompleted: jobs.filter(j => j.status === 'completed').length,
      jobsActive: jobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress').length,
      invoiceCount: invoices.length,
      unpaidCount: unpaid.length,
      quoteCount: quotes.length,
      lastInteraction,
    };
  }, [jobs, invoices, quotes]);

  const openEdit = () => {
    setForm({ ...customer });
    setEditing(true);
  };
  const save = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    await supabase.from('customers').update({
      name:    form.name,
      phone:   form.phone || null,
      email:   form.email || null,
      address: form.address || null,
      notes:   form.notes || null,
    }).eq('id', customer.id);
    await loadAll();
    setSaving(false);
    setEditing(false);
  };
  const del = async () => {
    if (!confirm('Delete this customer? Their jobs, invoices, and quotes stay (just unlinked).')) return;
    await supabase.from('customers').delete().eq('id', customer.id);
    router.push('/customers');
  };

  // Properties handlers
  const openNewProperty = () => setPropertyForm({ id:null, label:'', address:'', notes:'', is_primary:false });
  const openEditProperty = (p) => setPropertyForm({ ...p });
  const saveProperty = async () => {
    if (!propertyForm.label?.trim()) return;
    const payload = {
      org_id: orgId,
      customer_id: customer.id,
      label: propertyForm.label.trim(),
      address: propertyForm.address || null,
      notes: propertyForm.notes || null,
      is_primary: !!propertyForm.is_primary,
    };
    // Enforce single-primary at the app level (cheaper than a partial
    // unique index that has to deal with updates).
    if (payload.is_primary) {
      await supabase.from('customer_properties')
        .update({ is_primary: false })
        .eq('customer_id', customer.id)
        .neq('id', propertyForm.id || '00000000-0000-0000-0000-000000000000');
    }
    if (propertyForm.id) {
      await supabase.from('customer_properties').update(payload).eq('id', propertyForm.id);
    } else {
      await supabase.from('customer_properties').insert(payload);
    }
    setPropertyForm(null);
    await loadAll();
  };
  const removeProperty = async (id) => {
    if (!confirm('Remove this property?')) return;
    await supabase.from('customer_properties').delete().eq('id', id);
    await loadAll();
  };

  // Recurring plan handlers. Cadence + start date are required;
  // the cron will materialize jobs from next_run_date forward.
  const openNewRecurring = () => setRecurringForm({
    id:null, title:'', description:'', price:'', cadence:'monthly',
    weekday:'', day_of_month:'', next_run_date: new Date().toISOString().slice(0,10),
    property_id:'', active:true,
  });
  const openEditRecurring = (r) => setRecurringForm({
    ...r,
    weekday: r.weekday ?? '',
    day_of_month: r.day_of_month ?? '',
    property_id: r.property_id ?? '',
    price: r.price ?? '',
  });
  const saveRecurring = async () => {
    if (!recurringForm.title?.trim() || !recurringForm.next_run_date) return;
    const payload = {
      org_id: orgId,
      customer_id: customer.id,
      property_id: recurringForm.property_id || null,
      title: recurringForm.title.trim(),
      description: recurringForm.description || null,
      price: recurringForm.price === '' ? 0 : Number(recurringForm.price),
      cadence: recurringForm.cadence,
      weekday: recurringForm.cadence === 'weekly' || recurringForm.cadence === 'biweekly'
                ? (recurringForm.weekday ? Number(recurringForm.weekday) : null)
                : null,
      day_of_month: recurringForm.cadence === 'monthly' || recurringForm.cadence === 'quarterly' || recurringForm.cadence === 'yearly'
                ? (recurringForm.day_of_month ? Number(recurringForm.day_of_month) : null)
                : null,
      next_run_date: recurringForm.next_run_date,
      active: !!recurringForm.active,
    };
    if (recurringForm.id) {
      await supabase.from('recurring_jobs').update(payload).eq('id', recurringForm.id);
    } else {
      await supabase.from('recurring_jobs').insert(payload);
    }
    setRecurringForm(null);
    await loadAll();
  };
  const removeRecurring = async (id) => {
    if (!confirm('Stop this recurring plan? Existing jobs are kept.')) return;
    await supabase.from('recurring_jobs').delete().eq('id', id);
    await loadAll();
  };
  const toggleRecurring = async (r) => {
    await supabase.from('recurring_jobs').update({ active: !r.active }).eq('id', r.id);
    await loadAll();
  };

  // Customer portal link copy / send
  const portalUrl = customer?.portal_token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${customer.portal_token}`
    : null;
  const copyPortalLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl).then(() => alert('Portal link copied to clipboard.'));
  };

  if (loading || !customer) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/customers"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>
          {loading ? 'Loading customer…' : 'Customer not found.'}
        </div>
      </div>
    );
  }

  const telHref  = customer.phone ? `tel:${customer.phone.replace(/[^+\d]/g,'')}` : null;
  const smsHref  = customer.phone ? `sms:${customer.phone.replace(/[^+\d]/g,'')}` : null;
  const mailHref = customer.email ? `mailto:${customer.email}` : null;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/customers"/>

      <main style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 0'}}>
        <button onClick={() => router.push('/customers')}
          style={{background:'transparent',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:13,fontWeight:600,padding:'4px 0',marginBottom:10}}>
          ← All customers
        </button>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:18}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Customer</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 6px',lineHeight:1.05}}>
              {customer.name.toUpperCase()}
            </h1>
            {customer.phone   && <div style={{fontSize:13,color:'#c8d4ee'}}>{customer.phone}</div>}
            {customer.email   && <div style={{fontSize:13,color:'#7a8db0'}}>{customer.email}</div>}
            {customer.address && <div style={{fontSize:12,color:'#7a8db0',marginTop:2}}>{customer.address}</div>}
            {customer.notes   && <div style={{fontSize:12,color:'#fbbf24',marginTop:4,maxWidth:540}}>Note: {customer.notes}</div>}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={openEdit} style={btnGhost}>Edit</button>
            <button onClick={del}      style={{...btnGhost,color:'#f26060',borderColor:'#f2606055'}}>Delete</button>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(120px, 1fr))',gap:8,marginBottom:18}}>
          <ActionTile label="Call"  icon="📞" href={telHref}  color="#2edf87" disabled={!telHref}/>
          <ActionTile label="Text"  icon="💬" href={smsHref}  color="#4f9eff" disabled={!smsHref}/>
          <ActionTile label="Email" icon="✉️" href={mailHref} color="#fbbf24" disabled={!mailHref}/>
          <ActionTile label="New Quote" icon="📋"
            onClick={() => router.push(`/quotes?new=1&customer=${customer.id}`)}
            color="#b197fc"/>
          <ActionTile label="New Job" icon="🔧"
            onClick={() => router.push(`/jobs?new=1&customer=${customer.id}`)}
            color="#54d4f8"/>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:8,marginBottom:20}}>
          <StatTile label="Lifetime value" value={fmt$(stats.ltv)} color="#2edf87" sub={`${stats.invoiceCount} invoice${stats.invoiceCount===1?'':'s'}`}/>
          <StatTile label="Outstanding"    value={fmt$(stats.out)} color="#fbbf24" sub={`${stats.unpaidCount} unpaid`}/>
          <StatTile label="Jobs"           value={String(stats.jobsTotal)} color="#4f9eff" sub={`${stats.jobsActive} active · ${stats.jobsCompleted} done`}/>
          <StatTile label="Last interaction" value={stats.lastInteraction ? fmtDate(stats.lastInteraction) : '—'} color="#c8d4ee"/>
        </div>

        {/* Sections */}
        <Section title="Jobs" count={jobs.length}>
          {jobs.length === 0 ? <Empty>No jobs yet.</Empty> : jobs.map(j => (
            <Row key={j.id} onClick={() => router.push('/jobs')}
              left={j.title}
              middle={j.scheduled_date ? fmtDate(j.scheduled_date) : ''}
              right={fmt$(j.price || 0)}
              tag={j.status} tagColor={STATUS_COLOR[j.status] || '#7a8db0'}/>
          ))}
        </Section>

        <Section title="Invoices" count={invoices.length}>
          {invoices.length === 0 ? <Empty>No invoices yet.</Empty> : invoices.map(inv => (
            <Row key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)}
              left={inv.notes || 'Invoice'}
              middle={`Issued ${fmtDate(inv.issued_date)}${inv.paid_date ? ` · Paid ${fmtDate(inv.paid_date)}` : ''}`}
              right={fmt$(inv.amount)}
              tag={inv.status}
              tagColor={inv.status === 'paid' ? '#2edf87' : '#fbbf24'}/>
          ))}
        </Section>

        <Section title="Quotes" count={quotes.length}>
          {quotes.length === 0 ? <Empty>No quotes yet.</Empty> : quotes.map(q => (
            <Row key={q.id} onClick={() => router.push(`/quotes/${q.id}`)}
              left={q.title}
              middle={q.sent_at ? `Sent ${fmtDate(q.sent_at.slice(0,10))}` : 'Draft'}
              right={fmt$(q.amount)}
              tag={q.status}
              tagColor={QUOTE_STATUS_COLOR[q.status] || '#7a8db0'}/>
          ))}
        </Section>

        <Section title="Properties" count={properties.length} action={
          <button onClick={openNewProperty} style={addBtn}>+ Add</button>
        }>
          {properties.length === 0 ? (
            <Empty>No properties yet. The customer's main address acts as the default — add more here when they have multiple sites.</Empty>
          ) : properties.map(p => (
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:'1px solid #2e3f60'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600}}>
                  {p.label}
                  {p.is_primary && <span style={{marginLeft:8,fontSize:10,color:'#fbbf24',letterSpacing:'.06em',fontWeight:700}}>PRIMARY</span>}
                </div>
                {p.address && <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{p.address}</div>}
                {p.notes && <div style={{fontSize:11,color:'#fbbf24',marginTop:2}}>{p.notes}</div>}
              </div>
              <button onClick={() => openEditProperty(p)} style={smallBtn}>Edit</button>
              <button onClick={() => removeProperty(p.id)} style={{...smallBtn,color:'#f26060'}}>×</button>
            </div>
          ))}
        </Section>

        <Section title="Recurring plans" count={recurring.length} action={
          <button onClick={openNewRecurring} style={addBtn}>+ Plan</button>
        }>
          {recurring.length === 0 ? (
            <Empty>No recurring plans. Add one for maintenance contracts, monthly cleanings, or quarterly check-ins. The system creates the next job automatically.</Empty>
          ) : recurring.map(r => (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:'1px solid #2e3f60',opacity:r.active ? 1 : 0.5}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600}}>{r.title}</div>
                <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>
                  {cadenceLabel(r)} · Next: {fmtDate(r.next_run_date)}
                  {r.price ? ' · ' + fmt$(r.price) : ''}
                </div>
              </div>
              <button onClick={() => toggleRecurring(r)} style={{...smallBtn,color:r.active ? '#fbbf24' : '#2edf87'}}>
                {r.active ? 'Pause' : 'Resume'}
              </button>
              <button onClick={() => openEditRecurring(r)} style={smallBtn}>Edit</button>
              <button onClick={() => removeRecurring(r.id)} style={{...smallBtn,color:'#f26060'}}>×</button>
            </div>
          ))}
        </Section>

        <Section title="Customer portal" count={null}>
          <div style={{padding:'14px 16px'}}>
            <div style={{fontSize:13,color:'#c8d4ee',marginBottom:8}}>
              Give this customer a read-only link to their quotes, jobs, and invoices. No login required.
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <input readOnly value={portalUrl || ''} onClick={e => e.target.select()}
                style={{...inputStyle, flex:'1 1 220px', minWidth:0, fontSize:12, color:'#a8b8d8'}}/>
              <button onClick={copyPortalLink} style={{...smallBtn, background:'#4f9eff', color:'#fff', borderColor:'#4f9eff'}}>COPY LINK</button>
              {customer.email && (
                <button onClick={async () => {
                  if (sendingPortalLink) return;
                  setSendingPortalLink(true);
                  // Reuses the quoteSent template's CTA pattern via a
                  // plain "view your portal" email. We just dispatch
                  // an info email through the generic transport for
                  // now — could become its own template if desired.
                  try {
                    await fetch('/api/email/send-link', {
                      method:'POST',
                      headers: {
                        'Content-Type':'application/json',
                        Authorization: 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token,
                      },
                      body: JSON.stringify({ to: customer.email, url: portalUrl, customerName: customer.name }),
                    });
                    alert(`Portal link sent to ${customer.email}.`);
                  } catch { alert('Send failed.'); }
                  setSendingPortalLink(false);
                }} style={{...smallBtn, background:'#2edf87', color:'#111827', borderColor:'#2edf87'}}>
                  {sendingPortalLink ? '…' : 'EMAIL TO CUSTOMER'}
                </button>
              )}
            </div>
          </div>
        </Section>
      </main>

      {/* Property editor */}
      {propertyForm && (
        <div onClick={e => e.target === e.currentTarget && setPropertyForm(null)}
          style={modalBackdrop}>
          <div style={modalSheet}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={modalTitle}>{propertyForm.id ? 'EDIT PROPERTY' : 'NEW PROPERTY'}</div>
            <Field label="Label" value={propertyForm.label}
              onChange={v => setPropertyForm(p => ({...p, label:v}))}
              placeholder="Main store, Office 2, Rear unit..."/>
            <Field label="Address" value={propertyForm.address || ''}
              onChange={v => setPropertyForm(p => ({...p, address:v}))}
              placeholder="Street, City, State ZIP"/>
            <Field label="Notes" value={propertyForm.notes || ''}
              onChange={v => setPropertyForm(p => ({...p, notes:v}))}
              placeholder="Gate code, dogs, access..." textarea/>
            <div style={{margin:'10px 16px',display:'flex',alignItems:'center',gap:8}}>
              <input type="checkbox" id="primary_chk" checked={!!propertyForm.is_primary}
                onChange={e => setPropertyForm(p => ({...p, is_primary:e.target.checked}))}/>
              <label htmlFor="primary_chk" style={{fontSize:13,color:'#c8d4ee'}}>Mark as primary property</label>
            </div>
            <ModalActions onSave={saveProperty} onClose={() => setPropertyForm(null)} disabled={!propertyForm.label?.trim()}/>
          </div>
        </div>
      )}

      {/* Recurring plan editor */}
      {recurringForm && (
        <div onClick={e => e.target === e.currentTarget && setRecurringForm(null)} style={modalBackdrop}>
          <div style={modalSheet}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={modalTitle}>{recurringForm.id ? 'EDIT PLAN' : 'NEW RECURRING PLAN'}</div>
            <Field label="Title" value={recurringForm.title}
              onChange={v => setRecurringForm(p => ({...p, title:v}))}
              placeholder="Monthly lawn care"/>
            <Field label="Description" value={recurringForm.description || ''}
              onChange={v => setRecurringForm(p => ({...p, description:v}))}
              placeholder="Mow, edge, blow."
              textarea/>
            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Cadence</div>
                <select value={recurringForm.cadence}
                  onChange={e => setRecurringForm(p => ({...p, cadence:e.target.value}))}
                  style={inputStyle}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Price ($)</div>
                <input type="number" inputMode="decimal" value={recurringForm.price}
                  onChange={e => setRecurringForm(p => ({...p, price:e.target.value}))}
                  placeholder="0.00" style={inputStyle}/>
              </div>
            </div>
            <Field label="Next run date (start)" type="date" value={recurringForm.next_run_date}
              onChange={v => setRecurringForm(p => ({...p, next_run_date:v}))}/>
            {properties.length > 0 && (
              <div style={{margin:'10px 16px'}}>
                <div style={fieldLabel}>Property</div>
                <select value={recurringForm.property_id || ''}
                  onChange={e => setRecurringForm(p => ({...p, property_id:e.target.value}))}
                  style={inputStyle}>
                  <option value="">— primary —</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            )}
            <ModalActions onSave={saveRecurring} onClose={() => setRecurringForm(null)} disabled={!recurringForm.title?.trim() || !recurringForm.next_run_date}/>
          </div>
        </div>
      )}

      {editing && (
        <div onClick={e => e.target === e.currentTarget && setEditing(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>EDIT CUSTOMER</div>
            {[
              { label:'Name', key:'name', type:'text', placeholder:'Full name' },
              { label:'Phone', key:'phone', type:'tel', placeholder:'512-555-0100' },
              { label:'Email', key:'email', type:'email', placeholder:'email@example.com' },
              { label:'Address', key:'address', type:'text', placeholder:'Street, City, State ZIP' },
            ].map(field => (
              <div key={field.key} style={{margin:'10px 16px'}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>{field.label}</div>
                <input type={field.type} placeholder={field.placeholder} value={form[field.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={inputStyle} maxLength={field.key === 'address' ? 300 : 200}/>
              </div>
            ))}
            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Notes</div>
              <textarea maxLength={2000} value={form.notes || ''}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Gate code, dogs, access notes..."
                style={{...inputStyle, resize:'vertical', minHeight:72, fontFamily:'inherit'}}/>
            </div>
            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving || !form.name?.trim()}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
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

function ActionTile({ label, icon, href, onClick, color, disabled }) {
  const baseStyle = {
    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,
    padding:'12px 8px', borderRadius:10,
    background: '#1e2a42', border: '1px solid ' + (disabled ? '#2e3f60' : color + '55'),
    color: disabled ? '#3a4866' : color,
    fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase',
    textDecoration:'none', cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
  const content = (
    <>
      <span style={{fontSize:18,opacity: disabled ? 0.5 : 1}}>{icon}</span>
      <span>{label}</span>
    </>
  );
  if (disabled) return <div style={baseStyle}>{content}</div>;
  if (href)   return <a href={href} style={baseStyle}>{content}</a>;
  return <button onClick={onClick} style={{...baseStyle, fontFamily:'inherit'}}>{content}</button>;
}

function StatTile({ label, value, color, sub }) {
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 12px'}}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.02em',color,lineHeight:1.1,marginTop:4}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#7a8db0',marginTop:3}}>{sub}</div>}
    </div>
  );
}

function Section({ title, count, children, action }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8,gap:8}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff'}}>{title.toUpperCase()}</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {count != null && <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>{count}</div>}
          {action}
        </div>
      </div>
      <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,overflow:'hidden'}}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, textarea }) {
  return (
    <div style={{margin:'10px 16px'}}>
      <div style={fieldLabel}>{label}</div>
      {textarea ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
      ) : (
        <input type={type || 'text'} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={inputStyle}/>
      )}
    </div>
  );
}

function ModalActions({ onSave, onClose, disabled }) {
  return (
    <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
      <button onClick={onSave} disabled={disabled}
        style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:disabled?0.5:1}}>
        Save
      </button>
      <button onClick={onClose}
        style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'13px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>
        Cancel
      </button>
    </div>
  );
}

function cadenceLabel(r) {
  const days = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  switch (r.cadence) {
    case 'weekly':    return r.weekday ? `Weekly · ${days[r.weekday]}` : 'Weekly';
    case 'biweekly':  return r.weekday ? `Every 2 weeks · ${days[r.weekday]}` : 'Every 2 weeks';
    case 'monthly':   return r.day_of_month ? `Monthly · day ${r.day_of_month}` : 'Monthly';
    case 'quarterly': return r.day_of_month ? `Quarterly · day ${r.day_of_month}` : 'Quarterly';
    case 'yearly':    return r.day_of_month ? `Yearly · day ${r.day_of_month}` : 'Yearly';
    default: return r.cadence;
  }
}

function Row({ left, middle, right, tag, tagColor, onClick }) {
  return (
    <div onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:'1px solid #2e3f60',cursor:'pointer'}}
      onMouseEnter={e => e.currentTarget.style.background = '#243355'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{left}</div>
        {middle && <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{middle}</div>}
      </div>
      {right && <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:'#c8d4ee',whiteSpace:'nowrap'}}>{right}</div>}
      {tag && (
        <span style={{background:tagColor+'22',color:tagColor,border:'1px solid '+tagColor+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
          {tag}
        </span>
      )}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{fontSize:13,color:'#7a8db0',padding:'18px 14px',textAlign:'center'}}>{children}</div>;
}

const STATUS_COLOR = {
  scheduled: '#54d4f8', in_progress: '#fbbf24', completed: '#2edf87', cancelled: '#f26060',
};
const QUOTE_STATUS_COLOR = {
  draft: '#7a8db0', sent: '#4f9eff', approved: '#2edf87', declined: '#f26060', expired: '#fbbf24',
};

const btnGhost = {
  background:'transparent',border:'1px solid #2e3f60',borderRadius:8,
  color:'#c8d4ee',padding:'7px 14px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.04em',fontFamily:'inherit',
};
const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
const fieldLabel = {
  fontSize:11, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase',
  color:'#7a8db0', marginBottom:5,
};
const addBtn = {
  background:'#4f9eff', border:'none', borderRadius:8, color:'#fff',
  padding:'6px 12px', fontSize:11, fontWeight:700, letterSpacing:'.04em', cursor:'pointer', fontFamily:'inherit',
};
const smallBtn = {
  background:'transparent', border:'1px solid #2e3f60', borderRadius:7,
  color:'#c8d4ee', padding:'5px 10px', fontSize:11, fontWeight:600,
  letterSpacing:'.04em', cursor:'pointer', fontFamily:'inherit',
};
const modalBackdrop = {
  position:'fixed', inset:0, background:'rgba(0,0,0,.72)', zIndex:200,
  display:'flex', alignItems:'flex-end', backdropFilter:'blur(3px)',
};
const modalSheet = {
  background:'#1a2236', borderTop:'2px solid #2e3f60', borderRadius:'20px 20px 0 0',
  width:'100%', maxWidth:480, margin:'0 auto', maxHeight:'90vh', overflowY:'auto', paddingBottom:24,
};
const modalTitle = {
  fontFamily:"'Bebas Neue',sans-serif", fontSize:21, letterSpacing:'.08em',
  padding:'6px 16px 4px', color:'#f0f4ff',
};
