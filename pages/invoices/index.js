import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';

const FILTERS = [
  { key:'all',    label:'All' },
  { key:'unpaid', label:'Unpaid' },
  { key:'paid',   label:'Paid' },
];

const EMPTY = {
  job_id:'', customer_id:'', amount:'',
  status:'unpaid', issued_date: todayStr(), paid_date:'', notes:'',
};

export default function Invoices() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [invoices, setInvoices] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId) loadAll();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: inv }, { data: j }, { data: c }] = await Promise.all([
      supabase.from('invoices').select('*').eq('org_id', orgId).order('issued_date', { ascending:false, nullsFirst:false }),
      supabase.from('jobs').select('id,title,customer_id,price,status').eq('org_id', orgId).order('scheduled_date', { ascending:false, nullsFirst:false }),
      supabase.from('customers').select('id,name').eq('org_id', orgId).order('name'),
    ]);
    setInvoices(inv || []);
    setJobs(j || []);
    setCustomers(c || []);
    setLoading(false);
  };

  const customerName = id => customers.find(c => c.id === id)?.name || '—';
  const jobTitle = id => jobs.find(j => j.id === id)?.title || '—';

  const openNew = () => { setForm(EMPTY); setSheet('new'); };
  const openEdit = (inv) => {
    setForm({
      job_id: inv.job_id || '',
      customer_id: inv.customer_id || '',
      amount: inv.amount ?? '',
      status: inv.status || 'unpaid',
      issued_date: inv.issued_date || todayStr(),
      paid_date: inv.paid_date || '',
      notes: inv.notes || '',
    });
    setSheet(inv);
  };

  const pickJob = (jobId) => {
    const j = jobs.find(x => x.id === jobId);
    setForm(p => ({
      ...p,
      job_id: jobId,
      customer_id: j?.customer_id || p.customer_id || '',
      amount: p.amount === '' && j?.price != null ? String(j.price) : p.amount,
    }));
  };

  const toggleStatus = (next) => {
    setForm(p => ({
      ...p,
      status: next,
      paid_date: next === 'paid' ? (p.paid_date || todayStr()) : '',
    }));
  };

  const save = async () => {
    if (form.amount === '' || isNaN(Number(form.amount)) || !orgId) return;
    setSaving(true);
    const payload = {
      job_id: form.job_id || null,
      customer_id: form.customer_id || null,
      amount: Number(form.amount),
      status: form.status,
      issued_date: form.issued_date || todayStr(),
      paid_date: form.status === 'paid' ? (form.paid_date || todayStr()) : null,
      notes: form.notes || null,
    };
    if (sheet === 'new') {
      await supabase.from('invoices').insert({ ...payload, owner_id: user.id, org_id: orgId });
    } else {
      await supabase.from('invoices').update(payload).eq('id', sheet.id);
    }
    await loadAll();
    setSaving(false);
    setSheet(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this invoice?')) return;
    await supabase.from('invoices').delete().eq('id', id);
    setInvoices(inv => inv.filter(x => x.id !== id));
  };

  const quickMarkPaid = async (inv) => {
    await supabase.from('invoices').update({ status:'paid', paid_date: todayStr() }).eq('id', inv.id);
    await loadAll();
  };

  const visible = invoices.filter(i => filter === 'all' || i.status === filter);
  const unpaidTotal = invoices.filter(i => i.status === 'unpaid').reduce((s,i) => s + Number(i.amount||0), 0);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>Loading...</div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <div style={{background:'#1a2236',borderBottom:'1.5px solid #2e3f60',padding:'12px 16px',display:'flex',alignItems:'center',gap:8,position:'sticky',top:0,zIndex:50}}>
        <button onClick={() => router.push('/dashboard')} style={{background:'none',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:20,padding:'0 4px'}}>←</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',flex:1}}>INVOICES</div>
        <button onClick={() => router.push('/invoices/import')} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 12px',fontWeight:700,cursor:'pointer',fontSize:12,letterSpacing:'.04em'}}>Import</button>
        <button onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:13}}>+ New</button>
      </div>

      <div style={{margin:'12px 16px 6px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase'}}>Outstanding</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:'#fbbf24',letterSpacing:'.04em'}}>{fmt$(unpaidTotal)}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase'}}>Invoices</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:'#f0f4ff'}}>{invoices.length}</div>
        </div>
      </div>

      <div style={{display:'flex',gap:6,padding:'6px 12px 4px',overflowX:'auto'}}>
        {FILTERS.map(opt => (
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
          <div style={{fontSize:36,marginBottom:8}}>🧾</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>
            {invoices.length === 0 ? 'No Invoices Yet' : 'Nothing in this filter'}
          </div>
          <div style={{fontSize:13}}>{invoices.length === 0 ? 'Tap + New to bill a job.' : 'Try a different filter.'}</div>
        </div>
      )}

      {visible.map(inv => {
        const paid = inv.status === 'paid';
        const pillColor = paid ? '#2edf87' : '#fbbf24';
        return (
          <div key={inv.id} onClick={() => openEdit(inv)}
            style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,margin:'6px 16px',padding:'13px 14px',cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3,gap:8}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {inv.job_id ? jobTitle(inv.job_id) : 'Invoice'}
              </div>
              <span style={{background:pillColor+'22',color:pillColor,border:'1px solid '+pillColor+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',whiteSpace:'nowrap'}}>{paid?'PAID':'UNPAID'}</span>
              <button onClick={e => { e.stopPropagation(); del(inv.id); }} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:12,fontWeight:700,padding:'2px 4px'}}>✕</button>
            </div>
            <div style={{fontSize:12,color:'#c8d4ee'}}>{customerName(inv.customer_id)}</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4,fontSize:11,color:'#7a8db0'}}>
              <span>Issued {fmtDate(inv.issued_date)}{paid && inv.paid_date ? ` · Paid ${fmtDate(inv.paid_date)}` : ''}</span>
              <span style={{color:'#2edf87',fontWeight:700,fontSize:14}}>{fmt$(inv.amount || 0)}</span>
            </div>
            <div style={{display:'flex',gap:6,marginTop:8}}>
              <button onClick={e => { e.stopPropagation(); router.push('/invoices/' + inv.id); }}
                style={{flex:1,background:'#4f9eff22',border:'1px solid #4f9eff66',borderRadius:8,color:'#4f9eff',padding:'7px 0',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'.05em'}}>
                VIEW
              </button>
              {!paid && (
                <button onClick={e => { e.stopPropagation(); quickMarkPaid(inv); }}
                  style={{flex:1,background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:8,color:'#2edf87',padding:'7px 0',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'.05em'}}>
                  MARK PAID
                </button>
              )}
            </div>
          </div>
        );
      })}

      {sheet && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>{sheet==='new'?'NEW INVOICE':'EDIT INVOICE'}</div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>From Job</div>
              <select value={form.job_id} onChange={e => pickJob(e.target.value)} style={inputStyle}>
                <option value="">— none —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.price ? ` · ${fmt$(j.price)}` : ''}</option>)}
              </select>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Customer</div>
              <select value={form.customer_id} onChange={e => setForm(p => ({...p, customer_id:e.target.value}))} style={inputStyle}>
                <option value="">— none —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Amount ($)</div>
                <input type="number" inputMode="decimal" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(p => ({...p, amount:e.target.value}))}
                  style={inputStyle}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Issued</div>
                <input type="date" value={form.issued_date}
                  onChange={e => setForm(p => ({...p, issued_date:e.target.value}))}
                  style={inputStyle}/>
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Status</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[{key:'unpaid',label:'Unpaid',color:'#fbbf24'},{key:'paid',label:'Paid',color:'#2edf87'}].map(s => (
                  <button key={s.key} onClick={() => toggleStatus(s.key)}
                    style={{
                      background: form.status===s.key ? s.color+'22' : 'transparent',
                      border:'1.5px solid '+(form.status===s.key ? s.color : '#2e3f60'),
                      color: form.status===s.key ? s.color : '#c8d4ee',
                      borderRadius:10, padding:'10px 8px', fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.04em',
                    }}>{s.label}</button>
                ))}
              </div>
            </div>

            {form.status === 'paid' && (
              <div style={{margin:'10px 16px'}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Paid Date</div>
                <input type="date" value={form.paid_date || ''}
                  onChange={e => setForm(p => ({...p, paid_date:e.target.value}))}
                  style={inputStyle}/>
              </div>
            )}

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Notes</div>
              <textarea value={form.notes}
                onChange={e => setForm(p => ({...p, notes:e.target.value}))}
                placeholder="Internal notes, payment method, ref..."
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving || form.amount === '' || isNaN(Number(form.amount))}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving ? 'Saving...' : 'Save Invoice'}
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
