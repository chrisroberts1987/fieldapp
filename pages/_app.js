import Head from 'next/head';
import { useEffect } from 'react';
import TourOverlay from '../components/TourOverlay';
import OfflineBanner from '../components/OfflineBanner';
import InstallPrompt from '../components/InstallPrompt';

export default function MyApp({ Component, pageProps }) {
  // Register the service worker on first mount. The browser will keep
  // it registered across reloads — re-registering on every mount is a
  // no-op for the same script URL. Skip in dev so HMR isn't fighting
  // with cached responses.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        console.warn('[sw] registration failed:', err?.message || err);
      });
    });
  }, []);

  return (
    <>
      <Head>
        <title>MyForeman — From lead to paid</title>
        <meta name="description" content="Run your field service business from first call to final payment — with AI insights that help you grow." />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" />
        <meta property="og:title" content="MyForeman — From lead to paid" />
        <meta property="og:description" content="Run your field service business from first call to final payment — with AI insights that help you grow." />
        <meta property="og:type" content="website" />
      </Head>
      <OfflineBanner />
      <Component {...pageProps} />
      <TourOverlay />
      <InstallPrompt />
    </>
  );
}
