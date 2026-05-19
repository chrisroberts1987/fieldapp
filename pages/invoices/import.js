import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';

const TEMPLATE = `customer_name,amount,issued_date,paid_date,notes
Jane Smith,450.00,2025-03-15,2025-03-20,Lawn mow + edge
Bob Jones,1200.00,2025-04-02,2025-04-15,HVAC service call
Smith LLC,800.00,2025-05-10,,Quarterly maintenance`;

export default function ImportInvoices() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);
  const [csv, setCsv] = useState('');
  const [parsed, setParsed] = useState(null);   // { rows: [...], errors: [...] }
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [user, orgLoading, orgId]);

  const parse = () => {
    setResult(null);
    if (!csv.trim()) { setParsed({ rows:[], errors:['Paste some CSV first.'] }); return; }
    const rows = parseCSV(csv);
    if (rows.length < 2) { setParsed({ rows:[], errors:['Need a header row plus at least one data row.'] }); return; }

    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const reqd = ['customer_name', 'amount', 'issued_date'];
    const missing = reqd.filter(c => !headers.includes(c));
    if (missing.length) {
      setParsed({ rows:[], errors:[`Missing required column(s): ${missing.join(', ')}`] });
      return;
    }
    const idx = {
      customer_name: headers.indexOf('customer_name'),
      amount:        headers.indexOf('amount'),
      issued_date:   headers.indexOf('issued_date'),
      paid_date:     headers.indexOf('paid_date'),
      notes:         headers.indexOf('notes'),
      status:        headers.indexOf('status'),
    };

    const out = [];
    const errors = [];
    rows.slice(1).forEach((r, i) => {
      const rowNum = i + 2; // 1-indexed line number including header
      const name = (r[idx.customer_name] || '').trim();
      const amount = parseFloat((r[idx.amount] || '').replace(/[$,]/g, ''));
      const issued = (r[idx.issued_date] || '').trim();
      const paid   = idx.paid_date >= 0 ? (r[idx.paid_date] || '').trim() : '';
      const notes  = idx.notes >= 0 ? (r[idx.notes] || '').trim() : null;
      const statusExplicit = idx.status >= 0 ? (r[idx.status] || '').trim().toLowerCase() : '';
      const status = statusExplicit || (paid ? 'paid' : 'unpaid');

      if (!name) { errors.push(`Row ${rowNum}: customer_name is required`); return; }
      if (isNaN(amount) || amount < 0) { errors.push(`Row ${rowNum}: amount "${r[idx.amount]}" is not a valid number`); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) { errors.push(`Row ${rowNum}: issued_date must be YYYY-MM-DD`); return; }
      if (paid && !/^\d{4}-\d{2}-\d{2}$/.test(paid)) { errors.push(`Row ${rowNum}: paid_date must be YYYY-MM-DD or blank`); return; }
      if (status !== 'paid' && status !== 'unpaid') { errors.push(`Row ${rowNum}: status must be "paid" or "unpaid"`); return; }
      if (status === 'paid' && !paid) {
        // Default paid_date to issued_date when status=paid but paid_date blank
      }

      out.push({
        row: rowNum,
        customer_name: name,
        amount,
        issued_date: issued,
        paid_date: status === 'paid' ? (paid || issued) : null,
        notes: notes || null,
        status,
      });
    });

    setParsed({ rows: out, errors });
  };

  const importAll = async () => {
    if (!parsed?.rows?.length || !orgId) return;
    setImporting(true);

    // 1. Collect unique customer names from the import.
    const namesNeeded = [...new Set(parsed.rows.map(r => r.customer_name))];

    // 2. Find existing customers (case-insensitive) for this org.
    const { data: existing } = await supabase
      .from('customers').select('id, name')
      .eq('org_id', orgId);
    const existingMap = new Map();
    (existing || []).forEach(c => existingMap.set(c.name.trim().toLowerCase(), c.id));

    // 3. Create customers that don't exist yet.
    const toCreate = namesNeeded.filter(n => !existingMap.has(n.toLowerCase()));
    if (toCreate.length > 0) {
      const inserts = toCreate.map(n => ({ org_id: orgId, owner_id: user.id, name: n }));
      const { data: newC, error: cErr } = await supabase
        .from('customers').insert(inserts).select('id, name');
      if (cErr) {
        setResult({ ok:false, message: 'Failed to create customers: ' + cErr.message });
        setImporting(false);
        return;
      }
      (newC || []).forEach(c => existingMap.set(c.name.trim().toLowerCase(), c.id));
    }

    // 4. Bulk-insert invoices.
    const invoiceInserts = parsed.rows.map(r => ({
      org_id:        orgId,
      owner_id:      user.id,
      customer_id:   existingMap.get(r.customer_name.toLowerCase()) || null,
      amount:        r.amount,
      issued_date:   r.issued_date,
      paid_date:     r.paid_date,
      status:        r.status,
      notes:         r.notes,
    }));
    const { error: iErr } = await supabase.from('invoices').insert(invoiceInserts);
    if (iErr) {
      setResult({ ok:false, message: 'Failed to insert invoices: ' + iErr.message });
      setImporting(false);
      return;
    }

    setResult({
      ok: true,
      invoicesImported: invoiceInserts.length,
      customersCreated: toCreate.length,
    });
    setCsv('');
    setParsed(null);
    setImporting(false);
  };

  const pasteTemplate = () => { setCsv(TEMPLATE); setParsed(null); setResult(null); };

  if (!user || orgLoading) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/invoices"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
      </div>
    );
  }

  const paidPreview = parsed?.rows?.filter(r => r.status === 'paid') || [];
  const totalPreview = parsed?.rows?.reduce((s, r) => s + Number(r.amount || 0), 0) || 0;
  const paidTotalPreview = paidPreview.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/invoices"/>

      <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Invoices</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>
            IMPORT PRIOR INVOICES
          </h1>
          <div style={{fontSize:13,color:'#c8d4ee',marginTop:6,maxWidth:640,lineHeight:1.55}}>
            Paste invoices you've already collected this year (or any prior period) to populate your dashboard, revenue chart, and tax estimates. Customers you mention will be auto-created if they don't already exist.
          </div>
        </div>

        {result?.ok && (
          <div style={{background:'rgba(46,223,135,0.10)',border:'1px solid rgba(46,223,135,0.35)',borderRadius:12,padding:'16px 18px',marginBottom:20}}>
            <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.04em',color:'#2edf87',marginBottom:6}}>
              IMPORT COMPLETE
            </div>
            <div style={{fontSize:14,color:'#c8d4ee',lineHeight:1.55}}>
              Imported <strong style={{color:'#f0f4ff'}}>{result.invoicesImported} invoice{result.invoicesImported===1?'':'s'}</strong>
              {result.customersCreated > 0 && <> · Created <strong style={{color:'#f0f4ff'}}>{result.customersCreated} new customer{result.customersCreated===1?'':'s'}</strong></>}
            </div>
            <div style={{marginTop:12,display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={() => router.push('/invoices')} style={btnPrimary}>VIEW INVOICES</button>
              <button onClick={() => router.push('/dashboard')} style={btnGhost}>BACK TO DASHBOARD</button>
              <button onClick={() => { setResult(null); }} style={btnGhost}>IMPORT MORE</button>
            </div>
          </div>
        )}

        {!result?.ok && (
          <>
            {/* Format / instructions */}
            <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'16px 18px',marginBottom:14}}>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:8}}>FORMAT</div>
              <div style={{fontSize:13,color:'#c8d4ee',lineHeight:1.6,marginBottom:10}}>
                CSV with a header row. <strong>Required columns:</strong> <code style={code}>customer_name</code>, <code style={code}>amount</code>, <code style={code}>issued_date</code> (YYYY-MM-DD). <strong>Optional:</strong> <code style={code}>paid_date</code>, <code style={code}>status</code> (paid/unpaid), <code style={code}>notes</code>.
              </div>
              <div style={{fontSize:13,color:'#7a8db0',marginBottom:10}}>If <code style={code}>paid_date</code> is set, status defaults to paid. If blank, defaults to unpaid.</div>
              <button onClick={pasteTemplate} style={btnGhost}>PASTE EXAMPLE TEMPLATE</button>
            </div>

            {/* CSV input */}
            <div style={{marginBottom:14}}>
              <div style={fieldLabel}>Paste CSV</div>
              <textarea value={csv} onChange={e => setCsv(e.target.value)}
                placeholder={"customer_name,amount,issued_date,paid_date,notes\nJane Smith,450,2025-03-15,2025-03-20,Lawn mow"}
                style={{...inputStyle, minHeight:200, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, resize:'vertical'}}/>
            </div>

            <div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap'}}>
              <button onClick={parse} disabled={!csv.trim()} style={{...btnPrimary, opacity: csv.trim() ? 1 : 0.4}}>
                PARSE
              </button>
              <button onClick={() => { setCsv(''); setParsed(null); }} style={btnGhost}>CLEAR</button>
            </div>

            {parsed && parsed.errors.length > 0 && (
              <div style={{background:'rgba(242,96,96,0.10)',border:'1px solid rgba(242,96,96,0.3)',borderRadius:10,padding:'12px 14px',marginBottom:16}}>
                <div style={{fontSize:12,fontWeight:700,color:'#f26060',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:6}}>
                  {parsed.errors.length} issue{parsed.errors.length===1?'':'s'}
                </div>
                <ul style={{margin:0,paddingLeft:18,fontSize:12,color:'#f26060',lineHeight:1.6}}>
                  {parsed.errors.slice(0, 30).map((e, i) => <li key={i}>{e}</li>)}
                  {parsed.errors.length > 30 && <li>...and {parsed.errors.length - 30} more</li>}
                </ul>
              </div>
            )}

            {parsed && parsed.rows.length > 0 && (
              <>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff'}}>
                    PREVIEW · {parsed.rows.length} ROW{parsed.rows.length===1?'':'S'}
                  </div>
                  <div style={{fontSize:12,color:'#7a8db0'}}>
                    Total <strong style={{color:'#2edf87'}}>{fmt$(totalPreview)}</strong>
                    {' · '}Paid <strong style={{color:'#2edf87'}}>{fmt$(paidTotalPreview)}</strong>
                  </div>
                </div>

                <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,overflow:'hidden',marginBottom:16}}>
                  <div style={{maxHeight:360,overflowY:'auto'}}>
                    {parsed.rows.slice(0, 200).map((r, i) => (
                      <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 80px',gap:10,padding:'10px 12px',borderBottom:'1px solid #2e3f60',fontSize:12,alignItems:'baseline'}}>
                        <div style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#f0f4ff'}}>{r.customer_name}</div>
                        <div style={{color:'#c8d4ee'}}>{fmtDate(r.issued_date)}</div>
                        <div style={{color:'#2edf87',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{fmt$(r.amount)}</div>
                        <div style={{textAlign:'right'}}>
                          <span style={{
                            background: r.status==='paid' ? 'rgba(46,223,135,0.12)' : 'rgba(251,191,36,0.12)',
                            color: r.status==='paid' ? '#2edf87' : '#fbbf24',
                            border: '1px solid ' + (r.status==='paid' ? '#2edf8755' : '#fbbf2455'),
                            borderRadius:999, padding:'2px 8px', fontSize:10, fontWeight:700, letterSpacing:'.05em',
                          }}>{r.status.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                    {parsed.rows.length > 200 && (
                      <div style={{padding:'10px 12px',fontSize:11,color:'#7a8db0',textAlign:'center'}}>
                        ...and {parsed.rows.length - 200} more (all will be imported)
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={importAll} disabled={importing}
                  style={{...btnPrimary, padding:'14px 24px', fontSize:16, opacity:importing?0.6:1}}>
                  {importing ? 'IMPORTING...' : `IMPORT ${parsed.rows.length} INVOICE${parsed.rows.length===1?'':'S'}`}
                </button>
              </>
            )}

            {result && !result.ok && (
              <div style={{background:'rgba(242,96,96,0.10)',border:'1px solid rgba(242,96,96,0.3)',borderRadius:10,padding:'12px 14px',marginTop:16,fontSize:13,color:'#f26060'}}>
                {result.message}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// =====================================================
// CSV PARSER — handles quoted fields with commas + escaped quotes.
// =====================================================
function parseCSV(text) {
  const rows = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.length > 0);
  for (const line of lines) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current); current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells.map(c => c.trim()));
  }
  return rows;
}

// =====================================================
// STYLES
// =====================================================
const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:10,
  color:'#f0f4ff', fontSize:14, padding:'10px 12px', outline:'none', fontFamily:'inherit',
};
const fieldLabel = {
  fontSize:11, fontWeight:600, letterSpacing:'.08em',
  textTransform:'uppercase', color:'#7a8db0', marginBottom:5,
};
const btnPrimary = {
  background:'#4f9eff', border:'none', borderRadius:10, color:'#fff',
  padding:'10px 18px', cursor:'pointer', fontFamily:"'Bebas Neue',Impact,sans-serif",
  fontSize:14, letterSpacing:'.08em', fontWeight:700,
};
const btnGhost = {
  background:'transparent', border:'1px solid #2e3f60', borderRadius:10, color:'#c8d4ee',
  padding:'10px 16px', cursor:'pointer', fontFamily:"'Bebas Neue',Impact,sans-serif",
  fontSize:14, letterSpacing:'.08em', fontWeight:700,
};
const code = {
  background:'#111827', padding:'1px 6px', borderRadius:4, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize:11, border:'1px solid #2e3f60', color:'#c8d4ee',
};
