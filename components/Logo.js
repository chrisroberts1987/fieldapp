// Reusable MyForeman brand lockup.
//
// size: 'sm' | 'md' | 'lg' | 'xl'  (controls overall scale)
// icon: boolean                     (show the hard-hat square at the left)
// tagline: boolean                  (show "FROM LEAD TO PAID" under the wordmark)
//
// The wordmark is "MY" (white) stacked above "FOREMAN" (accent #4f9eff),
// Bebas Neue, condensed line-height so the two lines feel like one mark.

const SIZES = {
  sm: { icon: 28, mark: 14, gap: 8,  tagline: 9,  taglineGap: 4 },
  md: { icon: 40, mark: 22, gap: 12, tagline: 10, taglineGap: 6 },
  lg: { icon: 56, mark: 34, gap: 16, tagline: 11, taglineGap: 8 },
  xl: { icon: 76, mark: 48, gap: 20, tagline: 12, taglineGap: 10 },
};

export default function Logo({ size = 'md', icon = true, tagline = false }) {
  const s = SIZES[size] || SIZES.md;
  // Explicit per-line height + whiteSpace:nowrap so the wordmark
  // doesn't reflow when Bebas Neue hasn't loaded yet — the wider
  // fallback was making "MY" and "FOREMAN" stomp on each other on
  // mobile during the font-swap window. 'Arial Narrow' / Impact are
  // closer in metrics to Bebas Neue than a generic sans-serif.
  const lineH = Math.round(s.mark * 1.0);
  const markStyle = {
    fontFamily: "'Bebas Neue','Arial Narrow',Impact,sans-serif",
    fontSize: s.mark,
    letterSpacing: '.04em',
    fontWeight: 700,
    lineHeight: `${lineH}px`,
    height: lineH,
    display: 'block',
    whiteSpace: 'nowrap',
  };
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:s.gap,flexShrink:0,minWidth:0}}>
      {icon && <LogoIcon size={s.icon} />}
      <div style={{display:'inline-flex',flexDirection:'column',lineHeight:1,whiteSpace:'nowrap',overflow:'hidden'}}>
        <span style={{...markStyle, color:'#f0f4ff'}}>MY</span>
        <span style={{...markStyle, color:'#4f9eff'}}>FOREMAN</span>
        {tagline && (
          <div style={{fontSize:s.tagline,letterSpacing:'.18em',color:'#7a8db0',marginTop:s.taglineGap,fontWeight:600,textTransform:'uppercase',whiteSpace:'nowrap'}}>From lead to paid</div>
        )}
      </div>
    </div>
  );
}

export function LogoIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="64" height="64" rx="12" fill="#4f9eff"/>
      <path d="M 9 42 L 9 47 Q 9 49 11 49 L 53 49 Q 55 49 55 47 L 55 42 L 48 42 L 48 34 Q 48 18 32 18 Q 16 18 16 34 L 16 42 Z" fill="#ffffff"/>
      <rect x="29.5" y="20" width="5" height="22" rx="1.5" fill="#4f9eff" opacity="0.2"/>
    </svg>
  );
}
