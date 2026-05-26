// Public customer portal — no login. The contractor sends the URL
// /portal/<customer.portal_token>. We look up that customer via the
// service-role API and show their quotes / jobs / invoices read-only.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { fmt$, fmtDate } from '../../lib/helpers';

export default function CustomerPortal() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/portal/' + encodeURIComponent(token))
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Unable to load portal.'));
  }, [token]);

  if (error) return (
    <div style={pageStyle}>
      <div style={{textAlign:'center',padding:'80px 20px',color:'#7a8db0'}}>{error}</div>
    </div>
  );
  if (!data) return (
    <div style={pageStyle}>
      <div style={{textAlign:'center',padding:'80px 20px',color:'#7a8db0'}}>Loading...</div>
    </div>
  );

  const { customer, org, jobs, quotes, invoices } = data;
  const unpaid = invoices.filter(i => i.status !== 'paid');
  const totalDue = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div style={pageStyle}>
      <header style={{padding:'24px 16px 14px',borderBottom:'1px solid #2e3f60'}}>
        <div style={{maxWidth:720,margin:'0 auto'}}>
          {org.logo_url && <img src={org.logo_url} alt={org.name} style={{maxHeight:38,marginBottom:6}}/>}
          <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>{org.name}</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,letterSpacing:'.04em',margin:'4px 0 0'}}>
            HI {(customer.name || '').split(' ')[0].toUpperCase()}
          </h1>
        </div>
      </header>

      <main style={{maxWidth:720,margin:'0 auto',padding:'18px 16px 60px'}}>
        {totalDue > 0 && (
          <div style={{background:'#fbbf2422',border:'1px solid #fbbf24',borderRadius:10,padding:'14px 16px',marginBottom:16}}>
            <div style={{fontSize:11,color:'#fbbf24',letterSpacing:'.06em',fontWeight:700,textTransform:'uppercase'}}>Balance due</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:28,color:'#fbbf24',margin:'2px 0'}}>{fmt$(totalDue)}</div>
            <div style={{fontSize:12,color:'#c8d4ee'}}>Tap any unpaid invoice below to pay online.</div>
          </div>
        )}

        <Section title="Open quotes" empty="Nothing pending.">
          {quotes.filter(q => q.status === 'sent' || q.status === 'draft').map(q => (
            <a key={q.id} href={`/quote/${q.approval_token}`}
              style={rowStyle}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{q.title}</div>
                <div style={{fontSize:11,color:'#7a8db0'}}>Sent {q.sent_at ? fmtDate(q.sent_at.slice(0,10)) : 'recently'}</div>
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#4f9eff'}}>{fmt$(q.amount)}</div>
            </a>
          ))}
        </Section>

        <Section title="Upcoming jobs" empty="None scheduled.">
          {jobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress').map(j => (
            <div key={j.id} style={rowStyle}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{j.title}</div>
                <div style={{fontSize:11,color:'#7a8db0'}}>
                  {j.scheduled_date ? fmtDate(j.scheduled_date) : 'No date set'}
                  {j.scheduled_time ? ' · ' + j.scheduled_time.slice(0,5) : ''}
                  {j.status === 'in_progress' ? ' · in progress' : ''}
                </div>
              </div>
              {j.price ? <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:'#c8d4ee'}}>{fmt$(j.price)}</div> : null}
            </div>
          ))}
        </Section>

        <Section title="Unpaid invoices" empty="All caught up.">
          {unpaid.map(inv => (
            <a key={inv.id} href={`/inv/${inv.public_token || inv.id}`}
              style={{...rowStyle,background:'#fbbf240d',borderLeft:'3px solid #fbbf24'}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{inv.notes || 'Invoice'}</div>
                <div style={{fontSize:11,color:'#7a8db0'}}>Issued {fmtDate(inv.issued_date)}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:'#fbbf24'}}>{fmt$(inv.amount)}</div>
                <div style={{fontSize:10,color:'#fbbf24',letterSpacing:'.06em',fontWeight:700}}>PAY NOW →</div>
              </div>
            </a>
          ))}
        </Section>

        <Section title="History" empty="No past activity.">
          {[
            ...invoices.filter(i => i.status === 'paid').map(i => ({ kind:'invoice', date:i.paid_date || i.issued_date, ...i })),
            ...jobs.filter(j => j.status === 'completed').map(j => ({ kind:'job', date:j.scheduled_date, ...j })),
          ].sort((a,b) => (b.date || '').localeCompare(a.date || '')).slice(0, 12).map(item => (
            <div key={item.kind + ':' + item.id} style={rowStyle}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{item.kind === 'invoice' ? (item.notes || 'Invoice') : item.title}</div>
                <div style={{fontSize:11,color:'#7a8db0'}}>
                  {item.date ? fmtDate(item.date) : ''}{item.kind === 'invoice' ? ' · paid' : ' · completed'}
                </div>
              </div>
              {item.amount || item.price ? (
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:'#7a8db0'}}>{fmt$(item.amount || item.price)}</div>
              ) : null}
            </div>
          ))}
        </Section>

        <div style={{fontSize:11,color:'#5a6c8c',textAlign:'center',marginTop:30,lineHeight:1.6}}>
          Need to reach us? {org.business_email ? <a href={`mailto:${org.business_email}`} style={{color:'#4f9eff'}}>{org.business_email}</a> : 'Reply to any email we sent you.'}<br/>
          This portal is unique to you — don't share the link.<br/>
          Powered by <a href="https://myforemanhq.com" style={{color:'#7a8db0'}}>MyForeman</a>
        </div>
      </main>
    </div>
  );
}

function Section({ title, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : (children ? [children] : []);
  return (
    <div style={{marginBottom:20}}>
      <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:18,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:8}}>{title.toUpperCase()}</div>
      <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:10,overflow:'hidden'}}>
        {items.length === 0
          ? <div style={{padding:'18px 14px',textAlign:'center',color:'#7a8db0',fontSize:13}}>{empty}</div>
          : children}
      </div>
    </div>
  );
}

const pageStyle = { minHeight:'100vh', background:'#111827', color:'#f0f4ff', fontFamily:"'Inter',sans-serif" };
const rowStyle = {
  display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
  borderTop:'1px solid #2e3f60', color:'inherit', textDecoration:'none',
};
