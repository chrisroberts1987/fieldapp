import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isForeman, isSupervisor, isCrew, isOffice, roleLabel, roleColor } from '../../lib/role';
import { fmt$, fmtDate } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import SubNav from '../../components/SubNav';
import { sendEmail } from '../../lib/email/client';
import { seatStatus } from '../../lib/billing';

export default function Crew() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, org, role, loading: orgLoading } = useOrg(user);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [jobsByUser, setJobsByUser] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [inviteForm, setInviteForm] = useState({ invite_email:'', invite_phone:'', role:'crew', hourly_pay_rate:'' });
  const [saving, setSaving] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    const { data: m } = await supabase.rpc('list_org_members', { p_org_id: orgId });
    setMembers(Array.isArray(m) ? m : []);

    if (isForeman(role)) {
      const { data: inv } = await supabase
        .from('org_invitations').select('*')
        .eq('org_id', orgId).is('accepted_at', null)
        .order('created_at', { ascending:false });
      setInvites(inv || []);
    } else {
      setInvites([]);
    }

    const { data: j } = await supabase
      .from('jobs').select('assigned_to_user_id, status')
      .eq('org_id', orgId).in('status', ['scheduled','in_progress']);
    const map = {};
    (j || []).forEach(jb => {
      if (jb.assigned_to_user_id) {
        if (!map[jb.assigned_to_user_id]) map[jb.assigned_to_user_id] = [];
        map[jb.assigned_to_user_id].push(jb);
      }
    });
    setJobsByUser(map);

    // Pending approvals badge for the SubNav (office only).
    if (isOffice(role)) {
      const [{ count: ec }, { count: mc }] = await Promise.all([
        supabase.from('expenses').select('id', { count:'exact', head:true }).eq('org_id', orgId).eq('approval_status', 'pending'),
        supabase.from('mileage_logs').select('id', { count:'exact', head:true }).eq('org_id', orgId).eq('approval_status', 'pending'),
      ]);
      setPendingCount((ec || 0) + (mc || 0));
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
    if (orgId) loadAll();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  useRefetchOnFocus(loadAll, !!orgId);

  // Seat usage: confirmed members + pending invitations (each invite
  // is holding a seat for someone who hasn't accepted yet).
  const seatUsage = members.length + invites.length;
  const seats = seatStatus(org, seatUsage);

  const openInvite = () => {
    if (seats.state !== 'ok') return; // gated buttons should never reach here, but defend
    setInviteForm({ invite_email:'', invite_phone:'', role:'crew', hourly_pay_rate:'' });
    setNewInvite(null);
    setError('');
    setSheet('invite');
  };

  const sendInvite = async () => {
    setError('');
    if (!inviteForm.invite_email && !inviteForm.invite_phone) {
      setError('Email or phone required.');
      return;
    }
    // Re-check the seat cap at submit time — guards against a stale UI
    // (someone accepted an invite in another tab while this sheet was open).
    if (seats.state !== 'ok') {
      setError(`You're at the ${seats.limit}-member limit for your plan.`);
      return;
    }
    setSaving(true);
    const rate = inviteForm.hourly_pay_rate === '' ? null : Number(inviteForm.hourly_pay_rate);
    const { data, error: e } = await supabase.from('org_invitations').insert({
      org_id: orgId,
      invited_by: user.id,
      invite_email: inviteForm.invite_email.trim() || null,
      invite_phone: inviteForm.invite_phone.trim() || null,
      role: inviteForm.role,
      hourly_pay_rate: rate,
    }).select('*').single();
    setSaving(false);
    if (e) { setError(e.message); return; }
    setNewInvite(data);

    // Fire the invite email if we have one. Best-effort — the invite
    // exists either way, so the foreman can still copy/share the link.
    if (data.invite_email) {
      const url = `${window.location.origin}/invite/${data.token}`;
      const r = await sendEmail({
        type: 'crew_invite',
        to: data.invite_email,
        data: { role: data.role, inviteUrl: url, payRate: data.hourly_pay_rate },
      });
      if (!r.ok) setError('Invite created but email didn\'t send: ' + r.error);
    }

    await loadAll();
  };

  const revokeInvite = async (inviteId) => {
    if (!confirm('Revoke this invitation?')) return;
    await supabase.from('org_invitations').delete().eq('id', inviteId);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const inviteUrl = newInvite && typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${newInvite.token}` : '';
  const inviteUrlFor = (token) => typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${token}` : '';
  const copyInviteUrl = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(()=>setCopied(false),1800); } catch {}
  };
  const sms = (phone, url) => `sms:${phone || ''}?body=${encodeURIComponent("You've been invited to join our MyForeman team: " + url)}`;
  const mail = (email, url) => `mailto:${email || ''}?subject=${encodeURIComponent('Join our MyForeman team')}&body=${encodeURIComponent("You've been invited to join our team on MyForeman.\n\nTap the link below to accept and get set up:\n" + url + "\n\nThanks.")}`;

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/crew"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  // CREW MEMBER VIEW
  if (isCrew(role)) {
    const me = members.find(m => m.user_id === user.id);
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
        <TopNav active="/crew"/>
        <main style={{maxWidth:520,margin:'0 auto',padding:'28px 20px 0'}}>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Your profile</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0'}}>YOUR PROFILE</h1>
          </div>
          <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'20px 18px'}}>
            <Row label="Role"><RolePill role={role}/></Row>
            <Row label="Hourly rate">{me?.hourly_pay_rate != null ? fmt$(me.hourly_pay_rate) + ' / hr' : <span style={{color:'#7a8db0'}}>Not set</span>}</Row>
            <Row label="Joined">{me?.joined_at ? fmtDate(me.joined_at.slice(0,10)) : '—'}</Row>
            <Row label="Email">{user.email}</Row>
          </div>
          <div style={{marginTop:14,fontSize:12,color:'#7a8db0',lineHeight:1.55}}>
            Your foreman manages your role and pay rate. Reach out if anything looks off.
          </div>
        </main>
      </div>
    );
  }

  // FOREMAN + SUPERVISOR VIEW
  //
  // Supervisors see only their direct reports + themselves. Foreman
  // sees the full org sorted by tier (foreman → supervisor → crew).
  const visibleMembers = isSupervisor(role)
    ? members.filter(m => m.user_id === user.id || m.supervisor_id === user.id)
    : members;
  const sortedMembers = [...visibleMembers].sort((a, b) => {
    const orderOf = r => isForeman(r) ? 0 : isSupervisor(r) ? 1 : 2;
    return orderOf(a.role) - orderOf(b.role);
  });
  const supervisors = members.filter(m => isSupervisor(m.role));

  const assignSupervisor = async (memberUserId, supervisorUserId) => {
    const { error } = await supabase.rpc('set_member_supervisor', {
      p_member_user_id: memberUserId,
      p_supervisor_user_id: supervisorUserId || null,
    });
    if (error) { setError(error.message); return; }
    await loadAll();
  };

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/crew"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:18}}>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Crew</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0'}}>CREW</h1>
            <div style={{fontSize:13,color:'#7a8db0',marginTop:2}}>
              {members.length} member{members.length===1?'':'s'} · {seatUsage} of {seats.limit} seats used
            </div>
          </div>
          {isForeman(role) && <SeatAwareInviteButton seats={seats} onInvite={openInvite} onUpgrade={() => router.push('/billing')}/>}
        </div>

        <SubNav active="/crew" items={[
          { route:'/crew',      label:'Crew' },
          { route:'/approvals', label:'Approvals', badge: pendingCount },
        ]}/>

        {isForeman(role) && invites.length > 0 && (
          <div style={{marginBottom:18}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',color:'#fbbf24',marginBottom:8}}>PENDING INVITATIONS</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {invites.map(inv => {
                const url = inviteUrlFor(inv.token);
                return (
                  <div key={inv.id} style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 14px'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                        <RolePill role={inv.role}/>
                        <div style={{fontSize:13,color:'#f0f4ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {inv.invite_email || inv.invite_phone || 'Unknown'}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                        {inv.hourly_pay_rate != null && <span style={{fontSize:12,color:'#c8d4ee'}}>{fmt$(inv.hourly_pay_rate)}/hr</span>}
                        <button onClick={() => revokeInvite(inv.id)} style={{background:'none',border:'none',color:'#f26060',fontSize:11,fontWeight:700,cursor:'pointer'}}>REVOKE</button>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <input readOnly value={url} style={{flex:1,background:'#111827',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',fontSize:11,padding:'6px 8px',outline:'none',fontFamily:'monospace'}}/>
                      <button onClick={() => copyInviteUrl(url)}
                        style={{background:copied===url?'#2edf8722':'#4f9eff',border:copied===url?'1px solid #2edf87':'none',borderRadius:8,color:copied===url?'#2edf87':'#fff',padding:'6px 10px',fontSize:10,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
                        {copied===url ? 'COPIED' : 'COPY'}
                      </button>
                      {inv.invite_phone && <a href={sms(inv.invite_phone, url)} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'6px 10px',fontSize:10,fontWeight:700,letterSpacing:'.05em',textDecoration:'none'}}>SMS</a>}
                      {inv.invite_email && <a href={mail(inv.invite_email, url)} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'6px 10px',fontSize:10,fontWeight:700,letterSpacing:'.05em',textDecoration:'none'}}>EMAIL</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          {sortedMembers.map(m => {
            const active = (jobsByUser[m.user_id] || []).length > 0;
            const isMe = m.user_id === user.id;
            const memberIsCrew = isCrew(m.role);
            const sup = m.supervisor_id ? members.find(x => x.user_id === m.supervisor_id) : null;
            return (
              <div key={m.user_id}
                onClick={isForeman(role) ? () => router.push('/crew/' + m.user_id) : undefined}
                style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 14px',cursor: isForeman(role) ? 'pointer' : 'default'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <Avatar email={m.email}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {m.email}{isMe && <span style={{color:'#7a8db0',marginLeft:6,fontSize:12}}>(you)</span>}
                    </div>
                    <div style={{display:'flex',gap:6,marginTop:3,alignItems:'center',flexWrap:'wrap'}}>
                      <RolePill role={m.role}/>
                      <span style={{fontSize:10,fontWeight:700,letterSpacing:'.06em',padding:'2px 6px',borderRadius:4,background: active ? '#2edf8722' : '#7a8db022',color: active ? '#2edf87' : '#7a8db0',border:`1px solid ${active ? '#2edf8766' : '#7a8db066'}`}}>
                        {active ? 'ON A JOB' : 'AVAILABLE'}
                      </span>
                      {memberIsCrew && sup && (
                        <span style={{fontSize:10,color:'#b197fc',letterSpacing:'.06em',fontWeight:600,textTransform:'uppercase'}}>
                          reports to {sup.email?.split('@')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{textAlign:'right',fontSize:11,color:'#7a8db0'}}>
                    {m.hourly_pay_rate != null
                      ? <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,color:'#2edf87'}}>{fmt$(m.hourly_pay_rate)}/hr</div>
                      : <span>—</span>}
                  </div>
                </div>

                {/* Foreman-only: assign this crew member to a supervisor.
                    Hidden for non-crew rows and hidden when there are no
                    supervisors yet (suggest inviting one). */}
                {isForeman(role) && memberIsCrew && (
                  <div onClick={e => e.stopPropagation()}
                    style={{marginTop:10,paddingTop:10,borderTop:'1px solid #2e3f60',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700,flexShrink:0}}>Reports to</div>
                    {supervisors.length === 0 ? (
                      <span style={{fontSize:12,color:'#7a8db0',fontStyle:'italic'}}>Invite a Supervisor to enable assignment.</span>
                    ) : (
                      <select
                        value={m.supervisor_id || ''}
                        onChange={e => assignSupervisor(m.user_id, e.target.value)}
                        style={{flex:'1 1 200px',minWidth:0,background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',fontSize:13,padding:'7px 10px',outline:'none',fontFamily:'inherit'}}>
                        <option value="">— Reports directly to Foreman —</option>
                        {supervisors.map(s => (
                          <option key={s.user_id} value={s.user_id}>{s.display_name || s.email}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {sheet === 'invite' && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.72)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}} onClick={e => e.target===e.currentTarget && setSheet(null)}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,margin:'0 auto',maxHeight:'90vh',overflowY:'auto',paddingBottom:24}}>
            <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:21,letterSpacing:'.08em',padding:'6px 16px 4px',color:'#f0f4ff'}}>INVITE TEAM MEMBER</div>

            {newInvite ? (
              <div style={{padding:'10px 16px 0'}}>
                <div style={{background:'#2edf8722',border:'1px solid #2edf8766',borderRadius:10,padding:'12px 14px',marginBottom:12}}>
                  <div style={{fontSize:13,color:'#2edf87',fontWeight:600,marginBottom:4}}>✓ Invite created</div>
                  <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.5}}>Share this link with {newInvite.invite_email || newInvite.invite_phone}. They sign up at the link and join the team automatically.</div>
                </div>
                <div style={{display:'flex',gap:6,marginBottom:8}}>
                  <input readOnly value={inviteUrl} style={{flex:1,background:'#111827',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',fontSize:12,padding:'8px 10px',outline:'none',fontFamily:'monospace'}}/>
                  <button onClick={() => copyInviteUrl(inviteUrl)}
                    style={{background:copied===inviteUrl?'#2edf8722':'#4f9eff',border:copied===inviteUrl?'1px solid #2edf87':'none',borderRadius:8,color:copied===inviteUrl?'#2edf87':'#fff',padding:'8px 14px',fontSize:12,fontWeight:700,letterSpacing:'.05em',cursor:'pointer'}}>
                    {copied===inviteUrl ? 'COPIED' : 'COPY'}
                  </button>
                </div>
                <div style={{display:'flex',gap:6,marginBottom:14}}>
                  {newInvite.invite_phone && <a href={sms(newInvite.invite_phone, inviteUrl)} style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 0',fontSize:12,fontWeight:700,letterSpacing:'.06em',textAlign:'center',textDecoration:'none'}}>TEXT IT</a>}
                  {newInvite.invite_email && <a href={mail(newInvite.invite_email, inviteUrl)} style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 0',fontSize:12,fontWeight:700,letterSpacing:'.06em',textAlign:'center',textDecoration:'none'}}>EMAIL IT</a>}
                </div>
                <button onClick={() => setSheet(null)} style={{width:'100%',background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'12px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.08em',fontWeight:700,cursor:'pointer'}}>DONE</button>
              </div>
            ) : (
              <>
                <div style={{margin:'10px 16px'}}>
                  <div style={fieldLabel}>Email</div>
                  <input type="email" placeholder="them@example.com" value={inviteForm.invite_email}
                    onChange={e => setInviteForm(p => ({...p, invite_email:e.target.value}))} style={inputStyle}/>
                </div>
                <div style={{margin:'10px 16px'}}>
                  <div style={fieldLabel}>Phone (optional)</div>
                  <input type="tel" placeholder="512-555-0100" value={inviteForm.invite_phone}
                    onChange={e => setInviteForm(p => ({...p, invite_phone:e.target.value}))} style={inputStyle}/>
                </div>
                <div style={{margin:'10px 16px'}}>
                  <div style={fieldLabel}>Role</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    {[
                      { value:'crew',       label:'Crew',       color:'#54d4f8' },
                      { value:'dispatcher', label:'Supervisor', color:'#b197fc' },
                      { value:'admin',      label:'Foreman',    color:'#4f9eff' },
                    ].map(r => (
                      <button key={r.value} onClick={() => setInviteForm(p => ({...p, role:r.value}))}
                        style={{
                          background: inviteForm.role===r.value ? r.color+'22' : 'transparent',
                          border: '1.5px solid ' + (inviteForm.role===r.value ? r.color : '#2e3f60'),
                          color: inviteForm.role===r.value ? r.color : '#c8d4ee',
                          borderRadius:10, padding:'10px 4px', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'.04em',
                        }}>{r.label}</button>
                    ))}
                  </div>
                </div>
                <div style={{margin:'10px 16px'}}>
                  <div style={fieldLabel}>Hourly Pay Rate ($) — optional</div>
                  <input type="number" inputMode="decimal" placeholder="25.00" value={inviteForm.hourly_pay_rate}
                    onChange={e => setInviteForm(p => ({...p, hourly_pay_rate:e.target.value}))} style={inputStyle}/>
                </div>

                {error && <div style={{margin:'8px 16px',background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',fontSize:12,color:'#f26060'}}>{error}</div>}

                <div style={{padding:'8px 16px 0',display:'flex',gap:8}}>
                  <button onClick={sendInvite} disabled={saving}
                    style={{flex:1,background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:17,letterSpacing:'.06em',cursor:'pointer',opacity:saving?0.6:1}}>
                    {saving ? 'Creating...' : 'Create Invite'}
                  </button>
                  <button onClick={() => setSheet(null)}
                    style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'13px 16px',cursor:'pointer',fontSize:13,fontWeight:600}}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Renders the right CTA based on seat availability.
//   ok                 → normal blue "+ INVITE" button
//   upgrade_available  → orange "UPGRADE" — clicking lands on /billing
//   contact_support    → grey "CONTACT SUPPORT" — opens email to support
function SeatAwareInviteButton({ seats, onInvite, onUpgrade }) {
  if (seats.state === 'ok') {
    return (
      <button onClick={onInvite}
        style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>
        + INVITE
      </button>
    );
  }
  if (seats.state === 'upgrade_available') {
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
        <button onClick={onUpgrade}
          style={{background:'#fbbf24',border:'none',borderRadius:8,color:'#0d1726',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>
          UPGRADE TO ADD MORE
        </button>
        <div style={{fontSize:11,color:'#fbbf24'}}>{seats.limit}-seat limit reached</div>
      </div>
    );
  }
  // contact_support — already on Business (25 seats)
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
      <a href="mailto:support@myforemanhq.com?subject=Custom%20plan%20%2B%20more%20seats"
        style={{background:'transparent',border:'1.5px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'10px 18px',fontWeight:700,fontSize:13,letterSpacing:'.04em',textDecoration:'none'}}>
        CONTACT SUPPORT
      </a>
      <div style={{fontSize:11,color:'#7a8db0'}}>Business tier maxes at 25 seats — email us for custom pricing</div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'8px 0',borderBottom:'1px solid #2e3f60'}}>
      <span style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>{label}</span>
      <span style={{fontSize:14,color:'#f0f4ff',fontWeight:600}}>{children}</span>
    </div>
  );
}

function RolePill({ role }) {
  const c = roleColor(role);
  return (
    <span style={{fontSize:10,letterSpacing:'.06em',padding:'2px 8px',background:c+'22',color:c,border:`1px solid ${c}66`,borderRadius:999,fontWeight:700,textTransform:'uppercase'}}>
      {roleLabel(role)}
    </span>
  );
}

function Avatar({ email }) {
  const initial = (email || '?')[0].toUpperCase();
  return (
    <div style={{width:32,height:32,borderRadius:16,background:'#2e3f60',color:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,flexShrink:0}}>
      {initial}
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
