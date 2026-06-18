// Shared hamburger + close icons for the marketing nav. Kept in one
// place so the homepage, SeoLanding, and BlogLayout navs all draw
// from the same SVG primitives.

export function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3"  y1="6"  x2="21" y2="6"/>
      <line x1="3"  y1="12" x2="21" y2="12"/>
      <line x1="3"  y1="18" x2="21" y2="18"/>
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="6"  y1="6"  x2="18" y2="18"/>
      <line x1="18" y1="6"  x2="6"  y2="18"/>
    </svg>
  );
}
