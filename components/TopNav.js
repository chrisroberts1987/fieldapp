import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRefetchOnFocus } from '../lib/useFocus';
import { useOrg } from '../lib/org';
import { isForeman, isOffice } from '../lib/role';
import Logo from './Logo';

// Funnel-ordered: Dashboard → Leads → Quotes → Customers → Jobs → Invoices →
// then operational sections. Mileage is reachable from inside Expenses; the
// Approvals queue is reachable from inside Crew.
const ALL_TABS = [
  { label:'Dashboard', route:'/dashboard', showFor:'all' },
  { label:'Leads',     route:'/leads',     showFor:'office' },
  { label:'Quotes',    route:'/quotes',    showFor:'foreman' },
  { label:'Customers', route:'/customers', showFor:'office' },
  { label:'Jobs',      route:'/jobs',      showFor:'all' },
  { label:'Invoices',  route:'/invoices',  showFor:'foreman' },
  { label:'Expenses',  route:'/expenses',  showFor:'all',     // also serves /mileage via inner sub-nav
                                            alsoMatches:['/mileage'] },
  { label:'Tax',       route:'/tax',       showFor:'foreman' },
  { label:'Crew',      route:'/crew',      showFor:'all',     // also serves /approvals via inner sub-nav
                                            alsoMatches:['/approvals'] },
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
  const { role } = useOrg(user);
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

  return (
    <div style={{position:'sticky',top:0,zIndex:50,background:'#0d1726',borderBottom:'1px solid #1f2a40'}}>
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

        <div style={{position:'relative',flexShrink:0}}>
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
              <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,width:340,maxWidth:'90vw',maxHeight:480,overflowY:'auto',zIndex:70,boxShadow:'0 8px 24px rgba(0,0,0,.4)'}}>
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
                <MenuItem label="Sign Out" onClick={signOut} danger />
              </div>
            </>
          )}
        </div>
      </div>
      <style jsx global>{`
        .topnav-tabs::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

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
