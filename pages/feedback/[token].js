import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { FullPageLoading } from '../../components/PageStates';

export default function PublicFeedback() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady || !token) return;
    (async () => {
      const { data: d } = await supabase.rpc('get_feedback_by_token', { p_token: token });
      setData(d || null);
      setLoaded(true);
    })();
  }, [router.isReady, token]);

  const submit = async () => {
    if (!rating) { setError('Pick a rating first.'); return; }
    setSubmitting(true); setError('');
    const { error } = await supabase.rpc('submit_feedback', { p_token: token, p_rating: rating, p_comment: comment });
    if (error) { setError(error.message); setSubmitting(false); return; }
    setSubmitted(true);
    setSubmitting(false);
    // Review deflection: if the contractor has set a Google (or Yelp)
    // review URL and the rating clears their threshold (default 4),
    // bounce the happy customer over there 1.2s after the thank-you
    // shows. Negative reviews stay private — they get the normal
    // thank-you screen and the contractor gets a notification.
    const threshold = Number(data?.review_deflect_threshold || 4);
    const url = data?.google_review_url || data?.yelp_review_url;
    if (rating >= threshold && url) {
      setTimeout(() => { window.location.href = url; }, 1400);
    }
  };

  if (!loaded) return <FullPageLoading/>;
  if (!data) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{textAlign:'center',maxWidth:360}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,letterSpacing:'.08em',marginBottom:8}}>NOT FOUND</div>
          <div style={{fontSize:14,color:'#7a8db0'}}>This feedback link is invalid or has been removed.</div>
        </div>
      </div>
    );
  }

  const alreadyDone = data.submitted_at || submitted;

  if (alreadyDone) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{maxWidth:420,textAlign:'center'}}>
          <BizHeader biz={{ name:data.org_name, logo:data.org_logo_url }}/>
          <div style={{width:60,height:60,margin:'24px auto 14px',borderRadius:30,background:'#2edf8722',border:'2px solid #2edf87',display:'flex',alignItems:'center',justifyContent:'center',color:'#2edf87',fontSize:28,fontWeight:700}}>✓</div>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',marginBottom:10}}>THANK YOU</div>
          <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>Your feedback was sent to {data.org_name}. They appreciate it.</div>
          {submitted && rating >= Number(data?.review_deflect_threshold || 4) && (data?.google_review_url || data?.yelp_review_url) && (
            <div style={{marginTop:20,fontSize:12,color:'#7a8db0'}}>
              Redirecting you to leave a public review...{' '}
              <a href={data.google_review_url || data.yelp_review_url} style={{color:'#4f9eff'}}>tap here</a> if it doesn't.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",padding:'24px 16px 40px'}}>
      <div style={{maxWidth:480,margin:'0 auto'}}>
        <BizHeader biz={{ name:data.org_name, logo:data.org_logo_url }}/>

        <div style={{marginTop:18,marginBottom:18,textAlign:'center'}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em'}}>HOW DID WE DO?</div>
          <div style={{fontSize:14,color:'#c8d4ee',marginTop:6,lineHeight:1.5}}>
            Thanks for your business{data.customer_name ? ', ' + data.customer_name.split(' ')[0] : ''}. A quick rating helps {data.org_name} grow.
          </div>
        </div>

        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'24px 18px'}}>
          <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:18}}>
            {[1,2,3,4,5].map(n => {
              const filled = (hover || rating) >= n;
              return (
                <button key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  aria-label={`${n} star${n>1?'s':''}`}
                  style={{background:'none',border:'none',cursor:'pointer',padding:4,fontSize:44,lineHeight:1,color: filled ? '#fbbf24' : '#2e3f60',transition:'color .15s'}}>
                  ★
                </button>
              );
            })}
          </div>
          {rating > 0 && (
            <div style={{textAlign:'center',marginBottom:14,fontSize:12,letterSpacing:'.06em',fontWeight:700,color: rating >= 4 ? '#2edf87' : rating === 3 ? '#fbbf24' : '#f26060'}}>
              {[null, 'POOR','FAIR','GOOD','GREAT','EXCELLENT'][rating]}
            </div>
          )}

          <div style={{margin:'10px 0'}}>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#7a8db0',marginBottom:5}}>Anything to add? (optional)</div>
            <textarea maxLength={2000} value={comment} onChange={e => setComment(e.target.value)}
              placeholder="What we did well, what we could do better..."
              style={{width:'100%',background:'#111827',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit',minHeight:90,resize:'vertical'}}/>
          </div>

          {error && <div style={{background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',marginBottom:10,fontSize:12,color:'#f26060',textAlign:'center'}}>{error}</div>}

          <button onClick={submit} disabled={submitting || !rating}
            style={{width:'100%',background:'#4f9eff',color:'#fff',border:'none',borderRadius:10,padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',opacity:(submitting||!rating)?0.5:1}}>
            {submitting ? 'Sending...' : 'SEND FEEDBACK'}
          </button>
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
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase',marginTop:2}}>Customer feedback</div>
      </div>
    </div>
  );
}

const loadingStyle = {
  minHeight:'100vh', background:'#111827', display:'flex',
  alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif',
};
