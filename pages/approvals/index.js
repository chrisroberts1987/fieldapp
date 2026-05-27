import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isOffice } from '../../lib/role';
import { fmt$, fmtDate } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import SubNav from '../../components/SubNav';

export default function Approvals() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [members, setMembers] = useState({});
  const [pendingExpenses, setPendingExpenses] = useState([]);
  const [pendingMileage, setPendingMileage] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!orgId) return;
    setLoading(true);
    const [{ data: m }, { data: e }, { data: ml }] = await Promise.all([
      supabase.rpc('list_org_members', { p_org_id: orgId }),
      supabase.from('expenses').select('*').eq('org_id', orgId).eq('approval_status', 'pending').order('created_at', { ascending:false }),
      supabase.from('mileage_logs').select('*').eq('org_id', orgId).eq('approval_status', 'pending').order('created_at', { ascending:false }),
    ]);
    const map = {};
    (m || []).forEach(x => map[x.user_id] = x);
    setMembers(map);
    setPendingExpenses(e || []);
    setPendingMileage(ml || []);
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

  useEffect(() => {
    if (role && !isOffice(role)) router.push('/dashboard');
  }, [role]);

  useRefetchOnFocus(loadAll, !!orgId);

  const approveExpense = async (id) => {
    await supabase.from('expenses').update({
      approval_status:'approved', approved_by: user.id, approved_at: new Date().toISOString(), rejected_reason: null,
    }).eq('id', id);
    loadAll();
  };
  const rejectExpense = async (id) => {
    const reason = prompt('Reject reason? (optional)') || '';
    await supabase.from('expenses').update({
      approval_status:'rejected', approved_by: user.id, approved_at: new Date().toISOString(), rejected_reason: reason.trim() || null,
    }).eq('id', id);
    loadAll();
  };
  const approveMileage = async (id) => {
    await supabase.from('mileage_logs').update({
      approval_status:'approved', approved_by: user.id, approved_at: new Date().toISOString(), rejected_reason: null,
    }).eq('id', id);
    loadAll();
  };
  const rejectMileage = async (id) => {
    const reason = prompt('Reject reason? (optional)') || '';
    await supabase.from('mileage_logs').update({
      approval_status:'rejected', approved_by: user.id, approved_at: new Date().toISOString(), rejected_reason: reason.trim() || null,
    }).eq('id', id);
    loadAll();
  };

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/approvals"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  const total = pendingExpenses.length + pendingMileage.length;
  const memberName = userId => members[userId]?.email || 'Unknown';

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/approvals"/>

      <main style={{maxWidth:880,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{marginBottom:18}}>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'0'}}>APPROVALS</h1>
          <div style={{fontSize:13,color:'#7a8db0',marginTop:2}}>{total} pending</div>
        </div>

        <SubNav active="/approvals" items={[
          { route:'/crew',      label:'Crew' },
          { route:'/approvals', label:'Approvals', badge: total },
        ]}/>

        {total === 0 && (
          <div style={{textAlign:'center',padding:'60px 24px',color:'#7a8db0'}}>
            <div style={{fontSize:36,marginBottom:8}}>✓</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>ALL CLEAR</div>
            <div style={{fontSize:13}}>No pending expense or mileage submissions to review.</div>
          </div>
        )}

        {pendingExpenses.length > 0 && (
          <>
            <Section title={`Expenses · ${pendingExpenses.length}`} color="#f26060"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
              {pendingExpenses.map(e => (
                <Card key={e.id}
                  who={memberName(e.owner_id)}
                  date={e.expense_date}
                  amount={fmt$(e.amount || 0)} amountColor="#f26060"
                  primary={e.vendor || e.description || e.category || '—'}
                  secondary={`${e.category}${e.description ? ' · ' + e.description : ''}`}
                  onApprove={() => approveExpense(e.id)}
                  onReject={() => rejectExpense(e.id)}/>
              ))}
            </div>
          </>
        )}

        {pendingMileage.length > 0 && (
          <>
            <Section title={`Mileage · ${pendingMileage.length}`} color="#4f9eff"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:18}}>
              {pendingMileage.map(m => (
                <Card key={m.id}
                  who={memberName(m.user_id)}
                  date={m.log_date}
                  amount={`${Number(m.miles || 0).toFixed(1)} mi`} amountColor="#4f9eff"
                  primary={m.purpose}
                  secondary={m.notes || `${m.method} entry`}
                  onApprove={() => approveMileage(m.id)}
                  onReject={() => rejectMileage(m.id)}/>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, color }) {
  return (
    <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',color,marginBottom:8,fontWeight:700,marginTop:8}}>{title.toUpperCase()}</div>
  );
}

function Card({ who, date, amount, amountColor, primary, secondary, onApprove, onReject }) {
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:4,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:8,flex:1,minWidth:0}}>
          <span style={{fontSize:11,color:'#7a8db0',fontWeight:600}}>{who}</span>
          <span style={{fontSize:11,color:'#7a8db0'}}>· {fmtDate(date)}</span>
        </div>
        <span style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,color:amountColor,whiteSpace:'nowrap'}}>{amount}</span>
      </div>
      <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,marginBottom:2}}>{primary}</div>
      {secondary && <div style={{fontSize:11,color:'#7a8db0',marginBottom:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{secondary}</div>}
      <div style={{display:'flex',gap:6}}>
        <button onClick={onApprove} style={{flex:1,background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:6,color:'#2edf87',padding:'7px 0',fontSize:12,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
          APPROVE
        </button>
        <button onClick={onReject} style={{flex:1,background:'#f2606022',border:'1px solid #f2606066',borderRadius:6,color:'#f26060',padding:'7px 0',fontSize:12,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
          REJECT
        </button>
      </div>
    </div>
  );
}
