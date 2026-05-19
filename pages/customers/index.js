import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';

export default function Customers() {
const router = useRouter();
const [user, setUser] = useState(null);
const { orgId, loading: orgLoading } = useOrg(user);
const [customers, setCustomers] = useState([]);
const [loading, setLoading] = useState(true);
const [sheet, setSheet] = useState(null);
const [saving, setSaving] = useState(false);
const [form, setForm] = useState({
name:'', phone:'', email:'', address:'', notes:''
});

const loadCustomers = async () => {
setLoading(true);
const { data } = await supabase.from('customers').select('*').eq('org_id', orgId).order('name');
setCustomers(data || []);
setLoading(false);
};

useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => {
if (!session) { router.push('/login'); return; }
setUser(session.user);
});
}, []);

useEffect(() => {
if (orgId) loadCustomers();
else if (user && !orgLoading) router.push('/onboarding');
}, [orgId, orgLoading]);

useRefetchOnFocus(loadCustomers, !!orgId);

const openNew = () => {
setForm({ name:'', phone:'', email:'', address:'', notes:'' });
setSheet('new');
};

const openEdit = (c) => {
setForm({ ...c });
setSheet(c);
};

const save = async () => {
if (!form.name.trim() || !orgId) return;
setSaving(true);
if (sheet === 'new') {
await supabase.from('customers').insert({ ...form, owner_id: user.id, org_id: orgId });
} else {
await supabase.from('customers').update(form).eq('id', sheet.id);
}
await loadCustomers();
setSaving(false);
setSheet(null);
};

const del = async (id) => {
if (!confirm('Delete this customer?')) return;
await supabase.from('customers').delete().eq('id', id);
setCustomers(c => c.filter(x => x.id !== id));
};

if (loading) return (
<div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>Loading...</div>
);

return (
<div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
<div style={{background:'#1a2236',borderBottom:'1.5px solid #2e3f60',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50}}>
<button onClick={() => router.push('/dashboard')} style={{background:'none',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:20,padding:'0 4px'}}>←</button>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',flex:1}}>CUSTOMERS</div>
<button onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:13}}>+ New</button>
</div>

{customers.length === 0 && (
<div style={{textAlign:'center',padding:'60px 24px',color:'#7a8db0'}}>
<div style={{fontSize:36,marginBottom:8}}>👤</div>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>No Customers Yet</div>
<div style={{fontSize:13}}>Tap + New to add your first customer.</div>
</div>
)}

{customers.map(c => (
<div key={c.id} style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,margin:'6px 16px',padding:'13px 14px',cursor:'pointer'}} onClick={() => openEdit(c)}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff'}}>{c.name}</div>
<button onClick={e => { e.stopPropagation(); del(c.id); }} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:12,fontWeight:700,padding:'2px 6px'}}>✕</button>
</div>
{c.phone && <div style={{fontSize:12,color:'#c8d4ee'}}>{c.phone}</div>}
{c.email && <div style={{fontSize:12,color:'#7a8db0'}}>{c.email}</div>}
{c.address && <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{c.address}</div>}
{c.notes && <div style={{fontSize:11,color:'#fbbf24',marginTop:3}}>Note: {c.notes}</div>}
</div>
))}

{sheet && (
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && setSheet(null)}>
<div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
<div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>{sheet==='new'?'NEW CUSTOMER':'EDIT CUSTOMER'}</div>

{[
{ label:'Name', key:'name', type:'text', placeholder:'Full name', required:true },
{ label:'Phone', key:'phone', type:'tel', placeholder:'512-555-0100' },
{ label:'Email', key:'email', type:'email', placeholder:'email@example.com' },
{ label:'Address', key:'address', type:'text', placeholder:'Street, City, State ZIP' },
].map(field => (
<div key={field.key} style={{margin:'10px 16px'}}>
<div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>{field.label}</div>
<input type={field.type} placeholder={field.placeholder} value={form[field.key]}
onChange={e => setForm(p=>({...p,[field.key]:e.target.value}))}
style={{width:'100%',background:'#111827',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit'}}/>
</div>
))}

<div style={{margin:'10px 16px'}}>
<div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Notes</div>
<textarea value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder='Gate code, dogs, access notes...'
style={{width:'100%',background:'#111827',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit',resize:'vertical',minHeight:72}}/>
</div>

<div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
<button onClick={save} disabled={saving||!form.name.trim()}
style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
{saving?'Saving...':'Save Customer'}
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