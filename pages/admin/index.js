import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { fmt$, fmtDate } from '../../lib/helpers';
import { HorizontalLogo } from '../../components/Logo';
import { toast } from '../../components/Toast';

// Platform-owner admin dashboard. Client-side this is a thin shell:
// every data call goes through /api/admin/* which re-verifies the
// caller's email server-side. Bypassing the client redirect won't
// reveal data — the endpoints 403 anyone who isn't the admin.

const ADMIN_EMAIL = 'chris.roberts@myforemanhq.com';

export default function Admin() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [allowed, setAllowed] = useState(null);   // null = checking, true/false = decided
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      const ok = (session.user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setAllowed(ok);
      if (!ok) router.push('/dashboard');
    })();
  }, []);

  if (allowed !== true) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{color:'#7a8db0'}}>{allowed === false ? 'Redirecting…' : 'Checking access…'}</div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <AdminHeader user={user} router={router} />
      <nav style={{
        display:'flex',
        gap:0,
        padding:'0 8px',
        borderBottom:'1px solid #2e3f60',
        background:'#0d1726',
        overflowX:'auto',
        WebkitOverflowScrolling:'touch',
        scrollbarWidth:'none',
      }}>
        {['overview','finances','reach','businesses','usage','ai','support'].map(k => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              background:'transparent', border:'none',
              borderBottom: tab === k ? '2px solid #4f9eff' : '2px solid transparent',
              color: tab === k ? '#f0f4ff' : '#7a8db0',
              padding:'12px 12px', fontSize:12, fontWeight: tab === k ? 700 : 600,
              letterSpacing:'.05em', cursor:'pointer', fontFamily:'inherit',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
            {k.toUpperCase()}
          </button>
        ))}
      </nav>

      <main style={{maxWidth:1280,margin:'0 auto',padding:'24px 16px 0'}}>
        {tab === 'overview'   && <OverviewSection onGoTo={setTab} />}
        {tab === 'finances'   && <FinancesSection />}
        {tab === 'reach'      && <ReachSection />}
        {tab === 'businesses' && <BusinessesSection />}
        {tab === 'usage'      && <UsageSection />}
        {tab === 'ai'         && <AiUsageSection />}
        {tab === 'support'    && <SupportSection />}
      </main>
    </div>
  );
}

// =============================================================
// Header
// =============================================================
function AdminHeader({ user, router }) {
  const signOut = async () => { await supabase.auth.signOut(); router.push('/login'); };
  return (
    <div style={{background:'#0d1726',borderBottom:'1px solid #1f2a40',padding:'12px 14px'}}>
      <div style={{maxWidth:1280,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}>
          <HorizontalLogo height={36}/>
          <span style={{background:'#fbbf2422',color:'#fbbf24',border:'1px solid #fbbf2466',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',whiteSpace:'nowrap'}}>Admin</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <button onClick={() => router.push('/dashboard')} style={{...btnGhost,padding:'6px 10px',fontSize:11}}>App</button>
          <button onClick={() => router.push('/settings')} style={{...btnGhost,padding:'6px 10px',fontSize:11}}>Settings</button>
          <button onClick={signOut} style={{...btnGhost,color:'#f26060',borderColor:'#f2606055',padding:'6px 10px',fontSize:11}}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// API helpers
// =============================================================
async function adminFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Not signed in.' };
  const r = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      'Authorization': `Bearer ${session.access_token}`,
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { error: body?.error || `Request failed (${r.status})` };
  return body;
}

// =============================================================
// Overview
// =============================================================
function OverviewSection({ onGoTo }) {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [detail, setDetail] = useState(null); // org row to drill into

  useEffect(() => {
    (async () => {
      const r = await adminFetch('/api/admin/overview');
      if (r.error) setErr(r.error); else setData(r);
    })();
  }, []);
  if (err)   return <ErrorBlock msg={err}/>;
  if (!data) return <Loading/>;

  const tierTotal = (data.byTier.solo || 0) + (data.byTier.crew || 0) + (data.byTier.business || 0);

  return (
    <>
      <SectionHeading title="Platform Overview"/>
      <div style={kpiGrid}>
        <Kpi label="Total Businesses"   value={data.totalBusinesses}    color="#4f9eff" onClick={() => onGoTo('businesses')}/>
        <Kpi label="Trialing"           value={data.trialAccounts}      color="#fbbf24" sub="card on file, day 1–14" onClick={() => onGoTo('businesses')}/>
        <Kpi label="Active"             value={data.activeSubs}         color="#2edf87" sub="paying" onClick={() => onGoTo('businesses')}/>
        <Kpi label="MRR"                value={'$' + (data.mrr || 0).toLocaleString()} color="#2edf87" sub="monthly recurring" onClick={() => onGoTo('finances')}/>
        <Kpi label="Conversion"         value={data.conversionRate != null ? `${data.conversionRate}%` : '—'} color="#54d4f8" sub={`trial → paid (n=${data.conversionCohortSize})`} onClick={() => onGoTo('businesses')}/>
        <Kpi label="New This Week"      value={data.newSignupsThisWeek} color="#54d4f8" onClick={() => onGoTo('businesses')}/>
        <Kpi label="Past Due"           value={data.pastDue}            color="#fbbf24" sub="payment failed" onClick={() => onGoTo('businesses')}/>
        <Kpi label="Churned This Month" value={data.churnedThisMonth}   color="#f26060" sub="suspended" onClick={() => onGoTo('businesses')}/>
      </div>

      <Subhead>Subscriptions by Tier</Subhead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:18}}>
        <TierCard tier="solo"     count={data.byTier.solo     || 0} total={tierTotal} accent="#4f9eff" onClick={() => onGoTo('businesses')}/>
        <TierCard tier="crew"     count={data.byTier.crew     || 0} total={tierTotal} accent="#2edf87" onClick={() => onGoTo('businesses')}/>
        <TierCard tier="business" count={data.byTier.business || 0} total={tierTotal} accent="#b197fc" onClick={() => onGoTo('businesses')}/>
      </div>

      <Subhead>Geographic Reach</Subhead>
      <StatesPanel states={data.states || []} totalBusinesses={data.totalBusinesses}/>

      <Subhead>Recent Signups</Subhead>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
        {data.recentSignups.length === 0 && <div style={empty}>No signups yet.</div>}
        {data.recentSignups.map(s => (
          <SignupRow key={s.id} signup={s} onClick={() => setDetail({ id: s.id, name: s.name })}/>
        ))}
      </div>

      {detail && (
        <BusinessDetailModal
          business={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {}}
        />
      )}
    </>
  );
}

function StatesPanel({ states, totalBusinesses }) {
  const [expanded, setExpanded] = useState(false);
  const known = states.filter(s => s.code !== '??');
  const unknown = states.find(s => s.code === '??');
  const top = expanded ? known : known.slice(0, 6);
  const maxCount = Math.max(1, ...known.map(s => s.count));
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px',marginBottom:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10,gap:6,flexWrap:'wrap'}}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.10em',textTransform:'uppercase',fontWeight:700}}>
          {known.length} state{known.length === 1 ? '' : 's'} represented
          {unknown ? ` · ${unknown.count} unparseable address${unknown.count === 1 ? '' : 'es'}` : ''}
        </div>
        {known.length > 6 && (
          <button onClick={() => setExpanded(e => !e)}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'4px 10px',fontSize:11,fontWeight:600,letterSpacing:'.04em',cursor:'pointer',fontFamily:'inherit'}}>
            {expanded ? 'SHOW TOP 6' : `SHOW ALL ${known.length}`}
          </button>
        )}
      </div>
      {known.length === 0 ? (
        <div style={empty}>No parseable addresses yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {top.map(s => {
            const pct = totalBusinesses > 0 ? Math.round((s.count / totalBusinesses) * 100) : 0;
            const barPct = (s.count / maxCount) * 100;
            return (
              <div key={s.code} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#f0f4ff',width:36,letterSpacing:'.04em'}}>{s.code}</div>
                <div style={{flex:1,height:8,background:'#0d1726',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${barPct}%`,background:'#4f9eff',transition:'width .25s'}}/>
                </div>
                <div style={{fontSize:12,color:'#c8d4ee',fontWeight:600,minWidth:50,textAlign:'right'}}>{s.count} · {pct}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TierCard({ tier, count, total, accent, onClick }) {
  const label = tier[0].toUpperCase() + tier.slice(1);
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const interactive = typeof onClick === 'function';
  return (
    <div onClick={onClick}
      onMouseEnter={interactive ? e => { e.currentTarget.style.borderColor = '#4f9eff66'; } : undefined}
      onMouseLeave={interactive ? e => { e.currentTarget.style.borderColor = '#2e3f60'; } : undefined}
      style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px',cursor: interactive ? 'pointer' : 'default',transition:'border-color .15s'}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>{label}</div>
        <div style={{fontSize:11,color:'#7a8db0'}}>{pct}%</div>
      </div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.02em',color:accent,lineHeight:1.1,marginTop:4}}>{count}</div>
      <div style={{height:4,background:'#0d1726',borderRadius:999,overflow:'hidden',marginTop:8}}>
        <div style={{width:pct+'%',height:'100%',background:accent,transition:'width .3s'}}/>
      </div>
    </div>
  );
}

// =============================================================
// Finances — your platform-level dashboard
// =============================================================
function FinancesSection() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  useEffect(() => {
    (async () => {
      const r = await adminFetch('/api/admin/finances');
      if (r.error) setErr(r.error); else setData(r);
    })();
  }, []);
  if (err)   return <ErrorBlock msg={err}/>;
  if (!data) return <Loading/>;

  const fmt = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const maxSignups = Math.max(1, ...data.trend.map(t => t.signups));
  const netColor = data.estNetThisMonth >= 0 ? '#2edf87' : '#f26060';

  return (
    <>
      <SectionHeading title="Platform Finances" subtitle="Your business at the platform level. MRR + ARR estimated from current paid tiers, AI cost is live from the usage log."/>

      <div style={{display:'grid',gridTemplateColumns:'1fr',gap:14,marginBottom:14}}>
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'22px 20px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at top right, ${netColor}1a, transparent 60%)`,pointerEvents:'none'}}/>
          <div style={{position:'relative'}}>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Estimated Net · This Month</div>
            <div style={{display:'flex',alignItems:'baseline',gap:12,flexWrap:'wrap'}}>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:56,letterSpacing:'.02em',lineHeight:1,color:netColor}}>
                {fmt(data.estNetThisMonth)}
              </div>
              <div style={{fontSize:13,color:'#c8d4ee'}}>
                {data.grossMargin != null ? `${data.grossMargin}% gross margin` : '—'}
              </div>
            </div>
            <div style={{marginTop:10,display:'flex',gap:18,flexWrap:'wrap',fontSize:13,color:'#c8d4ee'}}>
              <span>Revenue: <span style={{color:'#2edf87',fontWeight:600}}>{fmt(data.revenueThisMonth)}</span></span>
              <span>AI cost: <span style={{color:'#f26060',fontWeight:600}}>{fmt(data.aiCostThisMonth)}</span></span>
            </div>
          </div>
        </div>
      </div>

      <Subhead>Recurring revenue</Subhead>
      <div style={kpiGrid}>
        <Kpi label="MRR"            value={fmt(data.mrr)} color="#2edf87" sub={`${data.paidCount} paying customers`}/>
        <Kpi label="ARR"            value={fmt(data.arr)} color="#2edf87" sub="annualized"/>
        <Kpi label="Trialing"       value={data.trialingCount} color="#fbbf24" sub="not yet paying"/>
        <Kpi label="AI Cost YTD"    value={fmt(data.aiCostYTD)} color="#fbbf24" sub="from usage log"/>
      </div>

      <Subhead>MRR by Tier</Subhead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:18}}>
        <TierMrrCard tier="solo"     mrr={data.tierMrr.solo     || 0} totalMrr={data.mrr} accent="#4f9eff"/>
        <TierMrrCard tier="crew"     mrr={data.tierMrr.crew     || 0} totalMrr={data.mrr} accent="#2edf87"/>
        <TierMrrCard tier="business" mrr={data.tierMrr.business || 0} totalMrr={data.mrr} accent="#b197fc"/>
      </div>

      <Subhead>12-Month Signups</Subhead>
      <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'16px 16px',marginBottom:18}}>
        <div style={{display:'flex',alignItems:'flex-end',gap:6,height:140}}>
          {data.trend.map((m, i) => {
            const h = Math.max(2, Math.round((m.signups / maxSignups) * 120));
            return (
              <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                <div title={`${m.signups} signups`} style={{width:'100%',background:'#4f9eff',height:h,borderRadius:4,opacity:m.signups > 0 ? 1 : 0.18}}/>
                <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.04em'}}>{m.label}</div>
                <div style={{fontSize:10,color:'#c8d4ee',fontWeight:600}}>{m.signups}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{fontSize:11,color:'#7a8db0',lineHeight:1.55,marginTop:8}}>
        Numbers are estimates. MRR sums published plan prices across active subs (Stripe is the source of truth for actual billed amounts). YTD revenue assumes steady-state MRR; replace with Stripe's actual invoiced total when wired in.
      </div>
    </>
  );
}

function TierMrrCard({ tier, mrr, totalMrr, accent }) {
  const label = tier[0].toUpperCase() + tier.slice(1);
  const pct = totalMrr > 0 ? Math.round((mrr / totalMrr) * 100) : 0;
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>{label}</div>
        <div style={{fontSize:11,color:'#7a8db0'}}>{pct}%</div>
      </div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.02em',color:accent,lineHeight:1.1,marginTop:4}}>
        ${mrr.toLocaleString()}
      </div>
      <div style={{fontSize:11,color:'#7a8db0',marginTop:3}}>per month</div>
      <div style={{height:4,background:'#0d1726',borderRadius:999,overflow:'hidden',marginTop:8}}>
        <div style={{width:pct+'%',height:'100%',background:accent,transition:'width .3s'}}/>
      </div>
    </div>
  );
}

// =============================================================
// Reach — geographic breakdown of every paying + trialing org.
// Each state card expands to show top cities + a recent org list.
// =============================================================
function ReachSection() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [openId, setOpenId] = useState(null); // expanded state code
  const [detail, setDetail] = useState(null); // org drill-in

  useEffect(() => {
    (async () => {
      const r = await adminFetch('/api/admin/reach');
      if (r.error) setErr(r.error); else setData(r);
    })();
  }, []);

  if (err)   return <ErrorBlock msg={err}/>;
  if (!data) return <Loading/>;

  const maxCount = Math.max(1, ...data.states.map(s => s.count));

  return (
    <>
      <SectionHeading title="Geographic Reach" subtitle="Where your contractors are. Parsed from their business address."/>

      <div style={kpiGrid}>
        <Kpi label="States Covered" value={data.statesCovered} color="#4f9eff"/>
        <Kpi label="Mapped Orgs"    value={data.knownTotal}    color="#2edf87" sub={`of ${data.total} total`}/>
        <Kpi label="Unparseable"    value={data.unknownTotal}  color="#fbbf24" sub="address missing state + ZIP"/>
        <Kpi label="Top State"      value={data.states[0]?.code || '—'} color="#b197fc" sub={data.states[0] ? `${data.states[0].count} orgs (${data.states[0].pct}%)` : ''}/>
      </div>

      <Subhead>States · Click a row to expand</Subhead>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:18}}>
        {data.states.length === 0 ? (
          <div style={empty}>No parseable addresses yet. As contractors sign up, this will populate.</div>
        ) : data.states.map(s => {
          const isOpen = openId === s.code;
          const barPct = (s.count / maxCount) * 100;
          return (
            <div key={s.code} style={{background:'#1e2a42',border:'1px solid '+(isOpen?'#4f9eff66':'#2e3f60'),borderRadius:10,overflow:'hidden',transition:'border-color .15s'}}>
              <button onClick={() => setOpenId(isOpen ? null : s.code)}
                style={{display:'flex',alignItems:'center',gap:12,width:'100%',padding:'12px 14px',background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit',color:'inherit',textAlign:'left'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:'#f0f4ff',width:40,letterSpacing:'.04em'}}>{s.code}</div>
                <div style={{flex:1,height:10,background:'#0d1726',borderRadius:5,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${barPct}%`,background:'#4f9eff',transition:'width .25s'}}/>
                </div>
                <div style={{fontSize:13,color:'#c8d4ee',fontWeight:600,minWidth:90,textAlign:'right'}}>{s.count} org{s.count === 1 ? '' : 's'} · {s.pct}%</div>
                <div style={{fontSize:14,color:'#4f9eff',width:14,textAlign:'center'}}>{isOpen ? '▾' : '▸'}</div>
              </button>

              {isOpen && (
                <div style={{padding:'4px 14px 14px',borderTop:'1px solid #2e3f60'}}>
                  {s.topCities.length > 0 && (
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10,marginBottom:12}}>
                      {s.topCities.map(c => (
                        <span key={c.city} style={{background:'#0d1726',border:'1px solid #2e3f60',borderRadius:999,padding:'4px 10px',fontSize:11,color:'#c8d4ee',fontWeight:600}}>
                          {c.city} · {c.count}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>
                    Most recent ({s.recentOrgs.length})
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}>
                    {s.recentOrgs.map(o => (
                      <ReachOrgRow key={o.id} org={o} onClick={() => setDetail({ id: o.id, name: o.name })}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.unknownTotal > 0 && (
        <>
          <Subhead>Addresses we couldn't parse</Subhead>
          <div style={{fontSize:12,color:'#7a8db0',marginBottom:8,lineHeight:1.5}}>
            These orgs are missing a recognizable "ST 12345" pattern in their address. Open each one and prompt the owner to update it in Settings.
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:18}}>
            {data.unknownOrgs.map(o => (
              <ReachOrgRow key={o.id} org={o} onClick={() => setDetail({ id: o.id, name: o.name })}/>
            ))}
            {data.unknownTotal > data.unknownOrgs.length && (
              <div style={{fontSize:11,color:'#7a8db0',padding:'6px 4px'}}>
                …and {data.unknownTotal - data.unknownOrgs.length} more. Open the Businesses tab for the full list.
              </div>
            )}
          </div>
        </>
      )}

      {detail && (
        <BusinessDetailModal
          business={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {}}
        />
      )}
    </>
  );
}

function ReachOrgRow({ org, onClick }) {
  const statusColor = org.status === 'active' ? '#2edf87'
    : org.status === 'trialing' ? '#fbbf24'
    : org.status === 'suspended' ? '#f26060'
    : '#7a8db0';
  const days = org.createdAt
    ? Math.floor((Date.now() - new Date(org.createdAt).getTime()) / 86_400_000)
    : null;
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : days != null ? `${days}d ago` : '—';
  return (
    <div onClick={onClick}
      style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,cursor:'pointer'}}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f9eff66'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e3f60'; }}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{org.name || 'Unnamed'}</div>
        <div style={{fontSize:11,color:'#7a8db0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {org.ownerName || org.email || '—'}
        </div>
      </div>
      <span style={{background:statusColor+'22',color:statusColor,border:'1px solid '+statusColor+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>
        {org.status === 'active' ? 'Paying' : org.status}
      </span>
      <span style={{fontSize:11,color:'#7a8db0',whiteSpace:'nowrap'}}>{ago}</span>
    </div>
  );
}

function SignupRow({ signup, onClick }) {
  const days = signup.created_at
    ? Math.floor((Date.now() - new Date(signup.created_at).getTime()) / 86_400_000)
    : null;
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
  const statusColor = signup.subscription_status === 'active' ? '#2edf87'
    : signup.subscription_status === 'trialing' ? '#fbbf24'
    : '#7a8db0';
  const statusLabel = signup.subscription_status === 'active' ? 'Paying'
    : signup.subscription_status === 'trialing' ? 'Trial'
    : signup.subscription_status || 'No plan';
  return (
    <div onClick={onClick}
      style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:10,transition:'border-color .15s'}}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f9eff66'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e3f60'; }}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {signup.name || 'Unnamed business'}
        </div>
        <div style={{fontSize:12,color:'#7a8db0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {signup.owner_name ? signup.owner_name + ' · ' : ''}{signup.business_email || 'no email'}
        </div>
      </div>
      <span style={{background:statusColor+'22',color:statusColor,border:'1px solid '+statusColor+'66',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
        {statusLabel}{signup.subscription_tier ? ` · ${signup.subscription_tier}` : ''}
      </span>
      <span style={{fontSize:11,color:'#7a8db0',whiteSpace:'nowrap'}}>{ago}</span>
    </div>
  );
}

// =============================================================
// Businesses
// =============================================================
function BusinessesSection() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);

  const reload = async () => {
    setData(null);
    const r = await adminFetch('/api/admin/businesses');
    if (r.error) setErr(r.error); else setData(r.businesses);
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter(b => {
      if (filter !== 'all' && b.status !== filter) return false;
      if (!q) return true;
      return (
        (b.name || '').toLowerCase().includes(q) ||
        (b.ownerEmail || '').toLowerCase().includes(q) ||
        (b.businessEmail || '').toLowerCase().includes(q) ||
        (b.ownerName || '').toLowerCase().includes(q)
      );
    });
  }, [data, search, filter]);

  if (err) return <ErrorBlock msg={err}/>;

  return (
    <>
      <SectionHeading title="Businesses" subtitle={data ? `${filtered.length} of ${data.length}` : 'Loading…'}/>

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{flex:'1 1 240px',minWidth:200,background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',padding:'10px 12px',fontSize:14,outline:'none',fontFamily:'inherit'}}/>
        <div style={{display:'flex',gap:4}}>
          {['all','trial','active','suspended'].map(k => (
            <button key={k} onClick={() => setFilter(k)}
              style={{
                background: filter === k ? '#4f9eff22' : 'transparent',
                border: '1px solid ' + (filter === k ? '#4f9eff' : '#2e3f60'),
                color: filter === k ? '#4f9eff' : '#c8d4ee',
                borderRadius: 8, padding:'8px 14px', fontSize:12, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase', cursor:'pointer', fontFamily:'inherit',
              }}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {!data ? <Loading/> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length === 0 ? (
            <div style={{padding:'40px 16px',textAlign:'center',color:'#7a8db0',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12}}>No businesses match.</div>
          ) : filtered.map(b => (
            <BusinessRow key={b.id} b={b} onView={() => setDetail(b)} />
          ))}
        </div>
      )}

      {detail && <BusinessDetailModal business={detail} onClose={() => setDetail(null)} onChanged={reload}/>}
    </>
  );
}

// Card layout (vs the old fixed-column table). The previous table
// added up to >330px of fixed column widths which left negative
// space for the name + pushed the View button off-screen on
// phones. A flex-wrapping card with the name at the top and the
// stats wrapping below renders cleanly at every viewport size.
function BusinessRow({ b, onView }) {
  const statusColor = b.status === 'active' ? '#2edf87' : b.status === 'trial' ? '#fbbf24' : '#f26060';
  return (
    <div onClick={onView}
      style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'12px 14px',cursor:'pointer',transition:'border-color .15s'}}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f9eff66'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2e3f60'; }}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff',lineHeight:1.15,wordBreak:'break-word'}}>
            {b.name || 'Unnamed business'}
          </div>
          <div style={{fontSize:12,color:'#7a8db0',marginTop:3,wordBreak:'break-word'}}>
            {b.ownerEmail || b.businessEmail || 'No email on file'}
            {b.ownerName ? ` · ${b.ownerName}` : ''}
          </div>
        </div>
        <span style={{background:statusColor+'22',color:statusColor,border:'1px solid '+statusColor+'66',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>
          {b.status}
        </span>
      </div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'center',fontSize:12,color:'#7a8db0'}}>
        <span><strong style={{color:'#c8d4ee'}}>{b.jobsCount ?? 0}</strong> jobs</span>
        <span><strong style={{color:'#c8d4ee'}}>{b.invoicesCount ?? 0}</strong> invoices</span>
        <span><strong style={{color:'#c8d4ee'}}>{b.customersCount ?? 0}</strong> customers</span>
        <span style={{color:'#7a8db0'}}>signed up {fmtDateLoose(b.createdAt)}</span>
        {b.lastActive && b.lastActive !== b.createdAt && (
          <span style={{color:'#7a8db0'}}>active {fmtDateLoose(b.lastActive)}</span>
        )}
        <button onClick={e => { e.stopPropagation(); onView(); }}
          style={{marginLeft:'auto',background:'#4f9eff22',border:'1px solid #4f9eff66',borderRadius:8,color:'#4f9eff',padding:'5px 12px',fontSize:11,fontWeight:700,letterSpacing:'.06em',cursor:'pointer',fontFamily:'inherit'}}>
          VIEW
        </button>
      </div>
    </div>
  );
}

function BusinessDetailModal({ business, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setData(null);
    const r = await adminFetch(`/api/admin/business/${business.id}`);
    if (r.error) setErr(r.error); else setData(r);
  };
  useEffect(() => { reload(); }, [business.id]);

  const toggleSuspend = async () => {
    const isSuspended = !!data?.org?.suspended_at;
    if (isSuspended) {
      if (!confirm(`Unsuspend ${business.name}?`)) return;
      setBusy(true);
      const r = await adminFetch(`/api/admin/business/${business.id}/suspend`, {
        method: 'POST', body: JSON.stringify({ action: 'unsuspend' }),
      });
      setBusy(false);
      if (r.error) { toast.error(r.error); return; }
    } else {
      const reason = prompt('Reason for suspension? (visible only in admin audit)');
      if (reason === null) return;
      setBusy(true);
      const r = await adminFetch(`/api/admin/business/${business.id}/suspend`, {
        method: 'POST', body: JSON.stringify({ action: 'suspend', reason }),
      });
      setBusy(false);
      if (r.error) { toast.error(r.error); return; }
    }
    await reload();
    onChanged?.();
  };

  const deleteOrg = async () => {
    const typed = prompt(`Type the business name to confirm deletion:\n\n${business.name}`);
    if (typed === null) return;
    setBusy(true);
    const r = await adminFetch(`/api/admin/business/${business.id}/delete`, {
      method: 'POST', body: JSON.stringify({ confirm: typed }),
    });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    onChanged?.();
    onClose();
  };

  // Generate a one-time magic-link the admin can paste in an
  // incognito window to sign in as the org owner. Admin's primary
  // session stays intact.
  const impersonate = async () => {
    if (!confirm(`Generate a one-time sign-in link for ${business.name}'s owner?\n\nOpen the URL in an incognito window to avoid clobbering your admin session.`)) return;
    setBusy(true);
    const r = await adminFetch(`/api/admin/business/${business.id}/impersonate`, { method: 'POST' });
    setBusy(false);
    if (r.error) { toast.error(r.error); return; }
    try {
      await navigator.clipboard.writeText(r.url);
      toast.success(`Sign-in link copied to clipboard.\n\nOwner: ${r.owner_email}\nExpires in ${r.expires_in_hours}h, single-use.\n\nPaste it in an incognito window.`);
    } catch {
      window.prompt(`Owner: ${r.owner_email}\nExpires in ${r.expires_in_hours}h.\n\nCopy this link and paste in incognito:`, r.url);
    }
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.78)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(4px)'}}>
      <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'18px 18px 0 0',width:'100%',maxWidth:760,margin:'0 auto',maxHeight:'92dvh',overflowY:'auto'}}>
        <div style={{width:36,height:4,background:'#2e3f60',borderRadius:2,margin:'12px auto 4px'}}/>
        <div style={{padding:'8px 18px 18px'}}>
          {err && <ErrorBlock msg={err}/>}
          {!data ? <Loading/> : (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,marginBottom:14,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>Business</div>
                  <h2 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.04em',margin:'4px 0 0',lineHeight:1.05}}>{data.org.name?.toUpperCase()}</h2>
                  <div style={{fontSize:13,color:'#c8d4ee',marginTop:4}}>{data.org.owner_name || '—'}</div>
                  <div style={{fontSize:12,color:'#7a8db0'}}>{data.org.business_email || '—'} · {data.org.phone || '—'}</div>
                  <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{data.org.address || '—'}</div>
                  {data.org.suspended_at && (
                    <div style={{marginTop:10,padding:'8px 10px',background:'rgba(242,96,96,.10)',border:'1px solid rgba(242,96,96,.35)',borderRadius:8,fontSize:12,color:'#f26060'}}>
                      Suspended {fmtDateLoose(data.org.suspended_at)}
                      {data.org.suspended_reason && <> — “{data.org.suspended_reason}”</>}
                    </div>
                  )}
                </div>
                <button onClick={onClose} style={{...btnGhost,padding:'6px 12px'}}>✕</button>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:14}}>
                <MiniStat label="Jobs"      value={data.counts.jobs}      color="#4f9eff"/>
                <MiniStat label="Invoices"  value={data.counts.invoices}  color="#fbbf24"/>
                <MiniStat label="Customers" value={data.counts.customers} color="#54d4f8"/>
                <MiniStat label="Expenses"  value={data.counts.expenses}  color="#f26060"/>
                <MiniStat label="Members"   value={data.counts.members}   color="#b197fc"/>
                <MiniStat label="LTV Paid"  value={fmt$(data.money.lifetimePaid)} color="#2edf87"/>
                <MiniStat label="Outstanding" value={fmt$(data.money.outstanding)} color="#fbbf24"/>
              </div>

              <Subhead>Members</Subhead>
              <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
                {data.members.map(m => (
                  <div key={m.user_id} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,fontSize:12,color:'#c8d4ee',gap:8}}>
                    <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.email || '—'}</span>
                    <span style={{color:'#7a8db0',textTransform:'uppercase',fontSize:10,letterSpacing:'.06em',fontWeight:700}}>{m.role}</span>
                  </div>
                ))}
              </div>

              <Subhead>Recent Invoices</Subhead>
              <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
                {data.recentInvoices.length === 0 && <div style={empty}>No invoices.</div>}
                {data.recentInvoices.map(inv => (
                  <div key={inv.id} style={listRow}>
                    <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#c8d4ee'}}>{inv.notes || 'Invoice'}</span>
                    <span style={{color:'#7a8db0',fontSize:11}}>{fmtDate(inv.issued_date)}</span>
                    <span style={{color:inv.status === 'paid' ? '#2edf87' : '#fbbf24',fontWeight:600,minWidth:60,textAlign:'right'}}>{fmt$(inv.amount)}</span>
                  </div>
                ))}
              </div>

              <Subhead>Recent Jobs</Subhead>
              <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
                {data.recentJobs.length === 0 && <div style={empty}>No jobs.</div>}
                {data.recentJobs.map(j => (
                  <div key={j.id} style={listRow}>
                    <span style={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#c8d4ee'}}>{j.title}</span>
                    <span style={{color:'#7a8db0',fontSize:11}}>{j.scheduled_date ? fmtDate(j.scheduled_date) : '—'}</span>
                    <span style={{color:'#c8d4ee',fontWeight:600,minWidth:60,textAlign:'right'}}>{fmt$(j.price || 0)}</span>
                  </div>
                ))}
              </div>

              <div style={{display:'flex',gap:8,marginTop:18,paddingTop:14,borderTop:'1px solid #2e3f60',flexWrap:'wrap'}}>
                <button onClick={impersonate} disabled={busy}
                  style={{...btnGhost,color:'#4f9eff',borderColor:'#4f9eff55',flex:'1 1 100%'}}>
                  Impersonate owner (1-hour link)
                </button>
                <button onClick={toggleSuspend} disabled={busy}
                  style={{...btnGhost,color:data.org.suspended_at?'#2edf87':'#fbbf24',borderColor:(data.org.suspended_at?'#2edf87':'#fbbf24')+'55',flex:1}}>
                  {data.org.suspended_at ? 'Unsuspend' : 'Suspend'}
                </button>
                <button onClick={deleteOrg} disabled={busy}
                  style={{...btnGhost,color:'#f26060',borderColor:'#f2606055',flex:1}}>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Usage
// =============================================================
function UsageSection() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  useEffect(() => {
    (async () => {
      const r = await adminFetch('/api/admin/usage');
      if (r.error) setErr(r.error); else setData(r);
    })();
  }, []);
  if (err)   return <ErrorBlock msg={err}/>;
  if (!data) return <Loading/>;
  return (
    <>
      <SectionHeading title="Usage Stats" subtitle="Platform-wide"/>
      <div style={kpiGrid}>
        <Kpi label="Total Jobs"          value={data.jobs}               color="#4f9eff"/>
        <Kpi label="Total Invoices"      value={data.invoices}           color="#fbbf24"/>
        <Kpi label="Total Quotes"        value={data.quotes}             color="#b197fc"/>
        <Kpi label="Total Customers"     value={'—'}                     color="#7a8db0" sub="see Businesses"/>
        <Kpi label="Expenses Logged"     value={data.expenses}           color="#f26060"/>
        <Kpi label="Mileage Logs"        value={data.mileage}            color="#54d4f8"/>
        <Kpi label="Job Photos Uploaded" value={data.jobPhotos}          color="#2edf87"/>
        <Kpi label="Leads Captured"      value={data.leads}              color="#54d4f8"/>
        <Kpi label="AI Coach Runs"       value={data.coachRunsThisMonth} color="#fbbf24" sub="this month"/>
        <Kpi label="Total Seats"         value={data.totalSeats}         color="#b197fc" sub="members across all orgs"/>
        <Kpi label="Storage Used"        value={'—'}                     color="#7a8db0" sub="reporting pending"/>
      </div>
    </>
  );
}

// =============================================================
// AI cost monitoring
// =============================================================
function AiUsageSection() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  useEffect(() => {
    (async () => {
      const r = await adminFetch('/api/admin/ai-usage');
      if (r.error) setErr(r.error); else setData(r);
    })();
  }, []);
  if (err)   return <ErrorBlock msg={err}/>;
  if (!data) return <Loading/>;

  const bySource = data.by_source || {};
  const sources  = ['customer_chat','internal_ai','coach','invoice_extract'];
  const sourceLabel = {
    customer_chat:    'Customer Chat',
    internal_ai:      'In-app Assistant',
    coach:            'Monthly AI Coach',
    invoice_extract:  'Invoice Extract',
  };

  return (
    <>
      <SectionHeading title="AI Cost Monitoring" subtitle="This calendar month — estimated based on model rates at the time of each call."/>

      {data.alerts && data.alerts.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
          {data.alerts.map((a, i) => (
            <div key={i} style={{
              padding:'10px 14px',
              background:'rgba(251,191,36,0.10)',
              border:'1px solid rgba(251,191,36,0.45)',
              borderRadius:10,
              fontSize:13,color:'#fbbf24',
              display:'flex',alignItems:'center',gap:10,
            }}>
              <span style={{fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase',fontSize:10}}>Alert</span>
              {a.type === 'platform_over_budget'
                ? <span>Total platform AI spend is ${a.cost.toFixed(2)} — over the ${a.threshold} threshold for this month.</span>
                : <span>{a.org_name} has spent ${a.cost.toFixed(2)} on AI this month — over the ${a.threshold} per-org threshold.</span>}
            </div>
          ))}
        </div>
      )}

      <div style={kpiGrid}>
        <Kpi label="Total AI Cost" value={'$' + (Number(data.total_cost || 0)).toFixed(2)} color="#fbbf24" sub="this month"/>
        <Kpi label="Live API calls" value={data.total_calls || 0} color="#4f9eff" sub="counted toward usage"/>
        <Kpi label="Cache hits" value={data.cache_hits || 0} color="#2edf87" sub="free — not counted"/>
        <Kpi label="Cache hit rate" value={`${data.cache_hit_rate || 0}%`} color="#54d4f8" sub="higher means cost controls working"/>
      </div>

      <Subhead>Spend by Source</Subhead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,marginBottom:18}}>
        {sources.map(s => {
          const row = bySource[s] || { calls: 0, cache_hits: 0, cost: 0 };
          return (
            <div key={s} style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.10em',textTransform:'uppercase',fontWeight:700}}>{sourceLabel[s]}</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.02em',color:'#fbbf24',lineHeight:1.1,marginTop:4}}>
                ${Number(row.cost || 0).toFixed(2)}
              </div>
              <div style={{fontSize:11,color:'#c8d4ee',marginTop:4}}>{row.calls || 0} call{(row.calls || 0) === 1 ? '' : 's'}</div>
              <div style={{fontSize:11,color:'#2edf87',marginTop:1}}>{row.cache_hits || 0} cache hit{(row.cache_hits || 0) === 1 ? '' : 's'}</div>
            </div>
          );
        })}
      </div>

      <Subhead>Top 10 Contractors by AI Spend (this month)</Subhead>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
        {(data.top_orgs || []).length === 0 && <div style={empty}>No AI activity yet this month.</div>}
        {(data.top_orgs || []).map(o => {
          const overBudget = Number(o.cost || 0) > (data.thresholds?.per_org || 5);
          return (
            <div key={o.org_id} style={{
              display:'flex',alignItems:'center',gap:8,
              padding:'9px 12px',
              background:'#1e2a42',
              border:'1px solid ' + (overBudget ? 'rgba(251,191,36,0.45)' : '#2e3f60'),
              borderRadius:10,
            }}>
              <span style={{flex:1,minWidth:0,fontSize:13,color:'#f0f4ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {o.org_name || 'Unnamed'}
              </span>
              <span style={{fontSize:11,color:'#7a8db0'}}>{o.calls || 0} calls</span>
              <span style={{fontSize:11,color:'#2edf87'}}>{o.cache_hits || 0} cached</span>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:overBudget ? '#fbbf24' : '#f0f4ff',minWidth:80,textAlign:'right'}}>
                ${Number(o.cost || 0).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{fontSize:11,color:'#7a8db0',marginTop:8,lineHeight:1.55}}>
        Per-org alert threshold: ${data.thresholds?.per_org || 5} / mo.
        Platform alert threshold: ${data.thresholds?.platform || 100} / mo.
        Numbers are estimated from published model rates — actual Anthropic billing is the source of truth.
      </div>
    </>
  );
}

// =============================================================
// Support
// =============================================================
// Focused "customer just called, look them up" view. The Businesses
// tab is for browsing the full list; Support is for fast lookup +
// action. Drops the user into the same BusinessDetailModal so all
// the same actions (suspend, delete, impersonate, full data) live
// in one place.
function SupportSection() {
  const [email, setEmail] = useState('');
  const [busy, setBusy]   = useState(false);
  const [match, setMatch] = useState(null);
  const [err, setErr]     = useState('');
  const [openId, setOpenId] = useState(null);

  const lookup = async () => {
    const q = email.trim().toLowerCase();
    if (!q) return;
    setBusy(true); setErr(''); setMatch(null);
    const r = await adminFetch(`/api/admin/businesses?search=${encodeURIComponent(q)}`);
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    // The businesses endpoint matches name OR owner email. For
    // support we want email matches preferentially; surface the
    // first hit that has the email exactly, otherwise the first.
    const list = Array.isArray(r) ? r : (r.businesses || []);
    // Endpoint matches name OR email server-side; we still narrow
    // by exact email locally so "joe@x.com" beats "joeschmoe@y.com".
    const exact = list.find(b => {
      const oe = (b.ownerEmail || '').toLowerCase();
      const be = (b.businessEmail || '').toLowerCase();
      return oe === q || be === q;
    });
    // Fall back to substring match if no exact hit.
    const sub = list.find(b => {
      const oe = (b.ownerEmail || '').toLowerCase();
      const be = (b.businessEmail || '').toLowerCase();
      return oe.includes(q) || be.includes(q);
    });
    const first = exact || sub || list[0] || null;
    if (!first) { setErr('No business found with that email.'); return; }
    setMatch(first);
  };

  const onKeyDown = (e) => { if (e.key === 'Enter') lookup(); };

  return (
    <>
      <SectionHeading title="Support" subtitle="Look up a contractor by email and help them. Impersonate to see what they see."/>

      <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'18px 14px',marginBottom:14}}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>Find a contractor</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={onKeyDown}
            placeholder="owner@example.com"
            style={{flex:'1 1 260px',minWidth:0,background:'#0d1726',border:'1px solid #2e3f60',borderRadius:10,color:'#f0f4ff',padding:'12px 14px',fontSize:14,fontFamily:'inherit'}}/>
          <button onClick={lookup} disabled={busy || !email.trim()}
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'12px 20px',fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:'.06em',cursor:busy?'progress':'pointer',opacity:busy?0.6:1}}>
            {busy ? 'LOOKING…' : 'LOOK UP'}
          </button>
        </div>
        {err && <div style={{marginTop:10,fontSize:12,color:'#f26060'}}>{err}</div>}
      </div>

      {match && (
        <div style={{background:'#1e2a42',border:'1px solid #4f9eff44',borderRadius:12,padding:'16px 14px',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:11,color:'#4f9eff',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>Match</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>
                {(match.name || 'Unnamed').toUpperCase()}
              </div>
              <div style={{fontSize:13,color:'#c8d4ee',marginTop:4}}>{match.ownerEmail || match.businessEmail || '—'}</div>
              <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>
                {match.status || 'no plan'} · {match.jobsCount ?? 0} jobs · {match.invoicesCount ?? 0} invoices · joined {match.createdAt ? fmtDateLoose(match.createdAt) : '—'}
              </div>
            </div>
            <button onClick={() => setOpenId(match.id)}
              style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 16px',fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:'.06em',cursor:'pointer'}}>
              OPEN FULL VIEW
            </button>
          </div>
          <div style={{fontSize:12,color:'#7a8db0',marginTop:10,lineHeight:1.55}}>
            Open the full view to see members, jobs, invoices, payment status, and to impersonate the owner. Impersonation generates a one-time sign-in link you paste in an incognito window so your admin session stays intact.
          </div>
        </div>
      )}

      {openId && (
        <BusinessDetailModal
          business={{ id: openId, name: match?.name || '' }}
          onClose={() => setOpenId(null)}
          onChanged={() => {}}
        />
      )}
    </>
  );
}

// =============================================================
// UI primitives
// =============================================================
function SectionHeading({ title, subtitle }) {
  return (
    <div style={{marginBottom:18}}>
      <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,letterSpacing:'.04em',margin:'8px 0 0'}}>{title.toUpperCase()}</h1>
      {subtitle && <div style={{fontSize:13,color:'#7a8db0',marginTop:2}}>{subtitle}</div>}
    </div>
  );
}
function Kpi({ label, value, color, sub, onClick }) {
  const interactive = typeof onClick === 'function';
  return (
    <div onClick={onClick}
      onMouseEnter={interactive ? e => { e.currentTarget.style.borderColor = '#4f9eff66'; } : undefined}
      onMouseLeave={interactive ? e => { e.currentTarget.style.borderColor = '#2e3f60'; } : undefined}
      style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px',cursor: interactive ? 'pointer' : 'default',transition:'border-color .15s'}}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:30,letterSpacing:'.02em',color,lineHeight:1.1,marginTop:4}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#7a8db0',marginTop:3}}>{sub}</div>}
      {interactive && <div style={{fontSize:10,color:'#4f9eff',marginTop:6,letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>Open →</div>}
    </div>
  );
}
function MiniStat({ label, value, color }) {
  return (
    <div style={{background:'#0d1726',border:'1px solid #2e3f60',borderRadius:10,padding:'8px 10px'}}>
      <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>{label}</div>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,color,letterSpacing:'.02em',marginTop:2}}>{value}</div>
    </div>
  );
}
function Subhead({ children }) {
  return <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:6,marginTop:4}}>{children.toUpperCase()}</div>;
}
function Loading() {
  return <div style={{padding:'40px 0',textAlign:'center',color:'#7a8db0',fontSize:13}}>Loading…</div>;
}
function ErrorBlock({ msg }) {
  return <div style={{padding:'14px 16px',background:'rgba(242,96,96,.10)',border:'1px solid rgba(242,96,96,.35)',borderRadius:10,color:'#f26060',fontSize:13,marginBottom:14}}>Error: {msg}</div>;
}

function fmtDateLoose(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'2-digit' });
}

const kpiGrid = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10, marginBottom:24 };
const tableHeader = {
  display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
  background:'#0d1726',
  fontSize:11, color:'#7a8db0', letterSpacing:'.08em', textTransform:'uppercase', fontWeight:700,
};
const hideMobile = { flex:'1 1 120px', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' };
const empty   = { fontSize:12,color:'#7a8db0',padding:'8px 10px',textAlign:'center',background:'#0d1726',border:'1px dashed #2e3f60',borderRadius:8 };
const listRow = { display:'flex',gap:8,padding:'6px 10px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,fontSize:12,alignItems:'center' };
const btnGhost = {
  background:'transparent',border:'1px solid #2e3f60',borderRadius:8,
  color:'#c8d4ee',padding:'7px 12px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.04em',fontFamily:'inherit',
};
