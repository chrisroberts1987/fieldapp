import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { fmt$, fmtDate } from '../../lib/helpers';

export default function PublicQuote() {
  const router = useRouter();
  const { token } = router.query;
  const [quote, setQuote] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState(null); // 'approved' | 'declined'
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady || !token) return;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_quote', { p_token: token });
      if (error) setError(error.message);
      setQuote(data || null);
      setLoaded(true);
    })();
  }, [router.isReady, token]);

  const approve = async () => {
    setActing(true); setError('');
    const { error } = await supabase.rpc('approve_quote', { p_token: token });
    if (error) { setError(error.message); setActing(false); return; }
    setDone('approved');
    setActing(false);
  };

  const decline = async () => {
    if (!confirm('Decline this quote?')) return;
    setActing(true); setError('');
    const { error } = await supabase.rpc('decline_quote', { p_token: token });
    if (error) { setError(error.message); setActing(false); return; }
    setDone('declined');
    setActing(false);
  };

  if (!loaded) {
    return <div style={loadingStyle}>Loading...</div>;
  }
  if (!quote) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{textAlign:'center',maxWidth:360}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:8}}>NOT FOUND</div>
          <div style={{fontSize:14,color:'#7a8db0'}}>This quote link is invalid or has been removed. Check with the contractor and try again.</div>
        </div>
      </div>
    );
  }

  const alreadyActioned = quote.status === 'approved' || quote.status === 'declined' || quote.status === 'expired' || done;

  if (done === 'approved') {
    return <SuccessScreen biz={{ name: quote.org_name, logo: quote.org_logo_url }}
      headline="QUOTE APPROVED"
      body={`Thank you. ${quote.org_name} has been notified and will be in touch to schedule.`}
      color="#2edf87"
      icon="✓"/>;
  }
  if (done === 'declined') {
    return <SuccessScreen biz={{ name: quote.org_name, logo: quote.org_logo_url }}
      headline="QUOTE DECLINED"
      body={`Thanks for letting ${quote.org_name} know. If anything changes, feel free to reach out.`}
      color="#7a8db0"
      icon="—"/>;
  }
  if (alreadyActioned) {
    return <SuccessScreen biz={{ name: quote.org_name, logo: quote.org_logo_url }}
      headline={quote.status === 'approved' ? 'ALREADY APPROVED' : 'NO LONGER ACTIVE'}
      body={`This quote has already been ${quote.status}. Contact ${quote.org_name} if you need a new one.`}
      color={quote.status === 'approved' ? '#2edf87' : '#fbbf24'}
      icon={quote.status === 'approved' ? '✓' : '—'}/>;
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",padding:'24px 16px 40px'}}>
      <div style={{maxWidth:520,margin:'0 auto'}}>
        <BizHeader biz={{ name: quote.org_name, logo: quote.org_logo_url }}/>

        <div style={{background:'#fff',color:'#111827',borderRadius:16,marginTop:18,padding:'28px 22px',boxShadow:'0 8px 24px rgba(0,0,0,.35)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,marginBottom:6}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.06em',color:'#111827',lineHeight:1.1}}>QUOTE</div>
            {quote.valid_until && (
              <div style={{fontSize:11,color:'#6b7280',fontWeight:600}}>Valid until {fmtDate(quote.valid_until)}</div>
            )}
          </div>
          <div style={{fontSize:13,color:'#4b5563',marginBottom:18}}>Prepared for <strong style={{color:'#111827'}}>{quote.customer_name}</strong></div>

          <div style={{padding:'18px 0',borderTop:'2px solid #111827',borderBottom:'1px solid #e5e7eb'}}>
            <div style={{fontSize:19,fontWeight:700,color:'#111827',marginBottom:8}}>{quote.title}</div>
            {quote.description && (
              <div style={{fontSize:14,color:'#374151',lineHeight:1.55,whiteSpace:'pre-line'}}>{quote.description}</div>
            )}
          </div>

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'18px 0'}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.06em',color:'#111827'}}>TOTAL</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,color:'#111827',fontVariantNumeric:'tabular-nums'}}>{fmt$(quote.amount || 0)}</div>
          </div>

          <button onClick={approve} disabled={acting}
            style={{width:'100%',background:'#2edf87',border:'none',borderRadius:12,color:'#0d1726',padding:'16px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.1em',fontWeight:700,cursor:'pointer',marginBottom:8,opacity:acting?0.5:1}}>
            {acting ? 'WORKING…' : 'APPROVE QUOTE'}
          </button>
          <button onClick={decline} disabled={acting}
            style={{width:'100%',background:'transparent',border:'1px solid #e5e7eb',borderRadius:12,color:'#6b7280',padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.06em',fontWeight:700,cursor:'pointer'}}>
            DECLINE
          </button>

          {error && (
            <div style={{marginTop:12,background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#991b1b'}}>{error}</div>
          )}

          <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid #e5e7eb',fontSize:11,color:'#6b7280',textAlign:'center',lineHeight:1.5}}>
            By approving, you authorize {quote.org_name} to schedule the work described above at the price shown.
          </div>
        </div>

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#7a8db0'}}>Powered by MyForeman</div>
      </div>
    </div>
  );
}

function BizHeader({ biz }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'4px 0'}}>
      {biz.logo && <img src={biz.logo} alt="" style={{width:54,height:54,objectFit:'contain',borderRadius:10,background:'#0d1726',border:'1px solid #2e3f60'}}/>}
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',lineHeight:1.05,color:'#f0f4ff'}}>{biz.name}</div>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase',marginTop:2}}>Your quote</div>
      </div>
    </div>
  );
}

function SuccessScreen({ biz, headline, body, color, icon }) {
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{maxWidth:420,textAlign:'center'}}>
        <BizHeader biz={biz}/>
        <div style={{width:60,height:60,margin:'24px auto 14px',borderRadius:30,background:color+'22',border:'2px solid '+color,display:'flex',alignItems:'center',justifyContent:'center',color,fontSize:28,fontWeight:700}}>{icon}</div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',marginBottom:10}}>{headline}</div>
        <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>{body}</div>
      </div>
    </div>
  );
}

const loadingStyle = {
  minHeight:'100vh', background:'#111827', display:'flex',
  alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif',
};
