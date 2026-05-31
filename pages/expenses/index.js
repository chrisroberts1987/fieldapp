import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isCrew } from '../../lib/role';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import SubNav from '../../components/SubNav';
import { validateUpload, ACCEPT_ATTR } from '../../lib/uploads';
import { firePushEvent } from '../../lib/push/fire';
import { toast } from '../../components/Toast';

// deductible: percentage of the expense that's tax-deductible (IRS rules).
// Most business expenses are 100%; meals are 50% per IRC §274(n).
const CATEGORIES = [
  { key:'materials',   label:'Materials',     color:'#4f9eff', deductible:100 },
  { key:'fuel',        label:'Fuel',          color:'#fbbf24', deductible:100 },
  { key:'labor',       label:'Labor / Subs',  color:'#b197fc', deductible:100 },
  { key:'equipment',   label:'Equipment',     color:'#54d4f8', deductible:100 },
  { key:'vehicle',     label:'Vehicle',       color:'#fb923c', deductible:100 },
  { key:'insurance',   label:'Insurance',     color:'#f26060', deductible:100 },
  { key:'office',      label:'Office',        color:'#7a8db0', deductible:100 },
  { key:'marketing',   label:'Marketing',     color:'#fb923c', deductible:100 },
  { key:'advertising', label:'Advertising',   color:'#fb923c', deductible:100 },
  { key:'meals',       label:'Meals',         color:'#f26060', deductible:50  },
  { key:'lodging',     label:'Lodging',       color:'#b197fc', deductible:100 },
  { key:'other',       label:'Other',         color:'#c8d4ee', deductible:100 },
];
const catMeta = k => CATEGORIES.find(c => c.key === k) || CATEGORIES[CATEGORIES.length - 1];

const EMPTY = {
  category:'materials', amount:'', expense_date: todayStr(),
  vendor:'', description:'', job_id:'',
};

export default function Expenses() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [expenses, setExpenses] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: e }, { data: j }] = await Promise.all([
      supabase.from('expenses').select('*').eq('org_id', orgId).order('expense_date', { ascending:false }),
      supabase.from('jobs').select('id,title').eq('org_id', orgId).order('scheduled_date', { ascending:false }),
    ]);
    setExpenses(e || []);
    setJobs(j || []);
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

  const jobTitle = id => jobs.find(j => j.id === id)?.title || '—';

  const openNew = () => {
    setForm(EMPTY);
    setReceiptFile(null);
    setReceiptPreview(null);
    setSheet('new');
  };
  const openEdit = (e) => {
    setForm({
      category: e.category || 'other',
      amount: e.amount ?? '',
      expense_date: e.expense_date || todayStr(),
      vendor: e.vendor || '',
      description: e.description || '',
      job_id: e.job_id || '',
    });
    setReceiptFile(null);
    setReceiptPreview(e.receipt_url || null);
    setSheet(e);
  };

  const pickReceipt = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const err = validateUpload(file, { images: true });
    if (err) { toast.error(err); return; }
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (form.amount === '' || isNaN(Number(form.amount)) || !orgId) return;
    setSaving(true);
    const payload = {
      ...form,
      amount: Number(form.amount),
      job_id: form.job_id || null,
      expense_date: form.expense_date || todayStr(),
      vendor: form.vendor.trim() || null,
      description: form.description.trim() || null,
    };
    let receipt_url = (sheet !== 'new' && sheet?.receipt_url) || null;
    if (receiptFile) {
      const extByMime = { 'image/jpeg':'jpg', 'image/png':'png', 'image/heic':'heic', 'image/heif':'heif' };
      const ext = extByMime[receiptFile.type] || 'jpg';
      const path = `${orgId}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('expense-receipts')
        .upload(path, receiptFile, { upsert: false, contentType: receiptFile.type });
      if (upErr) { toast.error('Receipt upload failed: ' + upErr.message); setSaving(false); return; }
      const { data: pub } = supabase.storage.from('expense-receipts').getPublicUrl(path);
      receipt_url = pub?.publicUrl || null;
    }
    payload.receipt_url = receipt_url;

    if (sheet === 'new') {
      const status = isCrew(role) ? 'pending' : 'approved';
      const { data: inserted } = await supabase.from('expenses').insert({
        ...payload, owner_id: user.id, org_id: orgId,
        approval_status: status,
        approved_by: status === 'approved' ? user.id : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      }).select('id').single();
      // Crew submission → ping the office (foreman + this crew's
      // supervisor) on both web and native. Office-self insertion
      // is auto-approved so it skips the push.
      if (status === 'pending' && inserted?.id) {
        firePushEvent('expense_submitted', inserted.id);
      }
    } else {
      await supabase.from('expenses').update(payload).eq('id', sheet.id);
    }
    await loadAll();
    setReceiptFile(null);
    setReceiptPreview(null);
    setSaving(false);
    setSheet(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(e => e.filter(x => x.id !== id));
  };

  // Crew only sees their own expenses; office sees everyone's.
  const ownFiltered = isCrew(role) ? expenses.filter(e => e.owner_id === user?.id) : expenses;
  const visible = ownFiltered.filter(e => filter === 'all' || e.category === filter);
  const totalAll      = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalFiltered = visible.reduce((s, e) => s + Number(e.amount || 0), 0);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/expenses"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/expenses"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:18}}>
          <div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'0',color:'#f0f4ff'}}>EXPENSES</h1>
            <div style={{fontSize:13,color:'#7a8db0',marginTop:4}}>
              Total <strong style={{color:'#f26060'}}>{fmt$(totalAll)}</strong>{filter!=='all' && <> · {catMeta(filter).label}: <strong style={{color:catMeta(filter).color}}>{fmt$(totalFiltered)}</strong></>}
            </div>
          </div>
          <button data-tour="expenses-header" onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>+ NEW EXPENSE</button>
        </div>

        <SubNav active="/expenses" items={[
          { route:'/expenses', label:'Expenses' },
          { route:'/mileage',  label:'Mileage' },
        ]}/>

        <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:4}}>
          {[{ key:'all', label:'All' }, ...CATEGORIES].map(opt => (
            <button key={opt.key} onClick={() => setFilter(opt.key)}
              style={{
                background: filter===opt.key ? '#2e3f60' : 'transparent',
                border:'1px solid #2e3f60', borderRadius:999, color:'#f0f4ff',
                padding:'6px 12px', fontSize:12, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer',
              }}>{opt.label}</button>
          ))}
        </div>

        <CategoryBreakdown expenses={ownFiltered}/>

        {visible.length === 0 && (
          <div style={{textAlign:'center',padding:'60px 24px',color:'#7a8db0'}}>
            <div style={{fontSize:36,marginBottom:8}}>🧾</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>
              {expenses.length === 0 ? 'No Expenses Yet' : 'Nothing in this filter'}
            </div>
            <div style={{fontSize:13}}>{expenses.length === 0 ? 'Tap + NEW EXPENSE to log materials, fuel, equipment, etc.' : 'Try a different filter.'}</div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          {visible.map(e => {
            const c = catMeta(e.category);
            const status = e.approval_status || 'approved';
            const statusC = status === 'approved' ? '#2edf87' : status === 'pending' ? '#fbbf24' : '#f26060';
            const showStatus = status !== 'approved';
            const partialDeductible = c.deductible < 100;
            return (
              <div key={e.id} onClick={() => openEdit(e)}
                style={{background:'#1e2a42',border:'1px solid '+(showStatus?statusC+'66':'#2e3f60'),borderRadius:10,padding:'12px 14px',cursor:'pointer',display:'flex',gap:10}}>
                {e.receipt_url && (
                  <img src={e.receipt_url} alt="" style={{width:48,height:48,objectFit:'cover',borderRadius:8,border:'1px solid #2e3f60',flexShrink:0}}/>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0,flex:1}}>
                      <span style={{background:c.color+'22',color:c.color,border:'1px solid '+c.color+'66',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',whiteSpace:'nowrap'}}>{c.label.toUpperCase()}</span>
                      {showStatus && <span style={{background:statusC+'22',color:statusC,border:'1px solid '+statusC+'66',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',whiteSpace:'nowrap'}}>{status.toUpperCase()}</span>}
                      <span style={{fontSize:14,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.vendor || e.description || '(no vendor)'}</span>
                    </div>
                    <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,color:'#f26060',whiteSpace:'nowrap'}}>{fmt$(e.amount || 0)}</span>
                    <button onClick={ev => { ev.stopPropagation(); del(e.id); }} style={{background:'transparent',border:'none',color:'#f26060',cursor:'pointer',fontSize:14,fontWeight:700,padding:'8px 10px',minWidth:36,minHeight:36,borderRadius:6}}>✕</button>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#7a8db0',gap:8,flexWrap:'wrap'}}>
                    <span>{fmtDate(e.expense_date)}{e.job_id ? ` · Job: ${jobTitle(e.job_id)}` : ' · Overhead'}</span>
                    {partialDeductible
                      ? <span style={{color:'#fbbf24',fontWeight:700,letterSpacing:'.04em',fontSize:10,textTransform:'uppercase'}}>● {c.deductible}% deductible</span>
                      : <span style={{color:'#2edf87',fontWeight:600,letterSpacing:'.04em',fontSize:10,textTransform:'uppercase'}}>● Deductible</span>}
                  </div>
                  {status === 'rejected' && e.rejected_reason && (
                    <div style={{marginTop:6,fontSize:11,color:'#f26060'}}>Rejected: {e.rejected_reason}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {sheet && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>{sheet==='new'?'NEW EXPENSE':'EDIT EXPENSE'}</div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Category</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                {CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => setForm(p => ({...p, category:c.key}))}
                    style={{
                      background: form.category===c.key ? c.color+'22' : 'transparent',
                      border:'1.5px solid '+(form.category===c.key ? c.color : '#2e3f60'),
                      color: form.category===c.key ? c.color : '#c8d4ee',
                      borderRadius:8, padding:'8px 4px', fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.02em',
                    }}>{c.label}</button>
                ))}
              </div>
            </div>

            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Amount ($)</div>
                <input style={inputStyle} type="number" inputMode="decimal" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(p => ({...p, amount:e.target.value}))}/>
              </div>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Date</div>
                <input style={inputStyle} type="date" value={form.expense_date}
                  onChange={e => setForm(p => ({...p, expense_date:e.target.value}))}/>
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Vendor</div>
              <input style={inputStyle} type="text" placeholder="Home Depot, Shell, etc."
                value={form.vendor} onChange={e => setForm(p => ({...p, vendor:e.target.value}))}/>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Job (optional)</div>
              <select value={form.job_id} onChange={e => setForm(p => ({...p, job_id:e.target.value}))} style={inputStyle}>
                <option value="">— Overhead / no job —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Description</div>
              <textarea maxLength={2000} value={form.description}
                onChange={e => setForm(p => ({...p, description:e.target.value}))}
                placeholder="What was purchased / receipt #"
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Receipt photo (optional)</div>
              <div style={{display:'flex',gap:10,alignItems:'center'}}>
                <div style={{width:64,height:64,borderRadius:10,background:'#111827',border:'1.5px solid #2e3f60',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                  {receiptPreview
                    ? <img src={receiptPreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    : <div style={{fontSize:10,color:'#7a8db0',textAlign:'center',padding:4}}>No photo</div>}
                </div>
                <label style={{flex:1}}>
                  <input type="file" accept={ACCEPT_ATTR} capture="environment" onChange={pickReceipt} style={{display:'none'}}/>
                  <div style={{background:'transparent',border:'1.5px solid #2e3f60',borderRadius:10,padding:'10px 12px',color:'#c8d4ee',fontSize:13,cursor:'pointer',textAlign:'center'}}>
                    {receiptPreview ? 'Replace photo' : 'Snap or upload receipt'}
                  </div>
                </label>
              </div>
              <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>JPG/PNG/HEIC, under 10 MB. Use your phone's camera on mobile.</div>
            </div>

            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving || form.amount === '' || isNaN(Number(form.amount))}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving ? 'Saving...' : 'Save Expense'}
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

function CategoryBreakdown({ expenses }) {
  if (!expenses || expenses.length === 0) return null;
  const totals = {};
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const grand = entries.reduce((s, [,v]) => s + v, 0);
  const max = entries[0][1];

  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px',marginBottom:14}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',fontWeight:700}}>WHERE THE MONEY IS GOING</div>
        <div style={{fontSize:11,color:'#7a8db0'}}>{fmt$(grand)} total</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {entries.map(([key, val]) => {
          const c = catMeta(key);
          const pct = (val / grand) * 100;
          const barPct = (val / max) * 100;
          return (
            <div key={key}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',fontSize:11,marginBottom:2}}>
                <span style={{color:'#c8d4ee',fontWeight:600}}>{c.label}{c.deductible < 100 && <span style={{color:'#fbbf24',marginLeft:6}}>({c.deductible}% ded.)</span>}</span>
                <span style={{color:'#f0f4ff',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{fmt$(val)} <span style={{color:'#7a8db0',fontSize:10}}>· {pct.toFixed(0)}%</span></span>
              </div>
              <div style={{height:8,background:'#111827',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${barPct}%`,background:c.color,opacity:0.85}}/>
              </div>
            </div>
          );
        })}
      </div>
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
