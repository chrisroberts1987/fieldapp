// Floating AI assistant bottom-right. Tap mic to dictate (Web
// Speech API, browser-native, no service required) or type. Posts
// to /api/ai/assistant which has tool-calling for log_expense,
// log_mileage, read_stats, read_jobs_today.
//
// Closed by default. Opens to a small chat sheet that doesn't
// block the page. Hides if there's no signed-in user.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from './Toast';

export default function AssistantWidget({ user, orgId }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'assistant', content: 'Hey! Ask me anything — "log $40 fuel", "what\'s my net this month", "anything today"...' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  const send = async (text) => {
    const body = (text || input).trim();
    if (!body || sending || !orgId) return;
    const next = [...msgs, { role:'user', content: body }];
    setMsgs(next);
    setInput('');
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session?.access_token,
        },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })), orgId }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        // Most server-side errors here are billing / rate-limit on
        // the AI. Show a generic-but-honest line; the raw error is
        // already useful in the server logs.
        const friendly = j?.error && /credit|rate limit|api key/i.test(j.error)
          ? 'AI is taking a quick break — the admin needs to top up credits or check the API key.'
          : (j?.error || 'Something went wrong.');
        setMsgs(prev => [...prev, { role: 'assistant', content: friendly }]);
      } else {
        setMsgs(prev => [...prev, { role: 'assistant', content: j.reply || 'Done.' }]);
      }
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'Network hiccup. Try again?' }]);
    }
    setSending(false);
  };

  // Voice: native Web Speech API. iOS Safari and Chrome on
  // Android both have it. Fall back gracefully if not supported.
  const startListening = () => {
    const Recog = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Recog) {
      toast.info('Voice input not supported on this browser. Type instead.');
      return;
    }
    const r = new Recog();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    recogRef.current = r;
    setListening(true);
    r.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (transcript) send(transcript);
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    r.start();
  };
  const stopListening = () => {
    try { recogRef.current?.stop(); } catch {}
    setListening(false);
  };

  if (!user || !orgId) return null;

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        style={{
          position:'fixed', right:16, bottom:84, zIndex:90,
          width:56, height:56, borderRadius:28,
          background: open ? '#1a2236' : 'linear-gradient(135deg,#4f9eff,#a855f7)',
          border: open ? '1.5px solid #4f9eff' : 'none',
          color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 8px 24px rgba(79,158,255,0.35)',
          cursor:'pointer',
          fontSize: 22,
        }}>
        {open ? '✕' : '✨'}
      </button>

      {open && (
        <div style={{
          position:'fixed', right:16, bottom:148, zIndex:90,
          width: 'min(380px, calc(100vw - 32px))',
          height: 'min(520px, calc(100vh - 220px))',
          background:'#1a2236',
          border:'1.5px solid #2e3f60',
          borderRadius:14,
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          boxShadow:'0 18px 60px rgba(0,0,0,0.45)',
        }}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid #2e3f60',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',color:'#f0f4ff'}}>
              ✨ ASSISTANT
            </div>
            <div style={{fontSize:10,color:'#7a8db0',letterSpacing:'.08em',fontWeight:700,textTransform:'uppercase'}}>AI</div>
          </div>

          <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:7}}>
            {msgs.map((m, i) => (
              <div key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: m.role === 'user' ? '#4f9eff' : '#0d1726',
                  border: m.role === 'user' ? 'none' : '1px solid #2e3f60',
                  color: m.role === 'user' ? '#fff' : '#f0f4ff',
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{alignSelf:'flex-start',color:'#7a8db0',fontSize:12,padding:'6px 10px',fontStyle:'italic'}}>
                thinking…
              </div>
            )}
          </div>

          <div style={{padding:'10px 12px',borderTop:'1px solid #2e3f60',display:'flex',gap:6}}>
            <button
              onClick={listening ? stopListening : startListening}
              aria-label={listening ? 'Stop listening' : 'Start voice'}
              style={{
                background: listening ? '#f26060' : '#0d1726',
                border:'1px solid ' + (listening ? '#f26060' : '#2e3f60'),
                borderRadius:10, color: listening ? '#fff' : '#c8d4ee',
                width:38, height:38, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
              }}>
              {listening ? '⏹' : '🎤'}
            </button>
            <input value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              disabled={sending || listening}
              placeholder={listening ? 'Listening…' : 'Ask or tell me anything...'}
              style={{flex:1,background:'#0d1726',border:'1px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:13,padding:'9px 11px',outline:'none',fontFamily:'inherit'}}/>
            <button onClick={() => send()} disabled={sending || !input.trim()}
              style={{background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'0 14px',fontWeight:700,fontSize:12,letterSpacing:'.04em',cursor:'pointer',opacity:(sending||!input.trim())?0.5:1}}>
              SEND
            </button>
          </div>
        </div>
      )}
    </>
  );
}
