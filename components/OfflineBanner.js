import { useEffect, useState } from 'react';

// Thin sticky banner that appears whenever the browser reports
// the device is offline. Hides as soon as the connection comes back.
// Mounted globally in _app.js so it covers every page.

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online',  update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online',  update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" aria-live="polite" style={{
      position:'fixed', top:0, left:0, right:0,
      zIndex:80,
      background:'#fbbf24',
      color:'#1a1f2b',
      padding:'8px 14px',
      fontSize:12,
      fontWeight:700,
      letterSpacing:'.06em',
      textTransform:'uppercase',
      textAlign:'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      boxShadow:'0 2px 8px rgba(0,0,0,0.18)',
    }}>
      Offline mode — changes will sync when reconnected
    </div>
  );
}
