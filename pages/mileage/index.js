import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isCrew } from '../../lib/role';
import { fmt$, fmtDate, todayStr, IRS_RATE } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import SubNav from '../../components/SubNav';

const PURPOSES = [
  { key:'business', label:'Business' },
  { key:'commute',  label:'Commute' },
  { key:'personal', label:'Personal' },
  { key:'other',    label:'Other' },
];

const TRIP_KEY = 'myforeman_trip_in_progress';

export default function Mileage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [trips, setTrips] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTrip, setActiveTrip] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const canSeeDeduction = role === 'owner' || role === 'admin';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
    try { const t = JSON.parse(localStorage.getItem(TRIP_KEY) || 'null'); if (t) setActiveTrip(t); } catch {}
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: t }, { data: j }] = await Promise.all([
      supabase.from('mileage_logs').select('*').eq('org_id', orgId).order('log_date', { ascending:false }).limit(200),
      supabase.from('jobs').select('id,title').eq('org_id', orgId).order('scheduled_date', { ascending:false }).limit(100),
    ]);
    setTrips(t || []);
    setJobs(j || []);
    setLoading(false);
  };

  useEffect(() => {
    if (orgId) loadAll();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  useRefetchOnFocus(loadAll, !!orgId);

  const jobTitle = id => jobs.find(j => j.id === id)?.title || '—';

  const startTrip = () => {
    setGpsError('');
    if (!navigator.geolocation) { setGpsError('Geolocation not available in this browser. Use manual entry.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const t = { lat: pos.coords.latitude, lng: pos.coords.longitude, started_at: Date.now() };
        setActiveTrip(t);
        localStorage.setItem(TRIP_KEY, JSON.stringify(t));
      },
      err => setGpsError(err.message || 'Could not get location. Allow GPS access and try again.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const endTrip = () => {
    setGpsError('');
    if (!activeTrip) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const miles = haversine(activeTrip.lat, activeTrip.lng, pos.coords.latitude, pos.coords.longitude);
        setForm({
          log_date: todayStr(),
          miles: miles.toFixed(2),
          purpose: 'business',
          job_id: '',
          notes: '',
          method: 'gps',
          start_lat: activeTrip.lat,
          start_lng: activeTrip.lng,
          end_lat: pos.coords.latitude,
          end_lng: pos.coords.longitude,
        });
        setSheet('save-trip');
      },
      err => setGpsError(err.message || 'Could not get location for end-of-trip. Try manual entry.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const cancelTrip = () => {
    setActiveTrip(null);
    localStorage.removeItem(TRIP_KEY);
  };

  const openManual = () => {
    setForm({ log_date: todayStr(), miles: '', purpose: 'business', job_id: '', notes: '', method: 'manual' });
    setSheet('manual');
  };

  const openEdit = (t) => {
    setForm({
      log_date: t.log_date,
      miles: String(t.miles ?? ''),
      purpose: t.purpose,
      job_id: t.job_id || '',
      notes: t.notes || '',
      method: t.method || 'manual',
    });
    setSheet(t);
  };

  const save = async () => {
    if (!form || !orgId) return;
    const miles = Number(form.miles);
    if (isNaN(miles) || miles <= 0) { alert('Enter miles greater than 0.'); return; }
    setSaving(true);
    const payload = {
      log_date: form.log_date || todayStr(),
      miles,
      purpose: form.purpose,
      job_id: form.job_id || null,
      notes: form.notes || null,
      method: form.method || 'manual',
      start_lat: form.start_lat ?? null,
      start_lng: form.start_lng ?? null,
      end_lat:   form.end_lat   ?? null,
      end_lng:   form.end_lng   ?? null,
    };
    if (sheet === 'manual' || sheet === 'save-trip') {
      const status = isCrew(role) ? 'pending' : 'approved';
      await supabase.from('mileage_logs').insert({
        ...payload, org_id: orgId, user_id: user.id,
        approval_status: status,
        approved_by: status === 'approved' ? user.id : null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      });
      if (sheet === 'save-trip') cancelTrip();
    } else {
      await supabase.from('mileage_logs').update(payload).eq('id', sheet.id);
    }
    await loadAll();
    setSaving(false);
    setSheet(null);
    setForm(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this trip?')) return;
    await supabase.from('mileage_logs').delete().eq('id', id);
    setTrips(prev => prev.filter(t => t.id !== id));
  };

  // Aggregates (own trips only for non-foreman, all org trips for foreman)
  const visibleTrips = canSeeDeduction ? trips : trips.filter(t => t.user_id === user?.id);
  const totalMiles = visibleTrips.reduce((s, t) => s + Number(t.miles || 0), 0);
  const businessMiles = visibleTrips.filter(t => t.purpose === 'business').reduce((s, t) => s + Number(t.miles || 0), 0);
  const deduction = businessMiles * IRS_RATE;
  const year = new Date().getFullYear();

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/mileage"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/mileage"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:18}}>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Mileage</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>MILEAGE</h1>
          </div>
        </div>

        <SubNav active="/mileage" items={[
          { route:'/expenses', label:'Expenses' },
          { route:'/mileage',  label:'Mileage' },
        ]}/>

        {/* Summary card */}
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'18px 18px',marginBottom:14,display:'grid',gridTemplateColumns: canSeeDeduction ? '1fr 1fr' : '1fr',gap:18}}>
          <div>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Total Miles ({year})</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.02em',lineHeight:1,color:'#4f9eff'}}>{totalMiles.toFixed(1)}</div>
            <div style={{marginTop:6,fontSize:12,color:'#7a8db0'}}>{businessMiles.toFixed(1)} business miles</div>
          </div>
          {canSeeDeduction && (
            <div>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>IRS Deduction Est.</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.02em',lineHeight:1,color:'#2edf87'}}>{fmt$(deduction)}</div>
              <div style={{marginTop:6,fontSize:12,color:'#7a8db0'}}>at {(IRS_RATE).toFixed(2)} $/mi · business only</div>
            </div>
          )}
        </div>

        {/* Active trip / start */}
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'18px 18px',marginBottom:18}}>
          {!activeTrip ? (
            <>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Log a trip</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button onClick={startTrip} style={{flex:'1 1 200px',background:'#2edf87',color:'#0d1726',border:'none',borderRadius:10,padding:'14px 18px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',fontWeight:700,cursor:'pointer'}}>
                  ● START TRIP (GPS)
                </button>
                <button onClick={openManual} style={{flex:'1 1 200px',background:'transparent',border:'1.5px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'14px 18px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',fontWeight:700,cursor:'pointer'}}>
                  MANUAL ENTRY
                </button>
              </div>
              {gpsError && <div style={{marginTop:10,fontSize:12,color:'#f26060'}}>{gpsError}</div>}
            </>
          ) : (
            <>
              <div style={{fontSize:11,color:'#2edf87',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>● Trip in progress</div>
              <div style={{fontSize:13,color:'#c8d4ee',marginBottom:10}}>
                Started {new Date(activeTrip.started_at).toLocaleTimeString()} · {activeTrip.lat.toFixed(4)}, {activeTrip.lng.toFixed(4)}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button onClick={endTrip} style={{flex:'1 1 200px',background:'#f26060',color:'#fff',border:'none',borderRadius:10,padding:'14px 18px',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',fontWeight:700,cursor:'pointer'}}>
                  ■ END TRIP
                </button>
                <button onClick={cancelTrip} style={{flex:'1 1 120px',background:'transparent',border:'1.5px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'14px 18px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  CANCEL
                </button>
              </div>
              {gpsError && <div style={{marginTop:10,fontSize:12,color:'#f26060'}}>{gpsError}</div>}
              <div style={{marginTop:10,fontSize:11,color:'#7a8db0'}}>GPS distance is straight-line, not road distance. Edit miles before saving if needed.</div>
            </>
          )}
        </div>

        {/* Trip list */}
        {visibleTrips.length === 0 ? (
          <div style={{textAlign:'center',padding:'60px 24px',color:'#7a8db0'}}>
            <div style={{fontSize:36,marginBottom:8}}>🚚</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>No Trips Yet</div>
            <div style={{fontSize:13}}>Start a GPS trip or log manually to get going.</div>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6}}>
            {visibleTrips.map(t => {
              const isMine = t.user_id === user?.id;
              return (
                <div key={t.id} onClick={isMine ? () => openEdit(t) : undefined}
                  style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 14px',cursor:isMine?'pointer':'default'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                      <span style={{fontSize:10,letterSpacing:'.06em',padding:'2px 6px',background:t.purpose==='business'?'#2edf8722':'#7a8db022',color:t.purpose==='business'?'#2edf87':'#7a8db0',border:`1px solid ${t.purpose==='business'?'#2edf8766':'#7a8db066'}`,borderRadius:4,fontWeight:700,textTransform:'uppercase',whiteSpace:'nowrap'}}>
                        {t.purpose}
                      </span>
                      <span style={{fontSize:13,color:'#c8d4ee'}}>{fmtDate(t.log_date)}</span>
                      {t.job_id && <span style={{fontSize:12,color:'#7a8db0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>· {jobTitle(t.job_id)}</span>}
                    </div>
                    <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,color:'#4f9eff',whiteSpace:'nowrap'}}>{Number(t.miles).toFixed(1)} mi</span>
                    {isMine && <button onClick={e => { e.stopPropagation(); del(t.id); }} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:11,fontWeight:700,padding:'2px 4px'}}>✕</button>}
                  </div>
                  {t.notes && <div style={{fontSize:11,color:'#7a8db0',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.notes}</div>}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {sheet && form && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && (setSheet(null), setForm(null))}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>
              {sheet === 'save-trip' ? 'SAVE TRIP' : (sheet === 'manual' ? 'NEW TRIP' : 'EDIT TRIP')}
            </div>

            <div style={{display:'flex',gap:8,margin:'10px 16px'}}>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Date</div>
                <input type="date" value={form.log_date} onChange={e => setForm(p => ({...p, log_date:e.target.value}))} style={inputStyle}/>
              </div>
              <div style={{flex:1}}>
                <div style={fieldLabel}>Miles</div>
                <input type="number" inputMode="decimal" step="0.01" value={form.miles} onChange={e => setForm(p => ({...p, miles:e.target.value}))} style={inputStyle}/>
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Purpose</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
                {PURPOSES.map(p => (
                  <button key={p.key} onClick={() => setForm(prev => ({...prev, purpose:p.key}))}
                    style={{
                      background: form.purpose===p.key ? '#4f9eff22' : 'transparent',
                      border: '1.5px solid ' + (form.purpose===p.key ? '#4f9eff' : '#2e3f60'),
                      color: form.purpose===p.key ? '#4f9eff' : '#c8d4ee',
                      borderRadius:8, padding:'8px 4px', fontSize:11, fontWeight:700, cursor:'pointer',
                    }}>{p.label}</button>
                ))}
              </div>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Job (optional)</div>
              <select value={form.job_id} onChange={e => setForm(p => ({...p, job_id:e.target.value}))} style={inputStyle}>
                <option value="">— none —</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={fieldLabel}>Notes</div>
              <textarea maxLength={2000} value={form.notes} onChange={e => setForm(p => ({...p, notes:e.target.value}))}
                placeholder="Where you went, why, anything memorable..."
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
              <button onClick={save} disabled={saving}
                style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                {saving ? 'Saving...' : 'Save Trip'}
              </button>
              <button onClick={() => { setSheet(null); setForm(null); }}
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

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // miles
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
const fieldLabel = {
  fontSize:11, fontWeight:600, letterSpacing:'.08em',
  textTransform:'uppercase', color:'#7a8db0', marginBottom:5,
};
