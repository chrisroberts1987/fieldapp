import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useOrg } from '../../lib/org';
import TopNav from '../../components/TopNav';
import {
  TARGET_SCHEMAS, ENTITY_ORDER, ENTITY_LABELS,
  PRESETS, detectFormat, buildDefaultMapping, classifySheet,
} from '../../lib/import/presets';

// Unified import flow. The contractor drops in EVERYTHING — one
// multi-sheet xlsx from Jobber, or all their QuickBooks CSVs at
// once, or whatever — and we:
//   1. Parse every sheet across every file
//   2. Auto-classify each sheet as customers / quotes / jobs /
//      invoices / expenses / mileage based on sheet name + headers
//   3. Auto-detect the source platform (Jobber / Housecall /
//      QuickBooks / generic) for column mapping
//   4. Show one preview: 'we'll create X customers, Y jobs, Z
//      invoices...' with the option to override classifications
//      or skip entire sheets
//   5. Run a validate-only pass server-side to surface dedupes +
//      errors BEFORE writing anything
//   6. The contractor reviews the preview, then ONE button commits
//      the whole import in dependency order with auto-create
//      placeholders for any customers referenced but not in the
//      customer sheet
//
// Caps: 5000 rows per entity, 30000 across all entities, 6MB per
// file, 10 files per upload.

const MAX_FILES_PER_UPLOAD = 10;

export default function ImportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId, loading: orgLoading } = useOrg(user);

  const [sheets, setSheets]       = useState([]); // [{ id, fileName, sheetName, headers, rows, entity, mapping }]
  const [parseErr, setParseErr]   = useState('');

  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview]       = useState(null); // server response from validateOnly
  const [previewErr, setPreviewErr] = useState('');

  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState(null);
  const [runErr, setRunErr]     = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUser(session.user);
    });
  }, []);

  useEffect(() => {
    if (user && !orgLoading && !orgId) router.push('/onboarding');
  }, [user, orgLoading, orgId]);

  const onFiles = async (fileList) => {
    setParseErr(''); setPreview(null); setResult(null);
    const files = Array.from(fileList || []).slice(0, MAX_FILES_PER_UPLOAD);
    if (files.length === 0) return;

    const next = [];
    for (const file of files) {
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
        setParseErr(`${file.name}: unsupported file type. Use .csv, .xlsx, or .xls.`);
        continue;
      }
      if (file.size > 6 * 1024 * 1024) {
        setParseErr(`${file.name}: file too large (max 6 MB).`);
        continue;
      }
      try {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: 'array' });
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          const json  = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
          if (!json.length) continue;
          const headers = Object.keys(json[0]);
          const entity  = classifySheet(sheetName, headers);
          const fmt     = detectFormat(headers, entity === 'unknown' ? 'customers' : entity);
          const mapping = entity === 'unknown'
            ? {}
            : buildDefaultMapping(fmt.id, entity, headers);
          next.push({
            id: `${file.name}::${sheetName}`,
            fileName: file.name,
            sheetName,
            headers,
            rows: json,
            entity,
            presetId: fmt.id,
            mapping,
          });
        }
      } catch (e) {
        setParseErr(`${file.name}: could not read (${e?.message || 'unknown'})`);
      }
    }
    setSheets(prev => [...prev, ...next]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
  };

  const setSheetEntity = (id, entity) => {
    setSheets(prev => prev.map(s => {
      if (s.id !== id) return s;
      if (entity === 'unknown' || entity === 'skip') return { ...s, entity: entity, mapping: {} };
      const fmt = detectFormat(s.headers, entity);
      return { ...s, entity, presetId: fmt.id, mapping: buildDefaultMapping(fmt.id, entity, s.headers) };
    }));
    setPreview(null);
  };

  const setSheetMapping = (id, key, src) => {
    setSheets(prev => prev.map(s => s.id === id ? { ...s, mapping: { ...s.mapping, [key]: src } } : s));
    setPreview(null);
  };

  const dropSheet = (id) => {
    setSheets(prev => prev.filter(s => s.id !== id));
    setPreview(null);
  };

  const reset = () => {
    setSheets([]); setPreview(null); setResult(null);
    setParseErr(''); setPreviewErr(''); setRunErr('');
  };

  // Build the batched payload from all classified sheets.
  const buildBatches = () => {
    const batches = {};
    for (const e of ENTITY_ORDER) batches[e] = [];
    for (const s of sheets) {
      if (!s.entity || s.entity === 'unknown' || s.entity === 'skip') continue;
      if (!ENTITY_ORDER.includes(s.entity)) continue;
      const schema = TARGET_SCHEMAS[s.entity];
      const reqsMissing = schema.some(f => f.required && !s.mapping[f.key]);
      if (reqsMissing) continue; // skip sheets with unmapped required fields
      for (const row of s.rows) {
        const out = {};
        for (const f of schema) {
          const src = s.mapping[f.key];
          if (src) out[f.key] = row[src];
        }
        batches[s.entity].push(out);
      }
    }
    return batches;
  };

  // Sheets that are fully ready to import (entity + all required mapped)
  const sheetReady = (s) => {
    if (!s.entity || s.entity === 'unknown' || s.entity === 'skip') return false;
    const schema = TARGET_SCHEMAS[s.entity];
    return schema.every(f => !f.required || s.mapping[f.key]);
  };
  const anyReady = sheets.some(sheetReady);

  // Per-entity totals for the inline preview header
  const totals = (() => {
    const t = {};
    for (const e of ENTITY_ORDER) t[e] = 0;
    for (const s of sheets) if (sheetReady(s)) t[s.entity] += s.rows.length;
    return t;
  })();

  const runValidate = async () => {
    if (!anyReady) return;
    setPreviewing(true); setPreviewErr(''); setPreview(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const r = await fetch('/api/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ validateOnly: true, batches: buildBatches() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setPreviewErr(body?.error || `Preview failed (${r.status})`); return; }
      setPreview(body);
    } catch (e) {
      setPreviewErr(e?.message || 'Network error.');
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!anyReady || running) return;
    setRunning(true); setRunErr(''); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const r = await fetch('/api/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ validateOnly: false, batches: buildBatches() }),
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

  if (!user || orgLoading) return <div style={loadingStyle}>Loading...</div>;

  return (
    <div style={{minHeight:'100vh',background:'#111827',color:'#f0f4ff',fontFamily:"'Inter',sans-serif",paddingBottom:80}}>
      <TopNav active="/settings"/>

      <div style={{maxWidth:820,margin:'24px auto 14px',padding:'0 16px'}}>
        {router.query.from === 'onboarding'
          ? <button onClick={() => router.push('/onboarding')} style={backStyle}>← Back to setup</button>
          : <button onClick={() => router.push('/settings')} style={backStyle}>← Settings</button>}
        <div style={{fontSize:12,color:'#7a8db0',letterSpacing:'.16em',fontWeight:600,textTransform:'uppercase',marginTop:8}}>Switch to MyForeman</div>
        <h1 style={{fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:36,letterSpacing:'.04em',margin:'4px 0 0'}}>IMPORT EVERYTHING</h1>
        <div style={{fontSize:13,color:'#c8d4ee',marginTop:8,lineHeight:1.55}}>
          Drop in your full export from Jobber, Housecall Pro, QuickBooks, or any spreadsheet. Multi-sheet workbooks and multiple CSVs both work. We classify what's in each sheet, auto-create any missing customers, and run the whole thing in one shot. Nothing gets overwritten and you'll see exactly what will happen before you commit.
        </div>
      </div>

      <div style={{maxWidth:820,margin:'18px auto 0',padding:'0 16px'}}>

        {/* Drop zone */}
        <div onDragOver={e => e.preventDefault()} onDrop={onDrop}
          style={{border:'1.5px dashed #2e3f60',borderRadius:12,padding:'24px 16px',textAlign:'center',background:'#1a2236',marginBottom:14}}>
          <div style={{fontSize:32,marginBottom:8}}>📂</div>
          <label style={{cursor:'pointer'}}>
            <input type="file" accept=".csv,.xlsx,.xls" multiple
              onChange={e => onFiles(e.target.files)}
              style={{display:'none'}}/>
            <div style={{display:'inline-block',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'10px 18px',fontSize:13,fontWeight:700,letterSpacing:'.05em'}}>
              CHOOSE FILES
            </div>
          </label>
          <div style={{fontSize:12,color:'#7a8db0',marginTop:10}}>
            or drag and drop · multiple files at once · multi-sheet xlsx supported
          </div>
          {parseErr && <ErrorBox text={parseErr}/>}
        </div>

        {/* Detected sheets */}
        {sheets.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:8}}>
              <div style={{fontSize:11,color:'#7a8db0',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700}}>
                {sheets.length} sheet{sheets.length === 1 ? '' : 's'} detected
              </div>
              <button onClick={reset} style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:6,color:'#c8d4ee',padding:'4px 10px',fontSize:11,cursor:'pointer'}}>Reset</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {sheets.map(s => (
                <SheetCard key={s.id} sheet={s}
                  onEntity={(e) => setSheetEntity(s.id, e)}
                  onMap={(k, src) => setSheetMapping(s.id, k, src)}
                  onDrop={() => dropSheet(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Totals + Preview action */}
        {anyReady && !result && (
          <div style={{background:'#1e2a42',border:'1px solid #4f9eff44',borderRadius:12,padding:'14px 14px',marginBottom:14}}>
            <div style={{fontSize:11,color:'#4f9eff',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:8}}>Ready to import</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:14,fontSize:13,color:'#c8d4ee',marginBottom:12}}>
              {ENTITY_ORDER.map(e => totals[e] > 0 && (
                <span key={e}><strong style={{color:'#f0f4ff'}}>{totals[e]}</strong> {ENTITY_LABELS[e].toLowerCase()}</span>
              ))}
            </div>
            <button onClick={runValidate} disabled={previewing}
              style={{width:'100%',background:'transparent',border:'1.5px solid #4f9eff',borderRadius:10,color:'#4f9eff',padding:'11px 0',fontWeight:700,fontSize:13,letterSpacing:'.05em',cursor:previewing?'progress':'pointer',opacity:previewing?0.7:1}}>
              {previewing ? 'CHECKING…' : 'PREVIEW (CHECK FOR DUPES + ERRORS)'}
            </button>
            {previewErr && <ErrorBox text={previewErr}/>}
          </div>
        )}

        {/* Preview result */}
        {preview && !result && (
          <PreviewCard preview={preview} totals={totals}
            onCommit={runImport} committing={running}
            runErr={runErr}/>
        )}

        {/* Final result */}
        {result && <ResultCard result={result} onAnother={reset}/>}
      </div>
    </div>
  );
}

// =============================================================
// Per-sheet card: shows classification + mapping + raw preview
// =============================================================
function SheetCard({ sheet, onEntity, onMap, onDrop }) {
  const [expanded, setExpanded] = useState(sheet.entity === 'unknown');
  const isSkip = sheet.entity === 'skip';
  const isUnknown = sheet.entity === 'unknown';
  const schema = (sheet.entity && TARGET_SCHEMAS[sheet.entity]) || [];
  const missingReqs = schema.filter(f => f.required && !sheet.mapping[f.key]).map(f => f.label);

  const pillColor = isUnknown ? '#fbbf24' : isSkip ? '#7a8db0'
    : missingReqs.length > 0 ? '#fbbf24'
    : '#2edf87';
  const pillLabel = isUnknown ? 'Needs entity'
    : isSkip ? 'Skipped'
    : missingReqs.length > 0 ? `Map ${missingReqs.join(', ')}`
    : ENTITY_LABELS[sheet.entity];

  return (
    <div style={{background:'#1e2a42',border:'1px solid #2e3f60',borderRadius:12,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:6,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:'#f0f4ff',fontWeight:600,wordBreak:'break-word'}}>
            {sheet.sheetName}{sheet.fileName !== sheet.sheetName ? ` · ${sheet.fileName}` : ''}
          </div>
          <div style={{fontSize:11,color:'#7a8db0',marginTop:2}}>
            {sheet.rows.length} rows · {sheet.headers.length} columns{sheet.presetId !== 'generic' && !isSkip && !isUnknown ? ` · ${PRESETS.find(p => p.id === sheet.presetId)?.label} format` : ''}
          </div>
        </div>
        <span style={{background:pillColor+'22',color:pillColor,border:'1px solid '+pillColor+'66',borderRadius:999,padding:'2px 9px',fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',whiteSpace:'nowrap'}}>
          {pillLabel}
        </span>
        <button onClick={onDrop} title="Remove this sheet from the import"
          style={{background:'none',border:'1px solid #2e3f60',borderRadius:6,color:'#7a8db0',width:24,height:24,cursor:'pointer',fontSize:12,padding:0,lineHeight:1}}>✕</button>
      </div>

      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:6}}>
        <label style={{fontSize:11,color:'#7a8db0',letterSpacing:'.06em',textTransform:'uppercase',fontWeight:600}}>Imports as:</label>
        <select value={sheet.entity || 'unknown'} onChange={e => onEntity(e.target.value)}
          style={{background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',padding:'6px 10px',fontSize:12,fontFamily:'inherit'}}>
          <option value="unknown">— pick —</option>
          {ENTITY_ORDER.map(e => <option key={e} value={e}>{ENTITY_LABELS[e]}</option>)}
          <option value="skip">Skip this sheet</option>
        </select>
        {!isSkip && !isUnknown && (
          <button onClick={() => setExpanded(x => !x)}
            style={{marginLeft:'auto',background:'transparent',border:'1px solid #2e3f60',borderRadius:6,color:'#c8d4ee',padding:'5px 10px',fontSize:11,cursor:'pointer'}}>
            {expanded ? 'Hide mapping' : 'Adjust mapping'}
          </button>
        )}
      </div>

      {expanded && !isSkip && !isUnknown && (
        <div style={{marginTop:10,padding:'10px 12px',background:'#0d1726',border:'1px solid #2e3f60',borderRadius:8}}>
          {schema.map(f => (
            <div key={f.key} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
              <div style={{flex:'0 0 140px',fontSize:12,color:'#c8d4ee',fontWeight:600}}>
                {f.label}{f.required && <span style={{color:'#fbbf24',marginLeft:4}}>*</span>}
              </div>
              <select value={sheet.mapping[f.key] || ''} onChange={e => onMap(f.key, e.target.value)}
                style={{flex:'1 1 200px',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8,color:'#f0f4ff',padding:'7px 10px',fontSize:12,fontFamily:'inherit'}}>
                <option value="">— skip —</option>
                {sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================
// Preview card — shows the planned result, gates the IMPORT button
// =============================================================
function PreviewCard({ preview, totals, onCommit, committing, runErr }) {
  const r = preview.results || {};
  return (
    <div style={{background:'rgba(46,223,135,0.06)',border:'1px solid rgba(46,223,135,0.35)',borderRadius:12,padding:'14px 14px',marginBottom:14}}>
      <div style={{fontSize:11,color:'#2edf87',letterSpacing:'.12em',textTransform:'uppercase',fontWeight:700,marginBottom:8}}>Preview · nothing imported yet</div>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
        {ENTITY_ORDER.map(e => r[e] && (totals[e] > 0 || r[e].inserted > 0 || r[e].skipped > 0 || r[e].errors.length > 0) && (
          <PreviewRow key={e} label={ENTITY_LABELS[e]} stats={r[e]}/>
        ))}
      </div>
      {(r.customers?.autoCreated || 0) > 0 && (
        <div style={{fontSize:12,color:'#c8d4ee',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8,padding:'8px 10px',marginBottom:10}}>
          Will auto-create <strong>{r.customers.autoCreated}</strong> placeholder customer{r.customers.autoCreated === 1 ? '' : 's'} from job/invoice/quote rows whose customers aren't in your file.
        </div>
      )}
      <button onClick={onCommit} disabled={committing}
        style={{width:'100%',background:'#4f9eff',border:'none',borderRadius:10,color:'#fff',padding:'13px 0',fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:'.08em',cursor:committing?'progress':'pointer',opacity:committing?0.6:1}}>
        {committing ? 'IMPORTING…' : 'COMMIT IMPORT'}
      </button>
      {runErr && <ErrorBox text={runErr}/>}
    </div>
  );
}

function PreviewRow({ label, stats }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',gap:8,fontSize:13,color:'#c8d4ee',borderBottom:'1px solid #1f2a40'}}>
      <span style={{fontWeight:600,color:'#f0f4ff'}}>{label}</span>
      <span>
        <strong style={{color:'#2edf87'}}>{stats.inserted}</strong> new
        {stats.skipped > 0 && <> · <span style={{color:'#7a8db0'}}>{stats.skipped} dupe{stats.skipped === 1 ? '' : 's'}</span></>}
        {stats.errors.length > 0 && <> · <span style={{color:'#f26060'}}>{stats.errors.length} error{stats.errors.length === 1 ? '' : 's'}</span></>}
      </span>
    </div>
  );
}

// =============================================================
// Final result
// =============================================================
function ResultCard({ result, onAnother }) {
  const r = result.results || {};
  const totalInserted = ENTITY_ORDER.reduce((s, e) => s + ((r[e]?.inserted) || 0), 0);
  const allErrors = ENTITY_ORDER.flatMap(e =>
    (r[e]?.errors || []).map(err => ({ ...err, entity: ENTITY_LABELS[e] }))
  );
  return (
    <div style={{marginTop:6,marginBottom:18,background:'rgba(46,223,135,0.08)',border:'1px solid rgba(46,223,135,0.35)',borderRadius:12,padding:'18px 16px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <div style={{fontSize:24}}>✓</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:'.06em',color:'#2edf87'}}>
          IMPORTED {totalInserted} RECORDS
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
        {ENTITY_ORDER.map(e => r[e] && (r[e].inserted > 0 || r[e].skipped > 0 || (r[e].errors?.length || 0) > 0) && (
          <PreviewRow key={e} label={ENTITY_LABELS[e]} stats={r[e]}/>
        ))}
      </div>
      {(r.customers?.autoCreated || 0) > 0 && (
        <div style={{fontSize:12,color:'#c8d4ee',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8,padding:'8px 10px',marginBottom:10}}>
          Auto-created <strong>{r.customers.autoCreated}</strong> placeholder customer{r.customers.autoCreated === 1 ? '' : 's'} from related rows. Fill in their contact info anytime from Customers.
        </div>
      )}
      {allErrors.length > 0 && (
        <details style={{marginBottom:10}}>
          <summary style={{fontSize:12,color:'#fbbf24',cursor:'pointer',marginBottom:6}}>Show {allErrors.length} error{allErrors.length === 1 ? '' : 's'}</summary>
          <div style={{maxHeight:200,overflowY:'auto',background:'#1a2236',border:'1px solid #2e3f60',borderRadius:8,padding:'8px 12px'}}>
            {allErrors.map((e, i) => (
              <div key={i} style={{fontSize:12,color:'#c8d4ee',padding:'3px 0',borderBottom: i < allErrors.length - 1 ? '1px solid #2e3f6055' : 'none'}}>
                <strong style={{color:'#fbbf24'}}>{e.entity} row {e.row}</strong>: {e.error}
              </div>
            ))}
          </div>
        </details>
      )}
      <button onClick={onAnother}
        style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:8,color:'#c8d4ee',padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
        Import more
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

const backStyle = { background: 'none', border: 'none', color: '#7a8db0', cursor: 'pointer', fontSize: 14, padding: 0 };
const loadingStyle = { minHeight: '100vh', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f0f4ff', fontFamily: 'sans-serif' };
