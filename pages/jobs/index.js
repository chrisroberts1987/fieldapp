import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';

const STATUSES = [
  { key:'scheduled',   label:'Scheduled',   color:'#54d4f8' },
  { key:'in_progress', label:'In Progress', color:'#fbbf24' },
  { key:'completed',   label:'Completed',   color:'#2edf87' },
  { key:'cancelled',   label:'Cancelled',   color:'#7a8db0' },
];
const statusMeta = k => STATUSES.find(s => s.key === k) || STATUSES[0];

const EMPTY = {
  customer_id:'', title:'', description:'',
  status:'scheduled', scheduled_date: todayStr(), price:'', notes:''
};

const EXPENSE_CATEGORIES = [
  { key:'materials',  label:'Materials' },
  { key:'fuel',       label:'Fuel' },
  { key:'labor',      label:'Labor / Subs' },
  { key:'equipment',  label:'Equipment' },
  { key:'other',      label:'Other' },
];

export default function Jobs() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY);
  const [jobExpenses, setJobExpenses] = useState([]);
  const [quickExp, setQuickExp] = useState({ amount:'', category:'materials', vendor:'' });
  const [addingExp, setAddingExp] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: j }, { data: c }] = await Promise.all([
      supabase.from('jobs').select('*').eq('org_id', orgId).order('scheduled_date', { ascending:false, nullsFirst:false }),
      supabase.from('customers').select('id,name').eq('org_id', orgId).order('name'),
    ]);
    setJobs(j || []);
    setCustomers(c || []);
    setLoading(false);
  };

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

  useRefetchOnFocus(loadAll, !!orgId);

  const customerName = id => customers.find(c => c.id === id)?.name || '—';

  const openNew = () => { setForm(EMPTY); setSheet('new'); };
  const openEdit = async (j) => {
    setForm({
      customer_id: j.customer_id || '',
      title: j.title || '',
      description: j.description || '',
      status: j.status || 'scheduled',
      scheduled_date: j.scheduled_date || todayStr(),
      price: j.price ?? '',
      notes: j.notes || '',
    });
    setQuickExp({ amount:'', category:'materials', vendor:'' });
    setSheet(j);
    const { data } = await supabase.from('expenses').select('*').eq('job_id', j.id).order('expense_date', { ascending:false });
    setJobExpenses(data || []);
  };

  const addQuickExpense = async () => {
    if (!sheet || sheet === 'new' || !orgId) return;
    const amount = Number(quickExp.amount);
    if (isNaN(amount) || amount <= 0) return;
    setAddingExp(true);
    const { data } = await supabase.from('expenses').insert({
      org_id: orgId,
      owner_id: user.id,
      job_id: sheet.id,
      amount,
      category: quickExp.category,
      vendor: quickExp.vendor.trim() || null,
      expense_date: todayStr(),
    }).select('*').single();
    if (data) setJobExpenses(prev => [data, ...prev]);
    setQuickExp({ amount:'', category:quickExp.category, vendor:'' });
    setAddingExp(false);
  };

  const removeJobExpense = async (id) => {
    await supabase.from('expenses').delete().eq('id', id);
    setJobExpenses(prev => prev.filter(e => e.id !== id));
  };

  const save = async () => {
    if (!form.title.trim() || !orgId) return;
    setSaving(true);
    const payload = {
      ...form,
      customer_id: form.customer_id || null,
      scheduled_date: form.scheduled_date || null,
      price: form.price === '' ? 0 : Number(form.price),
    };
    let savedJobId = null;
    const wasCompleted = sheet !== 'new' && sheet?.status === 'completed';
    const nowCompleted = payload.status === 'completed';

    if (sheet === 'new') {
      const { data } = await supabase.from('jobs').insert({ ...payload, owner_id: user.id, org_id: orgId }).select('id').single();
      savedJobId = data?.id;
    } else {
      await supabase.from('jobs').update(payload).eq('id', sheet.id);
      savedJobId = sheet.id;
    }

    // Auto-create invoice when a job transitions to completed (and we don't
    // already have one for this job).
    if (savedJobId && nowCompleted && !wasCompleted) {
      const { data: existing } = await supabase.from('invoices').select('id').eq('job_id', savedJobId).maybeSingle();
      if (!existing) {
        await supabase.from('invoices').insert({
          org_id: orgId,
          owner_id: user.id,
          job_id: savedJobId,
          customer_id: payload.customer_id,
          amount: payload.price || 0,
          status: 'unpaid',
          issued_date: todayStr(),
          notes: payload.description || null,
        });
        await supabase.from('notifications').insert({
          org_id: orgId,
          user_id: user.id,
          kind: 'job_completed',
          title: 'Job completed → invoice created',
          body: `"${payload.title}" is marked complete. Invoice drafted for ${payload.price ? '$'+Number(payload.price).toFixed(2) : '$0.00'}.`,
          link: '/invoices',
        });
      }
    }

    await loadAll();
    setSaving(false);
    setSheet(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this job?')) return;
    await supabase.from('jobs').delete().eq('id', id);
    setJobs(j => j.filter(x => x.id !== id));
  };

  const visible = jobs.filter(j => filter === 'all' || j.status === filter);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>Loading...</div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <div style={{background:'#1a2236',borderBottom:'1.5px solid #2e3f60',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50}}>
        <button onClick={() => router.push('/dashboard')} style={{background:'none',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:20,padding:'0 4px'}}>←</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',flex:1}}>JOBS</div>
        <button onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:13}}>+ New</button>
      </div>

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
          <div style={{fontSize:36,marginBottom:8}}>🛠️</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>
            {jobs.length === 0 ? 'No Jobs Yet' : 'Nothing in this filter'}
          </div>
          <div style={{fontSize:13}}>{jobs.length === 0 ? 'Tap + New to schedule your first job.' : 'Try a different filter.'}</div>
        </div>
      )}

      {visible.map(j => {
        const s = statusMeta(j.status);
        return (
          <div key={j.id} onClick={() => openEdit(j)}
            style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,margin:'6px 16px',padding:'13px 14px',cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3,gap:8}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.title}</div>
              <span style={{background:s.color+'22',color:s.color,border:'1px solid '+s.color+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',whiteSpace:'nowrap'}}>{s.label}</span>
              <button onClick={e => { e.stopPropagation(); del(j.id); }} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:12,fontWeight:700,padding:'2px 4px'}}>✕</button>
            </div>
            <div style={{fontSize:12,color:'#c8d4ee'}}>{customerName(j.customer_id)}</div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11,color:'#7a8db0'}}>
              <span>{fmtDate(j.scheduled_date)}</span>
              <span style={{color:'#2edf87',fontWeight:600}}>{fmt$(j.price || 0)}</span>
            </div>
            {j.notes && <div style={{fontSize:11,color:'#fbbf24',marginTop:3}}>Note: {j.notes}</div>}
          </div>
        );
      })}

      {sheet && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>{sheet==='new'?'NEW JOB':'EDIT JOB'}</div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Title</div>
              <input type="text" placeholder="e.g. Lawn mow + edge" value={form.title}
                onChange={e => setForm(p => ({...p, title:e.target.value}))}
                style={inputStyle}/>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Customer</div>
              <select value={form.customer_id}
                onChange={e => setForm(p => ({...p, customer_id:e.target.value}))}
                style={inputStyle}>
                <option value="">— none —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Status</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {STATUSES.map(s => (
                  <button key={s.key} onClick={() => setForm(p => ({...p, status:s.key}))}
                    style={{
                      background: form.status===s.key ? s.color+'22' : 'transparent',
                      border:'1.5px solid '+(form.status===s.key ? s.color : '#2e3f60'),
                      color: form.status===s.key ? s.color : '#c8d4ee',
                      borderRadius:10, padding:'10px 8px', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'.04em',
                    }}>{s.label}</button>
                ))}
              </div>
            </div>

            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Date</div>
                <input type="date" value={form.scheduled_date || ''}
                  onChange={e => setForm(p => ({...p, scheduled_date:e.target.value}))}
                  style={inputStyle}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Price ($)</div>
                <input type="number" inputMode="decimal" placeholder="0.00" value={form.price}
                  onChange={e => setForm(p => ({...p, price:e.target.value}))}
                  style={inputStyle}/>
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Description</div>
              <textarea value={form.description}
                onChange={e => setForm(p => ({...p, description:e.target.value}))}
                placeholder="Scope of work"
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Notes</div>
              <textarea value={form.notes}
                onChange={e => setForm(p => ({...p, notes:e.target.value}))}
                placeholder="Crew callouts, access, parts needed..."
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            {sheet !== 'new' && (
              <div style={{margin:'14px 16px 4px',padding:'12px 12px',background:'#111827',border:'1px solid #2e3f60',borderRadius:10}}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0'}}>Expenses on this job</div>
                  <div style={{fontSize:12,color:'#f26060',fontWeight:700}}>
                    {fmt$(jobExpenses.reduce((s,e) => s + Number(e.amount||0), 0))}
                  </div>
                </div>

                {jobExpenses.length > 0 && (
                  <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10}}>
                    {jobExpenses.map(e => (
                      <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,fontSize:12,color:'#c8d4ee'}}>
                        <span style={{color:'#7a8db0',textTransform:'uppercase',fontWeight:700,fontSize:10,letterSpacing:'.05em',minWidth:60}}>{e.category}</span>
                        <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.vendor || e.description || '—'}</span>
                        <span style={{color:'#f26060',fontWeight:600,whiteSpace:'nowrap'}}>{fmt$(e.amount||0)}</span>
                        <button onClick={() => removeJobExpense(e.id)} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:10,padding:'0 4px'}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{display:'flex',gap:6}}>
                  <input type="number" inputMode="decimal" placeholder="$"
                    value={quickExp.amount} onChange={e => setQuickExp(p => ({...p, amount:e.target.value}))}
                    style={{...inputStyle, padding:'8px 10px', fontSize:13, width:90, flexShrink:0}}/>
                  <select value={quickExp.category} onChange={e => setQuickExp(p => ({...p, category:e.target.value}))}
                    style={{...inputStyle, padding:'8px 10px', fontSize:13, width:120, flexShrink:0}}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <input type="text" placeholder="Vendor (optional)"
                    value={quickExp.vendor} onChange={e => setQuickExp(p => ({...p, vendor:e.target.value}))}
                    style={{...inputStyle, padding:'8px 10px', fontSize:13, flex:1}}/>
                  <button onClick={addQuickExpense} disabled={addingExp || !Number(quickExp.amount)}
                    style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 12px',fontWeight:700,cursor:'pointer',fontSize:13,opacity:(addingExp||!Number(quickExp.amount))?0.4:1}}>
                    Add
                  </button>
                </div>
              </div>
            )}

            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving || !form.title.trim()}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving ? 'Saving...' : 'Save Job'}
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
