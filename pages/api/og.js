import { ImageResponse } from 'next/og';

// Edge route that generates a 1200x630 OG share image on demand from
// query params. SeoLanding wires every SEO page to /api/og with its
// page-specific title + eyebrow so Slack, LinkedIn, iMessage, X, and
// Facebook all get a branded card instead of the default placeholder.
//
// Usage:
//   /api/og?title=HVAC%20Software&eyebrow=HVAC%20Software
//
// Cached aggressively (24h) since the same query always produces the
// same image and these get hit by social-media bots.

export const config = { runtime: 'edge' };

const BG       = '#0a0f1a';
const TEXT     = '#f0f4ff';
const SUBTEXT  = '#c8d4ee';
const MUTED    = '#7a8db0';
const BLUE     = '#4f9eff';
const GREEN    = '#2edf87';

export default function handler(req) {
  const url = new URL(req.url);
  const title   = (url.searchParams.get('title')   || 'MyForeman').slice(0, 140);
  const eyebrow = (url.searchParams.get('eyebrow') || 'Contractor Software').slice(0, 60);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: BG,
          color: TEXT,
          fontFamily: 'sans-serif',
          padding: '70px 80px',
          position: 'relative',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 800,
          height: 800,
          background: 'radial-gradient(circle, rgba(79,158,255,0.18) 0%, transparent 60%)',
          display: 'flex',
        }}/>
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-10%',
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(46,223,135,0.10) 0%, transparent 60%)',
          display: 'flex',
        }}/>

        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${BLUE}, #2a7de8)`,
            fontSize: 36,
            fontWeight: 800,
            color: '#fff',
          }}>MF</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 1 }}>MyForeman</div>
            <div style={{ fontSize: 16, color: MUTED, letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>
              Contractor Business OS
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ display: 'flex', flex: 1 }}/>

        {/* Eyebrow */}
        <div style={{
          fontSize: 22,
          color: BLUE,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: 'uppercase',
          marginBottom: 14,
          display: 'flex',
        }}>{eyebrow}</div>

        {/* Title */}
        <div style={{
          fontSize: title.length > 70 ? 56 : 72,
          fontWeight: 800,
          lineHeight: 1.05,
          color: TEXT,
          maxWidth: 1040,
          display: 'flex',
        }}>{title}</div>

        {/* Footer row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: 50,
        }}>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN, display: 'flex' }}/>
              <span style={{ fontSize: 18, color: SUBTEXT }}>From $39/mo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN, display: 'flex' }}/>
              <span style={{ fontSize: 18, color: SUBTEXT }}>14-day free trial</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: GREEN, display: 'flex' }}/>
              <span style={{ fontSize: 18, color: SUBTEXT }}>No credit card</span>
            </div>
          </div>
          <div style={{ fontSize: 18, color: MUTED }}>myforemanhq.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    }
  );
}
