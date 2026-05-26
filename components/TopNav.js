import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRefetchOnFocus } from '../lib/useFocus';
import { useOrg } from '../lib/org';
import { isForeman, isOffice } from '../lib/role';
import { trialDaysLeft, isBlocked } from '../lib/billing';
import Logo from './Logo';

// Funnel-ordered: Dashboard → Leads → Quotes → Customers → Jobs → Invoices →
// then operational sections. Mileage is reachable from inside Expenses; the
// Approvals queue is reachable from inside Crew.
const ALL_TABS = [
  { label:'Dashboard', route:'/dashboard', showFor:'all' },
  { label:'Customers', route:'/customers', showFor:'office' },
  { label:'Leads',     route:'/leads',     showFor:'office' },
  { label:'Quotes',    route:'/quotes',    showFor:'foreman' },
  { label:'Schedule',  route:'/schedule',  showFor:'all' },
  { label:'Jobs',      route:'/jobs',      showFor:'all' },
  { label:'Invoices',  route:'/invoices',  showFor:'foreman' },
  { label:'Expenses',  route:'/expenses',  showFor:'all',     // also serves /mileage via inner sub-nav
                                            alsoMatches:['/mileage'] },
  { label:'Tax',       route:'/tax',       showFor:'foreman' },
  { label:'Crew',      route:'/crew',      showFor:'all',     // also serves /approvals via inner sub-nav
                                            alsoMatches:['/approvals'] },
  { label:'Reviews',   route:'/reviews',   showFor:'foreman' },
  { label:'Insights',  route:'/insights',  showFor:'foreman' },
];

function visibleTabs(role) {
  return ALL_TABS.filter(t => {
    if (t.showFor === 'all') return true;
    if (t.showFor === 'office') return isOffice(role);
    if (t.showFor === 'foreman') return isForeman(role);
    return false;
  });
}

function isActive(tab, active) {
  if (tab.route === active) return true;
  if (Array.isArray(tab.alsoMatches) && tab.alsoMatches.includes(active)) return true;
  return false;
}

export default function TopNav({ active }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [user, setUser] = useState(null);
  const { role, org } = useOrg(user);
  const TABS = visibleTabs(role);

  const loadNotifs = async () => {
    if (!user) return;
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending:false }).limit(20);
    setNotifs(data || []);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifs();
    const interval = setInterval(loadNotifs, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  useRefetchOnFocus(loadNotifs, !!user);

  const unreadCount = notifs.filter(n => !n.read_at).length;

  const markRead = async (n) => {
    if (!n.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    }
    setNotifOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const ts = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: ts }).eq('user_id', user.id).is('read_at', null);
    setNotifs(prev => prev.map(n => n.read_at ? n : { ...n, read_at: ts }));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isDemo = user?.email === 'demo@myforemanhq.com';
  const isOwner = role === 'owner' || role === 'admin';
  const daysLeft = trialDaysLeft(org);
  const subStatus = org?.subscription_status;
  const showTrialBanner = !isDemo && isOwner && subStatus === 'trialing' && daysLeft != null;
  const showPastDue     = !isDemo && isOwner && subStatus === 'past_due';

  // Connect prompt: owner hasn't finished Stripe Connect onboarding,
  // so the org can't accept card payments yet. Stacks below the
  // trial / past-due banner when one is showing. Hides automatically
  // once charges_enabled flips true.
  const connectStarted     = !!org?.stripe_connect_account_id;
  const connectChargesOK   = !!org?.stripe_connect_charges_enabled;
  const showConnectBanner  = !isDemo && isOwner && !!org && !connectChargesOK;
  const [connectBusy, setConnectBusy] = useState(false);

  // Hit /api/stripe/connect/start and jump straight to Stripe's
  // hosted onboarding. Skips the Settings detour — the banner is the
  // CTA, no intermediate page needed.
  const connectNow = async () => {
    if (connectBusy) return;
    setConnectBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const r = await fetch('/api/stripe/connect/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body?.url) {
        alert(body?.error || 'Could not open Stripe. Try Settings → Customer Card Payments.');
        setConnectBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch (e) {
      alert(e?.message || 'Network error.');
      setConnectBusy(false);
    }
  };

  return (
    <>
    <div style={{position:'sticky',top:0,zIndex:50,background:'#0d1726',borderBottom:'1px solid #1f2a40'}}>
      {(showTrialBanner || showPastDue) && (
        <div style={{background: showPastDue ? '#3a1a1f' : '#1a2236', borderBottom:'1px solid '+(showPastDue?'#f2606044':'#fbbf2444')}}>
          <div style={{maxWidth:1280,margin:'0 auto',padding:'6px 12px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:(showPastDue?'#f26060':'#fbbf24')+'22',color:showPastDue?'#f26060':'#fbbf24',border:'1px solid '+(showPastDue?'#f26060':'#fbbf24')+'66',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>
              {showPastDue ? 'Past Due' : (daysLeft === 0 ? 'Trial ended' : 'Trial')}
            </span>
            <span style={{fontSize:12,color:'#c8d4ee',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {showPastDue
                ? "We couldn't charge your card. Update it to keep your subscription active."
                : daysLeft === 0
                  ? 'Your trial ended. Pick a plan to keep using MyForeman.'
                  : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial.`}
            </span>
            <button onClick={() => router.push('/billing')}
              style={{background:showPastDue?'#f26060':'#fbbf24',border:'none',borderRadius:6,color:'#0d1726',padding:'4px 12px',fontSize:10,fontWeight:700,letterSpacing:'.05em',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit'}}>
              {showPastDue ? 'UPDATE CARD' : (daysLeft === 0 ? 'PICK A PLAN' : 'UPGRADE')}
            </button>
          </div>
        </div>
      )}
      {showConnectBanner && (
        <div style={{background:'#1a2236',borderBottom:'1px solid #4f9eff44'}}>
          <div style={{maxWidth:1280,margin:'0 auto',padding:'6px 12px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:'#4f9eff22',color:'#4f9eff',border:'1px solid #4f9eff66',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>
              Payments
            </span>
            <span style={{fontSize:12,color:'#c8d4ee',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {connectStarted
                ? 'Finish Stripe setup to accept card payments.'
                : 'Set up card payments. Takes ~2 min, no Stripe account needed.'}
            </span>
            <button onClick={connectNow} disabled={connectBusy}
              style={{background:'#4f9eff',border:'none',borderRadius:6,color:'#fff',padding:'4px 12px',fontSize:10,fontWeight:700,letterSpacing:'.05em',cursor:connectBusy?'progress':'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit',opacity:connectBusy?0.6:1}}>
              {connectBusy ? 'OPENING...' : (connectStarted ? 'FINISH SETUP' : 'SET UP')}
            </button>
          </div>
        </div>
      )}
      {isDemo && (
        <div className="demo-banner" style={{background:'linear-gradient(90deg,#1f3a2c 0%,#1a2236 100%)',borderBottom:'1px solid #2edf8744'}}>
          <div style={{maxWidth:1280,margin:'0 auto',padding:'6px 12px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{background:'#2edf8722',color:'#2edf87',border:'1px solid #2edf8766',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',whiteSpace:'nowrap',flexShrink:0}}>Live demo</span>
            <span className="demo-banner-msg" style={{fontSize:12,color:'#c8d4ee',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              You're viewing a live demo. Sign up free to create your own account.
            </span>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
              style={{background:'transparent',border:'1px solid #2edf8766',borderRadius:6,color:'#2edf87',padding:'4px 9px',fontSize:10,fontWeight:700,letterSpacing:'.05em',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit'}}>
              EXIT
            </button>
            <button onClick={() => router.push('/signup')}
              style={{background:'#2edf87',border:'none',borderRadius:6,color:'#0d1726',padding:'4px 9px',fontSize:10,fontWeight:700,letterSpacing:'.05em',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontFamily:'inherit'}}>
              FREE TRIAL →
            </button>
          </div>
        </div>
      )}
      <div style={{maxWidth:1280,margin:'0 auto',padding:'10px 16px',display:'flex',alignItems:'center',gap:14}}>
        <div onClick={() => router.push('/dashboard')} style={{cursor:'pointer',flexShrink:0}}>
          <Logo size="sm" />
        </div>

        <nav className="topnav-tabs" style={{display:'flex',gap:2,flex:1,overflowX:'auto',scrollbarWidth:'none'}}>
          {TABS.map(t => {
            const on = isActive(t, active);
            return (
              <button key={t.route} onClick={() => router.push(t.route)}
                style={{
                  background: on ? 'rgba(79,158,255,0.12)' : 'transparent',
                  border: 'none',
                  borderBottom: on ? '2px solid #4f9eff' : '2px solid transparent',
                  color: on ? '#f0f4ff' : '#7a8db0',
                  padding:'10px 14px',
                  fontSize:13,
                  fontWeight: on ? 700 : 600,
                  letterSpacing:'.05em',
                  cursor:'pointer',
                  whiteSpace:'nowrap',
                  fontFamily:'inherit',
                }}>
                {t.label.toUpperCase()}
              </button>
            );
          })}
        </nav>

        <div style={{position:'relative',flexShrink:0,marginLeft:'auto'}}>
          <button onClick={() => setNotifOpen(v => !v)}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'6px 10px',cursor:'pointer',position:'relative'}}>
            <BellIcon/>
            {unreadCount > 0 && (
              <span style={{position:'absolute',top:-6,right:-6,background:'#f26060',color:'#fff',fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:999,minWidth:16,textAlign:'center'}}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div onClick={() => setNotifOpen(false)} style={{position:'fixed',inset:0,zIndex:60}}/>
              <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,width:340,maxWidth:'calc(100vw - 24px)',maxHeight:'calc(100vh - 160px)',overflowY:'auto',zIndex:70,boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid #2e3f60'}}>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:14,letterSpacing:'.08em',color:'#f0f4ff'}}>NOTIFICATIONS</div>
                  {unreadCount > 0 && <button onClick={markAllRead} style={{background:'none',border:'none',color:'#4f9eff',fontSize:11,fontWeight:700,cursor:'pointer'}}>MARK ALL READ</button>}
                </div>
                {notifs.length === 0 ? (
                  <div style={{padding:'24px 16px',textAlign:'center',color:'#7a8db0',fontSize:12}}>No notifications yet.</div>
                ) : (
                  notifs.map(n => (
                    <div key={n.id} onClick={() => markRead(n)}
                      style={{padding:'10px 14px',borderBottom:'1px solid #2e3f60',cursor:'pointer',background: n.read_at ? 'transparent' : 'rgba(79,158,255,0.05)'}}
                      onMouseEnter={e => e.currentTarget.style.background = '#111827'}
                      onMouseLeave={e => e.currentTarget.style.background = n.read_at ? 'transparent' : 'rgba(79,158,255,0.05)'}>
                      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                        {!n.read_at && <span style={{width:6,height:6,borderRadius:3,background:'#4f9eff',flexShrink:0}}/>}
                        <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,flex:1}}>{n.title}</div>
                      </div>
                      {n.body && <div style={{fontSize:12,color:'#c8d4ee',marginTop:2,lineHeight:1.4}}>{n.body}</div>}
                      <div style={{fontSize:10,color:'#7a8db0',marginTop:4}}>{timeAgo(n.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div style={{position:'relative',flexShrink:0}}>
          <button onClick={() => setMenuOpen(v => !v)}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'7px 11px',cursor:'pointer',fontSize:12,fontWeight:600,letterSpacing:'.05em'}}>
            ⋯
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:60}}/>
              <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,minWidth:160,padding:6,zIndex:70,boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
                <MenuItem label="Settings"  onClick={() => { setMenuOpen(false); router.push('/settings'); }} />
                <MenuItem label="Billing"   onClick={() => { setMenuOpen(false); router.push('/billing'); }} />
                <MenuItem label="Contact"   onClick={() => { setMenuOpen(false); router.push('/contact'); }} />
                <MenuItem label="Sign Out" onClick={signOut} danger />
              </div>
            </>
          )}
        </div>
      </div>
      <style jsx global>{`
        .topnav-tabs::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          .topnav-tabs { display: none !important; }
          body { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
          .demo-banner-msg { display: none; }
        }
        @media (min-width: 768px) {
          .mobile-bottom-nav { display: none !important; }
        }
      `}</style>
    </div>
    <MobileBottomNav role={role} active={active} router={router} onSignOut={signOut}/>
    </>
  );
}

// ============================================================
// Mobile bottom navigation — fixed to viewport bottom, only shown
// under 768px (CSS hides it on desktop). Five primary tabs + a
// "More" button that opens a slide-up sheet with the secondary
// sections. Items are role-gated the same way the top tab strip is.
// ============================================================
function MobileBottomNav({ role, active, router, onSignOut }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const allPrimary = [
    { route:'/dashboard', label:'Dashboard', icon:<DashIcon/>,    showFor:'all' },
    { route:'/leads',     label:'Leads',     icon:<PhoneIcon/>,   showFor:'office' },
    { route:'/quotes',    label:'Quotes',    icon:<ScrollIcon/>,  showFor:'foreman' },
    { route:'/jobs',      label:'Jobs',      icon:<WrenchIcon/>,  showFor:'all' },
    { route:'/invoices',  label:'Invoices',  icon:<ReceiptIcon/>, showFor:'foreman' },
  ];
  const allMore = [
    { route:'/customers', label:'Customers', icon:<PeopleIcon/>,  showFor:'office' },
    { route:'/crew',      label:'Crew',      icon:<CrewIcon/>,    showFor:'all',     alsoMatches:['/approvals'] },
    { route:'/expenses',  label:'Expenses',  icon:<WalletIcon/>,  showFor:'all',     alsoMatches:['/mileage'] },
    { route:'/tax',       label:'Tax',       icon:<PieIcon/>,     showFor:'foreman' },
    { route:'/reviews',   label:'Reviews',   icon:<StarTabIcon/>, showFor:'foreman' },
    { route:'/insights',  label:'Insights',  icon:<ChartIcon/>,   showFor:'foreman' },
    { route:'/billing',   label:'Billing',   icon:<CardIcon/>,    showFor:'foreman' },
    { route:'/settings',  label:'Settings',  icon:<GearIcon/>,    showFor:'all' },
    { route:'/contact',   label:'Contact',   icon:<MailIcon/>,    showFor:'all' },
  ];
  const visible = items => items.filter(t => {
    if (t.showFor === 'all') return true;
    if (t.showFor === 'office') return isOffice(role);
    if (t.showFor === 'foreman') return isForeman(role);
    return false;
  });
  const primary = visible(allPrimary);
  const more    = visible(allMore);

  const matches = (item) => {
    if (item.route === active) return true;
    if (Array.isArray(item.alsoMatches) && item.alsoMatches.includes(active)) return true;
    return false;
  };
  const moreIsActive = more.some(matches);

  const go = (route) => { setMoreOpen(false); router.push(route); };

  return (
    <>
      <nav className="mobile-bottom-nav" style={{
        position:'fixed', left:0, right:0, bottom:0, zIndex:55,
        background:'#1a2236', borderTop:'1px solid #2e3f60',
        display:'flex', alignItems:'stretch',
        paddingBottom:'env(safe-area-inset-bottom, 0px)',
      }}>
        {primary.map(t => {
          const on = matches(t);
          return <BottomTab key={t.route} item={t} active={on} onClick={() => router.push(t.route)} />;
        })}
        <BottomTab item={{ label:'More', icon:<DotsIcon/> }} active={moreIsActive || moreOpen} onClick={() => setMoreOpen(true)} />
      </nav>

      {moreOpen && (
        <div onClick={() => setMoreOpen(false)}
          style={{position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:200, display:'flex', alignItems:'flex-end', backdropFilter:'blur(2px)'}}>
          <div onClick={e => e.stopPropagation()}
            style={{
              width:'100%', background:'#111827',
              borderTop:'1px solid #2e3f60', borderRadius:'18px 18px 0 0',
              padding:'10px 12px calc(20px + env(safe-area-inset-bottom, 0px))',
              boxShadow:'0 -8px 30px rgba(0,0,0,.5)',
              animation:'slideUp .18s ease-out',
            }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px 10px'}}>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',color:'#f0f4ff'}}>MORE</div>
              <button onClick={() => setMoreOpen(false)}
                style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',width:30,height:30,cursor:'pointer',fontSize:14,lineHeight:1,fontFamily:'inherit'}}>
                ✕
              </button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:8}}>
              {more.map(it => {
                const on = matches(it);
                return (
                  <button key={it.route} onClick={() => go(it.route)}
                    style={{
                      background: on ? 'rgba(79,158,255,0.12)' : '#1a2236',
                      border: '1px solid ' + (on ? '#4f9eff' : '#2e3f60'),
                      borderRadius:12, padding:'14px 8px',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                      color: on ? '#4f9eff' : '#c8d4ee',
                      cursor:'pointer', fontFamily:'inherit',
                    }}>
                    <span style={{color: on ? '#4f9eff' : '#7a8db0'}}>{it.icon}</span>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>{it.label}</span>
                  </button>
                );
              })}
              <button onClick={() => { setMoreOpen(false); onSignOut(); }}
                style={{
                  background:'#1a2236', border:'1px solid #2e3f60', borderRadius:12, padding:'14px 8px',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  color:'#f26060', cursor:'pointer', fontFamily:'inherit',
                }}>
                <span style={{color:'#f26060'}}><LogoutIcon/></span>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>Sign Out</span>
              </button>
            </div>
          </div>
          <style jsx global>{`
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          `}</style>
        </div>
      )}
    </>
  );
}

function BottomTab({ item, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        flex:1, background:'transparent', border:'none', cursor:'pointer',
        padding:'8px 4px 6px', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:3,
        color: active ? '#4f9eff' : '#7a8db0',
        fontFamily:'inherit',
      }}>
      {item.icon}
      <span style={{fontSize:10,fontWeight:active?700:600,letterSpacing:'.04em'}}>{item.label}</span>
    </button>
  );
}

// Inline SVG icons for the mobile nav. Kept small and stroke-based so
// they pick up the parent's currentColor for active/inactive theming.
function svg(d) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>{d}</svg>;
}
function DashIcon()    { return svg(<><rect x="3"  y="3"  width="8" height="8" rx="1"/><rect x="13" y="3"  width="8" height="8" rx="1"/><rect x="3"  y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>); }
function PhoneIcon()   { return svg(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.95.36 1.88.7 2.77a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.31-1.27a2 2 0 0 1 2.11-.45c.89.34 1.82.57 2.77.7A2 2 0 0 1 22 16.92Z"/>); }
function ScrollIcon()  { return svg(<><path d="M8 21h12a2 2 0 0 0 2-2v-2H10"/><path d="M19 17V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3h10"/><path d="M15 8h-5"/><path d="M15 12h-5"/></>); }
function WrenchIcon()  { return svg(<path d="M14.7 6.3a4.5 4.5 0 0 0 4 6.36l-9.3 9.3a2.12 2.12 0 0 1-3-3l9.3-9.3a4.5 4.5 0 0 0-1-3.36Z"/>); }
function ReceiptIcon() { return svg(<><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2l-1 2-3-2-3 2-3-2-3 2-3-2Z"/><path d="M8 7h8M8 11h8M8 15h5"/></>); }
function DotsIcon()    { return svg(<><circle cx="5"  cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>); }
function CrewIcon()    { return svg(<><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="8" r="3"/><path d="M21 21v-1a3 3 0 0 0-3-3"/></>); }
function WalletIcon()  { return svg(<><path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M16 12h4"/><path d="M3 7V5a2 2 0 0 1 2-2h11"/></>); }
function PeopleIcon()  { return svg(<><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></>); }
function PieIcon()     { return svg(<><path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M21 12a9 9 0 0 0-9-9v9h9z"/></>); }
function ChartIcon()   { return svg(<polyline points="3 17 9 11 13 15 21 7"/>); }
function GearIcon()    { return svg(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>); }
function LogoutIcon()  { return svg(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>); }
function MailIcon()    { return svg(<><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></>); }
function CardIcon()    { return svg(<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>); }
function StarTabIcon() { return svg(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>); }

function MenuItem({ label, onClick, danger }) {
  return (
    <button onClick={onClick}
      style={{display:'block',width:'100%',textAlign:'left',background:'transparent',border:'none',color: danger ? '#f26060' : '#f0f4ff',padding:'8px 12px',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
      onMouseEnter={e => e.currentTarget.style.background = '#2e3f60'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {label}
    </button>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}
