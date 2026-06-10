// Public change-order approval page. URL: /co/<token>. No auth —
// anyone with the link can approve or decline. Mirrors the
// approval-flow patterns of /q/<token> (the original quote page).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { fmt$, fmtDate } from '../../lib/helpers';
import { FullPageLoading } from '../../components/PageStates';

export default function ChangeOrderPublic() {
  const router = useRouter();
  const { token } = router.query;
  const [co, setCo]   = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');
  const [declineMode, setDeclineMode] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (!router.isReady || !token) return;
    (async () => {
      const { data } = await supabase.rpc('get_public_change_order', { p_token: token });
      setCo(data || null);
      setLoaded(true);
    })();
  }, [router.isReady, token]);

  const decide = async (decision, reason = null) => {
    setBusy(true); setError('');
    const { data, error: e } = await supabase.rpc('decide_change_order', {
      p_token: token, p_decision: decision, p_reason: reason,
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    // Re-fetch so the status pill updates.
    const { data: refreshed } = await supabase.rpc('get_public_change_order', { p_token: token });
    setCo(refreshed || co);
  };

  if (!loaded) return <FullPageLoading/>;
  if (!co) {
    return (
      <Screen>
        <div style={{textAlign:'center',padding:'80px 20px',color:'#7a8db0'}}>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:26,letterSpacing:'.06em',marginBottom:8,color:'#f0f4ff'}}>NOT FOUND</div>
          <div style={{fontSize:14}}>This change-order link is invalid or has been revoked.</div>
        </div>
      </Screen>
    );
  }

  const org    = co.org || {};
  const job    = co.job || null;
  const quote  = co.quote || null;
  const items  = Array.isArray(co.line_items) ? co.line_items : [];
  const status = co.status;
  const settled = status !== 'pending';
  const originalTotal = job?.price ?? quote?.amount ?? 0;
  const newTotal = Number(originalTotal || 0) + Number(co.amount || 0);

  return (
    <Screen>
      <div style={{maxWidth:520,margin:'0 auto',padding:'24px 16px 60px'}}>
        <BizHeader org={org}/>

        {/* Status pill */}
        <div style={{marginTop:18,marginBottom:14,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{
            background: STATUS_BG[status], color: STATUS_FG[status], border:`1px solid ${STATUS_FG[status]}66`,
            borderRadius:999, padding:'4px 12px', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase',
          }}>
            {STATUS_LABEL[status]}
          </span>
          {settled && co.approved_at && <span style={{fontSize:12,color:'#7a8db0'}}>Approved {fmtDate(co.approved_at.slice(0,10))}</span>}
          {settled && co.declined_at && <span style={{fontSize:12,color:'#7a8db0'}}>Declined {fmtDate(co.declined_at.slice(0,10))}</span>}
        </div>

        {/* Hero */}
        <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'18px 18px',marginBottom:14}}>
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase'}}>Change order</div>
          <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.02em',color:'#fbbf24',lineHeight:1.05,marginTop:4}}>
            +{fmt$(co.amount)}
          </div>
          <div style={{fontSize:13,color:'#c8d4ee',marginTop:10,lineHeight:1.5}}>{co.description}</div>
          {co.reason && (
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #2e3f60',fontSize:12,color:'#7a8db0'}}>
              <span style={{color:'#a8b8d8',fontWeight:600}}>Why:</span> {co.reason}
            </div>
          )}
        </div>

        {/* Line items */}
        {items.length > 0 && (
          <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'14px 16px',marginBottom:14}}>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',fontWeight:700,textTransform:'uppercase',marginBottom:6}}>Line items</div>
            {items.map((li, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'7px 0',borderTop: i === 0 ? 'none' : '1px solid #2e3f60'}}>
                <div style={{fontSize:13,color:'#c8d4ee',flex:1}}>{li.description || li.name || '—'}</div>
                <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>
                  {fmt$(Number(li.quantity || 1) * Number(li.unit_price || li.price || 0))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New total */}
        <div style={{background:'#0d1726',border:'1px solid #2e3f60',borderRadius:12,padding:'12px 16px',marginBottom:18}}>
          <Row label={job ? 'Original job' : 'Original quote'} value={fmt$(originalTotal)}/>
          <Row label="Change order"    value={'+ ' + fmt$(co.amount)} valueColor="#fbbf24"/>
          <div style={{height:1,background:'#2e3f60',margin:'8px 0'}}/>
          <Row label="New total" value={fmt$(newTotal)} bold valueColor="#2edf87"/>
        </div>

        {/* Actions */}
        {!settled && !declineMode && (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={() => decide('approve')} disabled={busy}
              style={{background:'#2edf87',color:'#0d1726',border:'none',borderRadius:12,padding:'14px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.08em',cursor:'pointer',opacity:busy?0.6:1}}>
              {busy ? 'WORKING…' : 'APPROVE'}
            </button>
            <button onClick={() => setDeclineMode(true)} disabled={busy}
              style={{background:'transparent',color:'#f26060',border:'1px solid #f2606044',borderRadius:12,padding:'12px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:'.08em',cursor:'pointer'}}>
              Decline
            </button>
          </div>
        )}

        {!settled && declineMode && (
          <div style={{background:'#1a2236',border:'1px solid #f2606044',borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:12,color:'#7a8db0',marginBottom:8,lineHeight:1.5}}>
              Mind sharing why? Helps the contractor follow up.
            </div>
            <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)}
              placeholder="Optional"
              maxLength={500}
              style={{width:'100%',background:'#111827',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',fontSize:13,padding:'9px 10px',outline:'none',fontFamily:'inherit',minHeight:70,resize:'vertical',marginBottom:10}}/>
            <div style={{display:'flex',gap:6}}>
              <button onClick={() => setDeclineMode(false)}
                style={{flex:1,background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 0',fontWeight:700,fontSize:13,cursor:'pointer'}}>Back</button>
              <button onClick={() => decide('decline', declineReason.trim() || null)} disabled={busy}
                style={{flex:1,background:'#f26060',border:'none',borderRadius:10,color:'#fff',padding:'10px 0',fontWeight:700,fontSize:13,cursor:'pointer',opacity:busy?0.6:1}}>
                {busy ? 'Sending…' : 'Send decline'}
              </button>
            </div>
          </div>
        )}

        {settled && (
          <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:14,padding:'14px 16px',marginTop:6,fontSize:13,color:'#c8d4ee',lineHeight:1.55}}>
            Thanks. {org.name || 'Your contractor'} has been notified.
          </div>
        )}

        {error && <div style={{marginTop:10,padding:'9px 12px',background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,fontSize:12,color:'#f26060'}}>{error}</div>}

        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#7a8db0'}}>Powered by MyForeman</div>
      </div>
    </Screen>
  );
}

function Row({ label, value, bold, valueColor }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'4px 0'}}>
      <span style={{fontSize:bold?13:12,color:bold?'#f0f4ff':'#7a8db0',fontWeight:bold?700:500}}>{label}</span>
      <span style={{fontSize:bold?17:14,color: valueColor || '#f0f4ff',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{value}</span>
    </div>
  );
}

function Screen({ children }) {
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif"}}>
      {children}
    </div>
  );
}

function BizHeader({ org }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:14,padding:'4px 0'}}>
      {org?.logo_url && <img src={org.logo_url} alt="" style={{width:54,height:54,objectFit:'contain',borderRadius:10,background:'#0d1726',border:'1px solid #2e3f60'}}/>}
      <div style={{minWidth:0,flex:1}}>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',lineHeight:1.05,color:'#f0f4ff'}}>{org?.name || 'Your contractor'}</div>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.1em',fontWeight:600,textTransform:'uppercase',marginTop:2}}>Change order</div>
      </div>
    </div>
  );
}

const STATUS_LABEL = { pending: 'Awaiting approval', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled' };
const STATUS_FG    = { pending: '#fbbf24', approved: '#2edf87', declined: '#f26060', cancelled: '#7a8db0' };
const STATUS_BG    = { pending: 'rgba(251,191,36,.12)', approved: 'rgba(46,223,135,.12)', declined: 'rgba(242,96,96,.12)', cancelled: 'rgba(122,141,176,.12)' };
