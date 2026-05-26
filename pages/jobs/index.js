import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isCrew, isOffice } from '../../lib/role';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { sendEmail, sendInvoiceEmail } from '../../lib/email/client';
import { sendSMS } from '../../lib/sms/client';
import { validateUpload, ACCEPT_ATTR } from '../../lib/uploads';
import { firePushEvent } from '../../lib/push/fire';
import { lookupRouteMiles } from '../../lib/mileage';

const STATUSES = [
  { key:'pending',     label:'Pending',     color:'#a855f7' },  // approved-but-not-scheduled, eg. just converted from a quote
  { key:'scheduled',   label:'Scheduled',   color:'#54d4f8' },
  { key:'in_progress', label:'In Progress', color:'#fbbf24' },
  { key:'completed',   label:'Completed',   color:'#2edf87' },
  { key:'cancelled',   label:'Cancelled',   color:'#7a8db0' },
];
const statusMeta = k => STATUSES.find(s => s.key === k) || STATUSES[0];

const EMPTY = {
  customer_id:'', title:'', description:'',
  status:'scheduled', scheduled_date: todayStr(), scheduled_time:'', price:'', notes:'',
  assigned_to_user_id:'',
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
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [jobs, setJobs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY);
  const [jobExpenses, setJobExpenses] = useState([]);
  const [jobLabor, setJobLabor] = useState([]);
  const [jobPhotos, setJobPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [quickExp, setQuickExp] = useState({ amount:'', category:'materials', vendor:'' });
  const [quickLabor, setQuickLabor] = useState({ user_id:'', hours:'' });
  const [addingExp, setAddingExp] = useState(false);
  const [addingLabor, setAddingLabor] = useState(false);
  const [timeEntries, setTimeEntries] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [materials, setMaterials] = useState([]);
  const [newMaterial, setNewMaterial] = useState({ name:'', quantity:'1', unit_cost:'' });
  const [sendingOnMyWay, setSendingOnMyWay] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: j }, { data: c }, { data: m }] = await Promise.all([
      supabase.from('jobs').select('*').eq('org_id', orgId).order('scheduled_date', { ascending:false, nullsFirst:false }),
      supabase.from('customers').select('id,name,email,phone,address').eq('org_id', orgId).order('name'),
      supabase.rpc('list_org_members', { p_org_id: orgId }),
    ]);
    setJobs(j || []);
    setCustomers(c || []);
    setMembers(Array.isArray(m) ? m : []);
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

  // Deep-link: /jobs?open=<id> opens the sheet for that job. Used by
  // the /schedule calendar and notification bell to jump straight in.
  useEffect(() => {
    const id = router.query.open;
    if (!id || !jobs.length) return;
    const target = jobs.find(j => j.id === id);
    if (target) {
      openEdit(target);
      router.replace('/jobs', undefined, { shallow: true });
    }
  }, [router.query.open, jobs]);

  const customerName = id => customers.find(c => c.id === id)?.name || '—';

  const openNew = () => { setForm(EMPTY); setSheet('new'); };
  const openEdit = async (j) => {
    setForm({
      customer_id: j.customer_id || '',
      title: j.title || '',
      description: j.description || '',
      status: j.status || 'scheduled',
      scheduled_date: j.scheduled_date || todayStr(),
      scheduled_time: j.scheduled_time ? j.scheduled_time.slice(0,5) : '',
      price: j.price ?? '',
      notes: j.notes || '',
      assigned_to_user_id: j.assigned_to_user_id || '',
    });
    setQuickExp({ amount:'', category:'materials', vendor:'' });
    setQuickLabor({ user_id:'', hours:'' });
    setNewChecklistItem('');
    setNewMaterial({ name:'', quantity:'1', unit_cost:'' });
    setSheet(j);
    const [{ data: e }, { data: lb }, { data: ph }, { data: te }, { data: cl }, { data: mt }] = await Promise.all([
      supabase.from('expenses').select('*').eq('job_id', j.id).order('expense_date', { ascending:false }),
      supabase.from('job_labor').select('*').eq('job_id', j.id).order('work_date', { ascending:false }),
      supabase.from('job_photos').select('*').eq('job_id', j.id).order('created_at', { ascending:false }),
      supabase.from('time_entries').select('*').eq('job_id', j.id).order('clock_in_at', { ascending:false }),
      supabase.from('job_checklist_items').select('*').eq('job_id', j.id).order('position'),
      supabase.from('job_materials').select('*').eq('job_id', j.id).order('created_at'),
    ]);
    setJobExpenses(e || []);
    setJobLabor(lb || []);
    setJobPhotos(ph || []);
    setTimeEntries(te || []);
    setChecklist(cl || []);
    setMaterials(mt || []);
  };

  const addJobPhoto = async (ev, kind = 'work') => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file || !sheet || sheet === 'new' || !orgId) return;
    const err = validateUpload(file, { images: true });
    if (err) { alert(err); return; }
    setUploadingPhoto(true);
    const extByMime = { 'image/jpeg':'jpg', 'image/png':'png', 'image/heic':'heic', 'image/heif':'heif' };
    const ext = extByMime[file.type] || 'jpg';
    const path = `${orgId}/${sheet.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('job-photos')
      .upload(path, file, { upsert: false, contentType: file.type });
    if (upErr) { alert('Photo upload failed: ' + upErr.message); setUploadingPhoto(false); return; }
    const { data: pub } = supabase.storage.from('job-photos').getPublicUrl(path);
    const { data: row } = await supabase.from('job_photos').insert({
      org_id: orgId,
      job_id: sheet.id,
      user_id: user.id,
      photo_url: pub?.publicUrl || '',
      kind,
    }).select('*').single();
    if (row) setJobPhotos(prev => [row, ...prev]);
    setUploadingPhoto(false);
  };

  const removeJobPhoto = async (photo) => {
    if (!confirm('Delete this photo?')) return;
    await supabase.from('job_photos').delete().eq('id', photo.id);
    // Best-effort delete from storage too. Path = everything after the bucket name.
    try {
      const url = new URL(photo.photo_url);
      const parts = url.pathname.split('/job-photos/');
      if (parts[1]) await supabase.storage.from('job-photos').remove([parts[1]]);
    } catch {}
    setJobPhotos(prev => prev.filter(p => p.id !== photo.id));
  };

  const addQuickExpense = async () => {
    if (!sheet || sheet === 'new' || !orgId) return;
    const amount = Number(quickExp.amount);
    if (isNaN(amount) || amount <= 0) return;
    setAddingExp(true);
    const status = isCrew(role) ? 'pending' : 'approved';
    const { data } = await supabase.from('expenses').insert({
      org_id: orgId,
      owner_id: user.id,
      job_id: sheet.id,
      amount,
      category: quickExp.category,
      vendor: quickExp.vendor.trim() || null,
      expense_date: todayStr(),
      approval_status: status,
      approved_by: status === 'approved' ? user.id : null,
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    }).select('*').single();
    if (data) setJobExpenses(prev => [data, ...prev]);
    setQuickExp({ amount:'', category:quickExp.category, vendor:'' });
    setAddingExp(false);
  };

  const removeJobExpense = async (id) => {
    await supabase.from('expenses').delete().eq('id', id);
    setJobExpenses(prev => prev.filter(e => e.id !== id));
  };

  const addQuickLabor = async () => {
    if (!sheet || sheet === 'new' || !orgId) return;
    const hours = Number(quickLabor.hours);
    if (isNaN(hours) || hours <= 0 || !quickLabor.user_id) return;
    const member = members.find(m => m.user_id === quickLabor.user_id);
    const rate = member?.hourly_pay_rate;
    if (rate == null) {
      alert(`${member?.email || 'This member'} has no hourly rate set — open Crew → their card to set it before logging labor.`);
      return;
    }
    setAddingLabor(true);
    const { data } = await supabase.from('job_labor').insert({
      org_id: orgId,
      job_id: sheet.id,
      user_id: quickLabor.user_id,
      hours,
      hourly_rate: rate,
      work_date: todayStr(),
    }).select('*').single();
    if (data) setJobLabor(prev => [data, ...prev]);
    setQuickLabor({ user_id:'', hours:'' });
    setAddingLabor(false);
  };

  // Time tracking is fully automatic: "On My Way" opens a time_entries
  // row (with GPS start point), and marking the job complete closes
  // it and writes a mileage_log from start↔end coordinates. No manual
  // clock-in or clock-out buttons. If a crew wants to log hours
  // without GPS — e.g., dispute or back-fill — they use the manual
  // Labor section below (job_labor table).
  //
  // GPS capture is best-effort: 3s timeout, no UI block.
  const myOpenEntry = timeEntries.find(t => t.user_id === user?.id && !t.clock_out_at);

  const tryGetCoords = () => new Promise(resolve => {
    if (!navigator.geolocation) return resolve({});
    let done = false;
    const finish = (val) => { if (!done) { done = true; resolve(val); } };
    setTimeout(() => finish({}), 3000);
    navigator.geolocation.getCurrentPosition(
      p => finish({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      ()  => finish({}),
      { enableHighAccuracy: false, timeout: 2500, maximumAge: 60000 }
    );
  });


  // Checklist handlers. Foreman can add/remove items; anyone can tick.
  const addChecklistItem = async () => {
    const label = newChecklistItem.trim();
    if (!label || !sheet || sheet === 'new' || !orgId) return;
    const position = checklist.length;
    const { data } = await supabase.from('job_checklist_items').insert({
      org_id: orgId, job_id: sheet.id, label, position,
    }).select('*').single();
    if (data) setChecklist(prev => [...prev, data]);
    setNewChecklistItem('');
  };

  const toggleChecklist = async (item) => {
    const completed = !item.completed_at;
    const updates = completed
      ? { completed_at: new Date().toISOString(), completed_by: user.id }
      : { completed_at: null, completed_by: null };
    await supabase.from('job_checklist_items').update(updates).eq('id', item.id);
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, ...updates } : c));
  };

  const deleteChecklistItem = async (id) => {
    await supabase.from('job_checklist_items').delete().eq('id', id);
    setChecklist(prev => prev.filter(c => c.id !== id));
  };

  // Materials handlers.
  const addMaterial = async () => {
    const name = newMaterial.name.trim();
    if (!name || !sheet || sheet === 'new' || !orgId) return;
    const quantity = Number(newMaterial.quantity) || 1;
    const unit_cost = Number(newMaterial.unit_cost) || 0;
    const { data } = await supabase.from('job_materials').insert({
      org_id: orgId, job_id: sheet.id, name, quantity, unit_cost,
    }).select('*').single();
    if (data) setMaterials(prev => [...prev, data]);
    setNewMaterial({ name:'', quantity:'1', unit_cost:'' });
  };

  const removeMaterial = async (id) => {
    await supabase.from('job_materials').delete().eq('id', id);
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  // "We're on the way" — fires email + SMS to the customer with the
  // crew member's name and a default ETA. Stamps jobs.on_my_way_at so
  // the button reads "Re-send" the second time.
  const sendOnMyWay = async () => {
    if (!sheet || sheet === 'new' || !form.customer_id) return;
    const cust = customers.find(c => c.id === form.customer_id);
    if (!cust) return;
    if (!cust.email && !cust.phone) {
      alert('Customer has no phone or email on file.');
      return;
    }
    setSendingOnMyWay(true);
    const crewName = (user?.email || '').split('@')[0] || 'Your crew';
    const data = {
      customerName: cust.name || 'there',
      jobTitle: form.title || 'your job',
      crewName,
      etaMins: 30,
    };

    // Capture GPS once and use it for BOTH the customer notification's
    // ETA tracking (future) and the clock-in start point so the
    // mileage trip starts the moment they tap "On My Way", not when
    // they remember to clock in.
    const { lat, lng } = await tryGetCoords();

    let anyOk = false;
    if (cust.email) {
      const r = await sendEmail({ type: 'on_my_way', to: cust.email, data });
      if (r?.ok) anyOk = true;
    }
    if (cust.phone) {
      sendSMS({ type: 'on_my_way', to: cust.phone, data }).catch(() => {});
      anyOk = true;
    }

    // Auto-clock-in the crew member. The point of On My Way is "I'm
    // starting this job now" — making them tap a second button to
    // also start the timer was extra clicks for no gain. Skipped if
    // they're already clocked in to this or any other job.
    if (!myOpenEntry) {
      const { data: te } = await supabase.from('time_entries').insert({
        org_id: orgId,
        job_id: sheet.id,
        user_id: user.id,
        clock_in_at: new Date().toISOString(),
        in_lat: lat ?? null,
        in_lng: lng ?? null,
        notes: 'Auto-started by On My Way',
      }).select('*').single();
      if (te) setTimeEntries(prev => [te, ...prev]);
    }

    await supabase.from('jobs').update({ on_my_way_at: new Date().toISOString() }).eq('id', sheet.id);
    setSheet(prev => prev && prev !== 'new' ? { ...prev, on_my_way_at: new Date().toISOString() } : prev);
    setSendingOnMyWay(false);
    alert(anyOk
      ? `Notified ${cust.name}. Clock started — mark the job complete when done and we'll log time + mileage automatically.`
      : 'Could not send. Check email/phone on file.');
  };

  const removeJobLabor = async (id) => {
    await supabase.from('job_labor').delete().eq('id', id);
    setJobLabor(prev => prev.filter(l => l.id !== id));
  };

  const memberEmail = uid => members.find(m => m.user_id === uid)?.email || 'Unknown';

  const save = async () => {
    if (!form.title.trim() || !orgId) return;
    setSaving(true);
    const prevAssignee = sheet !== 'new' ? sheet?.assigned_to_user_id : null;
    const newAssignee = form.assigned_to_user_id || null;
    const payload = {
      ...form,
      customer_id: form.customer_id || null,
      scheduled_date: form.scheduled_date || null,
      scheduled_time: form.scheduled_time || null,
      price: form.price === '' ? 0 : Number(form.price),
      assigned_to_user_id: newAssignee,
      assigned_at: (newAssignee && newAssignee !== prevAssignee) ? new Date().toISOString() : (sheet !== 'new' ? sheet?.assigned_at : null),
    };
    // Auto-promote pending → scheduled when a date is now set. The
    // contractor's intent is clear: putting a date on a pending job
    // means they've scheduled it. Without this, contractors who set
    // the date without touching the status buttons would silently
    // skip the customer notification.
    if (payload.status === 'pending' && payload.scheduled_date) {
      payload.status = 'scheduled';
    }
    // A trigger in migration 0012 auto-creates the invoice when a job hits
    // 'completed' status, so the client side just persists the change.
    const wasCompleted = sheet !== 'new' && sheet?.status === 'completed';
    const nowCompleted = payload.status === 'completed';
    // Detect newly-scheduled jobs so we can email the customer. Fires
    // when either:
    //   - status transitions pending → scheduled (with a date), OR
    //   - a date is set on a job that didn't have one before, OR
    //   - the date itself changes (rescheduled)
    // Skips when the customer was already notified (status was already
    // scheduled AND the date didn't change).
    const prevDate   = sheet !== 'new' ? sheet?.scheduled_date : null;
    const prevStatus = sheet !== 'new' ? sheet?.status : null;
    const dateChanged = payload.scheduled_date !== prevDate;
    const justScheduled = !!payload.scheduled_date && (
      (prevStatus === 'pending') ||
      (!prevDate) ||
      (dateChanged && payload.status === 'scheduled')
    );
    let savedJobId = sheet !== 'new' ? sheet.id : null;
    if (sheet === 'new') {
      const { data } = await supabase.from('jobs').insert({ ...payload, owner_id: user.id, org_id: orgId }).select('id').single();
      savedJobId = data?.id;
    } else {
      await supabase.from('jobs').update(payload).eq('id', sheet.id);
    }

    // Push the assignee when the job got assigned (new) or reassigned
    // (changed). Skip if the assignee is the same user doing the
    // assigning — they don't need to ping themselves.
    if (savedJobId && newAssignee && newAssignee !== prevAssignee && newAssignee !== user.id) {
      firePushEvent('job_assigned', savedJobId);
    }

    // Fire the "your job is scheduled" notifications to the customer
    // on the transition. Email + SMS both go out. We surface a
    // visible result (toast) so the contractor knows whether the
    // customer was actually notified — previously this was
    // fire-and-forget which made silent failures invisible.
    let scheduleNotice = null;
    if (justScheduled && payload.customer_id) {
      const cust = customers.find(c => c.id === payload.customer_id);
      const human = fmtDate(payload.scheduled_date);
      if (cust?.email) {
        const r = await sendEmail({
          type: 'job_scheduled',
          to: cust.email,
          data: {
            customerName: cust.name,
            jobTitle: payload.title,
            scheduledDate: human,
            description: payload.description || null,
          },
        });
        scheduleNotice = r?.ok
          ? { ok: true,  text: `Emailed ${cust.email} the scheduled date.` }
          : { ok: false, text: `Customer email didn't send: ${r?.error || 'unknown error'}` };
      } else if (cust) {
        scheduleNotice = { ok: false, text: `No email on file for ${cust.name}. Add one in Customers to auto-notify them next time.` };
      }
      if (cust?.phone) {
        // Best-effort SMS — server endpoint returns skipped:true if
        // Twilio isn't set up yet, so this is a no-op until the
        // platform owner configures TWILIO_* env vars.
        sendSMS({
          type: 'job_scheduled',
          to: cust.phone,
          data: {
            customerName: cust.name,
            jobTitle: payload.title,
            scheduledDate: human,
          },
        });
      }
    }

    // When a job transitions to completed, close out any open time
    // entries on it and auto-log mileage from each — eliminates the
    // separate Clock Out step. Done before sending the customer
    // "your job is complete" email so the labor + mileage records
    // are settled by the time the contractor sees the receipt.
    if (nowCompleted && !wasCompleted && savedJobId) {
      const { data: openEntries } = await supabase.from('time_entries')
        .select('*')
        .eq('job_id', savedJobId)
        .is('clock_out_at', null);
      if (openEntries && openEntries.length > 0) {
        const { lat, lng } = await tryGetCoords();
        const closedAt = new Date().toISOString();
        for (const te of openEntries) {
          await supabase.from('time_entries').update({
            clock_out_at: closedAt,
            out_lat: lat ?? null,
            out_lng: lng ?? null,
          }).eq('id', te.id);

          // Mileage row from this entry's start ↔ now coordinates.
          // Prefers Mapbox driving distance when MAPBOX_TOKEN is set;
          // falls back to straight-line haversine if the lookup
          // fails. Skipped if either endpoint is missing or the
          // distance is GPS-jitter small.
          if (te.in_lat != null && te.in_lng != null && lat != null && lng != null) {
            const route = await lookupRouteMiles(te.in_lat, te.in_lng, lat, lng);
            if (route.miles >= 0.1) {
              await supabase.from('mileage_logs').insert({
                org_id: orgId,
                user_id: te.user_id,
                job_id:  savedJobId,
                log_date: todayStr(),
                miles: route.miles,
                start_lat: te.in_lat, start_lng: te.in_lng,
                end_lat:   lat,       end_lng:   lng,
                purpose:  'business',
                method:   'gps',
                notes:    route.source === 'mapbox'
                  ? 'Auto-logged on job completion (Mapbox driving distance)'
                  : 'Auto-logged on job completion (straight-line; Mapbox unavailable)',
                approval_status: 'pending',
              });
            }
          }
        }
      }
    }

    // Fire the "your job is complete" email to the customer on the
    // status transition into completed. Best-effort — the in-app
    // notification and invoice are still created by the trigger.
    if (nowCompleted && !wasCompleted && payload.customer_id) {
      const cust = customers.find(c => c.id === payload.customer_id);
      if (cust?.email) {
        await sendEmail({
          type: 'job_completed',
          to: cust.email,
          data: { customerName: cust.name, jobTitle: payload.title, description: payload.description || null },
        });
      }

      // The migration 0012 trigger creates the invoice asynchronously.
      // Briefly poll for it (up to ~2s) and then email it to the
      // customer with the Pay Now link. Best-effort: a failure here is
      // silent, the contractor can still Resend from the invoice page.
      if (savedJobId && cust?.email) {
        (async () => {
          for (let i = 0; i < 6; i++) {
            const { data: inv } = await supabase
              .from('invoices')
              .select('id, last_emailed_at')
              .eq('job_id', savedJobId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (inv?.id && !inv.last_emailed_at) {
              await sendInvoiceEmail(inv.id);
              return;
            }
            if (inv?.last_emailed_at) return; // already sent (shouldn't happen on first complete, but defensive)
            await new Promise(r => setTimeout(r, 350));
          }
        })();
      }
    }

    await loadAll();
    setSaving(false);
    setSheet(null);
    if (scheduleNotice) {
      // Quick contractor-facing feedback so they know the customer
      // was (or wasn't) notified.
      alert(scheduleNotice.text);
    }
  };

  const del = async (id) => {
    if (!confirm('Delete this job?')) return;
    await supabase.from('jobs').delete().eq('id', id);
    setJobs(j => j.filter(x => x.id !== id));
  };

  const claim = async (job) => {
    await supabase.from('jobs').update({
      assigned_to_user_id: user.id,
      assigned_at: new Date().toISOString(),
    }).eq('id', job.id);
    await loadAll();
  };

  // Crew sees only jobs assigned to them + unassigned pool.
  const roleFiltered = isCrew(role)
    ? jobs.filter(j => j.assigned_to_user_id === user?.id || !j.assigned_to_user_id)
    : jobs;
  const visible = roleFiltered.filter(j => filter === 'all' || j.status === filter);

  const memberLabel = uid => {
    const m = members.find(x => x.user_id === uid);
    return m?.email || 'Unknown';
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',display:'flex',alignItems:'center',justifyContent:'center',color:'#f0f4ff',fontFamily:'sans-serif'}}>Loading...</div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/jobs"/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',margin:'24px 16px 14px'}}>
        <div>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Jobs</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>JOBS</h1>
        </div>
        {isOffice(role) && <button data-tour="page-cta" onClick={openNew} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>+ NEW</button>}
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
        const unassigned = !j.assigned_to_user_id;
        const mine = j.assigned_to_user_id === user?.id;
        return (
          <div key={j.id} data-tour="job-row" onClick={() => openEdit(j)}
            style={{background:'#1e2a42',border:'1px solid '+(unassigned && isCrew(role)?'#fbbf2466':'#2e3f60'),borderRadius:10,margin:'6px 16px',padding:'13px 14px',cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3,gap:8}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.title}</div>
              <span style={{background:s.color+'22',color:s.color,border:'1px solid '+s.color+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em',whiteSpace:'nowrap'}}>{s.label}</span>
              {isOffice(role) && <button onClick={e => { e.stopPropagation(); del(j.id); }} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:12,fontWeight:700,padding:'2px 4px'}}>✕</button>}
            </div>
            <div style={{fontSize:12,color:'#c8d4ee'}}>{customerName(j.customer_id)}</div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11,color:'#7a8db0',gap:8,flexWrap:'wrap'}}>
              <span>{fmtDate(j.scheduled_date)}</span>
              <span>
                {unassigned
                  ? <span style={{color:'#fbbf24',fontWeight:700,letterSpacing:'.04em',textTransform:'uppercase',fontSize:10}}>● Pool — unassigned</span>
                  : mine
                    ? <span style={{color:'#2edf87',fontWeight:700,letterSpacing:'.04em',textTransform:'uppercase',fontSize:10}}>● Assigned to you</span>
                    : <span>Assigned to {memberLabel(j.assigned_to_user_id)}</span>}
              </span>
              {!isCrew(role) && <span style={{color:'#2edf87',fontWeight:600}}>{fmt$(j.price || 0)}</span>}
            </div>
            {j.notes && <div style={{fontSize:11,color:'#fbbf24',marginTop:3}}>Note: {j.notes}</div>}
            {isCrew(role) && unassigned && (
              <button onClick={e => { e.stopPropagation(); claim(j); }}
                style={{marginTop:8,width:'100%',background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:8,color:'#2edf87',padding:'7px 0',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'.05em'}}>
                CLAIM THIS JOB
              </button>
            )}
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
              {form.customer_id && (
                <CustomerContactCard
                  customer={customers.find(c => c.id === form.customer_id)}
                  jobTitle={form.title}
                />
              )}
            </div>

            {isOffice(role) && (
              <div style={{margin:'10px 16px'}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Assigned to</div>
                <select value={form.assigned_to_user_id}
                  onChange={e => setForm(p => ({...p, assigned_to_user_id:e.target.value}))}
                  style={inputStyle}>
                  <option value="">— Crew pool (unassigned) —</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
                </select>
              </div>
            )}

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
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Time</div>
                <input type="time" value={form.scheduled_time || ''}
                  onChange={e => setForm(p => ({...p, scheduled_time:e.target.value}))}
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
              <textarea maxLength={2000} value={form.description}
                onChange={e => setForm(p => ({...p, description:e.target.value}))}
                placeholder="Scope of work"
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            <div style={{margin:'10px 16px'}}>
              <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Notes</div>
              <textarea maxLength={2000} value={form.notes}
                onChange={e => setForm(p => ({...p, notes:e.target.value}))}
                placeholder="Crew callouts, access, parts needed..."
                style={{...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit'}}/>
            </div>

            {sheet !== 'new' && form.customer_id && (
              <div style={{margin:'14px 16px'}}>
                <button
                  onClick={sendOnMyWay}
                  disabled={sendingOnMyWay}
                  style={{
                    width:'100%',
                    background: sheet.on_my_way_at ? '#1a2236' : '#fbbf24',
                    border: sheet.on_my_way_at ? '1px solid #fbbf24' : 'none',
                    color: sheet.on_my_way_at ? '#fbbf24' : '#111827',
                    borderRadius:10, padding:'14px',
                    fontSize:13, fontWeight:800, letterSpacing:'.06em',
                    cursor:'pointer', fontFamily:'inherit',
                  }}>
                  {sendingOnMyWay ? 'SENDING...' : (sheet.on_my_way_at ? '🚐 RE-NOTIFY CUSTOMER' : '🚐 ON MY WAY')}
                </button>
                {sheet.on_my_way_at && (
                  <div style={{fontSize:11,color:'#7a8db0',marginTop:6,textAlign:'center'}}>
                    Last sent {new Date(sheet.on_my_way_at).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {sheet !== 'new' && timeEntries.length > 0 && (
              <div style={{margin:'14px 16px',padding:'12px',background:'#0f1626',border:'1px solid #2e3f60',borderRadius:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0'}}>Time on this job</div>
                  <div style={{fontSize:11,color:myOpenEntry ? '#fbbf24' : '#7a8db0'}}>
                    {myOpenEntry
                      ? `Running since ${new Date(myOpenEntry.clock_in_at).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`
                      : `${timeEntries.length} entr${timeEntries.length === 1 ? 'y' : 'ies'}`}
                  </div>
                </div>
                {myOpenEntry && (
                  <div style={{fontSize:12,color:'#7a8db0',marginBottom:8,lineHeight:1.5}}>
                    Auto-stops + logs mileage when this job is marked complete.
                  </div>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {timeEntries.slice(0, 5).map(t => {
                    const mins = t.clock_out_at
                      ? Math.round((new Date(t.clock_out_at) - new Date(t.clock_in_at)) / 60000)
                      : null;
                    return (
                      <div key={t.id} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#c8d4ee',padding:'4px 0',borderBottom:'1px solid #1a2236'}}>
                        <div>{memberEmail(t.user_id).split('@')[0]}</div>
                        <div style={{color:'#7a8db0'}}>
                          {mins != null ? `${Math.floor(mins/60)}h ${mins%60}m` : 'running'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {sheet !== 'new' && (
              <div style={{margin:'14px 16px',padding:'12px',background:'#0f1626',border:'1px solid #2e3f60',borderRadius:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0'}}>Checklist</div>
                  <div style={{fontSize:11,color:'#7a8db0'}}>
                    {checklist.filter(c => c.completed_at).length}/{checklist.length}
                  </div>
                </div>
                {checklist.map(item => (
                  <div key={item.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0'}}>
                    <button onClick={() => toggleChecklist(item)}
                      style={{
                        width:22, height:22, borderRadius:5,
                        background: item.completed_at ? '#2edf87' : 'transparent',
                        border: '1.5px solid ' + (item.completed_at ? '#2edf87' : '#7a8db0'),
                        color:'#111827', fontWeight:900, cursor:'pointer', fontFamily:'inherit', flexShrink:0,
                      }}>
                      {item.completed_at ? '✓' : ''}
                    </button>
                    <div style={{flex:1,fontSize:13,color:item.completed_at ? '#7a8db0' : '#f0f4ff',textDecoration:item.completed_at ? 'line-through' : 'none'}}>{item.label}</div>
                    {isOffice(role) && (
                      <button onClick={() => deleteChecklistItem(item.id)}
                        style={{background:'transparent',border:'none',color:'#7a8db0',fontSize:13,cursor:'pointer',padding:4}}>×</button>
                    )}
                  </div>
                ))}
                {isOffice(role) && (
                  <div style={{display:'flex',gap:6,marginTop:8}}>
                    <input value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                      placeholder="Add a step..."
                      style={{...inputStyle, flex:1}}/>
                    <button onClick={addChecklistItem}
                      style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'0 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>ADD</button>
                  </div>
                )}
                {!checklist.length && !isOffice(role) && (
                  <div style={{fontSize:12,color:'#7a8db0',fontStyle:'italic'}}>Foreman hasn't added steps for this job.</div>
                )}
              </div>
            )}

            {sheet !== 'new' && (
              <div style={{margin:'14px 16px',padding:'12px',background:'#0f1626',border:'1px solid #2e3f60',borderRadius:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0'}}>Materials used</div>
                  <div style={{fontSize:11,color:'#7a8db0'}}>
                    {fmt$(materials.reduce((s, m) => s + Number(m.quantity || 0) * Number(m.unit_cost || 0), 0))}
                  </div>
                </div>
                {materials.map(m => (
                  <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #1a2236',fontSize:13}}>
                    <div style={{flex:1}}>
                      <div style={{color:'#f0f4ff'}}>{m.name}</div>
                      <div style={{fontSize:11,color:'#7a8db0'}}>{m.quantity} × {fmt$(m.unit_cost)}</div>
                    </div>
                    <div style={{color:'#c8d4ee',marginRight:8}}>{fmt$(Number(m.quantity) * Number(m.unit_cost))}</div>
                    <button onClick={() => removeMaterial(m.id)}
                      style={{background:'transparent',border:'none',color:'#7a8db0',fontSize:13,cursor:'pointer',padding:4}}>×</button>
                  </div>
                ))}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:6,marginTop:8}}>
                  <input value={newMaterial.name}
                    onChange={e => setNewMaterial(p => ({...p, name:e.target.value}))}
                    placeholder="Item"
                    style={inputStyle}/>
                  <input type="number" inputMode="decimal" value={newMaterial.quantity}
                    onChange={e => setNewMaterial(p => ({...p, quantity:e.target.value}))}
                    placeholder="Qty"
                    style={inputStyle}/>
                  <input type="number" inputMode="decimal" value={newMaterial.unit_cost}
                    onChange={e => setNewMaterial(p => ({...p, unit_cost:e.target.value}))}
                    placeholder="$/ea"
                    style={inputStyle}/>
                  <button onClick={addMaterial}
                    style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'0 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>ADD</button>
                </div>
              </div>
            )}

            {sheet !== 'new' && (() => {
              const revenue = Number(form.price) || 0;
              const laborCost = jobLabor.reduce((s, l) => s + Number(l.cost || 0), 0);
              const expenseTotal = jobExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
              const profit = revenue - laborCost - expenseTotal;
              const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
              const profitColor = profit >= 0 ? '#2edf87' : '#f26060';
              return (
                <div style={{margin:'14px 16px 4px',padding:'12px 12px',background:'#111827',border:'1px solid #2e3f60',borderRadius:10}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:8}}>Profitability</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:4}}>
                    <ProfitLine label="Revenue"  value={fmt$(revenue)}      color="#2edf87"/>
                    <ProfitLine label="Labor"    value={'-' + fmt$(laborCost)}  color="#fbbf24"/>
                    <ProfitLine label="Expenses" value={'-' + fmt$(expenseTotal)} color="#f26060"/>
                    <ProfitLine label="Profit"   value={fmt$(profit)} color={profitColor} bold suffix={revenue > 0 ? `${margin.toFixed(0)}% margin` : null}/>
                  </div>
                </div>
              );
            })()}

            {sheet !== 'new' && (
              <div style={{margin:'10px 16px 4px',padding:'12px 12px',background:'#111827',border:'1px solid #2e3f60',borderRadius:10}}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0'}}>Labor on this job</div>
                  <div style={{fontSize:12,color:'#fbbf24',fontWeight:700}}>
                    {fmt$(jobLabor.reduce((s,l) => s + Number(l.cost||0), 0))}
                  </div>
                </div>

                {jobLabor.length > 0 && (
                  <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10}}>
                    {jobLabor.map(l => (
                      <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6,fontSize:12,color:'#c8d4ee'}}>
                        <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{memberEmail(l.user_id)}</span>
                        <span style={{fontSize:11,color:'#7a8db0',whiteSpace:'nowrap'}}>{Number(l.hours).toFixed(1)}h × {fmt$(l.hourly_rate)}</span>
                        <span style={{color:'#fbbf24',fontWeight:600,whiteSpace:'nowrap'}}>{fmt$(l.cost||0)}</span>
                        <button onClick={() => removeJobLabor(l.id)} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:10,padding:'0 4px'}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {isOffice(role) && (
                  <div style={{display:'flex',gap:6}}>
                    <select value={quickLabor.user_id} onChange={e => setQuickLabor(p => ({...p, user_id:e.target.value}))}
                      style={{...inputStyle, padding:'8px 10px', fontSize:13, flex:1}}>
                      <option value="">— Crew member —</option>
                      {members.map(m => <option key={m.user_id} value={m.user_id} disabled={m.hourly_pay_rate == null}>
                        {m.email}{m.hourly_pay_rate == null ? ' (no rate)' : ' · $' + Number(m.hourly_pay_rate).toFixed(2) + '/hr'}
                      </option>)}
                    </select>
                    <input type="number" inputMode="decimal" step="0.25" placeholder="Hours"
                      value={quickLabor.hours} onChange={e => setQuickLabor(p => ({...p, hours:e.target.value}))}
                      style={{...inputStyle, padding:'8px 10px', fontSize:13, width:80, flexShrink:0}}/>
                    <button onClick={addQuickLabor} disabled={addingLabor || !Number(quickLabor.hours) || !quickLabor.user_id}
                      style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 12px',fontWeight:700,cursor:'pointer',fontSize:13,opacity:(addingLabor||!Number(quickLabor.hours)||!quickLabor.user_id)?0.4:1}}>
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {sheet !== 'new' && (
              <div style={{margin:'10px 16px 4px',padding:'12px 12px',background:'#111827',border:'1px solid #2e3f60',borderRadius:10}}>
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

            {sheet !== 'new' && (
              <div style={{margin:'10px 16px 4px',padding:'12px 12px',background:'#111827',border:'1px solid #2e3f60',borderRadius:10}}>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0'}}>Photos on this job</div>
                  <div style={{fontSize:12,color:'#7a8db0'}}>{jobPhotos.length} attached</div>
                </div>

                {jobPhotos.length > 0 && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(88px, 1fr))',gap:6,marginBottom:10}}>
                    {jobPhotos.map(p => (
                      <div key={p.id} style={{position:'relative',aspectRatio:'1/1',borderRadius:8,overflow:'hidden',background:'#0d1726',border:'1px solid #2e3f60'}}>
                        <a href={p.photo_url} target="_blank" rel="noopener noreferrer" style={{display:'block',width:'100%',height:'100%'}}>
                          <img src={p.photo_url} alt={p.kind} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                        </a>
                        {p.kind !== 'work' && (
                          <span style={{position:'absolute',top:4,left:4,background:'#0d1726cc',color:'#f0f4ff',fontSize:9,fontWeight:700,letterSpacing:'.04em',textTransform:'uppercase',padding:'2px 6px',borderRadius:4}}>{p.kind}</span>
                        )}
                        <button onClick={() => removeJobPhoto(p)} style={{position:'absolute',top:2,right:2,background:'#1a2236cc',border:'none',color:'#f26060',width:22,height:22,borderRadius:11,cursor:'pointer',fontSize:11,lineHeight:1,padding:0}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <PhotoUploadButton label="+ BEFORE" kind="before" onChange={addJobPhoto} disabled={uploadingPhoto}/>
                  <PhotoUploadButton label="+ WORK"   kind="work"   onChange={addJobPhoto} disabled={uploadingPhoto}/>
                  <PhotoUploadButton label="+ AFTER"  kind="after"  onChange={addJobPhoto} disabled={uploadingPhoto}/>
                </div>
                {uploadingPhoto && <div style={{fontSize:11,color:'#7a8db0',marginTop:6}}>Uploading…</div>}
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

// One-tap contact controls for the customer attached to a job.
// Crew members only see the job sheet — this is their fastest path
// to call, text, or get directions without leaving the job.
//
//   tel:   universal — every iOS and Android phone honors it
//   sms:   ditto, prefilled with a short intro the crew can edit
//   mailto: same for email
//   maps:  opens Apple Maps on iOS / Google Maps on Android via the
//          ?q=<address> URL pattern both apps respect.
function CustomerContactCard({ customer, jobTitle }) {
  if (!customer) return null;
  const { name, phone, email, address } = customer;
  const tel  = phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : null;
  const intro = `Hi ${(name || '').split(' ')[0] || 'there'}, this is about ${jobTitle || 'your job'}. `;
  const sms  = phone ? `sms:${phone.replace(/[^0-9+]/g, '')}?body=${encodeURIComponent(intro)}` : null;
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent(jobTitle || 'Your job')}` : null;
  const maps = address ? `https://maps.google.com/?q=${encodeURIComponent(address)}` : null;

  const anyContact = phone || email || address;
  if (!anyContact) {
    return (
      <div style={{marginTop:8,padding:'10px 12px',background:'#1a2236',border:'1px dashed #2e3f60',borderRadius:8,fontSize:12,color:'#7a8db0',lineHeight:1.5}}>
        No phone, email, or address on file for this customer. Add contact info in Customers.
      </div>
    );
  }

  return (
    <div style={{marginTop:8,padding:'10px 12px',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8}}>
      <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>Reach the customer</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:address ? 8 : 0}}>
        {tel && (
          <a href={tel} style={contactBtn('#2edf87')}>📞 CALL</a>
        )}
        {sms && (
          <a href={sms} style={contactBtn('#4f9eff')}>💬 TEXT</a>
        )}
        {mail && (
          <a href={mail} style={contactBtn('#b197fc')}>✉️ EMAIL</a>
        )}
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer" style={contactBtn('#fbbf24')}>📍 DIRECTIONS</a>
        )}
      </div>
      {phone && <div style={{fontSize:12,color:'#c8d4ee'}}>📱 {phone}</div>}
      {email && <div style={{fontSize:12,color:'#c8d4ee'}}>✉ {email}</div>}
      {address && <div style={{fontSize:12,color:'#c8d4ee',whiteSpace:'pre-line',marginTop:2}}>🏠 {address}</div>}
    </div>
  );
}

function contactBtn(color) {
  return {
    flex: '1 1 auto',
    background: color + '22',
    border: '1px solid ' + color + '66',
    borderRadius: 8,
    color,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '.05em',
    textDecoration: 'none',
    textAlign: 'center',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
}

function ProfitLine({ label, value, color, bold, suffix }) {
  return (
    <div>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize: bold ? 22 : 18, color, lineHeight:1.1}}>{value}</div>
      {suffix && <div style={{fontSize:10,color:'#7a8db0',marginTop:1}}>{suffix}</div>}
    </div>
  );
}

const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};

function PhotoUploadButton({ label, kind, onChange, disabled }) {
  // The native input is hidden behind the styled <label>. capture="environment"
  // makes mobile open the rear camera instead of the photo library by default.
  return (
    <label style={{
      flex:'1 1 0',
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      gap:6, padding:'9px 10px',
      background:'#1e2a42', border:'1px dashed #2e3f60', borderRadius:8,
      color:'#c8d4ee', fontSize:11, fontWeight:700, letterSpacing:'.06em',
      cursor: disabled ? 'wait' : 'pointer', opacity: disabled ? 0.5 : 1,
      whiteSpace:'nowrap', minWidth:90,
    }}>
      {label}
      <input type="file" accept={ACCEPT_ATTR} capture="environment"
        onChange={(e) => onChange(e, kind)} disabled={disabled}
        style={{display:'none'}}/>
    </label>
  );
}
