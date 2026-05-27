import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isForeman, roleLabel, roleColor } from '../../lib/role';
import { fmt$, fmtDate } from '../../lib/helpers';
import TopNav from '../../components/TopNav';

export default function CrewDetail() {
  const router = useRouter();
  const { id: memberUserId } = router.query;
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [member, setMember] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRole, setEditRole] = useState('');
  const [editRate, setEditRate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    if (!orgId || !memberUserId) return;
    setLoading(true);
    const [{ data: members }, { data: j }, { data: e }, { data: m }] = await Promise.all([
      supabase.rpc('list_org_members', { p_org_id: orgId }),
      supabase.from('jobs').select('*').eq('org_id', orgId).eq('assigned_to_user_id', memberUserId).order('scheduled_date', { ascending:false }),
      supabase.from('expenses').select('*').eq('org_id', orgId).eq('owner_id', memberUserId).order('expense_date', { ascending:false }).limit(50),
      supabase.from('mileage_logs').select('*').eq('org_id', orgId).eq('user_id', memberUserId).order('log_date', { ascending:false }).limit(50),
    ]);
    const me = (members || []).find(x => x.user_id === memberUserId);
    setMember(me || null);
    setJobs(j || []);
    setExpenses(e || []);
    setMileage(m || []);
    if (me) {
      setEditRole(me.role);
      setEditRate(me.hourly_pay_rate != null ? String(me.hourly_pay_rate) : '');
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    if (orgId) loadAll();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [router.isReady, orgId, orgLoading, memberUserId]);

  useRefetchOnFocus(loadAll, !!(orgId && memberUserId));

  // Once we have orgLoading + role, if not foreman, kick them out.
  useEffect(() => {
    if (role && !isForeman(role)) router.push('/crew');
  }, [role]);

  const saveMember = async () => {
    setSaving(true);
    const rate = editRate === '' ? null : Number(editRate);
    await supabase.from('org_members')
      .update({ role: editRole, hourly_pay_rate: rate })
      .eq('org_id', orgId).eq('user_id', memberUserId);
    await loadAll();
    setSaving(false);
  };

  const approveExpense = async (expenseId, currentStatus) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    await supabase.from('expenses').update({
      approval_status: newStatus,
      approved_by: newStatus === 'approved' ? user.id : null,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
      rejected_reason: null,
    }).eq('id', expenseId);
    loadAll();
  };
  const rejectExpense = async (expenseId) => {
    const reason = prompt('Reject reason? (optional)') || '';
    await supabase.from('expenses').update({
      approval_status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejected_reason: reason.trim() || null,
    }).eq('id', expenseId);
    loadAll();
  };

  const approveMileage = async (logId, currentStatus) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    await supabase.from('mileage_logs').update({
      approval_status: newStatus,
      approved_by: newStatus === 'approved' ? user.id : null,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
      rejected_reason: null,
    }).eq('id', logId);
    loadAll();
  };
  const rejectMileage = async (logId) => {
    const reason = prompt('Reject reason? (optional)') || '';
    await supabase.from('mileage_logs').update({
      approval_status: 'rejected',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejected_reason: reason.trim() || null,
    }).eq('id', logId);
    loadAll();
  };

  if (loading || !router.isReady) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/crew"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  if (!member) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/crew"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Crew member not found.</div>
    </div>
  );

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalMiles    = mileage.reduce((s, m) => s + Number(m.miles || 0), 0);
  const pendingExpenseCount = expenses.filter(e => e.approval_status === 'pending').length;
  const pendingMileageCount = mileage.filter(m => m.approval_status === 'pending').length;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/crew"/>

      <main style={{maxWidth:880,margin:'0 auto',padding:'24px 20px 0'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <button onClick={() => router.push('/crew')} style={{background:'transparent',border:'none',color:'#7a8db0',cursor:'pointer',fontSize:20,padding:'8px 10px',minWidth:36,minHeight:36,borderRadius:6}}>←</button>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Crew member</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.04em',margin:'4px 0 0'}}>{member.email.toUpperCase()}</h1>
          </div>
        </div>

        {/* Role + pay rate edit */}
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'16px 16px',marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:14,letterSpacing:'.1em',color:'#7a8db0',marginBottom:10,fontWeight:700}}>ROLE &amp; PAY</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>
              <div style={fieldLabel}>Role</div>
              <select value={editRole} onChange={e => setEditRole(e.target.value)} style={inputStyle}>
                <option value="owner">Foreman (Owner)</option>
                <option value="admin">Foreman (Admin)</option>
                <option value="dispatcher">Supervisor</option>
                <option value="crew">Crew</option>
              </select>
            </div>
            <div>
              <div style={fieldLabel}>Hourly rate ($)</div>
              <input type="number" inputMode="decimal" placeholder="25.00" value={editRate}
                onChange={e => setEditRate(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          <button onClick={saveMember} disabled={saving} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'8px 16px',fontWeight:700,cursor:'pointer',fontSize:12,letterSpacing:'.05em',opacity:saving?0.5:1}}>
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>

        {/* Quick stats */}
        <div className="stats-grid" style={{marginBottom:14}}>
          <Stat label="Active Jobs" value={jobs.filter(j => ['scheduled','in_progress'].includes(j.status)).length} color="#4f9eff"/>
          <Stat label="Total Expenses" value={fmt$(totalExpenses)} color="#f26060" sub={pendingExpenseCount > 0 ? `${pendingExpenseCount} pending` : null}/>
          <Stat label="Total Miles" value={totalMiles.toFixed(1)} color="#2edf87" sub={pendingMileageCount > 0 ? `${pendingMileageCount} pending` : null}/>
        </div>

        {/* Jobs */}
        <SectionHeader title="Assigned jobs"/>
        {jobs.length === 0 ? (
          <Empty text="No assigned jobs."/>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
            {jobs.map(j => (
              <div key={j.id} onClick={() => router.push('/jobs')}
                style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 14px',cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{j.title}</div>
                  <JobStatusPill status={j.status}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#7a8db0',marginTop:3}}>
                  <span>{j.scheduled_date ? fmtDate(j.scheduled_date) : '—'}</span>
                  <span style={{color:'#2edf87'}}>{fmt$(j.price || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Expenses */}
        <SectionHeader title="Expenses submitted"/>
        {expenses.length === 0 ? (
          <Empty text="No expenses submitted yet."/>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
            {expenses.map(e => <ApprovalRow key={e.id} type="expense" item={e} onApprove={approveExpense} onReject={rejectExpense}/>)}
          </div>
        )}

        {/* Mileage */}
        <SectionHeader title="Mileage submitted"/>
        {mileage.length === 0 ? (
          <Empty text="No mileage submitted yet."/>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
            {mileage.map(m => <ApprovalRow key={m.id} type="mileage" item={m} onApprove={approveMileage} onReject={rejectMileage}/>)}
          </div>
        )}
      </main>

      <style jsx global>{`
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        @media (max-width: 540px) { .stats-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',color:'#f0f4ff',margin:'14px 0 8px'}}>{title.toUpperCase()}</div>
  );
}

function Empty({ text }) {
  return <div style={{padding:'14px 16px',background:'#1e2a42',border:'1px dashed #2e3f60',borderRadius:10,fontSize:13,color:'#7a8db0',textAlign:'center'}}>{text}</div>;
}

function Stat({ label, value, color, sub }) {
  return (
    <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.02em',color}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#fbbf24',marginTop:4,fontWeight:600}}>{sub}</div>}
    </div>
  );
}

function JobStatusPill({ status }) {
  const meta = {
    scheduled:   { color:'#54d4f8', label:'Scheduled' },
    in_progress: { color:'#fbbf24', label:'In Progress' },
    completed:   { color:'#2edf87', label:'Completed' },
    cancelled:   { color:'#7a8db0', label:'Cancelled' },
  }[status] || { color:'#7a8db0', label: status };
  return <span style={{fontSize:10,fontWeight:700,letterSpacing:'.06em',padding:'2px 8px',borderRadius:999,background:meta.color+'22',color:meta.color,border:'1px solid '+meta.color+'66',textTransform:'uppercase',whiteSpace:'nowrap'}}>{meta.label}</span>;
}

function ApprovalRow({ type, item, onApprove, onReject }) {
  const status = item.approval_status || 'approved';
  const date = item.expense_date || item.log_date;
  const amount = type === 'expense' ? fmt$(item.amount || 0) : `${Number(item.miles || 0).toFixed(1)} mi`;
  const detail = type === 'expense'
    ? (item.vendor || item.description || item.category || '—')
    : `${item.purpose} · ${item.notes || ''}`;
  const c = status === 'approved' ? '#2edf87' : status === 'pending' ? '#fbbf24' : '#f26060';
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{detail}</div>
          <div style={{fontSize:11,color:'#7a8db0'}}>{fmtDate(date)}</div>
        </div>
        <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,color:type==='expense'?'#f26060':'#4f9eff',whiteSpace:'nowrap'}}>{amount}</span>
        <span style={{fontSize:10,letterSpacing:'.06em',padding:'2px 8px',borderRadius:4,background:c+'22',color:c,border:'1px solid '+c+'66',fontWeight:700,textTransform:'uppercase',whiteSpace:'nowrap'}}>{status}</span>
      </div>
      {status === 'rejected' && item.rejected_reason && (
        <div style={{fontSize:11,color:'#f26060',marginBottom:6}}>Reason: {item.rejected_reason}</div>
      )}
      {status !== 'approved' && (
        <div style={{display:'flex',gap:6}}>
          <button onClick={() => onApprove(item.id, status)}
            style={{flex:1,background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:6,color:'#2edf87',padding:'6px 0',fontSize:11,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
            APPROVE
          </button>
          {status === 'pending' && (
            <button onClick={() => onReject(item.id)}
              style={{flex:1,background:'#f2606022',border:'1px solid #f2606066',borderRadius:6,color:'#f26060',padding:'6px 0',fontSize:11,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
              REJECT
            </button>
          )}
        </div>
      )}
      {status === 'approved' && (
        <button onClick={() => onApprove(item.id, status)}
          style={{width:'100%',background:'transparent',border:'1px solid #2e3f60',borderRadius:6,color:'#7a8db0',padding:'6px 0',fontSize:11,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
          UNDO APPROVAL
        </button>
      )}
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
