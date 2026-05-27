// Service catalog (price book). Foreman-managed list of common
// services with default unit prices. Used as autofill source for
// quote line items.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { isForeman } from '../../lib/role';
import { fmt$ } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { FullPageLoading } from '../../components/PageStates';

const UNITS = ['each','hour','sq ft','linear ft','day','visit','job'];

export default function Services() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // form or null
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase.from('services').select('*').eq('org_id', orgId).order('name');
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (orgId) load();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  const openNew = () => setEditing({ id:null, name:'', description:'', unit_price:'', unit:'each', active:true });
  const openEdit = (s) => setEditing({ ...s, unit_price: s.unit_price ?? '' });

  const save = async () => {
    if (!editing.name?.trim()) return;
    setSaving(true);
    const payload = {
      org_id: orgId,
      name: editing.name.trim(),
      description: editing.description || null,
      unit_price: Number(editing.unit_price) || 0,
      unit: editing.unit || 'each',
      active: !!editing.active,
    };
    if (editing.id) {
      await supabase.from('services').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('services').insert(payload);
    }
    setSaving(false);
    setEditing(null);
    await load();
  };
  const remove = async (id) => {
    if (!confirm('Remove this service from the catalog?')) return;
    await supabase.from('services').delete().eq('id', id);
    await load();
  };

  if (loading) return (
    <FullPageLoading/>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/services"/>

      <main style={{maxWidth:760,margin:'0 auto',padding:'24px 16px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:14}}>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Price book</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>SERVICES</h1>
          </div>
          {isForeman(role) && (
            <button onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,fontSize:13,letterSpacing:'.04em',cursor:'pointer'}}>+ NEW</button>
          )}
        </div>

        <div style={{fontSize:13,color:'#c8d4ee',marginBottom:16,lineHeight:1.5}}>
          Common services you offer. When building a quote, pick from this list to autofill the price.
        </div>

        <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,overflow:'hidden'}}>
          {items.length === 0 ? (
            <div style={{padding:'32px 18px',textAlign:'center',color:'#7a8db0',fontSize:13}}>
              No services yet. Add common ones like "Lawn mow", "Service call", "Drywall repair" so you don't retype prices on every quote.
            </div>
          ) : items.map(s => (
            <div key={s.id} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderTop:'1px solid #2e3f60'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:s.active ? '#f0f4ff' : '#7a8db0'}}>
                  {s.name}
                  {!s.active && <span style={{marginLeft:8,fontSize:10,color:'#7a8db0',letterSpacing:'.06em',fontWeight:700}}>INACTIVE</span>}
                </div>
                {s.description && <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{s.description}</div>}
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#c8d4ee',whiteSpace:'nowrap'}}>{fmt$(s.unit_price)} <span style={{fontSize:11,color:'#7a8db0'}}>/ {s.unit}</span></div>
              {isForeman(role) && (
                <>
                  <button onClick={() => openEdit(s)} style={smallBtn}>Edit</button>
                  <button onClick={() => remove(s.id)} style={{...smallBtn,color:'#f26060'}}>×</button>
                </>
              )}
            </div>
          ))}
        </div>
      </main>

      {editing && (
        <div onClick={e => e.target === e.currentTarget && setEditing(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px'}}>{editing.id ? 'EDIT SERVICE' : 'NEW SERVICE'}</div>
            <Field label="Name *"  value={editing.name}        onChange={v => setEditing(p => ({...p, name:v}))} placeholder="Lawn mowing"/>
            <Field label="Description" value={editing.description || ''} onChange={v => setEditing(p => ({...p, description:v}))} placeholder="Mow, edge, blow."/>
            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Unit price</div>
                <input type="number" inputMode="decimal" value={editing.unit_price}
                  onChange={e => setEditing(p => ({...p, unit_price:e.target.value}))}
                  placeholder="0.00" style={inputStyle}/>
              </div>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Per</div>
                <select value={editing.unit} onChange={e => setEditing(p => ({...p, unit:e.target.value}))} style={inputStyle}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{margin:'10px 16px',display:'flex',alignItems:'center',gap:8}}>
              <input type="checkbox" id="active_chk" checked={!!editing.active}
                onChange={e => setEditing(p => ({...p, active:e.target.checked}))}/>
              <label htmlFor="active_chk" style={{fontSize:13,color:'#c8d4ee'}}>Active (show in catalog picker)</label>
            </div>
            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving || !editing.name?.trim()}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.5:1}}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(null)}
                style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'13px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{margin:'10px 16px'}}>
      <div style={fieldLabel}>{label}</div>
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle}/>
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
const fieldLabel = { fontSize:11, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', color:'#7a8db0', marginBottom:5 };
const smallBtn = {
  background:'transparent', border:'1px solid #2e3f60', borderRadius:7,
  color:'#c8d4ee', padding:'5px 10px', fontSize:11, fontWeight:600,
  letterSpacing:'.04em', cursor:'pointer', fontFamily:'inherit',
};
