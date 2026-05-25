import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import TopNav from '../../components/TopNav';
import { TARGET_SCHEMAS, PRESETS, detectFormat, buildDefaultMapping } from '../../lib/import/presets';

// Five-step data import flow:
//   1. Pick what to import (customers / jobs / invoices)
//   2. Drop a CSV or Excel file
//   3. We auto-detect format (Jobber / Housecall / QuickBooks) and
//      pre-fill the column mapping; user can override.
//   4. Preview the first 5 mapped rows.
//   5. Run the import. Server-side dedupe means re-running is safe;
//      nothing gets overwritten.
//
// Hard caps: 1000 rows per import, .csv/.xlsx/.xls only. The xlsx
// (SheetJS) lib parses everything client-side so the server only
// sees a clean array of typed rows.

const MAX_ROWS = 1000;
const ENTITIES = [
  { key: 'customers', label: 'Customers' },
  { key: 'jobs',      label: 'Jobs' },
  { key: 'invoices',  label: 'Invoices' },
];

export default function ImportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);

  const [entity, setEntity]     = useState('customers');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders]   = useState([]);
  const [rows, setRows]         = useState([]);     // raw rows: array of { header: cellValue }
  const [presetId, setPresetId] = useState('generic');
  const [mapping, setMapping]   = useState({});     // targetKey → sourceHeader
  const [parseErr, setParseErr] = useState('');

  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState(null);     // { inserted, skipped, errors }
  const [runErr, setRunErr]   = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [user, orgLoading, orgId]);

  // Re-run auto-detect + mapping whenever the entity or headers change.
  useEffect(() => {
    if (!headers.length) return;
    const det = detectFormat(headers, entity);
    setPresetId(det.id);
    setMapping(buildDefaultMapping(det.id, entity, headers));
  }, [entity, headers]);

  const onFile = async (file) => {
    setParseErr(''); setResult(null); setRunErr('');
    if (!file) return;
    const okExt = /\.(csv|xlsx|xls)$/i.test(file.name);
    if (!okExt) {
      setParseErr('Please upload a .csv, .xlsx, or .xls file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setParseErr('File is too large. 8 MB max.');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet     = wb.Sheets[sheetName];
      if (!sheet) { setParseErr('No sheet found in file.'); return; }
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!json.length) { setParseErr('File has no rows.'); return; }
      if (json.length > MAX_ROWS) {
        setParseErr(`File has ${json.length} rows. Maximum is ${MAX_ROWS} per import. Split the file and try again.`);
        return;
      }
      const cols = Object.keys(json[0]);
      setFileName(file.name);
      setHeaders(cols);
      setRows(json);
    } catch (e) {
      setParseErr(e?.message || 'Could not read file.');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const schema = TARGET_SCHEMAS[entity];

  // Has every required field been mapped?
  const ready = headers.length > 0 && schema.every(f => !f.required || mapping[f.key]);

  // Build the typed payload from rows × mapping, ready to POST.
  const buildPayload = () => rows.map(r => {
    const out = {};
    for (const f of schema) {
      const src = mapping[f.key];
      if (src) out[f.key] = r[src];
    }
    return out;
  });

  const previewRows = buildPayload().slice(0, 5);

  const runImport = async () => {
    if (!ready || running) return;
    setRunning(true); setRunErr(''); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const r = await fetch('/api/import/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ entity, rows: buildPayload() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setRunErr(body?.error || `Import failed (${r.status})`); return; }
      setResult(body);
    } catch (e) {
      setRunErr(e?.message || 'Network error.');
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setFileName(''); setHeaders([]); setRows([]);
    setMapping({}); setPresetId('generic');
    setResult(null); setRunErr(''); setParseErr('');
  };

  if (!user || orgLoading) {
    return <div style={loadingStyle}>Loading...</div>;
  }

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/settings"/>

      <div style={{maxWidth:760,margin:'24px auto 14px',padding:'0 16px'}}>
        <button onClick={() => router.push('/settings')} style={backStyle}>← Settings</button>
        <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase',marginTop:8}}>Switch to MyForeman</div>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>IMPORT DATA</h1>
        <div style={{fontSize:13,color:'#c8d4ee',marginTop:8,lineHeight:1.55}}>
          Coming from Jobber, Housecall Pro, QuickBooks, or a spreadsheet? Bring your customers, jobs, and invoices over in a few minutes. We never overwrite anything you already have. Re-running an import is safe.
        </div>
      </div>

      <div style={{maxWidth:760,margin:'18px auto 0',padding:'0 16px'}}>

        {/* Step 1: pick entity */}
        <Section step="1" title="What are you importing?">
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {ENTITIES.map(opt => (
              <button key={opt.key} onClick={() => { setEntity(opt.key); setResult(null); }}
                style={{
                  background: entity === opt.key ? '#4f9eff' : 'transparent',
                  border: '1.5px solid ' + (entity === opt.key ? '#4f9eff' : '#2e3f60'),
                  borderRadius: 999, color: entity === opt.key ? '#fff' : '#c8d4ee',
                  padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '.05em',
                }}>
                {opt.label.toUpperCase()}
              </button>
            ))}
          </div>
          {entity !== 'customers' && (
            <div style={{marginTop:10,fontSize:12,color:'#fbbf24',background:'#fbbf2412',border:'1px solid #fbbf2433',borderRadius:8,padding:'8px 12px',lineHeight:1.5}}>
              Heads up: {entity} are linked to customers. If a customer in your file doesn't exist in MyForeman yet, the row will be skipped with an error. Import customers first.
            </div>
          )}
        </Section>

        {/* Step 2: upload */}
        <Section step="2" title="Upload your file">
          <div onDragOver={e => e.preventDefault()} onDrop={onDrop}
            style={{border:'1.5px dashed #2e3f60',borderRadius:12,padding:'24px 16px',textAlign:'center',background:'#1a2236'}}>
            <div style={{fontSize:32,marginBottom:8}}>📄</div>
            <label style={{cursor:'pointer'}}>
              <input type="file" accept=".csv,.xlsx,.xls"
                onChange={e => onFile(e.target.files?.[0])}
                style={{display:'none'}}/>
              <div style={{display:'inline-block',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'10px 18px',fontSize:13,fontWeight:700,letterSpacing:'.05em'}}>
                CHOOSE FILE
              </div>
            </label>
            <div style={{fontSize:12,color:'#7a8db0',marginTop:10}}>
              or drag and drop · .csv, .xlsx, .xls · max {MAX_ROWS} rows
            </div>
            {fileName && (
              <div style={{marginTop:14,padding:'10px 12px',background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                <div style={{fontSize:13,color:'#f0f4ff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {fileName} <span style={{color:'#7a8db0',fontSize:11}}>· {rows.length} rows</span>
                </div>
                <button onClick={reset} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:6,color:'#c8d4ee',padding:'4px 10px',fontSize:11,cursor:'pointer'}}>Change</button>
              </div>
            )}
          </div>
          {parseErr && <ErrorBox text={parseErr}/>}
        </Section>

        {/* Step 3: detected format + mapping */}
        {headers.length > 0 && (
          <Section step="3" title="Match your columns">
            <div style={{fontSize:12,color:'#c8d4ee',marginBottom:10,lineHeight:1.5}}>
              {presetId === 'generic'
                ? "We couldn't auto-detect the format, so pick the matching column for each field below. Required fields are starred."
                : <>Detected <strong style={{color:'#2edf87'}}>{PRESETS.find(p => p.id === presetId)?.label}</strong> format. Defaults pre-filled below — adjust any that aren't right.</>}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {schema.map(f => (
                <div key={f.key} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <div style={{flex:'0 0 140px',fontSize:12,color:'#c8d4ee',fontWeight:600}}>
                    {f.label}{f.required && <span style={{color:'#fbbf24',marginLeft:4}}>*</span>}
                  </div>
                  <select value={mapping[f.key] || ''}
                    onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                    style={{flex:'1 1 200px',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',padding:'8px 10px',fontSize:13,fontFamily:'inherit'}}>
                    <option value="">— skip —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Step 4: preview */}
        {headers.length > 0 && ready && (
          <Section step="4" title={`Preview (first ${Math.min(5, previewRows.length)} rows)`}>
            <div style={{overflowX:'auto',border:'1px solid #2e3f60',borderRadius:8}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr style={{background:'#1a2236'}}>
                    {schema.filter(f => mapping[f.key]).map(f => (
                      <th key={f.key} style={{textAlign:'left',padding:'8px 10px',color:'#7a8db0',fontWeight:600,whiteSpace:'nowrap',borderBottom:'1px solid #2e3f60'}}>
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} style={{borderTop:'1px solid #1f2a40'}}>
                      {schema.filter(f => mapping[f.key]).map(f => (
                        <td key={f.key} style={{padding:'8px 10px',color:'#f0f4ff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:200}}>
                          {String(r[f.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Step 5: run */}
        {headers.length > 0 && ready && !result && (
          <div style={{marginTop:18,marginBottom:18}}>
            <button onClick={runImport} disabled={running}
              style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'14px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:'.08em',cursor:running?'progress':'pointer',opacity:running?0.6:1}}>
              {running ? `IMPORTING ${rows.length} ROWS…` : `IMPORT ${rows.length} ${entity.toUpperCase()}`}
            </button>
            {runErr && <ErrorBox text={runErr}/>}
            <div style={{fontSize:11,color:'#7a8db0',textAlign:'center',marginTop:8,lineHeight:1.5}}>
              Nothing in MyForeman gets overwritten. Duplicates (matched by email/phone for customers, by customer + amount + date for invoices) are silently skipped.
            </div>
          </div>
        )}

        {/* Result */}
        {result && <ResultCard result={result} entity={entity} onAnother={reset}/>}
      </div>
    </div>
  );
}

function Section({ step, title, children }) {
  return (
    <div style={{marginBottom:14,background:'#1e2a42',border:'1.5px solid #2e3f60',borderRadius:12,padding:'14px 14px 14px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <div style={{width:24,height:24,borderRadius:999,background:'#4f9eff22',border:'1px solid #4f9eff66',color:'#4f9eff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}>
          {step}
        </div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:'.08em',color:'#f0f4ff'}}>{title.toUpperCase()}</div>
      </div>
      {children}
    </div>
  );
}

function ResultCard({ result, entity, onAnother }) {
  const { inserted, skipped, errors } = result;
  return (
    <div style={{marginTop:18,marginBottom:18,background:'rgba(46,223,135,0.08)',border:'1px solid rgba(46,223,135,0.35)',borderRadius:12,padding:'18px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <div style={{fontSize:24}}>✓</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.06em',color:'#2edf87'}}>
          IMPORT COMPLETE
        </div>
      </div>
      <div style={{fontSize:14,color:'#f0f4ff',lineHeight:1.6,marginBottom:10}}>
        Imported <strong>{inserted}</strong> {entity}{skipped > 0 ? `, skipped ${skipped} duplicates` : ''}{errors?.length ? `, ${errors.length} errors` : ''}.
      </div>
      {errors && errors.length > 0 && (
        <details style={{marginBottom:10}}>
          <summary style={{fontSize:12,color:'#fbbf24',cursor:'pointer',marginBottom:6}}>
            Show {errors.length} error{errors.length === 1 ? '' : 's'}
          </summary>
          <div style={{maxHeight:160,overflowY:'auto',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8,padding:'8px 12px'}}>
            {errors.map((e, i) => (
              <div key={i} style={{fontSize:12,color:'#c8d4ee',padding:'3px 0',borderBottom: i < errors.length - 1 ? '1px solid #2e3f6055' : 'none'}}>
                <strong style={{color:'#fbbf24'}}>Row {e.row}</strong>: {e.error}
              </div>
            ))}
          </div>
        </details>
      )}
      <button onClick={onAnother}
        style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
        Import another file
      </button>
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div style={{marginTop:10,background:'rgba(242,96,96,.12)',border:'1px solid rgba(242,96,96,.3)',borderRadius:8,padding:'9px 12px',fontSize:12,color:'#f26060'}}>
      {text}
    </div>
  );
}

const backStyle = {
  background: 'none', border: 'none', color: '#7a8db0', cursor: 'pointer',
  fontSize: 14, padding: 0,
};

const loadingStyle = {
  minHeight: '100vh', background: '#111827', display: 'flex',
  alignItems: 'center', justifyContent: 'center', color: '#f0f4ff', fontFamily: 'sans-serif',
};
