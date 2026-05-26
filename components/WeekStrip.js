// Compact 7-day calendar strip. Used on the dashboard so the
// schedule lives on the home screen — tapping a day chip jumps
// straight to the job sheet. Tapping the "View full calendar"
// link goes to /schedule for the full grid + day view.
//
// Renders the next 7 days starting at today. For each day, shows
// scheduled jobs (status color) + ghost previews of active
// recurring plans projected forward to that date.

import { useRouter } from 'next/router';
import { fmt$ } from '../lib/helpers';

const STATUS_COLOR = {
  pending:     '#a855f7',
  scheduled:   '#54d4f8',
  in_progress: '#fbbf24',
  completed:   '#2edf87',
  cancelled:   '#7a8db0',
};
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoDay(d) { return d.toISOString().slice(0,10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

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
  while (cur < toDate && safety < 50) {
    if (cur >= fromDate) out.push(new Date(cur));
    cur = advance(cur);
    safety++;
  }
  return out;
}

export default function WeekStrip({ jobs, recurring = [], customerName, includeRecurring = true }) {
  const router = useRouter();
  const today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const days  = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff'}}>THIS WEEK</div>
        <a onClick={() => router.push('/schedule')} style={{fontSize:11,color:'#4f9eff',cursor:'pointer',letterSpacing:'.06em',fontWeight:700,textTransform:'uppercase'}}>Full calendar →</a>
      </div>
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:6,scrollSnapType:'x mandatory'}}>
        {days.map((day, i) => {
          const iso  = isoDay(day);
          // Multi-day jobs show on every day their window covers,
          // not just their start date.
          const dayJobs = (jobs || [])
            .filter(j => {
              const start = j.scheduled_date;
              const end   = j.scheduled_end_date || j.scheduled_date;
              return start && start <= iso && iso <= end;
            })
            .map(j => ({
              ...j,
              isStart: j.scheduled_date === iso,
              isEnd:   (j.scheduled_end_date || j.scheduled_date) === iso,
              isMultiDay: !!j.scheduled_end_date && j.scheduled_end_date !== j.scheduled_date,
            }))
            .sort((a,b) => (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99'));
          const ghosts = includeRecurring
            ? recurring.flatMap(plan =>
                projectRecurring(plan, day, addDays(day, 1)).map(occ => ({ id:'rec-'+plan.id+'-'+isoDay(occ), plan }))
              )
            : [];
          const total = dayJobs.length + ghosts.length;
          const isToday = i === 0;
          return (
            <div key={iso}
              style={{
                minWidth: 150,
                maxWidth: 180,
                scrollSnapAlign:'start',
                background:'#1a2236',
                border: isToday ? '1px solid #4f9eff' : '1px solid #2e3f60',
                borderRadius:10,
                padding:10,
                display:'flex', flexDirection:'column', gap:6,
              }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:10,letterSpacing:'.16em',fontWeight:700,color:isToday ? '#4f9eff' : '#7a8db0',textTransform:'uppercase'}}>
                    {isToday ? 'TODAY' : WEEKDAYS[day.getDay()]}
                  </div>
                  <div style={{fontSize:16,fontWeight:700,color:isToday ? '#4f9eff' : '#f0f4ff'}}>{day.getDate()}</div>
                </div>
                <div style={{fontSize:10,color:'#7a8db0',fontWeight:600}}>{total || ''}</div>
              </div>

              {total === 0 && (
                <div style={{fontSize:11,color:'#5a6c8c',fontStyle:'italic',textAlign:'center',padding:'10px 0'}}>—</div>
              )}

              {dayJobs.map(j => {
                const color = STATUS_COLOR[j.status] || '#7a8db0';
                const isMiddle = j.isMultiDay && !j.isStart && !j.isEnd;
                return (
                  <button key={j.id} onClick={() => router.push(`/jobs?open=${j.id}`)}
                    style={{
                      background: color + (isMiddle ? '08' : '14'),
                      borderRadius: 5,
                      padding: isMiddle ? '3px 8px' : '6px 8px',
                      textAlign:'left',
                      color:'#f0f4ff',
                      cursor:'pointer',
                      fontFamily:'inherit',
                      border:'none',
                      borderLeftWidth:3,
                      borderLeftStyle:'solid',
                      borderLeftColor: color,
                    }}>
                    {j.scheduled_time && j.isStart && !j.isMultiDay && (
                      <div style={{fontSize:9,color:color,fontWeight:700,letterSpacing:'.04em'}}>{j.scheduled_time.slice(0,5)}</div>
                    )}
                    {j.isMultiDay && (
                      <div style={{fontSize:8,color:color,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>
                        {j.isStart ? '↦ DAY 1' : (j.isEnd ? '⤓ END' : '⋯ ONGOING')}
                      </div>
                    )}
                    <div style={{fontSize:12,fontWeight:600,lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{j.title}</div>
                    {customerName && j.customer_id && !isMiddle && (
                      <div style={{fontSize:10,color:'#a8b8d8',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{customerName(j.customer_id)}</div>
                    )}
                  </button>
                );
              })}

              {ghosts.map(g => (
                <div key={g.id}
                  style={{
                    background: '#a855f70a',
                    border: '1px dashed #a855f766',
                    borderLeftWidth: 3, borderLeftStyle:'solid', borderLeftColor:'#a855f7',
                    borderRadius: 5,
                    padding:'6px 8px',
                  }}
                  title="Recurring plan — materializes into a real job on this date.">
                  <div style={{fontSize:9,color:'#a855f7',fontWeight:700,letterSpacing:'.04em'}}>🔁 RECURRING</div>
                  <div style={{fontSize:12,fontWeight:600,lineHeight:1.2,color:'#f0f4ff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{g.plan.title}</div>
                  {customerName && (
                    <div style={{fontSize:10,color:'#a8b8d8',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{customerName(g.plan.customer_id)}</div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
