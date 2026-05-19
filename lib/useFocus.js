import { useEffect, useRef } from 'react';

// Calls `fn` whenever the tab regains focus (focus event or visibility flip).
// Uses a ref so the latest closure runs without re-attaching listeners on every
// render. Pass `enabled=false` to skip — useful when dependencies aren't ready
// yet (e.g. orgId still loading).
export function useRefetchOnFocus(fn, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const handler = () => {
      if (!document.hidden) fnRef.current?.();
    };
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [enabled]);
}
