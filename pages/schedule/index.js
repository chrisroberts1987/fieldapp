// Week / day calendar view. Office roles (foreman + supervisor) see
// every scheduled job — crew sees only their own assignments. Jobs
// are rendered as colored chips per day; clicking a chip jumps to
// /jobs?open=<id> which deep-links into the existing job sheet so we
// don't have to re-implement editing here.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isOffice, isCrew } from '../../lib/role';
import { fmt$ } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { FullPageLoading } from '../../components/PageStates';

const STATUS_COLOR = {
  pending:     '#a855f7',
  scheduled:   '#54d4f8',
  in_progress: '#fbbf24',
  completed:   '#2edf87',
  cancelled:   '#7a8db0',
};

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function isoDay(d) { return d.toISOString().slice(0,10); }
function sameDay(a, b) { return a.toDateString() === b.toDateString(); }
function dayCount(j) {
  if (!j.scheduled_end_date) return 1;
  const ms = new Date(j.scheduled_end_date) - new Date(j.scheduled_date);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export default function Schedule() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [members, setMembers] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [view, setView] = useState('week'); // 'week' | 'day'
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const weekStart = startOfWeek(anchor);
    const weekEnd   = addDays(weekStart, 7);
    const [{ data: j }, { data: c }, { data: m }, { data: rec }] = await Promise.all([
      // Pull every job whose window OVERLAPS the visible range,
      // not just ones starting in it. A 5-day job that started
      // yesterday should still show today.
      supabase.from('jobs')
        .select('id, title, status, customer_id, assigned_to_user_id, scheduled_date, scheduled_end_date, scheduled_time, price')
        .eq('org_id', orgId)
        .lt('scheduled_date', isoDay(weekEnd))
        .or(`scheduled_end_date.gte.${isoDay(weekStart)},and(scheduled_end_date.is.null,scheduled_date.gte.${isoDay(weekStart)})`)
        .order('scheduled_date'),
      supabase.from('customers').select('id, name').eq('org_id', orgId),
      supabase.rpc('list_org_members', { p_org_id: orgId }),
      supabase.from('recurring_jobs').select('*').eq('org_id', orgId).eq('active', true),
    ]);
    setJobs(j || []);
    setCustomers(c || []);
    setMembers(Array.isArray(m) ? m : []);
    setRecurring(rec || []);
    setLoading(false);
  };

  // Project recurring plans forward into the visible window. Cron will
  // materialize each one on its next_run_date, but we want the user to
  // see future occurrences before they exist as real jobs. These are
  // rendered as ghost chips with a RECURRING tag.
  function projectRecurring(plan, fromDate, toDate) {
    const out = [];
    const advance = (d) => {
      const x = new Date(d);
      switch (plan.cadence) {
        case 'weekly':    x.setDate(x.getDate() + 7);  break;
        case 'biweekly':  x.setDate(x.getDate() + 14); break;
        case 'monthly':   x.setMonth(x.getMonth() + 1); break;
        case 'quarterly': x.setMonth(x.getMonth() + 3); break;
        case 'yearly':    x.setFullYear(x.getFullYear() + 1); break;
      }
      return x;
    };
    let cur = new Date(plan.next_run_date);
    let safety = 0;
    while (cur < toDate && safety < 200) {
      if (cur >= fromDate) out.push(new Date(cur));
      cur = advance(cur);
      safety++;
    }
    return out;
  }

  useEffect(() => {
    if (orgId) load();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, anchor, orgLoading]);

  useRefetchOnFocus(load, !!orgId);

  const visibleJobs = useMemo(() => {
    if (!user) return [];
    if (isCrew(role)) return jobs.filter(j => j.assigned_to_user_id === user.id);
    return jobs;
  }, [jobs, role, user]);

  const customerName = id => customers.find(c => c.id === id)?.name || 'No customer';
  const assigneeShortName = (uid) => {
    if (!uid) return null;
    const m = members.find(x => x.user_id === uid);
    if (!m) return null;
    return (m.email || '').split('@')[0];
  };

  const goPrev = () => setAnchor(addDays(anchor, view === 'week' ? -7 : -1));
  const goNext = () => setAnchor(addDays(anchor, view === 'week' ? 7  :  1));
  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d); };
  const openJob = (id) => router.push(`/jobs?open=${id}`);

  // Build the array of days to render. Week = 7 days from sunday;
  // Day view = just the anchor.
  const days = view === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
    : [anchor];

  const todayObj = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  const periodLabel = view === 'week'
    ? `${startOfWeek(anchor).toLocaleDateString(undefined, { month:'short', day:'numeric' })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })}`
    : anchor.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  if (loading) return (
    <FullPageLoading/>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/schedule"/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',margin:'24px 16px 14px'}}>
        <div>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Schedule</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>{periodLabel.toUpperCase()}</h1>
        </div>
        {isOffice(role) && (
          <button onClick={() => router.push('/jobs')}
            style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>
            + NEW JOB
          </button>
        )}
      </div>

      <div style={{display:'flex',gap:8,padding:'0 12px 16px',alignItems:'center',flexWrap:'wrap'}}>
        <button onClick={goPrev}  style={navBtn}>‹</button>
        <button onClick={goToday} style={{...navBtn,padding:'8px 14px',fontSize:12,letterSpacing:'.05em',fontWeight:700}}>TODAY</button>
        <button onClick={goNext}  style={navBtn}>›</button>
        <div style={{flex:1}}/>
        <div style={{display:'flex',background:'#0f1626',border:'1px solid #2e3f60',borderRadius:8,overflow:'hidden'}}>
          {['week','day'].map(k => (
            <button key={k} onClick={() => setView(k)}
              style={{background: view===k ? '#2e3f60' : 'transparent',color:'#f0f4ff',border:'none',padding:'8px 14px',fontSize:12,fontWeight:700,letterSpacing:'.05em',cursor:'pointer',textTransform:'uppercase'}}>
              {k}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:'0 12px',display:'grid',gap:8,gridTemplateColumns: view === 'week' ? 'repeat(7, minmax(140px, 1fr))' : '1fr',overflowX: view === 'week' ? 'auto' : 'visible'}}>
        {days.map(day => {
          const iso = isoDay(day);
          // A job shows on this day if (single-day && scheduled_date == iso)
          // OR (multi-day && start <= iso <= end).
          const dayJobs = visibleJobs.filter(j => {
            const start = j.scheduled_date;
            const end   = j.scheduled_end_date || j.scheduled_date;
            return start && start <= iso && iso <= end;
          }).map(j => ({
            ...j,
            // Annotate for the chip renderer.
            isStart: j.scheduled_date === iso,
            isEnd:   (j.scheduled_end_date || j.scheduled_date) === iso,
            isMultiDay: !!j.scheduled_end_date && j.scheduled_end_date !== j.scheduled_date,
          }))
            .sort((a,b) => (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99'));
          // Ghost preview rows for recurring plans that fall on this
          // day but haven't been materialized into a real job yet.
          // Office-only — crew shouldn't see plans for unassigned work.
          const dayStart = new Date(day);
          const dayEnd   = addDays(day, 1);
          const ghostRecurring = isOffice(role)
            ? recurring.flatMap(plan => {
                const occurrences = projectRecurring(plan, dayStart, dayEnd);
                return occurrences.map(occ => ({
                  id: 'rec-' + plan.id + '-' + isoDay(occ),
                  plan, occ,
                }));
              })
            : [];
          const isToday = sameDay(day, todayObj);
          return (
            <div key={iso}
              style={{
                background:'#1a2236',
                border: isToday ? '1px solid #4f9eff' : '1px solid #2e3f60',
                borderRadius:10,
                padding:10,
                minHeight: view === 'week' ? 220 : 320,
                display:'flex',
                flexDirection:'column',
                gap:8,
              }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:'.16em',fontWeight:700,color:isToday ? '#4f9eff' : '#7a8db0',textTransform:'uppercase'}}>{WEEKDAYS[day.getDay()]}</div>
                  <div style={{fontSize:18,fontWeight:700,color:isToday ? '#4f9eff' : '#f0f4ff'}}>{day.getDate()}</div>
                </div>
                <div style={{fontSize:10,color:'#7a8db0',fontWeight:600}}>{dayJobs.length || ''}</div>
              </div>

              {dayJobs.length === 0 && ghostRecurring.length === 0 && (
                <div style={{fontSize:11,color:'#5a6c8c',fontStyle:'italic',marginTop:'auto',marginBottom:'auto',textAlign:'center'}}>No jobs</div>
              )}

              {ghostRecurring.map(g => {
                const color = '#a855f7';
                return (
                  <div key={g.id}
                    style={{
                      background: color + '0a',
                      border: '1px dashed ' + color + '66',
                      borderLeftWidth: 3,
                      borderLeftStyle: 'solid',
                      borderLeftColor: color,
                      borderRadius: 6,
                      padding: '8px 10px',
                      opacity: 0.85,
                    }}
                    title="Recurring plan — a real job will be created automatically on this date.">
                    <div style={{fontSize:10,color:color,fontWeight:700,letterSpacing:'.06em'}}>🔁 RECURRING</div>
                    <div style={{fontSize:13,fontWeight:600,lineHeight:1.25,color:'#f0f4ff'}}>{g.plan.title}</div>
                    <div style={{fontSize:11,color:'#a8b8d8',marginTop:2}}>{customerName(g.plan.customer_id)}</div>
                    {g.plan.price ? (
                      <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{fmt$(g.plan.price)}</div>
                    ) : null}
                  </div>
                );
              })}

              {dayJobs.map(j => {
                const color = STATUS_COLOR[j.status] || '#7a8db0';
                const who = assigneeShortName(j.assigned_to_user_id);
                // For middle days of a multi-day job, render a thin
                // continuation bar so the foreman can see "this job
                // is in progress here" without spamming full chip
                // info on every day. Start day gets full info; end
                // day shows a small "ends today" tag.
                const isMiddle = j.isMultiDay && !j.isStart && !j.isEnd;
                return (
                  <button key={j.id} onClick={() => openJob(j.id)}
                    style={{
                      background: color + (isMiddle ? '08' : '14'),
                      borderRadius: 6,
                      padding: isMiddle ? '4px 10px' : '8px 10px',
                      textAlign:'left',
                      color:'#f0f4ff',
                      cursor:'pointer',
                      fontFamily:'inherit',
                      border:'none',
                      borderLeftWidth:3,
                      borderLeftStyle:'solid',
                      borderLeftColor: color,
                    }}>
                    {j.scheduled_time && j.isStart && (
                      <div style={{fontSize:10,color:color,fontWeight:700,letterSpacing:'.04em'}}>{j.scheduled_time.slice(0,5)}</div>
                    )}
                    {j.isMultiDay && (
                      <div style={{fontSize:9,color:color,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>
                        {j.isStart ? '↦ DAY 1 OF ' + dayCount(j) : (j.isEnd ? '⤓ FINAL DAY' : '⋯ IN PROGRESS')}
                      </div>
                    )}
                    <div style={{fontSize:13,fontWeight:600,lineHeight:1.25,overflow:'hidden',textOverflow:'ellipsis'}}>{j.title}</div>
                    {!isMiddle && (
                      <>
                        <div style={{fontSize:11,color:'#a8b8d8',marginTop:2}}>{customerName(j.customer_id)}</div>
                        {j.price ? (
                          <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{fmt$(j.price)}</div>
                        ) : null}
                        {who && (
                          <div style={{fontSize:10,color:color,marginTop:4,fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase'}}>👷 {who}</div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{padding:'18px 16px',display:'flex',gap:14,flexWrap:'wrap',fontSize:11,color:'#7a8db0'}}>
        {Object.entries(STATUS_COLOR).map(([k, c]) => (
          <div key={k} style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:c}}/>
            {k.replace('_',' ')}
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtn = {
  background:'#1a2236',
  border:'1px solid #2e3f60',
  borderRadius:8,
  color:'#f0f4ff',
  width:38,
  height:38,
  fontSize:18,
  cursor:'pointer',
  fontFamily:'inherit',
};
