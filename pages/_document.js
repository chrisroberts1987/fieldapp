import { Html, Head, Main, NextScript } from 'next/document';

// Document-level HTML scaffolding. The PWA-related Apple metadata
// belongs here (not _app.js) because these tags must be in the
// initial HTML response, not added by React on hydration. iOS Safari
// reads them once when it parses the page before running JS.

const SPLASH_DEVICES = [
  // device-width x device-height x device-pixel-ratio
  { w: 750,  h: 1334, r: 2, file: 'splash-750x1334.png'  }, // iPhone SE/6/7/8
  { w: 1125, h: 2436, r: 3, file: 'splash-1125x2436.png' }, // iPhone X/11 Pro/12 mini
  { w: 1170, h: 2532, r: 3, file: 'splash-1170x2532.png' }, // iPhone 12/13/14
  { w: 1284, h: 2778, r: 3, file: 'splash-1284x2778.png' }, // iPhone 12/13/14 Plus
  { w: 1290, h: 2796, r: 3, file: 'splash-1290x2796.png' }, // iPhone 14 Pro Max
];

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme + viewport */}
        <meta name="theme-color" content="#4f9eff" />
        <meta name="msapplication-TileColor" content="#4f9eff" />
        <meta name="color-scheme" content="dark" />

        {/* iOS Safari PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MyForeman" />

        {/* apple-touch-icon links (iOS uses these for the home-screen icon) */}
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />

        {/* iOS splash screens — media queries match each device's viewport */}
        {SPLASH_DEVICES.map(d => (
          <link key={d.file}
            rel="apple-touch-startup-image"
            href={`/splash/${d.file}`}
            media={`screen and (device-width: ${d.w / d.r}px) and (device-height: ${d.h / d.r}px) and (-webkit-device-pixel-ratio: ${d.r}) and (orientation: portrait)`}/>
        ))}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
