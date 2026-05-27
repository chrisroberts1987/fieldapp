// SMS message threads viewer. Inbound texts from customers land
// here as threads, sorted by most recent. Owner reads + replies
// manually — no auto-bot.
//
// Requires Twilio to be configured. Until then, the page renders
// empty — the inbound webhook is the only thing that creates threads.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isForeman } from '../../lib/role';
import TopNav from '../../components/TopNav';

export default function Messages() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [threads, setThreads] = useState([]);
  const [openThread, setOpenThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  const loadThreads = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase.from('message_threads')
      .select('id, customer_id, phone, last_at, customers(name)')
      .eq('org_id', orgId)
      .order('last_at', { ascending: false })
      .limit(100);
    setThreads(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (orgId) loadThreads();
    else if (user && !orgLoading) router.push('/onboarding');
  }, [orgId, orgLoading]);

  useRefetchOnFocus(loadThreads, !!orgId);

  const openConvo = async (t) => {
    setOpenThread(t);
    const { data } = await supabase.from('messages')
      .select('*').eq('thread_id', t.id).order('created_at');
    setMessages(data || []);
  };

  const sendReply = async () => {
    if (!draft.trim() || !openThread || sending) return;
    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session?.access_token },
      body: JSON.stringify({ thread_id: openThread.id, body: draft }),
    });
    const j = await resp.json();
    if (!resp.ok) {
      alert(j?.error || 'Send failed');
    } else {
      setDraft('');
      const { data } = await supabase.from('messages').select('*').eq('thread_id', openThread.id).order('created_at');
      setMessages(data || []);
    }
    setSending(false);
  };

  if (!user || orgLoading) return <div style={loadingStyle}>Loading…</div>;
  if (!isForeman(role)) return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <TopNav active="/messages"/>
      <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Messages are foreman-only.</div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/messages"/>

      <main style={{maxWidth:760,margin:'0 auto',padding:'24px 16px 0'}}>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Messages</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>SMS THREADS</h1>
          <div style={{fontSize:13,color:'#c8d4ee',marginTop:6,lineHeight:1.5}}>
            Inbound texts to your business number. Tap a thread to read and reply.
          </div>
        </div>

        {loading ? (
          <div style={{padding:'40px 16px',textAlign:'center',color:'#7a8db0'}}>Loading…</div>
        ) : threads.length === 0 ? (
          <div style={{padding:'40px 20px',textAlign:'center',color:'#7a8db0',fontSize:13,background:'#1e2a42',border:'1px dashed #2e3f60',borderRadius:12}}>
            <div style={{fontSize:32,marginBottom:8}}>💬</div>
            <div>No messages yet. When a customer texts your business number, the thread shows up here and you get a notification.</div>
          </div>
        ) : (
          <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,overflow:'hidden'}}>
            {threads.map(t => (
              <div key={t.id} onClick={() => openConvo(t)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderTop:'1px solid #2e3f60',cursor:'pointer'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:'#f0f4ff'}}>{t.customers?.name || t.phone || 'Unknown'}</div>
                  <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>{t.phone} · {new Date(t.last_at).toLocaleString()}</div>
                </div>
                <div style={{fontSize:18,color:'#4f9eff'}}>→</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {openThread && (
        <div onClick={e => e.target === e.currentTarget && setOpenThread(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}}>
          <div style={{background:'#1a2236',borderTop:'2px solid #2e3f60',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:520,margin:'0 auto',height:'78vh',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid #2e3f60',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',color:'#f0f4ff'}}>
                  {openThread.customers?.name || openThread.phone}
                </div>
                <div style={{fontSize:11,color:'#7a8db0'}}>{openThread.phone}</div>
              </div>
              <button onClick={() => setOpenThread(null)}
                style={{background:'transparent',border:'none',color:'#7a8db0',fontSize:20,cursor:'pointer'}}>✕</button>
            </div>

            <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
              {messages.map(m => {
                const isOut = m.direction === 'outbound';
                return (
                  <div key={m.id}
                    style={{
                      alignSelf: isOut ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: isOut ? '#4f9eff' : '#0d1726',
                      border: isOut ? 'none' : '1px solid #2e3f60',
                      color: isOut ? '#fff' : '#f0f4ff',
                      padding:'8px 12px',
                      borderRadius: isOut ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      fontSize:13.5, lineHeight:1.5, whiteSpace:'pre-wrap',
                    }}>
                    {m.body}
                    <div style={{fontSize:9,opacity:0.6,marginTop:3,letterSpacing:'.04em',textTransform:'uppercase'}}>
                      {isOut ? 'You' : ''} {new Date(m.created_at).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{padding:'10px 12px',borderTop:'1px solid #2e3f60',display:'flex',gap:6}}>
              <input value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendReply())}
                placeholder="Type a reply…"
                style={{flex:1,background:'#0d1726',border:'1px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit'}}/>
              <button onClick={sendReply} disabled={sending || !draft.trim()}
                style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'0 16px',fontWeight:700,fontSize:12,letterSpacing:'.04em',cursor:'pointer',opacity:(sending||!draft.trim())?0.5:1}}>
                SEND
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const loadingStyle = { minHeight:'100vh', background:'#111827', display:'flex', alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif' };
