import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { fmt$, fmtDate } from '../../lib/helpers';

// Public invoice view for the contractor's customer. Reached via a
// shareable URL like /inv/<token>. No login required. Pay Now spins
// up a Stripe Checkout session and redirects.

export default function PublicInvoice() {
  const router = useRouter();
  const { token, paid, cancelled } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [inv, setInv]       = useState(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState('');

  const load = async () => {
    if (!token) return;
    setLoading(true); setError('');
    const { data, error: e } = await supabase.rpc('get_invoice_by_token', { p_token: token });
    if (e) { setError(e.message); setLoading(false); return; }
    setInv(data);
    setLoading(false);
  };

  useEffect(() => { if (router.isReady) load(); }, [router.isReady, token]);
  // Re-fetch if we came back from a successful payment so the status flips visibly.
  useEffect(() => { if (paid === '1') setTimeout(() => load(), 1500); }, [paid]);

  const pay = async () => {
    setPaying(true); setPayErr('');
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body?.url) {
        setPayErr(body?.error || `Could not start checkout (${r.status}).`);
        setPaying(false);
        return;
      }
      window.location.href = body.url;
    } catch (e) {
      setPayErr(e?.message || 'Network error.');
      setPaying(false);
    }
  };

  if (loading) {
    return <Shell><div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading invoice…</div></Shell>;
  }
  if (error || !inv) {
    return (
      <Shell>
        <div style={{textAlign:'center',padding:'60px 20px'}}>
          <div style={{fontSize:36,marginBottom:8}}>—</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:6}}>INVOICE NOT FOUND</div>
          <div style={{fontSize:13,color:'#7a8db0'}}>This link may have expired or been mistyped. Contact the business that sent it.</div>
        </div>
      </Shell>
    );
  }

  const org = inv.org || {};
  const isPaid = inv.status === 'paid';

  return (
    <Shell>
      {/* Header / branding */}
      <div style={{padding:'24px 24px 18px',borderBottom:'1px solid #2e3f60'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          {org.logo_url && (
            <img src={org.logo_url} alt={org.name || ''} style={{maxHeight:48,maxWidth:140,objectFit:'contain'}}/>
          )}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>From</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:24,letterSpacing:'.04em',color:'#f0f4ff',lineHeight:1.05}}>{(org.name || 'Your contractor').toUpperCase()}</div>
            <div style={{fontSize:12,color:'#7a8db0',marginTop:2}}>
              {org.business_email}{org.business_email && org.phone && ' · '}{org.phone}
            </div>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {paid === '1' && !isPaid && (
        <Banner color="#2edf87" text="Thanks — Stripe is confirming your payment. This page will refresh shortly."/>
      )}
      {cancelled === '1' && !isPaid && (
        <Banner color="#fbbf24" text="Payment cancelled. You can try again whenever you're ready."/>
      )}

      {/* Invoice body */}
      <div style={{padding:'24px 24px 8px'}}>
        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Invoice</div>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 14px',lineHeight:1,color:isPaid?'#2edf87':'#f0f4ff'}}>
          {fmt$(inv.amount)}
        </h1>

        <Row label="Billed to"      value={inv.customer_name || '—'}/>
        <Row label="Issued"         value={fmtDate(inv.issued_date)}/>
        {isPaid && <Row label="Paid"  value={`${fmtDate(inv.paid_date)}${inv.paid_via ? ` · ${inv.paid_via}` : ''}`} color="#2edf87"/>}
        {!isPaid && <Row label="Status" value="Unpaid" color="#fbbf24"/>}
        {inv.notes && <Row label="Notes" value={inv.notes}/>}

        {!isPaid && org.card_payments_enabled && (
          <div style={{marginTop:22}}>
            <button onClick={pay} disabled={paying}
              style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:12,color:'#fff',padding:'15px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:20,letterSpacing:'.06em',cursor:paying?'wait':'pointer',opacity:paying?0.6:1}}>
              {paying ? 'OPENING CHECKOUT…' : `PAY ${fmt$(inv.amount)} NOW`}
            </button>
            <div style={{fontSize:11,color:'#7a8db0',textAlign:'center',marginTop:8}}>
              Secure payment by Stripe. Visa, Mastercard, Amex, Discover.
            </div>
            {payErr && <div style={{fontSize:12,color:'#f26060',textAlign:'center',marginTop:8}}>{payErr}</div>}
          </div>
        )}

        {!isPaid && !org.card_payments_enabled && (
          <div style={{marginTop:22,padding:'14px 16px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12}}>
            <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.55,textAlign:'center'}}>
              Please pay {org.name || 'this contractor'} directly — by check, Zelle, Venmo, or the method you usually use.
            </div>
            <div style={{fontSize:12,color:'#7a8db0',textAlign:'center',marginTop:8}}>
              Card payments aren't enabled on this invoice.
            </div>
          </div>
        )}

        {isPaid && (
          <div style={{marginTop:22,padding:'14px 16px',background:'rgba(46,223,135,0.08)',border:'1px solid rgba(46,223,135,0.35)',borderRadius:12,textAlign:'center'}}>
            <div style={{fontSize:28,marginBottom:4}}>✓</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.06em',color:'#2edf87'}}>PAID IN FULL</div>
            <div style={{fontSize:12,color:'#c8d4ee',marginTop:4}}>Thanks for the payment. {org.name || 'Your contractor'} will follow up if anything else is needed.</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{padding:'18px 24px 22px',borderTop:'1px solid #2e3f60',marginTop:14}}>
        <div style={{fontSize:11,color:'#7a8db0',textAlign:'center'}}>
          Questions? Reply to the email or call <strong style={{color:'#c8d4ee'}}>{org.business_email || org.phone || org.name}</strong>.
        </div>
        <div style={{fontSize:10,color:'#7a8db0',textAlign:'center',marginTop:10}}>
          Powered by <a href="https://myforemanhq.com" style={{color:'#7a8db0',textDecoration:'underline'}}>MyForeman</a>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',system-ui,sans-serif",padding:'24px 12px'}}>
      <div style={{maxWidth:480,margin:'0 auto',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:16,overflow:'hidden',boxShadow:'0 16px 40px rgba(0,0,0,0.45)'}}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',gap:12,padding:'8px 0',borderBottom:'1px solid #2e3f6055',alignItems:'baseline'}}>
      <span style={{fontSize:11,color:'#7a8db0',letterSpacing:'.08em',textTransform:'uppercase',fontWeight:600}}>{label}</span>
      <span style={{fontSize:14,color:color||'#f0f4ff',fontWeight:600,textAlign:'right',maxWidth:'70%',overflowWrap:'anywhere'}}>{value}</span>
    </div>
  );
}

function Banner({ color, text }) {
  return (
    <div style={{margin:'12px 16px 0',padding:'10px 12px',background:color+'15',border:'1px solid '+color+'55',borderRadius:10,fontSize:13,color,textAlign:'center'}}>
      {text}
    </div>
  );
}
