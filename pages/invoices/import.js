import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import { fmt$, fmtDate, todayStr } from '../../lib/helpers';
import TopNav from '../../components/TopNav';
import { ALLOWED_UPLOAD_MIMES, ALLOWED_UPLOAD_LABEL, MAX_UPLOAD_BYTES, ACCEPT_ATTR } from '../../lib/uploads';
import { toast } from '../../components/Toast';

const ACCEPTED = ACCEPT_ATTR;
const MAX_BATCH = 10;

export default function ImportInvoices() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);

  const [rows, setRows] = useState([]); // { id, filename, type, status, data, error }
  const [dragOver, setDragOver] = useState(false);
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

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    if (rows.length + files.length > MAX_BATCH) {
      toast.success(`Max ${MAX_BATCH} files at a time. You have ${rows.length} queued.`);
      return;
    }

    const newRows = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        newRows.push({ id: rid(), filename: file.name, type: file.type, status: 'error', error: 'Too large (>10 MB)' });
        continue;
      }
      if (!ALLOWED_UPLOAD_MIMES.includes((file.type || '').toLowerCase())) {
        newRows.push({ id: rid(), filename: file.name, type: file.type, status: 'error', error: `Unsupported type. Use ${ALLOWED_UPLOAD_LABEL}.` });
        continue;
      }
      newRows.push({ id: rid(), filename: file.name, type: file.type, status: 'extracting', _file: file });
    }
    const updated = [...rows, ...newRows];
    setRows(updated);

    // Extract each pending file sequentially.
    for (const row of newRows) {
      if (row.status !== 'extracting') continue;
      try {
        const base64 = await fileToBase64(row._file);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { patchRow(row.id, { status:'error', error:'Sign in expired. Please reload.' }); continue; }
        const resp = await fetch('/api/invoices/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ files: [{ name: row.filename, type: row.type, data: base64 }] }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          patchRow(row.id, { status:'error', error: json?.error || `Server error ${resp.status}` });
          continue;
        }
        const r = json.results?.[0];
        if (!r || !r.success) {
          patchRow(row.id, { status:'error', error: r?.error || 'Extraction failed' });
          continue;
        }
        patchRow(row.id, { status:'ready', data: r.data });
      } catch (e) {
        patchRow(row.id, { status:'error', error: e.message });
      }
    }
  };

  const patchRow = (id, patch) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const updateField = (id, key, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, data: { ...r.data, [key]: value } } : r));
  };

  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const importAll = async () => {
    const ready = rows.filter(r => r.status === 'ready' && r.data);
    if (ready.length === 0 || !orgId) return;
    setImporting(true);

    // Validate each row.
    const errors = [];
    const cleaned = ready.map((r, i) => {
      const rowNum = i + 1;
      const d = r.data;
      const name = (d.customer_name || '').trim();
      const amount = Number(d.amount);
      const issued = (d.issued_date || '').trim();
      const paid = (d.paid_date || '').trim();
      const status = d.status === 'paid' ? 'paid' : 'unpaid';
      if (!name) errors.push(`${r.filename}: customer name is empty`);
      if (isNaN(amount) || amount < 0) errors.push(`${r.filename}: amount invalid`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) errors.push(`${r.filename}: issued date must be YYYY-MM-DD`);
      if (paid && !/^\d{4}-\d{2}-\d{2}$/.test(paid)) errors.push(`${r.filename}: paid date must be YYYY-MM-DD or blank`);
      return {
        customer_name: name,
        amount,
        issued_date: issued,
        paid_date: status === 'paid' ? (paid || issued) : null,
        notes: d.notes || null,
        status,
      };
    });
    if (errors.length > 0) {
      setResult({ ok:false, message: errors.join('\n') });
      setImporting(false);
      return;
    }

    // Find or create customers by name.
    const names = [...new Set(cleaned.map(r => r.customer_name))];
    const { data: existing } = await supabase.from('customers').select('id, name').eq('org_id', orgId);
    const map = new Map();
    (existing || []).forEach(c => map.set(c.name.trim().toLowerCase(), c.id));
    const toCreate = names.filter(n => !map.has(n.toLowerCase()));
    if (toCreate.length > 0) {
      const inserts = toCreate.map(n => ({ org_id: orgId, owner_id: user.id, name: n }));
      const { data: newC, error: cErr } = await supabase.from('customers').insert(inserts).select('id, name');
      if (cErr) { setResult({ ok:false, message: 'Customer create failed: ' + cErr.message }); setImporting(false); return; }
      (newC || []).forEach(c => map.set(c.name.trim().toLowerCase(), c.id));
    }

    const inserts = cleaned.map(r => ({
      org_id: orgId,
      owner_id: user.id,
      customer_id: map.get(r.customer_name.toLowerCase()) || null,
      amount: r.amount,
      issued_date: r.issued_date,
      paid_date: r.paid_date,
      status: r.status,
      notes: r.notes,
    }));
    const { error: iErr } = await supabase.from('invoices').insert(inserts);
    if (iErr) {
      setResult({ ok:false, message: 'Invoice insert failed: ' + iErr.message });
      setImporting(false);
      return;
    }

    setResult({ ok:true, invoicesImported: inserts.length, customersCreated: toCreate.length });
    setRows([]);
    setImporting(false);
  };

  if (!user || orgLoading) {
    return (
      <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif"}}>
        <TopNav active="/invoices"/>
        <div style={{padding:'80px 20px',textAlign:'center',color:'#7a8db0'}}>Loading...</div>
      </div>
    );
  }

  const readyCount = rows.filter(r => r.status === 'ready').length;
  const extractingCount = rows.filter(r => r.status === 'extracting').length;
  const totalPreview = rows.filter(r => r.status === 'ready').reduce((s, r) => s + Number(r.data?.amount || 0), 0);

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/invoices"/>

      <main style={{maxWidth:980,margin:'0 auto',padding:'28px 20px 0'}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase'}}>Invoices</div>
          <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:42,letterSpacing:'.04em',margin:'4px 0 0',color:'#f0f4ff'}}>IMPORT PRIOR INVOICES</h1>
          <div style={{fontSize:13,color:'#c8d4ee',marginTop:6,maxWidth:680,lineHeight:1.55}}>
            Drop in PDFs or photos of past invoices. AI extracts the customer name, amount, dates, and status. Review and edit anything that's off, then import in one click. Customers are auto-created if they don't already exist.
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
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              style={{
                display:'block', textAlign:'center', padding:'36px 24px',
                background: dragOver ? 'rgba(79,158,255,0.12)' : '#1e2a42',
                border: dragOver ? '2px dashed #4f9eff' : '2px dashed #2e3f60',
                borderRadius: 14,
                marginBottom: 16,
                cursor: 'pointer',
                transition: 'background .15s, border-color .15s',
              }}>
              <input type="file" accept={ACCEPTED} multiple onChange={e => addFiles(e.target.files)} style={{display:'none'}}/>
              <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff',marginBottom:6}}>
                DROP INVOICES HERE
              </div>
              <div style={{fontSize:13,color:'#c8d4ee',marginBottom:4}}>
                or tap to choose files
              </div>
              <div style={{fontSize:11,color:'#7a8db0'}}>
                PDF, PNG, JPG, GIF, or WebP · up to {MAX_FILE_MB} MB each · max {MAX_BATCH} at a time
              </div>
            </label>

            {rows.length > 0 && (
              <>
                <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
                  <div style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:22,letterSpacing:'.06em',color:'#f0f4ff'}}>
                    QUEUE · {rows.length}
                  </div>
                  <div style={{fontSize:12,color:'#7a8db0'}}>
                    {extractingCount > 0 && <>Extracting {extractingCount} · </>}
                    Ready <strong style={{color:'#2edf87'}}>{readyCount}</strong> · Total <strong style={{color:'#2edf87'}}>{fmt$(totalPreview)}</strong>
                  </div>
                </div>

                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
                  {rows.map(r => <Row key={r.id} row={r} onChange={updateField} onRemove={removeRow} />)}
                </div>

                <button onClick={importAll} disabled={importing || readyCount === 0}
                  style={{...btnPrimary, padding:'14px 24px', fontSize:16, opacity:(importing||readyCount===0)?0.5:1}}>
                  {importing ? 'IMPORTING...' : `IMPORT ${readyCount} INVOICE${readyCount===1?'':'S'}`}
                </button>
              </>
            )}

            {result && !result.ok && (
              <div style={{background:'rgba(242,96,96,0.10)',border:'1px solid rgba(242,96,96,0.3)',borderRadius:10,padding:'12px 14px',marginTop:16,fontSize:13,color:'#f26060',whiteSpace:'pre-line'}}>
                {result.message}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Row({ row, onChange, onRemove }) {
  const { status, filename, data, error } = row;
  const confColor = data?.confidence === 'high' ? '#2edf87' : data?.confidence === 'medium' ? '#fbbf24' : '#f26060';

  return (
    <div style={{background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom: status==='ready' ? 12 : 0}}>
        <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:10}}>
          <FileIcon type={row.type}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{filename}</div>
            <div style={{fontSize:11,color:'#7a8db0',marginTop:1}}>
              {status === 'extracting' && <><span style={{color:'#fbbf24'}}>● Extracting...</span></>}
              {status === 'ready'      && <span style={{color: confColor}}>● {data.confidence?.toUpperCase()} confidence</span>}
              {status === 'error'      && <span style={{color:'#f26060'}}>● Error: {error}</span>}
            </div>
          </div>
        </div>
        <button onClick={() => onRemove(row.id)} style={{background:'none',border:'none',color:'#f26060',fontSize:14,fontWeight:700,cursor:'pointer',padding:'4px 8px'}}>✕</button>
      </div>

      {status === 'ready' && data && (
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          <Field label="Customer">
            <input style={inputStyle} type="text" value={data.customer_name || ''}
              onChange={e => onChange(row.id, 'customer_name', e.target.value)} placeholder="Customer name"/>
          </Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <Field label="Amount ($)">
              <input style={inputStyle} type="number" inputMode="decimal" value={data.amount ?? ''}
                onChange={e => onChange(row.id, 'amount', e.target.value === '' ? '' : Number(e.target.value))}/>
            </Field>
            <Field label="Issued">
              <input style={inputStyle} type="date" value={data.issued_date || ''}
                onChange={e => onChange(row.id, 'issued_date', e.target.value)}/>
            </Field>
            <Field label="Status">
              <select style={inputStyle} value={data.status || 'unpaid'}
                onChange={e => onChange(row.id, 'status', e.target.value)}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
          </div>
          {data.status === 'paid' && (
            <Field label="Paid Date">
              <input style={inputStyle} type="date" value={data.paid_date || ''}
                onChange={e => onChange(row.id, 'paid_date', e.target.value)}/>
            </Field>
          )}
          <Field label="Notes">
            <input style={inputStyle} type="text" value={data.notes || ''}
              onChange={e => onChange(row.id, 'notes', e.target.value)} placeholder="What was billed"/>
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{fontSize:10,color:'#7a8db0',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',marginBottom:3}}>{label}</div>
      {children}
    </div>
  );
}

function FileIcon({ type }) {
  const isPdf = type === 'application/pdf';
  const c = isPdf ? '#f26060' : '#4f9eff';
  return (
    <div style={{width:32,height:32,borderRadius:8,background:c+'22',border:'1px solid '+c+'66',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:10,fontWeight:700,color:c,letterSpacing:'.04em'}}>
      {isPdf ? 'PDF' : 'IMG'}
    </div>
  );
}

const rid = () => Math.random().toString(36).slice(2, 11);

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result || '';
    const idx = String(result).indexOf(',');
    resolve(idx >= 0 ? String(result).slice(idx + 1) : String(result));
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const inputStyle = {
  width:'100%', background:'#111827', border:'1.5px solid #2e3f60', borderRadius:8,
  color:'#f0f4ff', fontSize:13, padding:'8px 10px', outline:'none', fontFamily:'inherit',
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
