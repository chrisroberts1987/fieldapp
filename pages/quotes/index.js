import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';

const STATUSES = [
  { key:'draft',     label:'Draft',     color:'#7a8db0' },
  { key:'sent',      label:'Sent',      color:'#4f9eff' },
  { key:'approved',  label:'Approved',  color:'#2edf87' },
  { key:'declined',  label:'Declined',  color:'#f26060' },
  { key:'expired',   label:'Expired',   color:'#fbbf24' },
];
const statusMeta = k => STATUSES.find(s => s.key === k) || STATUSES[0];

export default function Quotes() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('quotes').select('*')
      .eq('org_id', orgId).order('created_at', { ascending:false });
    setQuotes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (orgId) load();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  useRefetchOnFocus(() => { if (orgId) load(); }, !!orgId);

  const createBlank = async () => {
    if (!orgId) return;
    const { data, error } = await supabase.from('quotes').insert({
      org_id: orgId,
      owner_id: user.id,
      customer_name: 'New Customer',
      title: 'New Quote',
      amount: 0,
    }).select('id').single();
    if (error) return alert(error.message);
    router.push(`/quotes/${data.id}`);
  };

  const del = async (id) => {
    if (!confirm('Delete this quote?')) return;
    await supabase.from('quotes').delete().eq('id', id);
    setQuotes(q => q.filter(x => x.id !== id));
  };

  const visible = quotes.filter(q => filter === 'all' || q.status === filter);

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/quotes"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/quotes"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:18}}>
          <div>
            <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Quotes</div>
            <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>QUOTES</h1>
          </div>
          <button data-tour="page-cta" onClick={createBlank} style={{background:'#4f9eff',border:'none',borderRadius:8,color:'#fff',padding:'10px 18px',fontWeight:700,cursor:'pointer',fontSize:13,letterSpacing:'.04em'}}>+ NEW QUOTE</button>
        </div>

        <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto'}}>
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
            <div style={{fontSize:36,marginBottom:8}}>📄</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:4}}>
              {quotes.length === 0 ? 'No Quotes Yet' : 'Nothing in this filter'}
            </div>
            <div style={{fontSize:13}}>{quotes.length === 0 ? 'Tap + NEW QUOTE or generate one from a lead.' : 'Try a different filter.'}</div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          {visible.map(q => {
            const s = statusMeta(q.status);
            return (
              <div key={q.id} onClick={() => router.push(`/quotes/${q.id}`)}
                style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,padding:'12px 14px',cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:3}}>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.04em',color:'#f0f4ff',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.title}</div>
                  <span style={{background:s.color+'22',color:s.color,border:'1px solid '+s.color+'66',borderRadius:999,padding:'2px 8px',fontSize:10,fontWeight:700,letterSpacing:'.05em'}}>{s.label.toUpperCase()}</span>
                  <button onClick={e => { e.stopPropagation(); del(q.id); }} style={{background:'none',border:'none',color:'#f26060',cursor:'pointer',fontSize:12,fontWeight:700,padding:'2px 4px'}}>✕</button>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#c8d4ee'}}>
                  <span>{q.customer_name}</span>
                  <span style={{color:'#2edf87',fontWeight:600}}>{fmt$(q.amount || 0)}</span>
                </div>
                <div style={{fontSize:11,color:'#7a8db0',marginTop:3}}>
                  {q.status === 'sent' && q.sent_at && <>Sent {fmtDate(q.sent_at.slice(0,10))}</>}
                  {q.status === 'approved' && q.approved_at && <>Approved {fmtDate(q.approved_at.slice(0,10))}</>}
                  {q.status === 'declined' && q.declined_at && <>Declined {fmtDate(q.declined_at.slice(0,10))}</>}
                  {q.status === 'draft' && <>Created {fmtDate(q.created_at?.slice(0,10))}</>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
