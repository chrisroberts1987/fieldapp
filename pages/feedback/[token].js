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
    // No auto-redirect. The thank-you screen now shows an explicit
    // "Post to Google" CTA when the rating clears the threshold AND
    // the contractor configured a review URL. Low-rating customers
    // see a private apology message instead — the contractor gets a
    // notification via the submit_feedback RPC.
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
    // Three branches:
    //   high rating + URL set        → Google review CTA
    //   high rating but no URL       → simple thank you
    //   low rating (≤3)              → private apology (no public ask)
    // We only know `rating` after a fresh submit in this session; if
    // the page is reopened later we always show the simple thank-you.
    const threshold = Number(data?.review_deflect_threshold || 4);
    const googleUrl = data?.google_review_url || null;
    const isHigh = submitted && rating >= threshold;
    const isLow  = submitted && rating > 0 && rating < threshold;
    const orgName = data?.org_name || 'They';

    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{maxWidth:420,textAlign:'center',width:'100%'}}>
          <BizHeader biz={{ name:data.org_name, logo:data.org_logo_url }}/>

          {isLow ? (
            <>
              <div style={{width:60,height:60,margin:'24px auto 14px',borderRadius:30,background:'#fbbf2422',border:'2px solid #fbbf24',display:'flex',alignItems:'center',justifyContent:'center',color:'#fbbf24',fontSize:28,fontWeight:700}}>!</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',marginBottom:10}}>WE'RE SORRY</div>
              <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>
                We're sorry to hear that. {orgName} will be in touch to make it right.
              </div>
            </>
          ) : (
            <>
              <div style={{width:60,height:60,margin:'24px auto 14px',borderRadius:30,background:'#2edf8722',border:'2px solid #2edf87',display:'flex',alignItems:'center',justifyContent:'center',color:'#2edf87',fontSize:28,fontWeight:700}}>✓</div>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',marginBottom:10}}>THANK YOU</div>
              <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>
                Your feedback was sent to {data.org_name}. They appreciate it.
              </div>
            </>
          )}

          {/* Google review CTA — only after a high rating AND only
              when the contractor has actually configured a URL. */}
          {isHigh && googleUrl && (
            <div style={{marginTop:22,padding:'18px 18px',background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,textAlign:'left'}}>
              <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600,marginBottom:6,lineHeight:1.45}}>
                Glad you had a great experience!
              </div>
              <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55,marginBottom:14}}>
                Mind sharing your review on Google? It helps {data.org_name} grow.
              </div>
              <a href={googleUrl} target="_blank" rel="noopener noreferrer"
                style={{display:'block',background:'#4f9eff',color:'#fff',textDecoration:'none',borderRadius:10,padding:'13px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.08em',textAlign:'center',marginBottom:8}}>
                POST TO GOOGLE
              </a>
              <button onClick={() => { /* dismiss = no-op, just keep them on this screen */ }}
                aria-label="No thanks, don't post a review"
                style={{display:'block',width:'100%',background:'transparent',color:'#7a8db0',border:'1px solid #2e3f60',borderRadius:10,padding:'11px 0',fontSize:13,fontWeight:600,letterSpacing:'.05em',cursor:'pointer',fontFamily:'inherit'}}
                onClickCapture={(e) => {
                  // Replace the CTA card with a quiet acknowledgement.
                  const card = e.currentTarget.closest('div');
                  if (card) card.style.display = 'none';
                }}>
                No thanks
              </button>
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
