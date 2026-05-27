// Consistent toast notifications matching the dark theme.
// Top-of-screen on mobile, top-right on desktop. Success auto-
// dismisses after 3 seconds; errors stay until tapped.
//
// Usage:
//   import { useToast } from '../components/Toast';
//   const toast = useToast();
//   toast.success('Saved.');
//   toast.error('Could not save: ' + e.message);
//
// Mount <ToastHost/> once in _app.js. Anywhere else just calls
// useToast() to push messages.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext(null);

let pushFn = null; // module-level so non-React callers can push too

export function ToastHost() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((kind, message, opts = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    const ttl = opts.ttl ?? (kind === 'error' ? null : 3000);
    setToasts(prev => [...prev, { id, kind, message }]);
    if (ttl) setTimeout(() => remove(id), ttl);
  }, [remove]);

  // Expose imperatively for non-hook callers.
  useEffect(() => { pushFn = push; return () => { pushFn = null; }; }, [push]);

  return (
    <div style={{
      position:'fixed',
      top:'calc(12px + env(safe-area-inset-top, 0px))',
      left:'50%', transform:'translateX(-50%)',
      zIndex: 9999,
      display:'flex', flexDirection:'column', gap:8,
      pointerEvents:'none',
      width:'min(420px, calc(100vw - 24px))',
    }}>
      {toasts.map(t => {
        const palette = t.kind === 'error'
          ? { bg:'rgba(242,96,96,0.18)', bd:'#f26060', fg:'#fff' }
          : t.kind === 'success'
            ? { bg:'rgba(46,223,135,0.18)', bd:'#2edf87', fg:'#fff' }
            : { bg:'rgba(79,158,255,0.18)', bd:'#4f9eff', fg:'#fff' };
        return (
          <div key={t.id} onClick={() => remove(t.id)}
            style={{
              pointerEvents:'auto',
              background: palette.bg,
              border: `1px solid ${palette.bd}`,
              borderLeft: `4px solid ${palette.bd}`,
              backdropFilter:'blur(10px)',
              borderRadius:10,
              padding:'12px 14px',
              color: palette.fg,
              fontSize:13.5, lineHeight:1.5,
              fontFamily:"'Inter',system-ui,sans-serif",
              cursor:'pointer',
              boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
              animation:'mf-toast-in .2s ease-out',
            }}>
            <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              <span style={{fontSize:14,lineHeight:1.3,flexShrink:0}}>
                {t.kind === 'error' ? '⚠' : t.kind === 'success' ? '✓' : 'ℹ'}
              </span>
              <span style={{flex:1,wordWrap:'break-word'}}>{t.message}</span>
            </div>
          </div>
        );
      })}
      <style jsx>{`
        @keyframes mf-toast-in {
          from { transform: translateY(-12px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Hook + module-level wrapper. The hook version is reactive (re-
// renders the host); the module-level fallback works inside async
// callbacks and even outside React (lib code, fetch error handlers).
export function useToast() {
  return {
    success: (m, opts) => pushFn?.('success', m, opts),
    error:   (m, opts) => pushFn?.('error',   m, opts),
    info:    (m, opts) => pushFn?.('info',    m, opts),
  };
}
export const toast = {
  success: (m, opts) => pushFn?.('success', m, opts),
  error:   (m, opts) => pushFn?.('error',   m, opts),
  info:    (m, opts) => pushFn?.('info',    m, opts),
};
