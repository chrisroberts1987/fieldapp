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
  const [loading, setLoading]   = useState(true);

  // Edit sheet state — same form shape as the list page's sheet
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState(null);
  const [saving, setSaving]     = useState(false);

  const loadAll = async () => {
    if (!orgId || !id) return;
    setLoading(true);
    const [{ data: c }, { data: j }, { data: inv }, { data: q }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).eq('org_id', orgId).maybeSingle(),
      supabase.from('jobs').select('*').eq('customer_id', id).eq('org_id', orgId).order('scheduled_date', { ascending:false, nullsFirst:false }),
      supabase.from('invoices').select('*').eq('customer_id', id).eq('org_id', orgId).order('issued_date', { ascending:false, nullsFirst:false }),
      supabase.from('quotes').select('id, title, amount, status, sent_at, approved_at, declined_at, created_at').eq('customer_id', id).eq('org_id', orgId).order('created_at', { ascending:false }),
    ]);
    setCustomer(c || null);
    setJobs(j || []);
    setInvoices(inv || []);
    setQuotes(q || []);
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
      </main>

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

function Section({ title, count, children }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff'}}>{title.toUpperCase()}</div>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>{count}</div>
      </div>
      <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,overflow:'hidden'}}>
        {children}
      </div>
    </div>
  );
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
