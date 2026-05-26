// Touch-friendly signature pad. Renders a canvas the customer signs
// on with finger or stylus, captures the result as a PNG data URL,
// and hands it back via onSave(name, pngDataUrl). Cancel returns null.
//
// Use inside a modal — the parent owns layout. Designed for crew
// holding the phone for the customer.
//
// Pointer events handle mouse, touch, and pen on every modern
// browser. No external library.

import { useEffect, useRef, useState } from 'react';

export default function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const hasInkRef = useRef(false);
  const [name, setName] = useState('');
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Match the canvas pixel buffer to its CSS size for crisp lines.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0d1726';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Filling lets the saved PNG render nicely on light backgrounds
    // (e.g., printed invoices) without a transparency surprise.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  function pointerPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e) {
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = pointerPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
  }
  function move(e) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = pointerPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (!hasInkRef.current) { hasInkRef.current = true; setEmpty(false); }
  }
  function end(e) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
  }

  function clearPad() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    hasInkRef.current = false;
    setEmpty(true);
  }

  function save() {
    if (empty || !name.trim()) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave({ name: name.trim(), dataUrl });
  }

  return (
    <div style={{padding:'12px 16px 18px'}}>
      <div style={{fontSize:13,color:'#c8d4ee',marginBottom:10,lineHeight:1.5}}>
        Sign below to confirm the work is complete. Your name appears on the receipt.
      </div>

      <input value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your full name"
        maxLength={120}
        style={{
          width:'100%', background:'#111827', border:'1.5px solid #2e3f60',
          borderRadius:10, color:'#f0f4ff', fontSize:14, padding:'10px 12px',
          outline:'none', marginBottom:10, fontFamily:'inherit',
        }}/>

      <div style={{position:'relative',background:'#ffffff',border:'1.5px solid #2e3f60',borderRadius:10,overflow:'hidden'}}>
        <canvas
          ref={canvasRef}
          style={{display:'block',width:'100%',height:180,touchAction:'none',cursor:'crosshair'}}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}/>
        {empty && (
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none',color:'#9aa3b3',fontSize:13,fontStyle:'italic'}}>
            Sign here
          </div>
        )}
      </div>

      <div style={{display:'flex',gap:8,marginTop:12}}>
        <button onClick={clearPad}
          style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#c8d4ee',padding:'10px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
          Clear
        </button>
        <div style={{flex:1}}/>
        <button onClick={onCancel}
          style={{background:'transparent',border:'1px solid #2e3f60',borderRadius:10,color:'#7a8db0',padding:'10px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
          Skip
        </button>
        <button onClick={save} disabled={empty || !name.trim()}
          style={{background:'#2edf87',border:'none',borderRadius:10,color:'#111827',padding:'10px 18px',fontWeight:800,fontSize:13,letterSpacing:'.06em',cursor:'pointer',opacity:(empty || !name.trim()) ? 0.5 : 1}}>
          DONE
        </button>
      </div>
    </div>
  );
}
