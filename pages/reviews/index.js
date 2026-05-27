import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { useRefetchOnFocus } from '../../lib/useFocus';
import { isForeman } from '../../lib/role';
import { fmt$, fmtDate } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { FullPageLoading } from '../../components/PageStates';

// Customer reviews dashboard. Lists every submitted feedback for
// the contractor's org, sorted newest first, with summary stats
// at the top (count, average rating, distribution). Each review
// shows the star count, comment text, customer name + link, and
// the invoice it was attached to.
//
// Reviews where the customer never responded (no submitted_at) are
// listed separately as 'pending' so the contractor knows how many
// requests are outstanding.

export default function Reviews() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, role, loading: orgLoading } = useOrg(user);
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all'); // all / 5 / 4 / 3 / 2 / 1 / pending
  const [customers, setCustomers] = useState({});
  const [invoices, setInvoices]   = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [user, orgLoading, orgId]);

  const load = async () => {
    if (!orgId) return;
    setRows(null);
    const [{ data: fb }, { data: cust }, { data: inv }] = await Promise.all([
      supabase.from('feedback').select('*').eq('org_id', orgId).order('submitted_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('customers').select('id,name').eq('org_id', orgId),
      supabase.from('invoices').select('id,amount,issued_date').eq('org_id', orgId),
    ]);
    setRows(fb || []);
    const cm = {}; for (const c of cust || []) cm[c.id] = c.name; setCustomers(cm);
    const im = {}; for (const i of inv || [])  im[i.id] = i;        setInvoices(im);
  };

  useEffect(() => { if (orgId) load(); }, [orgId]);
  useRefetchOnFocus(load, !!orgId);

  // Stats: count + avg of SUBMITTED reviews only
  const submitted = useMemo(() => (rows || []).filter(r => r.submitted_at != null), [rows]);
  const pending   = useMemo(() => (rows || []).filter(r => r.submitted_at == null),  [rows]);
  const avgRating = submitted.length
    ? (submitted.reduce((s, r) => s + (r.rating || 0), 0) / submitted.length)
    : null;
  const distribution = useMemo(() => {
    const d = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    for (const r of submitted) if (r.rating) d[r.rating] = (d[r.rating] || 0) + 1;
    return d;
  }, [submitted]);

  const visible = useMemo(() => {
    if (filter === 'all') return submitted;
    if (filter === 'pending') return pending;
    const n = Number(filter);
    return submitted.filter(r => r.rating === n);
  }, [submitted, pending, filter]);

  if (!user || orgLoading || rows === null) {
    return <FullPageLoading/>;
  }
  if (!isForeman(role)) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/reviews"/>
        <div style={{maxWidth:600,margin:'40px auto',padding:'40px 16px',textAlign:'center',color:'#7a8db0'}}>
          Customer reviews are visible to the foreman only.
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/reviews"/>

      <div style={{maxWidth:920,margin:'24px auto 14px',padding:'0 16px'}}>
        <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Customer Reviews</div>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>REVIEWS</h1>
      </div>

      <div style={{maxWidth:920,margin:'18px auto 0',padding:'0 16px'}}>

        {/* Summary stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:14}}>
          <div style={card}>
            <div style={statLabel}>Average</div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,color:'#fbbf24',lineHeight:1}}>
                {avgRating != null ? avgRating.toFixed(1) : '—'}
              </div>
              <Stars rating={avgRating || 0} size={16}/>
            </div>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>{submitted.length} review{submitted.length === 1 ? '' : 's'}</div>
          </div>
          <div style={card}>
            <div style={statLabel}>Distribution</div>
            <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:6}}>
              {[5,4,3,2,1].map(n => {
                const count = distribution[n] || 0;
                const pct = submitted.length ? (count / submitted.length) * 100 : 0;
                return (
                  <div key={n} style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#7a8db0'}}>
                    <span style={{width:14}}>{n}★</span>
                    <div style={{flex:1,height:6,background:'#0d1726',borderRadius:999,overflow:'hidden'}}>
                      <div style={{width:pct+'%',height:'100%',background:'#fbbf24',transition:'width .3s'}}/>
                    </div>
                    <span style={{width:24,textAlign:'right',color:'#c8d4ee'}}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={card}>
            <div style={statLabel}>Pending</div>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:32,color:'#7a8db0',lineHeight:1,marginTop:4}}>{pending.length}</div>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:4}}>requests sent, not yet answered</div>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
          <FilterPill label={`All (${submitted.length})`} active={filter === 'all'} onClick={() => setFilter('all')} color="#4f9eff"/>
          {[5,4,3,2,1].map(n => (
            <FilterPill key={n} label={`${n}★ (${distribution[n] || 0})`} active={filter === String(n)} onClick={() => setFilter(String(n))} color={n >= 4 ? '#2edf87' : n === 3 ? '#fbbf24' : '#f26060'}/>
          ))}
          <FilterPill label={`Pending (${pending.length})`} active={filter === 'pending'} onClick={() => setFilter('pending')} color="#7a8db0"/>
        </div>

        {/* List */}
        {visible.length === 0 ? (
          <div style={{padding:'60px 16px',textAlign:'center',color:'#7a8db0',background:'#1e2a42',border:'1px dashed #2e3f60',borderRadius:12}}>
            {filter === 'pending'
              ? 'No outstanding review requests. When customers pay, they get a feedback link automatically.'
              : filter === 'all'
                ? 'No reviews yet. When a customer pays an invoice, they get a branded feedback request — responses land here.'
                : `No ${filter}-star reviews.`}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {visible.map(r => (
              <ReviewCard key={r.id} review={r}
                customerName={customers[r.customer_id] || r.customer_name || 'Customer'}
                invoice={invoices[r.invoice_id]}
                onOpenCustomer={() => r.customer_id && router.push('/customers/' + r.customer_id)}
                onOpenInvoice={() => r.invoice_id && router.push('/invoices/' + r.invoice_id)}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, customerName, invoice, onOpenCustomer, onOpenInvoice }) {
  const isPending = !review.submitted_at;
  const color = isPending ? '#7a8db0'
    : (review.rating || 0) >= 4 ? '#2edf87'
    : review.rating === 3 ? '#fbbf24' : '#f26060';
  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,flexWrap:'wrap',marginBottom:8}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:14,color:'#f0f4ff',fontWeight:600}}>
            {customerName}
          </div>
          <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>
            {isPending
              ? `Request sent ${fmtDate(review.created_at)}, not yet answered`
              : `Submitted ${fmtDate(review.submitted_at)}`}
            {invoice && <> · <a onClick={onOpenInvoice} style={{color:'#4f9eff',cursor:'pointer',textDecoration:'none'}}>{fmt$(invoice.amount)} invoice {fmtDate(invoice.issued_date)}</a></>}
          </div>
        </div>
        {!isPending ? (
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <Stars rating={review.rating || 0} size={18}/>
            <span style={{background:color+'22',color,border:'1px solid '+color+'66',borderRadius:999,padding:'2px 8px',fontSize:11,fontWeight:700,letterSpacing:'.05em'}}>{review.rating}/5</span>
          </div>
        ) : (
          <span style={{background:'#7a8db022',color:'#7a8db0',border:'1px solid #7a8db066',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase'}}>Pending</span>
        )}
      </div>
      {!isPending && review.comment && (
        <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55,padding:'10px 12px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,marginTop:6,whiteSpace:'pre-line'}}>
          "{review.comment}"
        </div>
      )}
      {review.customer_id && (
        <button onClick={onOpenCustomer}
          style={{marginTop:8,background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'5px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
          Open customer
        </button>
      )}
    </div>
  );
}

function Stars({ rating, size = 16 }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span style={{whiteSpace:'nowrap',color:'#fbbf24',fontSize:size,lineHeight:1}}>
      {[1,2,3,4,5].map(n => {
        const filled = n <= full || (n === full + 1 && half);
        return <span key={n} style={{opacity: filled ? 1 : 0.25, marginRight: 1}}>★</span>;
      })}
    </span>
  );
}

function FilterPill({ label, active, onClick, color }) {
  return (
    <button onClick={onClick}
      style={{
        background: active ? color + '22' : 'transparent',
        border: '1px solid ' + (active ? color : '#2e3f60'),
        color: active ? color : '#c8d4ee',
        borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600,
        letterSpacing: '.04em', cursor: 'pointer', fontFamily: 'inherit',
      }}>
      {label}
    </button>
  );
}

const card = { background:'#1e2a42', border:'1px solid #2e3f60', borderRadius:12, padding:'14px 14px' };
const statLabel = { fontSize:10, color:'#7a8db0', letterSpacing:'.12em', textTransform:'uppercase', fontWeight:700 };
const loadingStyle = { minHeight: '100vh', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0f4ff', fontFamily: 'sans-serif' };
