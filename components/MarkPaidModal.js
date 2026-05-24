import { useState } from 'react';
import { markInvoicePaidWithCascade } from '../lib/invoice-paid';
import { fmt$ } from '../lib/helpers';

// Bottom-sheet for marking one or many invoices paid. Captures the
// payment method (cash / check / Zelle / Venmo / ACH / other) plus an
// optional reference (check number, transaction id) and runs the
// cascade for each invoice.
//
// invoices: array of { id, customer_id, amount }
// onDone(result): called after all invoices processed with
//   { ok, failed: number, marked: number }
// onClose(): called when the user dismisses (cancel or after done)

const METHODS = [
  { key: 'cash',   label: 'Cash',   icon: '💵' },
  { key: 'check',  label: 'Check',  icon: '🧾' },
  { key: 'zelle',  label: 'Zelle',  icon: 'Z'  },
  { key: 'venmo',  label: 'Venmo',  icon: 'V'  },
  { key: 'ach',    label: 'ACH',    icon: '🏦' },
  { key: 'stripe', label: 'Card',   icon: '💳' },
  { key: 'other',  label: 'Other',  icon: '•'  },
];

export default function MarkPaidModal({ invoices, orgId, userId, onDone, onClose }) {
  const [method, setMethod]       = useState('check');
  const [reference, setReference] = useState('');
  const [busy, setBusy]           = useState(false);
  const [progress, setProgress]   = useState(null); // { done, total }

  if (!invoices || invoices.length === 0) return null;
  const bulk  = invoices.length > 1;
  const total = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  const submit = async () => {
    setBusy(true);
    setProgress({ done: 0, total: invoices.length });
    let failed = 0, marked = 0;
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      const r = await markInvoicePaidWithCascade({
        invoiceId:  inv.id,
        orgId,
        userId,
        customerId: inv.customer_id,
        amount:     inv.amount,
        paidVia:    method,
        reference:  reference.trim() || null,
      });
      if (r.ok) marked++; else failed++;
      setProgress({ done: i + 1, total: invoices.length });
    }
    setBusy(false);
    onDone?.({ ok: failed === 0, marked, failed });
  };

  return (
    <div role="dialog" aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose?.()}
      style={{
        position:'fixed', inset:0, zIndex:200,
        background:'rgba(0,0,0,0.72)', backdropFilter:'blur(3px)',
        display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'12px',
      }}>
      <div style={{
        background:'#1a2236', border:'1px solid #2e3f60', borderRadius:14,
        width:'100%', maxWidth:480, padding:'18px 18px calc(18px + env(safe-area-inset-bottom, 0px))',
        color:'#f0f4ff', fontFamily:"'Inter',sans-serif",
        maxHeight:'92dvh', overflowY:'auto',
      }}>
        <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>
          {bulk ? `Mark ${invoices.length} invoices paid` : 'Mark invoice paid'}
        </div>
        <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.02em',color:'#2edf87',lineHeight:1,margin:'4px 0 14px'}}>
          {fmt$(total)}
        </div>

        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>
          How was it paid?
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))',gap:6,marginBottom:14}}>
          {METHODS.map(m => {
            const on = method === m.key;
            return (
              <button key={m.key} onClick={() => setMethod(m.key)} disabled={busy}
                style={{
                  background: on ? 'rgba(46,223,135,0.12)' : '#111827',
                  border: '1.5px solid ' + (on ? '#2edf87' : '#2e3f60'),
                  color: on ? '#2edf87' : '#c8d4ee',
                  borderRadius: 10, padding: '10px 4px',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                  cursor: busy ? 'wait' : 'pointer',
                  fontFamily:'inherit',
                }}>
                <span style={{fontSize:18,lineHeight:1}}>{m.icon}</span>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:'.04em',textTransform:'uppercase'}}>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600,marginBottom:6}}>
          Reference <span style={{color:'#5a6985',textTransform:'none',letterSpacing:0,fontWeight:500}}>(optional)</span>
        </div>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} disabled={busy}
          placeholder={method === 'check' ? 'Check #1234' : method === 'stripe' ? 'Stripe charge id' : 'Transaction ref'}
          maxLength={120}
          style={{width:'100%',background:'#111827',border:'1.5px solid #2e3f60',borderRadius:10,color:'#f0f4ff',fontSize:14,padding:'10px 12px',outline:'none',fontFamily:'inherit',marginBottom:14}}/>

        {progress && (
          <div style={{fontSize:12,color:'#7a8db0',marginBottom:10,textAlign:'center'}}>
            Processed {progress.done} of {progress.total}…
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button onClick={submit} disabled={busy}
            style={{flex:1,background:'#2edf87',border:'none',borderRadius:10,color:'#0d1726',padding:'14px 0',fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',cursor:busy?'wait':'pointer',opacity:busy?0.6:1}}>
            {busy ? 'WORKING…' : `MARK ${bulk ? 'ALL' : ''} PAID`}
          </button>
          <button onClick={() => !busy && onClose?.()} disabled={busy}
            style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'14px 16px',cursor:busy?'wait':'pointer',fontSize:13,fontWeight:600,fontFamily:'inherit'}}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
