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
    let cancelled = false;
    const resolveSession = async () => {
      // PWA cold-launch + iOS standalone can return null on the first
      // getSession() call while the supabase storage adapter is still
      // rehydrating. Wait for the INITIAL_SESSION event before we give
      // up and bounce to /login.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        session = await new Promise((resolve) => {
          let done = false;
          const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1500);
          const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
            if (done) return;
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              done = true; clearTimeout(timer); sub?.subscription?.unsubscribe?.(); resolve(s);
            }
          });
        });
      }
      if (cancelled) return;
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
      const ok = (session.user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setAllowed(ok);
      if (!ok) router.push('/dashboard');
    };
    resolveSession();
    // Bounce out the moment the session is invalidated (token refresh
    // fails, user signs out elsewhere) instead of showing "Not signed in"
    // on every panel.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        router.push('/login');
      }
    });
    return () => { cancelled = true; sub?.subscription?.unsubscribe?.(); };
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
        {['overview','finances','books','reach','businesses','usage','ai','support','integrations','broadcast'].map(k => (
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
        {tab === 'books'      && <BooksSection />}
        {tab === 'reach'      && <ReachSection />}
        {tab === 'businesses' && <BusinessesSection />}
        {tab === 'usage'      && <UsageSection />}
        {tab === 'ai'         && <AiUsageSection />}
        {tab === 'support'    && <SupportSection />}
        {tab === 'integrations' && <IntegrationsSection />}
        {tab === 'broadcast'    && <BroadcastSection />}
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
  // Resilient to PWA / iOS standalone token churn: try the current session,
  // refresh once on null session or 401, then bounce to /login if still cold.
  const callOnce = async (token) => {
    const r = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        'Authorization': `Bearer ${token}`,
      },
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  };

  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { data } = await supabase.auth.refreshSession();
    session = data?.session || null;
  }
  if (!session) {
    if (typeof window !== 'undefined') window.location.replace('/login');
    return { error: 'Not signed in.' };
  }

  let res = await callOnce(session.access_token);
  if (res.status === 401) {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session) {
      res = await callOnce(data.session.access_token);
    } else if (typeof window !== 'undefined') {
      window.location.replace('/login');
      return { error: 'Not signed in.' };
    }
  }

  if (!res.ok) return { error: res.body?.error || `Request failed (${res.status})` };
  return res.body;
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
      <MarketingQrPanel/>

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

function MarketingQrPanel() {
  const PRINT_PNG = '/myforeman-marketing-qr.png';
  const PREVIEW = 'https://api.qrserver.com/v1/create-qr-code/?data=https%3A%2F%2Fmyforemanhq.com&size=300x300&margin=12&qzone=2&format=png&ecc=H';
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText('https://myforemanhq.com');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:14,padding:18,marginBottom:18,display:'flex',gap:18,flexWrap:'wrap',alignItems:'center'}}>
      <div style={{background:'#ffffff',padding:10,borderRadius:10,flexShrink:0}}>
        <img src={PREVIEW} alt="MyForeman marketing QR code" width="180" height="180" style={{display:'block',width:180,height:180}}/>
      </div>
      <div style={{flex:'1 1 280px',minWidth:240}}>
        <div style={{fontSize:11,color:'#fbbf24',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:6}}>Marketing QR Code</div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.02em',color:'#f0f4ff',lineHeight:1.1,marginBottom:6}}>
          Points to myforemanhq.com
        </div>
        <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55,marginBottom:12}}>
          For print flyers, business cards, and physical drops (barbershops, supply houses). Cold scans land on the full landing page so visitors see features, pricing, and the demo before deciding to sign up. Not the signup form, not a booking page.
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <a href={PRINT_PNG} download="myforeman-marketing-qr.png"
            style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'10px 16px',fontWeight:700,fontSize:12,letterSpacing:'.06em',textDecoration:'none',display:'inline-block',fontFamily:'inherit'}}>
            DOWNLOAD HI-RES (1500×1500)
          </a>
          <a href={PRINT_PNG} target="_blank" rel="noopener noreferrer"
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 14px',fontWeight:700,fontSize:12,letterSpacing:'.06em',textDecoration:'none',display:'inline-block',fontFamily:'inherit'}}>
            PREVIEW PNG
          </a>
          <button onClick={copyLink}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:copied ? '#2edf87' : '#c8d4ee',padding:'10px 14px',fontWeight:700,fontSize:12,letterSpacing:'.06em',cursor:'pointer',fontFamily:'inherit'}}>
            {copied ? 'COPIED' : 'COPY URL'}
          </button>
        </div>
        <div style={{fontSize:11,color:'#7a8db0',marginTop:10}}>
          Print spec: 1500×1500, error correction H (30% damage tolerance). Reprints cleanly at any size from business card to poster.
        </div>
      </div>
    </div>
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

// =============================================================
// Books — manual expense ledger + tax payments + computed P&L
// =============================================================
const EXPENSE_CATEGORIES = [
  'hosting','ai','ads','software','contractors','salaries',
  'legal','equipment','travel','marketing','fees','other',
];
const TAX_TYPES = [
  ['federal_quarterly', 'Federal · Quarterly'],
  ['federal_annual',    'Federal · Annual'],
  ['state_quarterly',   'State · Quarterly'],
  ['state_annual',      'State · Annual'],
  ['self_employment',   'Self-Employment'],
  ['sales',             'Sales Tax'],
  ['other',             'Other'],
];
const fmtMoney = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const todayIso = () => new Date().toISOString().slice(0, 10);

function BooksSection() {
  const [year, setYear]             = useState(new Date().getUTCFullYear());
  const [pnl, setPnl]               = useState(null);
  const [expenses, setExpenses]     = useState(null);
  const [payments, setPayments]     = useState(null);
  const [quarterly, setQuarterly]   = useState(null);
  const [vendors, setVendors]       = useState(null);
  const [recurring, setRecurring]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [adding, setAdding]         = useState(null); // 'expense' | 'tax' | 'vendor' | 'settings' | 'recurring'

  const reload = async () => {
    setLoading(true);
    const [p, e, t, q, v, rc] = await Promise.all([
      adminFetch('/api/admin/books/pnl'),
      adminFetch('/api/admin/books/expenses'),
      adminFetch('/api/admin/books/tax-payments'),
      adminFetch(`/api/admin/books/quarterly?year=${year}`),
      adminFetch(`/api/admin/books/vendors-1099?year=${year}`),
      adminFetch('/api/admin/books/recurring'),
    ]);
    if (!p?.error)  setPnl(p);
    if (!e?.error)  setExpenses(e.expenses || []);
    if (!t?.error)  setPayments(t.payments || []);
    if (!q?.error)  setQuarterly(q);
    if (!v?.error)  setVendors(v.vendors || []);
    if (!rc?.error) setRecurring(rc.recurring || []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pnl && loading) return <Loading/>;
  if (!pnl) return <div style={{color:'#f26060',padding:20}}>Could not load books.</div>;

  const downloadCsv = async (type) => {
    // Can't use window.open — admin endpoints require a bearer token.
    // Fetch with auth, then trigger a download via blob URL.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast('Not signed in.'); return; }
    const r = await fetch(`/api/admin/books/export?type=${type}&year=${year}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!r.ok) { toast(`Export failed (${r.status})`); return; }
    const blob = await r.blob();
    const filename = (r.headers.get('content-disposition') || '').match(/filename="([^"]+)"/)?.[1]
      || `myforeman-${type}-${year}.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  };

  const net = pnl.netAfterTax.ytd;
  const netColor = net >= 0 ? '#2edf87' : '#f26060';

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap',marginBottom:18}}>
        <SectionHeading title="Books" subtitle="Platform P&L, expense ledger, tax payments, and 1099 directory. Stripe + Apple fees auto-import."/>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',padding:'9px 11px',fontSize:13,fontFamily:'inherit'}}>
            {Array.from({ length: 4 }, (_, i) => new Date().getUTCFullYear() - i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button onClick={() => setAdding('settings')} style={{
            background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',
            padding:'9px 14px',fontSize:12,fontWeight:600,letterSpacing:'.04em',cursor:'pointer',fontFamily:'inherit',
          }}>SETTINGS</button>
          <button onClick={reload} disabled={loading} style={{
            background: loading ? '#1e2a42' : '#4f9eff', border:'none', borderRadius:8, color:'#fff',
            padding:'9px 16px', fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:'.06em',
            cursor: loading ? 'wait' : 'pointer',
          }}>{loading ? 'REFRESHING…' : 'REFRESH'}</button>
        </div>
      </div>

      {/* Hero net */}
      <div style={{
        background:'linear-gradient(135deg, #1e2a42 0%, #243353 100%)',
        border:'1px solid #2e3f60', borderRadius:14, padding:'20px 22px', marginBottom:22,
      }}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.18em',textTransform:'uppercase',fontWeight:700}}>
          Net YTD (after estimated tax · {Math.round(pnl.taxRate*100)}% rate)
        </div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:56,lineHeight:1.05,letterSpacing:'.02em',color:netColor,marginTop:6}}>
          {fmtMoney(net)}
        </div>
        <div style={{fontSize:12,color:'#7a8db0',marginTop:6}}>
          Revenue: <span style={{color:'#f0f4ff',fontWeight:600}}>{fmtMoney(pnl.revenue.ytd)}</span>
          {' · '}Expenses: <span style={{color:'#f26060',fontWeight:600}}>{fmtMoney(pnl.expenses.ytd.total)}</span>
          {' · '}Est. tax: <span style={{color:'#fbbf24',fontWeight:600}}>{fmtMoney(pnl.estimatedTax.ytd)}</span>
        </div>
      </div>

      {/* This-month KPIs */}
      <Subhead>This month</Subhead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:10,marginBottom:18}}>
        <Kpi label="Revenue"           value={fmtMoney(pnl.revenue.thisMonth)}        color="#2edf87" sub={`Stripe ${fmtMoney(pnl.revenue.byType.stripe)} · Apple ${fmtMoney(pnl.revenue.byType.apple)}`}/>
        <Kpi label="AI cost"           value={fmtMoney(pnl.expenses.thisMonth.ai)}    color="#fbbf24" sub="from usage log"/>
        <Kpi label="Manual expenses"   value={fmtMoney(pnl.expenses.thisMonth.manual)} color="#f26060" sub={`${expenses?.length || 0} entries total`}/>
        <Kpi label="Net before tax"    value={fmtMoney(pnl.netBeforeTax.thisMonth)}   color="#f0f4ff"/>
        <Kpi label="Est. tax accrual"  value={fmtMoney(pnl.estimatedTax.thisMonth)}   color="#fbbf24" sub={`${Math.round(pnl.taxRate*100)}% × net`}/>
        <Kpi label="Net after tax"     value={fmtMoney(pnl.netAfterTax.thisMonth)}    color={pnl.netAfterTax.thisMonth >= 0 ? '#2edf87' : '#f26060'}/>
      </div>

      {/* Tax payments summary */}
      <Subhead>Tax YTD</Subhead>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:10,marginBottom:18}}>
        <Kpi label="Estimated owed YTD" value={fmtMoney(pnl.estimatedTax.ytd)} color="#fbbf24"/>
        <Kpi label="Paid YTD"           value={fmtMoney(pnl.taxPayments.paidYTD)} color="#2edf87"/>
        <Kpi label="Remaining to set aside" value={fmtMoney(pnl.taxPayments.owedRemaining)} color={pnl.taxPayments.owedRemaining > 0 ? '#f26060' : '#2edf87'}/>
      </div>

      {/* Expense ledger */}
      <BookTablePanel
        title="Expenses"
        addLabel="+ Add expense"
        onAdd={() => setAdding('expense')}
        onExport={() => downloadCsv('expenses')}
        byCategory={pnl.expenses.ytd.byCategory}
        rows={expenses || []}
        renderRow={(r) => (
          <ExpenseRow key={r.id} row={r} vendors={vendors || []} onChanged={reload}/>
        )}
        emptyText="No expenses logged yet."
      />

      {/* Tax payments */}
      <BookTablePanel
        title="Tax payments"
        addLabel="+ Add payment"
        onAdd={() => setAdding('tax')}
        onExport={() => downloadCsv('tax-payments')}
        rows={payments || []}
        renderRow={(r) => (
          <TaxPaymentRow key={r.id} row={r} onChanged={reload}/>
        )}
        emptyText="No tax payments logged yet."
      />

      {/* Quarterly tax breakdown */}
      {quarterly && <QuarterlyPanel data={quarterly}/>}

      {/* Recurring expenses */}
      <BookTablePanel
        title="Recurring monthly expenses"
        addLabel="+ Add recurring"
        onAdd={() => setAdding('recurring')}
        rows={recurring || []}
        renderRow={(r) => (
          <RecurringRow key={r.id} row={r} onChanged={reload}/>
        )}
        emptyText="No recurring expenses set up. Use for Claude Max, GitHub, Vercel Pro — anything that bills monthly at a known amount."
      />

      {/* 1099 vendors */}
      <BookTablePanel
        title={`1099 Vendors · ${year}`}
        addLabel="+ Add vendor"
        onAdd={() => setAdding('vendor')}
        onExport={() => downloadCsv('1099-summary')}
        rows={vendors || []}
        renderRow={(v) => (
          <Vendor1099Row key={v.id} vendor={v} onChanged={reload}/>
        )}
        emptyText="No 1099 vendors yet. Add anyone you pay $600+ in a calendar year."
      />

      {adding === 'expense' && (
        <ExpenseEditorModal vendors={vendors || []} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload(); }}/>
      )}
      {adding === 'tax' && (
        <TaxPaymentEditorModal onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload(); }}/>
      )}
      {adding === 'vendor' && (
        <Vendor1099EditorModal onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload(); }}/>
      )}
      {adding === 'recurring' && (
        <RecurringEditorModal onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload(); }}/>
      )}
      {adding === 'settings' && (
        <BooksSettingsModal current={quarterly?.config} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); reload(); }}/>
      )}
    </>
  );
}

function RecurringRow({ row, onChanged }) {
  const [editing, setEditing] = useState(false);
  const del = async () => {
    if (!confirm(`Delete recurring "${row.name}" (${fmtMoney(row.amount)} on the ${row.day_of_month}th)?`)) return;
    const r = await adminFetch(`/api/admin/books/recurring?id=${row.id}`, { method: 'DELETE' });
    if (r?.error) { toast(r.error); return; }
    onChanged();
  };
  const lastIns = row.last_inserted_on ? `last inserted ${row.last_inserted_on}` : 'not yet inserted';
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 100px auto',gap:10,alignItems:'center',padding:'8px 10px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:8,fontSize:13,opacity: row.active ? 1 : 0.5}}>
        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          <span style={{color:'#f0f4ff',fontWeight:600}}>{row.name}</span>
          <span style={{color:'#7a8db0',marginLeft:6,fontSize:11}}>· {row.category}</span>
          {row.vendor && <span style={{color:'#7a8db0',marginLeft:6,fontSize:11}}>· {row.vendor}</span>}
          {!row.active && <span style={{color:'#f26060',marginLeft:6,fontSize:11}}>· paused</span>}
        </div>
        <div style={{color:'#7a8db0',fontSize:11,textAlign:'right'}}>day {row.day_of_month}</div>
        <div style={{color:'#7a8db0',fontSize:10}}>{lastIns}</div>
        <div style={{color:'#f26060',fontWeight:700,textAlign:'right'}}>{fmtMoney(row.amount)}/mo</div>
        <div style={{display:'flex',gap:4}}>
          <button onClick={() => setEditing(true)} style={iconBtn}>✎</button>
          <button onClick={del} style={iconBtn}>✕</button>
        </div>
      </div>
      {editing && (
        <RecurringEditorModal row={row} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }}/>
      )}
    </>
  );
}

function RecurringEditorModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         row?.name         || '',
    category:     row?.category     || 'software',
    vendor:       row?.vendor       || '',
    amount:       row?.amount       ?? '',
    day_of_month: row?.day_of_month || 1,
    notes:        row?.notes        || '',
    active:       row?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const body = {
      ...form,
      amount: Number(form.amount),
      day_of_month: Math.floor(Number(form.day_of_month)),
      vendor: form.vendor || null,
      notes:  form.notes  || null,
    };
    const r = row?.id
      ? await adminFetch(`/api/admin/books/recurring?id=${row.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await adminFetch('/api/admin/books/recurring',                { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (r?.error) { toast(r.error); return; }
    onSaved();
  };
  return (
    <EditorShell title={row?.id ? 'Edit recurring expense' : 'Add recurring expense'} onClose={onClose} onSave={save} saving={saving}>
      <FormRow label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Claude Max, GitHub Pro" style={inputStyle}/></FormRow>
      <FormRow label="Category">
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FormRow>
      <FormRow label="Vendor"><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Anthropic" style={inputStyle}/></FormRow>
      <FormRow label="Amount per month (USD)"><input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Day of month it charges (1-31)"><input type="number" min="1" max="31" value={form.day_of_month} onChange={e => setForm({ ...form, day_of_month: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Notes"><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{...inputStyle,fontFamily:'inherit',resize:'vertical'}}/></FormRow>
      {row?.id && (
        <FormRow label="Status">
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#c8d4ee'}}>
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}/>
            Active (uncheck to pause without deleting)
          </label>
        </FormRow>
      )}
    </EditorShell>
  );
}

function QuarterlyPanel({ data }) {
  const { quarters, year, yearTotals, config } = data;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{marginTop:18,marginBottom:18,background:'#0d1726',border:'1px solid #2e3f60',borderRadius:12,padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}>
        <Subhead>{`Quarterly · ${year}`}</Subhead>
        <div style={{fontSize:11,color:'#7a8db0'}}>
          {config.filing_state || 'No state'} · {Math.round(config.federal_income_rate * 100)}% federal · {Math.round(config.state_income_rate * 100)}% state
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:10}}>
        {quarters.map(q => {
          const overdue = q.balanceDue > 0 && today > q.dueOn;
          const dueColor = overdue ? '#f26060' : (q.balanceDue === 0 ? '#2edf87' : '#fbbf24');
          return (
            <div key={q.quarter} style={{background:'#1e2a42',border:`1px solid ${dueColor}55`,borderRadius:10,padding:'12px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',color:'#f0f4ff'}}>{q.label.toUpperCase()}</div>
                <div style={{fontSize:10,color:dueColor,letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700}}>{overdue ? 'Overdue' : `Due ${q.dueOn}`}</div>
              </div>
              <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{q.window.start} → {q.window.end}</div>
              <div style={{marginTop:10,display:'grid',gridTemplateColumns:'1fr auto',rowGap:4,fontSize:12,color:'#c8d4ee'}}>
                <span>Net</span>                       <span style={{color:'#f0f4ff',fontWeight:600}}>{fmtMoney(q.netBeforeTax)}</span>
                <span>SE tax</span>                    <span>{fmtMoney(q.tax.se)}</span>
                <span>Federal</span>                   <span>{fmtMoney(q.tax.federal)}</span>
                <span>State</span>                     <span>{fmtMoney(q.tax.state)}</span>
                <span style={{paddingTop:6,borderTop:'1px solid #2e3f60'}}>Owed</span>
                <span style={{paddingTop:6,borderTop:'1px solid #2e3f60',color:'#fbbf24',fontWeight:700}}>{fmtMoney(q.tax.total)}</span>
                <span>Paid</span>                      <span style={{color:'#2edf87'}}>{fmtMoney(q.taxPaid)}</span>
                <span style={{fontWeight:700}}>Balance</span>
                <span style={{fontWeight:700,color:dueColor}}>{fmtMoney(q.balanceDue)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:10,marginTop:12}}>
        <MiniStat label="Year revenue"  value={fmtMoney(yearTotals.revenue)}      color="#f0f4ff"/>
        <MiniStat label="Year expenses" value={fmtMoney(yearTotals.expenses)}     color="#f26060"/>
        <MiniStat label="Net"           value={fmtMoney(yearTotals.netBeforeTax)} color={yearTotals.netBeforeTax >= 0 ? '#2edf87' : '#f26060'}/>
        <MiniStat label="Tax owed YTD"  value={fmtMoney(yearTotals.taxOwed)}      color="#fbbf24"/>
        <MiniStat label="Tax paid YTD"  value={fmtMoney(yearTotals.taxPaid)}      color="#2edf87"/>
        <MiniStat label="Balance"       value={fmtMoney(yearTotals.balanceDue)}   color={yearTotals.balanceDue > 0 ? '#f26060' : '#2edf87'}/>
      </div>
    </div>
  );
}

function Vendor1099Row({ vendor, onChanged }) {
  const [editing, setEditing] = useState(false);
  const del = async () => {
    if (!confirm(`Archive 1099 vendor "${vendor.name}"? Existing expense links stay intact.`)) return;
    const r = await adminFetch(`/api/admin/books/vendors-1099?id=${vendor.id}`, { method: 'DELETE' });
    if (r?.error) { toast(r.error); return; }
    onChanged();
  };
  const total = vendor.year_total || 0;
  const flag = vendor.requires_1099;
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 140px 100px auto',gap:10,alignItems:'center',padding:'8px 10px',background:'#1e2a42',border:`1px solid ${flag ? '#fbbf2455' : '#2e3f60'}`,borderRadius:8,fontSize:13,opacity: vendor.active ? 1 : 0.5}}>
        <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          <span style={{color:'#f0f4ff',fontWeight:600}}>{vendor.name}</span>
          {vendor.business_name && <span style={{color:'#7a8db0',marginLeft:6,fontSize:12}}>· {vendor.business_name}</span>}
          {vendor.tax_id && <span style={{color:'#7a8db0',marginLeft:6,fontSize:11}}>· TIN on file</span>}
          {!vendor.active && <span style={{color:'#f26060',marginLeft:6,fontSize:11}}>· archived</span>}
        </div>
        <div style={{fontSize:11,color:'#7a8db0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{vendor.email || ''}</div>
        <div style={{color:'#f0f4ff',fontWeight:700,textAlign:'right'}}>{fmtMoney(total)}</div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          {flag && <span title="≥ $600 paid: 1099-NEC required" style={{background:'#fbbf2422',color:'#fbbf24',padding:'2px 7px',borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:'.06em'}}>1099</span>}
          <button onClick={() => setEditing(true)} style={iconBtn}>✎</button>
          {vendor.active && <button onClick={del} style={iconBtn}>✕</button>}
        </div>
      </div>
      {editing && (
        <Vendor1099EditorModal vendor={vendor} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }}/>
      )}
    </>
  );
}

function Vendor1099EditorModal({ vendor, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:          vendor?.name          || '',
    business_name: vendor?.business_name || '',
    email:         vendor?.email         || '',
    tax_id:        vendor?.tax_id        || '',
    address:       vendor?.address       || '',
    notes:         vendor?.notes         || '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const body = { ...form };
    const r = vendor?.id
      ? await adminFetch(`/api/admin/books/vendors-1099?id=${vendor.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await adminFetch('/api/admin/books/vendors-1099',                  { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (r?.error) { toast(r.error); return; }
    onSaved();
  };
  return (
    <EditorShell title={vendor?.id ? 'Edit 1099 vendor' : 'Add 1099 vendor'} onClose={onClose} onSave={save} saving={saving}>
      <FormRow label="Name (individual)"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Business name (if different)"><input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Tax ID (SSN or EIN)"><input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} placeholder="XX-XXXXXXX or XXX-XX-XXXX" style={inputStyle}/></FormRow>
      <FormRow label="Address"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Street, City, ST ZIP" style={inputStyle}/></FormRow>
      <FormRow label="Notes"><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{...inputStyle,fontFamily:'inherit',resize:'vertical'}}/></FormRow>
    </EditorShell>
  );
}

function BooksSettingsModal({ current, onClose, onSaved }) {
  const [form, setForm] = useState({
    filing_state:        current?.filing_state || '',
    filing_status:       current?.filing_status || 'single',
    se_tax_rate:         current?.se_tax_rate ?? 0.153,
    ss_wage_base:        current?.ss_wage_base ?? 168600,
    federal_income_rate: current?.federal_income_rate ?? 0.18,
    state_income_rate:   current?.state_income_rate ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const body = {
      ...form,
      filing_state: form.filing_state || null,
      se_tax_rate: Number(form.se_tax_rate),
      ss_wage_base: Number(form.ss_wage_base),
      federal_income_rate: Number(form.federal_income_rate),
      state_income_rate: Number(form.state_income_rate),
    };
    const r = await adminFetch('/api/admin/books/config', { method: 'PUT', body: JSON.stringify(body) });
    setSaving(false);
    if (r?.error) { toast(r.error); return; }
    onSaved();
  };
  return (
    <EditorShell title="Tax settings" onClose={onClose} onSave={save} saving={saving}>
      <FormRow label="Filing state (2-letter)"><input value={form.filing_state} onChange={e => setForm({ ...form, filing_state: e.target.value.toUpperCase().slice(0,2) })} placeholder="TX" style={inputStyle}/></FormRow>
      <FormRow label="Filing status">
        <select value={form.filing_status} onChange={e => setForm({ ...form, filing_status: e.target.value })} style={inputStyle}>
          <option value="single">Single</option>
          <option value="married_joint">Married · Joint</option>
          <option value="married_separate">Married · Separate</option>
          <option value="head_of_household">Head of Household</option>
        </select>
      </FormRow>
      <FormRow label="Self-employment tax rate (decimal, e.g. 0.153)"><input type="number" step="0.0001" min="0" max="0.5" value={form.se_tax_rate} onChange={e => setForm({ ...form, se_tax_rate: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Social Security wage base (USD)"><input type="number" step="100" min="0" value={form.ss_wage_base} onChange={e => setForm({ ...form, ss_wage_base: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="Federal income rate (effective, decimal e.g. 0.18)"><input type="number" step="0.01" min="0" max="0.5" value={form.federal_income_rate} onChange={e => setForm({ ...form, federal_income_rate: e.target.value })} style={inputStyle}/></FormRow>
      <FormRow label="State income rate (effective, decimal e.g. 0.05)"><input type="number" step="0.01" min="0" max="0.2" value={form.state_income_rate} onChange={e => setForm({ ...form, state_income_rate: e.target.value })} style={inputStyle}/></FormRow>
      <div style={{fontSize:11,color:'#7a8db0',marginTop:6,lineHeight:1.5}}>
        Rates are estimates the quarterly view applies to your net income. Use your CPA's projected numbers for accuracy — these are not a tax filing.
      </div>
    </EditorShell>
  );
}

function BookTablePanel({ title, addLabel, onAdd, onExport, byCategory, rows, renderRow, emptyText }) {
  return (
    <div style={{marginTop:18,marginBottom:18,background:'#0d1726',border:'1px solid #2e3f60',borderRadius:12,padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:10}}>
        <Subhead>{title}</Subhead>
        <div style={{display:'flex',gap:6}}>
          {onExport && (
            <button onClick={onExport} title="Download CSV" style={{
              background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',
              padding:'7px 10px',fontSize:11,fontWeight:600,letterSpacing:'.06em',cursor:'pointer',fontFamily:'inherit',
            }}>CSV ↓</button>
          )}
          <button onClick={onAdd} style={{
            background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',
            padding:'7px 12px',fontSize:12,fontWeight:700,letterSpacing:'.04em',cursor:'pointer',fontFamily:'inherit',
          }}>{addLabel}</button>
        </div>
      </div>
      {byCategory && Object.keys(byCategory).length > 0 && (
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
          {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (
            <span key={cat} style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:999,padding:'4px 10px',fontSize:11,color:'#c8d4ee'}}>
              {cat}: <span style={{color:'#f0f4ff',fontWeight:700}}>{fmtMoney(amt)}</span>
            </span>
          ))}
        </div>
      )}
      {rows.length === 0
        ? <div style={{fontSize:12,color:'#7a8db0',fontStyle:'italic',padding:'10px 0'}}>{emptyText}</div>
        : <div style={{display:'flex',flexDirection:'column',gap:6}}>{rows.map(renderRow)}</div>}
    </div>
  );
}

function ExpenseRow({ row, vendors = [], onChanged }) {
  const [editing, setEditing] = useState(false);
  const del = async () => {
    if (!confirm(`Delete ${row.category} expense for ${fmtMoney(row.amount)}?`)) return;
    const r = await adminFetch(`/api/admin/books/expenses?id=${row.id}`, { method: 'DELETE' });
    if (r?.error) { toast(r.error); return; }
    onChanged();
  };
  const linkedVendor = row.vendor_1099_id ? vendors.find(v => v.id === row.vendor_1099_id) : null;
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'90px 110px 1fr 100px auto',gap:10,alignItems:'center',padding:'8px 10px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:8,fontSize:13}}>
        <div style={{color:'#c8d4ee'}}>{row.occurred_on}</div>
        <div style={{color:'#7a8db0',fontWeight:600,textTransform:'uppercase',fontSize:11,letterSpacing:'.06em'}}>{row.category}</div>
        <div style={{color:'#f0f4ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {row.vendor || <span style={{color:'#7a8db0',fontStyle:'italic'}}>—</span>}
          {row.source !== 'manual' && <span style={{marginLeft:6,fontSize:10,padding:'1px 6px',borderRadius:999,background:'#2e3f60',color:'#c8d4ee'}}>{row.source}</span>}
          {linkedVendor && <span style={{marginLeft:6,fontSize:10,padding:'1px 6px',borderRadius:999,background:'#fbbf2422',color:'#fbbf24'}}>1099 · {linkedVendor.name}</span>}
        </div>
        <div style={{color:'#f26060',fontWeight:700,textAlign:'right'}}>{fmtMoney(row.amount)}</div>
        <div style={{display:'flex',gap:4}}>
          <button onClick={() => setEditing(true)} style={iconBtn}>✎</button>
          <button onClick={del} style={iconBtn}>✕</button>
        </div>
      </div>
      {editing && (
        <ExpenseEditorModal row={row} vendors={vendors} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }}/>
      )}
    </>
  );
}

function TaxPaymentRow({ row, onChanged }) {
  const [editing, setEditing] = useState(false);
  const typeLabel = TAX_TYPES.find(([k]) => k === row.tax_type)?.[1] || row.tax_type;
  const del = async () => {
    if (!confirm(`Delete ${typeLabel} payment of ${fmtMoney(row.amount)}?`)) return;
    const r = await adminFetch(`/api/admin/books/tax-payments?id=${row.id}`, { method: 'DELETE' });
    if (r?.error) { toast(r.error); return; }
    onChanged();
  };
  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'90px 1fr 100px 100px auto',gap:10,alignItems:'center',padding:'8px 10px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:8,fontSize:13}}>
        <div style={{color:'#c8d4ee'}}>{row.paid_on}</div>
        <div style={{color:'#f0f4ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{typeLabel}</div>
        <div style={{color:'#7a8db0',fontSize:12}}>{row.period}</div>
        <div style={{color:'#2edf87',fontWeight:700,textAlign:'right'}}>{fmtMoney(row.amount)}</div>
        <div style={{display:'flex',gap:4}}>
          <button onClick={() => setEditing(true)} style={iconBtn}>✎</button>
          <button onClick={del} style={iconBtn}>✕</button>
        </div>
      </div>
      {editing && (
        <TaxPaymentEditorModal row={row} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }}/>
      )}
    </>
  );
}

function ExpenseEditorModal({ row, vendors = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    occurred_on:     row?.occurred_on    || todayIso(),
    category:        row?.category       || 'hosting',
    vendor:          row?.vendor         || '',
    amount:          row?.amount         ?? '',
    notes:           row?.notes          || '',
    receipt_url:     row?.receipt_url    || '',
    vendor_1099_id:  row?.vendor_1099_id || '',
  });
  const [saving, setSaving] = useState(false);
  const showVendor1099 = form.category === 'contractors';
  const save = async () => {
    setSaving(true);
    const body = {
      ...form,
      amount: Number(form.amount),
      vendor: form.vendor || null,
      notes:  form.notes  || null,
      receipt_url: form.receipt_url || null,
      vendor_1099_id: showVendor1099 ? (form.vendor_1099_id || null) : null,
    };
    const r = row?.id
      ? await adminFetch(`/api/admin/books/expenses?id=${row.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await adminFetch('/api/admin/books/expenses',                { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (r?.error) { toast(r.error); return; }
    onSaved();
  };
  return (
    <EditorShell title={row?.id ? 'Edit expense' : 'Add expense'} onClose={onClose} onSave={save} saving={saving}>
      <FormRow label="Date">
        <input type="date" value={form.occurred_on} onChange={e => setForm({ ...form, occurred_on: e.target.value })} style={inputStyle}/>
      </FormRow>
      <FormRow label="Category">
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </FormRow>
      <FormRow label="Vendor">
        <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Vercel, OpenAI, Twilio" style={inputStyle}/>
      </FormRow>
      {showVendor1099 && (
        <FormRow label="1099 vendor (year-end tracking)">
          <select value={form.vendor_1099_id} onChange={e => setForm({ ...form, vendor_1099_id: e.target.value })} style={inputStyle}>
            <option value="">— none —</option>
            {vendors.filter(v => v.active).map(v => (
              <option key={v.id} value={v.id}>{v.name}{v.business_name ? ` (${v.business_name})` : ''}</option>
            ))}
          </select>
        </FormRow>
      )}
      <FormRow label="Amount (USD)">
        <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle}/>
      </FormRow>
      <FormRow label="Receipt URL">
        <input type="url" value={form.receipt_url} onChange={e => setForm({ ...form, receipt_url: e.target.value })} placeholder="https://..." style={inputStyle}/>
      </FormRow>
      <FormRow label="Notes">
        <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{...inputStyle, fontFamily:'inherit', resize:'vertical'}}/>
      </FormRow>
    </EditorShell>
  );
}

function TaxPaymentEditorModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    paid_on:  row?.paid_on  || todayIso(),
    period:   row?.period   || `${new Date().getUTCFullYear()} Q${Math.floor(new Date().getUTCMonth()/3)+1}`,
    tax_type: row?.tax_type || 'federal_quarterly',
    amount:   row?.amount   ?? '',
    notes:    row?.notes    || '',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const body = { ...form, amount: Number(form.amount), notes: form.notes || null };
    const r = row?.id
      ? await adminFetch(`/api/admin/books/tax-payments?id=${row.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await adminFetch('/api/admin/books/tax-payments',                { method: 'POST', body: JSON.stringify(body) });
    setSaving(false);
    if (r?.error) { toast(r.error); return; }
    onSaved();
  };
  return (
    <EditorShell title={row?.id ? 'Edit tax payment' : 'Add tax payment'} onClose={onClose} onSave={save} saving={saving}>
      <FormRow label="Paid on">
        <input type="date" value={form.paid_on} onChange={e => setForm({ ...form, paid_on: e.target.value })} style={inputStyle}/>
      </FormRow>
      <FormRow label="Type">
        <select value={form.tax_type} onChange={e => setForm({ ...form, tax_type: e.target.value })} style={inputStyle}>
          {TAX_TYPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </FormRow>
      <FormRow label="Period">
        <input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="e.g. 2026 Q2" style={inputStyle}/>
      </FormRow>
      <FormRow label="Amount (USD)">
        <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle}/>
      </FormRow>
      <FormRow label="Notes">
        <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{...inputStyle, fontFamily:'inherit', resize:'vertical'}}/>
      </FormRow>
    </EditorShell>
  );
}

function EditorShell({ title, children, onClose, onSave, saving }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{position:'fixed',inset:0,zIndex:9500,background:'rgba(8,11,20,0.78)',display:'flex',alignItems:'center',justifyContent:'center',padding:14,backdropFilter:'blur(4px)'}}>
      <div style={{width:'100%',maxWidth:520,background:'#1a2236',border:'1px solid #2e3f60',borderRadius:14,boxShadow:'0 20px 50px rgba(0,0,0,0.55)',padding:18,color:'#f0f4ff'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em'}}>{title.toUpperCase()}</div>
          <button onClick={onClose} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#7a8db0',width:30,height:30,cursor:'pointer'}}>✕</button>
        </div>
        {children}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:14}}>
          <button onClick={onClose} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'9px 14px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{background: saving ? '#1e2a42' : '#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'9px 18px',fontSize:13,fontWeight:700,cursor: saving ? 'wait' : 'pointer',fontFamily:'inherit',letterSpacing:'.04em'}}>{saving ? 'SAVING…' : 'SAVE'}</button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div style={{marginBottom:10}}>
      <label style={{display:'block',fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width:'100%', boxSizing:'border-box',
  background:'#0d1726', border:'1px solid #2e3f60', borderRadius:8,
  color:'#f0f4ff', padding:'9px 11px', fontSize:13,
};
const iconBtn = {
  background:'transparent', border:'1px solid #2e3f60', borderRadius:6,
  color:'#7a8db0', width:26, height:26, cursor:'pointer', fontSize:12, padding:0,
};

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
// Integrations
// =============================================================
const INTEGRATIONS = [
  { key:'stripe',         label:'Stripe',                endpoint:'/api/admin/integrations/stripe' },
  { key:'revenuecat',     label:'RevenueCat · Apple IAP', endpoint:'/api/admin/integrations/revenuecat' },
  { key:'facebookAds',    label:'Facebook Ads',          endpoint:'/api/admin/integrations/facebook-ads' },
  { key:'searchConsole',  label:'Google Search Console', endpoint:'/api/admin/integrations/search-console' },
  { key:'googleAds',      label:'Google Ads',            endpoint:'/api/admin/integrations/google-ads' },
  { key:'twilio',         label:'Twilio SMS',            endpoint:'/api/admin/integrations/twilio' },
  { key:'clarity',        label:'Microsoft Clarity',     endpoint:'/api/admin/integrations/clarity' },
];

function IntegrationsSection() {
  // Per-card state: pending | { ok, configured, data?, error?, lastUpdated, missingEnv? }
  const empty = useMemo(() => Object.fromEntries(INTEGRATIONS.map(i => [i.key, null])), []);
  const [cards, setCards]       = useState(empty);
  const [refreshing, setRefresh] = useState(false);

  const loadAll = async () => {
    setRefresh(true);
    setCards(empty); // show per-card spinners
    await Promise.all(INTEGRATIONS.map(async (i) => {
      const r = await adminFetch(i.endpoint);
      // adminFetch returns either the body or { error }. Normalize so
      // every card has the same shape downstream.
      const normalized = r?.error
        ? { ok:false, configured:true, error:r.error, lastUpdated:new Date().toISOString() }
        : r;
      setCards(prev => ({ ...prev, [i.key]: normalized }));
    }));
    setRefresh(false);
  };

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stripe     = cards.stripe?.data;
  const revenuecat = cards.revenuecat?.data;
  const combinedMrr = (stripe?.mrr || 0) + (revenuecat?.mrr || 0);
  const combinedReady = !!(cards.stripe?.ok || cards.revenuecat?.ok);

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap',marginBottom:18}}>
        <SectionHeading title="Integrations" subtitle="Live data pulled from each external service."/>
        <button onClick={loadAll} disabled={refreshing} style={{
          background: refreshing ? '#1e2a42' : '#4f9eff',
          border:'none', borderRadius:8, color:'#fff',
          padding:'9px 16px', fontFamily:"'Bebas Neue',sans-serif",
          fontSize:13, letterSpacing:'.06em',
          cursor: refreshing ? 'wait' : 'pointer',
        }}>{refreshing ? 'REFRESHING…' : 'REFRESH'}</button>
      </div>

      {/* Combined MRR hero */}
      <div style={{
        background:'linear-gradient(135deg, #1e2a42 0%, #243353 100%)',
        border:'1px solid #2e3f60', borderRadius:14,
        padding:'20px 22px', marginBottom:22,
      }}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.18em',textTransform:'uppercase',fontWeight:700}}>
          Combined MRR · Stripe + Apple IAP
        </div>
        <div style={{
          fontFamily:"'Bebas Neue',Impact,sans-serif",
          fontSize:56, lineHeight:1.05, letterSpacing:'.02em',
          color:'#2edf87', marginTop:6,
        }}>
          {combinedReady ? fmt$(combinedMrr) : '—'}
        </div>
        <div style={{fontSize:12,color:'#7a8db0',marginTop:6}}>
          Stripe: {cards.stripe?.ok ? fmt$(stripe?.mrr || 0) : (cards.stripe ? 'n/a' : '…')}
          {' · '}
          Apple: {cards.revenuecat?.ok ? fmt$(revenuecat?.mrr || 0) : (cards.revenuecat ? 'n/a' : '…')}
        </div>
      </div>

      {/* Cards grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))',gap:14}}>
        {INTEGRATIONS.map(i => (
          <IntegrationCard key={i.key} label={i.label} state={cards[i.key]} kind={i.key}/>
        ))}
      </div>
    </>
  );
}

function IntegrationCard({ label, state, kind }) {
  return (
    <div style={{
      background:'#1e2a42', border:'1px solid #2e3f60', borderRadius:12,
      padding:'14px 16px', display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',color:'#f0f4ff'}}>
          {label.toUpperCase()}
        </div>
        <StatusPill state={state}/>
      </div>

      <IntegrationBody kind={kind} state={state}/>

      <div style={{fontSize:10,color:'#7a8db0',marginTop:'auto',paddingTop:8,borderTop:'1px dashed #2e3f60'}}>
        Last updated: {state?.lastUpdated ? new Date(state.lastUpdated).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit', second:'2-digit' }) : '—'}
      </div>
    </div>
  );
}

function StatusPill({ state }) {
  if (!state)              return <Pill color="#7a8db0" bg="#7a8db022">Loading</Pill>;
  if (state.ok)            return <Pill color="#2edf87" bg="#2edf8722">Live</Pill>;
  if (!state.configured)   return <Pill color="#fbbf24" bg="#fbbf2422">Not configured</Pill>;
  return <Pill color="#f26060" bg="#f2606022">Error</Pill>;
}
function Pill({ color, bg, children }) {
  return (
    <span style={{
      background:bg, color, border:`1px solid ${color}55`,
      borderRadius:999, padding:'2px 9px', fontSize:10, fontWeight:700,
      letterSpacing:'.1em', textTransform:'uppercase', whiteSpace:'nowrap',
    }}>{children}</span>
  );
}

function IntegrationBody({ kind, state }) {
  if (!state) return <div style={{fontSize:12,color:'#7a8db0',padding:'6px 0'}}>Loading…</div>;

  if (!state.ok && !state.configured) {
    return (
      <div style={{fontSize:12,color:'#c8d4ee',lineHeight:1.55}}>
        <div style={{color:'#fbbf24',marginBottom:6,fontWeight:700,fontSize:11,letterSpacing:'.06em',textTransform:'uppercase'}}>
          Missing env vars
        </div>
        {(state.missingEnv || []).map(v => (
          <div key={v} style={{fontFamily:'ui-monospace,Menlo,monospace',fontSize:11,color:'#f0f4ff'}}>{v}</div>
        ))}
      </div>
    );
  }

  if (!state.ok) {
    return (
      <div style={{
        fontSize:12, color:'#f26060', lineHeight:1.5,
        background:'rgba(242,96,96,.08)', border:'1px solid rgba(242,96,96,.3)',
        borderRadius:8, padding:'8px 10px',
      }}>{state.error || 'Request failed.'}</div>
    );
  }

  const d = state.data || {};
  switch (kind) {
    case 'stripe':
      return (
        <div style={miniGrid}>
          <MiniStat label="MRR"          value={fmt$(d.mrr)}                color="#2edf87"/>
          <MiniStat label="Active subs"  value={(d.activeSubs ?? 0).toLocaleString()} color="#4f9eff"/>
          <MiniStat label="New this mo." value={(d.newSubsThisMonth ?? 0).toLocaleString()} color="#f0f4ff"/>
          <MiniStat label="Churned"      value={(d.churnedThisMonth ?? 0).toLocaleString()} color="#f26060"/>
        </div>
      );

    case 'revenuecat':
      return (
        <div style={miniGrid}>
          <MiniStat label="Apple MRR"    value={fmt$(d.mrr)}                color="#2edf87"/>
          <MiniStat label="Active IAP"   value={(d.activeSubs ?? 0).toLocaleString()} color="#4f9eff"/>
          <MiniStat label="New this mo." value={(d.newSubsThisMonth ?? 0).toLocaleString()} color="#f0f4ff"/>
        </div>
      );

    case 'facebookAds':
      return (
        <>
          <div style={miniGrid}>
            <MiniStat label="Spend"      value={fmt$(d.spend || 0)}         color="#f0f4ff"/>
            <MiniStat label="Link clicks" value={(d.linkClicks ?? 0).toLocaleString()} color="#4f9eff"/>
            <MiniStat label="CPC"        value={fmt$(d.cpc || 0)}           color="#2edf87"/>
          </div>
          {d.bestAd && (
            <div style={{fontSize:11,color:'#7a8db0',marginTop:4,lineHeight:1.5}}>
              <span style={{color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:700,fontSize:10}}>Top ad · </span>
              <span style={{color:'#f0f4ff',fontWeight:600}}>{d.bestAd.name}</span>
              {' '}<span style={{color:'#7a8db0'}}>· {d.bestAd.linkClicks.toLocaleString()} clicks · {fmt$(d.bestAd.spend)}</span>
            </div>
          )}
        </>
      );

    case 'searchConsole':
      return (
        <>
          <div style={miniGrid}>
            <MiniStat label="Clicks"      value={(d.clicks ?? 0).toLocaleString()}      color="#4f9eff"/>
            <MiniStat label="Impressions" value={(d.impressions ?? 0).toLocaleString()} color="#f0f4ff"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
            <div>
              <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>Top pages</div>
              {(d.topPages || []).slice(0, 5).map(p => (
                <div key={p.url} style={listLine} title={p.url}>
                  <span style={listText}>{shortPath(p.url)}</span>
                  <span style={{color:'#4f9eff',fontWeight:700}}>{p.clicks.toLocaleString()}</span>
                </div>
              ))}
              {(!d.topPages || !d.topPages.length) && <div style={listEmpty}>No data</div>}
            </div>
            <div>
              <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>Top queries</div>
              {(d.topQueries || []).slice(0, 5).map(q => (
                <div key={q.query} style={listLine}>
                  <span style={listText}>{q.query}</span>
                  <span style={{color:'#4f9eff',fontWeight:700}}>{q.clicks.toLocaleString()}</span>
                </div>
              ))}
              {(!d.topQueries || !d.topQueries.length) && <div style={listEmpty}>No data</div>}
            </div>
          </div>
        </>
      );

    case 'googleAds':
      return (
        <div style={miniGrid}>
          <MiniStat label="Spend"  value={fmt$(d.spend || 0)}              color="#f0f4ff"/>
          <MiniStat label="Clicks" value={(d.clicks ?? 0).toLocaleString()} color="#4f9eff"/>
          <MiniStat label="CPC"    value={fmt$(d.cpc || 0)}                color="#2edf87"/>
        </div>
      );

    case 'twilio':
      return (
        <div style={miniGrid}>
          <MiniStat
            label={d.capped ? 'SMS sent (5000+)' : 'SMS sent this month'}
            value={(d.smsSentThisMonth ?? 0).toLocaleString()}
            color="#4f9eff"
          />
        </div>
      );

    case 'clarity':
      return (
        <>
          <div style={miniGrid}>
            <MiniStat label="Sessions (24h)" value={(d.sessions ?? 0).toLocaleString()}      color="#4f9eff"/>
            <MiniStat label="Users"          value={(d.users ?? 0).toLocaleString()}         color="#f0f4ff"/>
            <MiniStat label="Avg scroll"     value={`${(d.avgScrollDepth ?? 0).toFixed(0)}%`} color="#2edf87"/>
            <MiniStat label="Rage clicks"    value={(d.rageClicks ?? 0).toLocaleString()}    color="#f26060"/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:4,fontSize:11,color:'#7a8db0',lineHeight:1.5}}>
            <div>
              {d.botSessions > 0 && <>Bots filtered: <span style={{color:'#f0f4ff',fontWeight:600}}>{d.botSessions.toLocaleString()}</span></>}
              {d.botSessions > 0 && d.deadClicks > 0 && ' · '}
              {d.deadClicks > 0 && <>Dead clicks: <span style={{color:'#f0f4ff',fontWeight:600}}>{d.deadClicks.toLocaleString()}</span></>}
            </div>
            <a href="https://clarity.microsoft.com/projects/view/x8znr59h3p/dashboard"
               target="_blank" rel="noreferrer noopener"
               style={{color:'#4f9eff',fontWeight:600,textDecoration:'none',whiteSpace:'nowrap'}}>
              View in Clarity ↗
            </a>
          </div>
        </>
      );

    default:
      return null;
  }
}

function shortPath(url) {
  try {
    const u = new URL(url);
    const p = (u.pathname + u.search).replace(/\/$/, '');
    return p || u.hostname;
  } catch {
    return url;
  }
}

const miniGrid = { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px, 1fr))', gap:8 };
const listLine = { display:'flex', justifyContent:'space-between', gap:8, fontSize:11, color:'#c8d4ee', padding:'3px 0', minWidth:0 };
const listText = { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', minWidth:0 };
const listEmpty = { fontSize:11, color:'#7a8db0', fontStyle:'italic', padding:'4px 0' };

// =============================================================
// Broadcast (email blast to active orgs)
// =============================================================
const TIER_OPTIONS = [
  { key:'all',      label:'All tiers' },
  { key:'solo',     label:'Solo' },
  { key:'crew',     label:'Crew' },
  { key:'business', label:'Business' },
];

function BroadcastSection() {
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [tier, setTier]       = useState('all');

  const [recipients, setRecipients] = useState(null); // { total, byTier }
  const [history, setHistory]       = useState(null); // { broadcasts, todayCount, maxPerDay, lastSentAt }
  const [previewHtml, setPreviewHtml] = useState(null); // html string when preview open
  const [confirmStage, setConfirmStage] = useState(null); // null | 'first' | 'large'
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null); // { sentCount, failedCount, recipientCount } | { error }

  const loadRecipients = async () => {
    const r = await adminFetch('/api/admin/broadcasts/recipients');
    if (!r.error) setRecipients(r);
  };
  const loadHistory = async () => {
    const r = await adminFetch('/api/admin/broadcasts/history');
    if (!r.error) setHistory(r);
  };
  useEffect(() => { loadRecipients(); loadHistory(); }, []);

  // Count for the currently-selected tier
  const countForTier = useMemo(() => {
    if (!recipients) return null;
    if (tier === 'all') return recipients.total;
    return (recipients.byTier?.[tier] || 0);
  }, [recipients, tier]);

  const rateLimitReached = history && history.todayCount >= history.maxPerDay;
  const remaining        = history ? Math.max(history.maxPerDay - history.todayCount, 0) : null;

  const canCompose = !!subject.trim() && !!body.trim() && countForTier > 0 && !rateLimitReached;

  const openPreview = async () => {
    setPreviewHtml('loading');
    const r = await adminFetch('/api/admin/broadcasts/preview', {
      method: 'POST',
      body: JSON.stringify({ subject, body }),
    });
    if (r.error) { setPreviewHtml(null); toast(r.error); return; }
    setPreviewHtml(r.html);
  };

  const startSend = () => {
    if (!canCompose) return;
    setResult(null);
    setConfirmStage('first');
  };

  const doSend = async (confirmedLargeBatch = false) => {
    setSending(true);
    const r = await adminFetch('/api/admin/broadcasts/send', {
      method: 'POST',
      body: JSON.stringify({ subject, body, tier, confirmedLargeBatch }),
    });
    setSending(false);

    // Surface a second confirm modal if the server says we need one.
    if (r?.requiresLargeBatchConfirm) {
      setConfirmStage('large');
      return;
    }
    setConfirmStage(null);
    if (r?.error) {
      setResult({ error: r.error });
      toast(r.error);
      return;
    }
    setResult({
      ok: true,
      sentCount:      r.sentCount,
      failedCount:    r.failedCount,
      recipientCount: r.recipientCount,
    });
    setSubject('');
    setBody('');
    loadHistory();
    toast(`Broadcast sent to ${r.sentCount} of ${r.recipientCount}.`);
  };

  return (
    <>
      <SectionHeading title="Broadcast" subtitle="Email every active or trialing organization."/>

      {/* Top-row status: today usage, last sent, rate limit warning */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:10,marginBottom:18}}>
        <Kpi label="Today's sends"
             value={history ? `${history.todayCount} / ${history.maxPerDay}` : '…'}
             color={rateLimitReached ? '#f26060' : '#4f9eff'}
             sub={remaining !== null ? `${remaining} left today` : undefined}/>
        <Kpi label="Last broadcast"
             value={history?.lastSentAt ? fmtRelative(history.lastSentAt) : '—'}
             color="#f0f4ff"
             sub={history?.lastSentAt ? new Date(history.lastSentAt).toLocaleString() : 'No history'}/>
        <Kpi label="Active recipients"
             value={recipients ? recipients.total.toLocaleString() : '…'}
             color="#2edf87"
             sub="active + trialing orgs with email"/>
      </div>

      {rateLimitReached && (
        <div style={{padding:'12px 14px',background:'rgba(242,96,96,.10)',border:'1px solid rgba(242,96,96,.35)',borderRadius:10,color:'#f26060',fontSize:13,marginBottom:14}}>
          Daily limit reached ({history.maxPerDay} broadcasts). Try again after UTC midnight.
        </div>
      )}

      {/* Compose form */}
      <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:18,marginBottom:24}}>
        <Subhead>Compose</Subhead>

        <label style={fieldLabel}>Tier filter</label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
          {TIER_OPTIONS.map(t => {
            const active = tier === t.key;
            const cnt = recipients ? (t.key === 'all' ? recipients.total : (recipients.byTier?.[t.key] || 0)) : null;
            return (
              <button key={t.key} onClick={() => setTier(t.key)}
                style={{
                  background: active ? '#4f9eff' : 'transparent',
                  border:`1px solid ${active ? '#4f9eff' : '#2e3f60'}`,
                  borderRadius:8, color: active ? '#fff' : '#c8d4ee',
                  padding:'8px 14px', fontSize:12, fontWeight:600,
                  letterSpacing:'.04em', cursor:'pointer', fontFamily:'inherit',
                }}>
                {t.label}{cnt !== null && <span style={{opacity:.7,marginLeft:6}}>· {cnt.toLocaleString()}</span>}
              </button>
            );
          })}
        </div>

        <label style={fieldLabel}>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200}
          placeholder="e.g. New feature: AI invoice extraction"
          style={textInput}/>

        <label style={fieldLabel}>Message</label>
        <div style={{fontSize:11,color:'#7a8db0',marginBottom:6}}>
          Plain text. Blank lines become paragraph breaks. URLs auto-link.
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={50000}
          rows={10}
          placeholder={`Hey,\n\nQuick update on what's new in MyForeman this week...\n\n— Chris`}
          style={{...textInput, fontFamily:'ui-monospace,Menlo,monospace', lineHeight:1.55, resize:'vertical'}}/>

        <div style={{display:'flex',alignItems:'center',gap:10,marginTop:14,flexWrap:'wrap'}}>
          <button onClick={openPreview} disabled={!subject.trim() || !body.trim()}
            style={{...btnGhost, opacity:(!subject.trim() || !body.trim()) ? .5 : 1, cursor:(!subject.trim() || !body.trim()) ? 'not-allowed' : 'pointer'}}>
            Preview
          </button>
          <button onClick={startSend} disabled={!canCompose}
            style={{
              background: canCompose ? '#2edf87' : '#1e2a42',
              border:'none', borderRadius:8, color:'#0d1726',
              padding:'10px 18px', fontFamily:"'Bebas Neue',sans-serif",
              fontSize:14, letterSpacing:'.06em', fontWeight:700,
              cursor: canCompose ? 'pointer' : 'not-allowed',
              opacity: canCompose ? 1 : .5,
            }}>
            SEND TO {countForTier !== null ? countForTier.toLocaleString() : '—'} {countForTier === 1 ? 'PERSON' : 'PEOPLE'}
          </button>
          {result?.ok && (
            <span style={{fontSize:12,color:'#2edf87'}}>
              ✓ Sent {result.sentCount}/{result.recipientCount}
              {result.failedCount > 0 && <span style={{color:'#f26060',marginLeft:6}}>· {result.failedCount} failed</span>}
            </span>
          )}
          {result?.error && (
            <span style={{fontSize:12,color:'#f26060'}}>Error: {result.error}</span>
          )}
        </div>
      </div>

      {/* History */}
      <Subhead>Broadcast history</Subhead>
      {!history && <Loading/>}
      {history && history.broadcasts.length === 0 && (
        <div style={empty}>No broadcasts sent yet.</div>
      )}
      {history && history.broadcasts.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {history.broadcasts.map(b => (
            <div key={b.id} style={{background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,padding:'10px 14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap'}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#f0f4ff',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis'}}>{b.subject}</div>
                  <div style={{fontSize:11,color:'#7a8db0'}}>
                    {b.tier_filter ? `${b.tier_filter} tier` : 'all tiers'} · {b.recipient_count.toLocaleString()} recipients · {b.sent_count.toLocaleString()} sent
                    {b.failed_count > 0 && <span style={{color:'#f26060'}}> · {b.failed_count} failed</span>}
                  </div>
                </div>
                <div style={{fontSize:11,color:'#7a8db0',textAlign:'right',whiteSpace:'nowrap'}}>
                  <div>{new Date(b.sent_at).toLocaleString()}</div>
                  <div style={{color:'#7a8db0',opacity:.7}}>{b.sent_by}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewHtml && (
        <Modal onClose={() => setPreviewHtml(null)} title="Email preview">
          {previewHtml === 'loading' ? (
            <div style={{padding:40,textAlign:'center',color:'#7a8db0'}}>Loading preview…</div>
          ) : (
            <iframe
              title="Broadcast preview"
              srcDoc={previewHtml}
              sandbox=""
              style={{width:'100%',height:'70vh',border:'1px solid #2e3f60',borderRadius:8,background:'#fff'}}
            />
          )}
        </Modal>
      )}

      {/* First confirm modal */}
      {confirmStage === 'first' && (
        <Modal onClose={() => setConfirmStage(null)} title="Send broadcast?">
          <p style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55,margin:'0 0 14px'}}>
            You are about to send to <strong style={{color:'#f0f4ff'}}>{countForTier.toLocaleString()}</strong> {countForTier === 1 ? 'person' : 'people'}.
            {history?.lastSentAt && (
              <span style={{display:'block',marginTop:8,fontSize:12,color:'#7a8db0'}}>
                Last broadcast went out {fmtRelative(history.lastSentAt)} — make sure this isn't a duplicate.
              </span>
            )}
          </p>
          <p style={{fontSize:13,color:'#c8d4ee',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,padding:'10px 12px',margin:'0 0 16px'}}>
            <strong style={{color:'#f0f4ff'}}>{subject}</strong>
          </p>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button onClick={() => setConfirmStage(null)} style={btnGhost} disabled={sending}>Cancel</button>
            <button onClick={() => doSend(false)} disabled={sending}
              style={{
                background:'#2edf87', border:'none', borderRadius:8, color:'#0d1726',
                padding:'10px 18px', fontFamily:"'Bebas Neue',sans-serif", fontSize:14,
                letterSpacing:'.06em', fontWeight:700, cursor: sending ? 'wait' : 'pointer',
              }}>
              {sending ? 'SENDING…' : 'YES, SEND'}
            </button>
          </div>
        </Modal>
      )}

      {/* Second confirm modal — only when server flags large batch */}
      {confirmStage === 'large' && (
        <Modal onClose={() => setConfirmStage(null)} title="Wait — large batch">
          <p style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55,margin:'0 0 14px'}}>
            This will hit <strong style={{color:'#f26060'}}>more than 1,000 recipients</strong>. Confirm one more time to send.
          </p>
          <p style={{fontSize:12,color:'#7a8db0',margin:'0 0 16px'}}>
            Subject: {subject}
          </p>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button onClick={() => setConfirmStage(null)} style={btnGhost} disabled={sending}>Cancel</button>
            <button onClick={() => doSend(true)} disabled={sending}
              style={{
                background:'#f26060', border:'none', borderRadius:8, color:'#fff',
                padding:'10px 18px', fontFamily:"'Bebas Neue',sans-serif", fontSize:14,
                letterSpacing:'.06em', fontWeight:700, cursor: sending ? 'wait' : 'pointer',
              }}>
              {sending ? 'SENDING…' : 'I UNDERSTAND, SEND'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(8,12,20,.7)', zIndex:200,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background:'#111827', border:'1px solid #2e3f60', borderRadius:14,
          padding:'18px 20px', maxWidth:720, width:'100%', maxHeight:'90vh',
          overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.5)',
        }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff'}}>{title.toUpperCase()}</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#7a8db0',fontSize:18,cursor:'pointer',padding:4}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'in the future';
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const fieldLabel = { display:'block', fontSize:11, color:'#7a8db0', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:700, marginBottom:6 };
const textInput  = {
  width:'100%', background:'#0d1726', border:'1px solid #2e3f60', borderRadius:8,
  color:'#f0f4ff', padding:'10px 12px', fontSize:14, fontFamily:'inherit',
  marginBottom:14, boxSizing:'border-box',
};

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
