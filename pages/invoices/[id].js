import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';

export default function InvoiceDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const { orgId, org, loading: orgLoading } = useOrg(user);
  const [invoice, setInvoice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (!router.isReady || !id || !orgId) return;
    load();
  }, [router.isReady, id, orgId]);

  const load = async () => {
    setLoading(true);
    const { data: inv } = await supabase
      .from('invoices').select('*')
      .eq('id', id).eq('org_id', orgId).maybeSingle();
    if (!inv) { setInvoice(null); setLoading(false); return; }
    setInvoice(inv);

    const [{ data: c }, { data: j }] = await Promise.all([
      inv.customer_id
        ? supabase.from('customers').select('*').eq('id', inv.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      inv.job_id
        ? supabase.from('jobs').select('*').eq('id', inv.job_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setCustomer(c || null);
    setJob(j || null);
    setLoading(false);
  };

  const markPaid = async () => {
    await supabase.from('invoices').update({ status:'paid', paid_date: todayStr() }).eq('id', invoice.id);
    load();
  };
  const markUnpaid = async () => {
    await supabase.from('invoices').update({ status:'unpaid', paid_date: null }).eq('id', invoice.id);
    load();
  };

  if (loading || orgLoading || !org) {
    return <div style={loadingStyle}>Loading...</div>;
  }
  if (!invoice) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",padding:24}}>
        <button onClick={() => router.push('/invoices')} style={backStyle}>← Back</button>
        <div style={{marginTop:24,textAlign:'center',color:'#7a8db0'}}>Invoice not found.</div>
      </div>
    );
  }

  const invoiceNumber = 'INV-' + invoice.id.slice(0,8).toUpperCase();
  const paid = invoice.status === 'paid';

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-sheet { background: white !important; color: #111827 !important; box-shadow: none !important; border: none !important; margin: 0 !important; max-width: 100% !important; }
          .invoice-sheet * { color: #111827 !important; border-color: #d1d5db !important; }
          .invoice-sheet .accent { color: #1f2937 !important; }
          .invoice-sheet .muted  { color: #4b5563 !important; }
        }
      `}</style>

      <div className="no-print" style={{background:'#1a2236',borderBottom:'1.5px solid #2e3f60',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:50}}>
        <button onClick={() => router.push('/invoices')} style={backStyle}>←</button>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:'.08em',flex:1}}>{invoiceNumber}</div>
        {paid
          ? <button onClick={markUnpaid} style={btnGhost}>Mark Unpaid</button>
          : <button onClick={markPaid} style={btnGreen}>Mark Paid</button>}
        <button onClick={() => window.print()} style={btnAccent}>Print</button>
      </div>

      <div className="invoice-sheet" style={{
        background:'#fff', color:'#111827',
        maxWidth:760, margin:'18px auto', padding:'32px 36px',
        boxShadow:'0 8px 24px rgba(0,0,0,.35)', borderRadius:8,
      }}>

        {/* Top: business + invoice meta */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:24,paddingBottom:18,borderBottom:'2px solid #1f2937'}}>
          <div style={{display:'flex',gap:14,alignItems:'flex-start',flex:1,minWidth:0}}>
            {org.logo_url && (
              <img src={org.logo_url} alt="" style={{width:72,height:72,objectFit:'contain',borderRadius:6,background:'#f9fafb',border:'1px solid #e5e7eb'}}/>
            )}
            <div style={{minWidth:0}}>
              <div className="accent" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:'.04em',color:'#111827',lineHeight:1.05}}>{org.name}</div>
              {org.owner_name && <div className="muted" style={{fontSize:13,color:'#4b5563',marginTop:2}}>{org.owner_name}</div>}
              {org.address && <div className="muted" style={{fontSize:12,color:'#4b5563',marginTop:6,whiteSpace:'pre-line'}}>{org.address}</div>}
              <div className="muted" style={{fontSize:12,color:'#4b5563',marginTop:6}}>
                {org.phone && <span>{org.phone}</span>}
                {org.phone && org.business_email && <span> · </span>}
                {org.business_email && <span>{org.business_email}</span>}
              </div>
              {org.license_number && (
                <div className="muted" style={{fontSize:11,color:'#6b7280',marginTop:4,letterSpacing:'.04em'}}>LICENSE #{org.license_number}</div>
              )}
            </div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div className="accent" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:'.1em',color:'#111827'}}>INVOICE</div>
            <div className="muted" style={{fontSize:13,color:'#4b5563',marginTop:2,fontFamily:'monospace'}}>{invoiceNumber}</div>
            <div style={{marginTop:10}}>
              <span style={{
                display:'inline-block',
                padding:'4px 10px',
                borderRadius:999,
                fontSize:11,
                fontWeight:700,
                letterSpacing:'.08em',
                background: paid ? '#dcfce7' : '#fef3c7',
                color:      paid ? '#166534' : '#92400e',
                border: '1px solid ' + (paid ? '#86efac' : '#fcd34d'),
              }}>{paid ? 'PAID' : 'UNPAID'}</span>
            </div>
          </div>
        </div>

        {/* Bill To + dates */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,paddingTop:18,paddingBottom:18}}>
          <div>
            <div className="muted" style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#6b7280',marginBottom:6}}>Bill To</div>
            {customer ? (
              <>
                <div style={{fontSize:15,fontWeight:700,color:'#111827'}}>{customer.name}</div>
                {customer.address && <div className="muted" style={{fontSize:12,color:'#4b5563',marginTop:3,whiteSpace:'pre-line'}}>{customer.address}</div>}
                {customer.phone && <div className="muted" style={{fontSize:12,color:'#4b5563',marginTop:3}}>{customer.phone}</div>}
                {customer.email && <div className="muted" style={{fontSize:12,color:'#4b5563'}}>{customer.email}</div>}
              </>
            ) : (
              <div className="muted" style={{fontSize:12,color:'#6b7280',fontStyle:'italic'}}>No customer linked</div>
            )}
          </div>
          <div style={{textAlign:'right'}}>
            <DateRow label="Issued"  value={fmtDate(invoice.issued_date)} />
            {paid && invoice.paid_date && <DateRow label="Paid" value={fmtDate(invoice.paid_date)} />}
          </div>
        </div>

        {/* Line items */}
        <table style={{width:'100%',borderCollapse:'collapse',marginBottom:18}}>
          <thead>
            <tr style={{borderBottom:'1px solid #d1d5db'}}>
              <th style={{...thStyle,textAlign:'left'}}>Description</th>
              <th style={{...thStyle,textAlign:'right',width:140}}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{borderBottom:'1px solid #e5e7eb'}}>
              <td style={{padding:'12px 0',verticalAlign:'top'}}>
                <div style={{fontSize:14,color:'#111827',fontWeight:500}}>{job?.title || 'Service'}</div>
                {job?.description && <div className="muted" style={{fontSize:12,color:'#4b5563',marginTop:3,whiteSpace:'pre-line'}}>{job.description}</div>}
                {job?.scheduled_date && <div className="muted" style={{fontSize:11,color:'#6b7280',marginTop:3}}>Service date: {fmtDate(job.scheduled_date)}</div>}
              </td>
              <td style={{padding:'12px 0',textAlign:'right',verticalAlign:'top',fontVariantNumeric:'tabular-nums',fontSize:14,color:'#111827'}}>
                {fmt$(invoice.amount || 0)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <div style={{minWidth:240}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0',borderTop:'2px solid #111827',marginTop:6}}>
              <div className="accent" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.08em',color:'#111827'}}>TOTAL</div>
              <div className="accent" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:'#111827',fontVariantNumeric:'tabular-nums'}}>{fmt$(invoice.amount || 0)}</div>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div style={{marginTop:18,padding:'12px 14px',background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:6}}>
            <div className="muted" style={{fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:'#6b7280',marginBottom:4}}>Notes</div>
            <div style={{fontSize:13,color:'#1f2937',whiteSpace:'pre-line'}}>{invoice.notes}</div>
          </div>
        )}

        <div className="muted" style={{marginTop:36,paddingTop:14,borderTop:'1px solid #e5e7eb',fontSize:11,color:'#6b7280',textAlign:'center'}}>
          {paid ? 'Thank you for your business.' : 'Please remit payment by check or electronic transfer. Questions? Contact us.'}
        </div>
      </div>

      <div style={{height:40}}/>
    </div>
  );
}

function DateRow({ label, value }) {
  return (
    <div style={{fontSize:12,color:'#4b5563',marginBottom:2}}>
      <span className="muted" style={{textTransform:'uppercase',letterSpacing:'.06em',fontSize:10,fontWeight:700,marginRight:6,color:'#6b7280'}}>{label}</span>
      <span style={{color:'#111827',fontWeight:500}}>{value}</span>
    </div>
  );
}

const thStyle = {
  padding:'8px 0',
  fontSize:10,
  fontWeight:700,
  letterSpacing:'.1em',
  textTransform:'uppercase',
  color:'#6b7280',
};

const backStyle = { background:'none', border:'none', color:'#7a8db0', cursor:'pointer', fontSize:20, padding:'0 4px' };
const btnAccent = { background:'#4f9eff', border:'none', borderRadius:8, color:'#fff', padding:'8px 14px', fontWeight:700, cursor:'pointer', fontSize:12 };
const btnGreen  = { background:'#2edf8722', border:'1px solid #2edf8766', borderRadius:8, color:'#2edf87', padding:'8px 12px', fontWeight:700, cursor:'pointer', fontSize:12 };
const btnGhost  = { background:'transparent', border:'1px solid #2e3f60', borderRadius:8, color:'#7a8db0', padding:'8px 12px', fontWeight:700, cursor:'pointer', fontSize:12 };

const loadingStyle = {
  minHeight:'100vh', background:'#111827', display:'flex',
  alignItems:'center', justifyContent:'center', color:'#f0f4ff', fontFamily:'sans-serif',
};
