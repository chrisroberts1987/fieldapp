import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import TourOverlay from '../components/TourOverlay';
import OfflineBanner from '../components/OfflineBanner';
import InstallPrompt from '../components/InstallPrompt';
import AssistantWidget from '../components/AssistantWidget';
import { ToastHost } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { useOrg } from '../lib/org';

const META_PIXEL_ID = '2115883415642593';

// Routes where the floating AI assistant should NOT show. Marketing
// pages, public links (invoice, portal, booking, quote), and the
// auth wall — anywhere the user isn't an authenticated org member,
// the widget would be useless or visually noisy.
const ASSISTANT_HIDDEN = new Set([
  '/', '/login', '/signup', '/reset', '/contact', '/privacy', '/terms',
]);
const ASSISTANT_HIDDEN_PREFIX = ['/inv/', '/q/', '/quote/', '/portal/', '/book/', '/feedback/', '/invite/'];

function shouldShowAssistant(pathname) {
  if (ASSISTANT_HIDDEN.has(pathname)) return false;
  return !ASSISTANT_HIDDEN_PREFIX.some(p => pathname.startsWith(p));
}

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const { orgId } = useOrg(user);

  // Pick up the signed-in user once for the assistant widget.
  // Each page already does its own session check; this just lets
  // the widget render globally without each page passing user.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

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

  // Meta Pixel: refire PageView on client-side route changes. The
  // initial hit is sent by the inline script in the <Script> tag
  // below; this handles every subsequent SPA navigation.
  useEffect(() => {
    const onRouteChange = () => {
      if (typeof window !== 'undefined' && window.fbq) window.fbq('track', 'PageView');
    };
    router.events.on('routeChangeComplete', onRouteChange);
    return () => router.events.off('routeChangeComplete', onRouteChange);
  }, [router.events]);

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
          `.trim(),
        }}
      />
      <Head>
        <title>MyForeman — From lead to paid</title>
        <meta name="description" content="Run your field service business from first call to final payment, with AI insights that help you grow." />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        {/* favicon links live in pages/_document.js so they ship in
            the initial HTML response. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" />
        <meta property="og:title" content="MyForeman — From lead to paid" />
        <meta property="og:description" content="Run your field service business from first call to final payment, with AI insights that help you grow." />
        <meta property="og:type" content="website" />
      </Head>
      <OfflineBanner />
      <ToastHost />
      <Component {...pageProps} />
      <TourOverlay />
      <InstallPrompt />
      {shouldShowAssistant(router.pathname) && <AssistantWidget user={user} orgId={orgId}/>}
      <style jsx global>{`
        /* Prevent any element from causing horizontal scroll — when
           that happens the mobile browser fits the wider content
           inside the viewport, looking like the page is zoomed in. */
        html, body { overflow-x: hidden; max-width: 100vw; }
        /* iOS standalone-mode safe-area padding so the status-bar
           area doesn't clip the sticky TopNav. */
        body { padding-top: env(safe-area-inset-top, 0px); }
        /* iOS auto-zooms any focused input/textarea/select with
           font-size < 16px and never zooms back out. Override every
           form control on mobile to 16px so focusing email/password
           on /login doesn't lock the page into a permanent zoom. */
        @media (max-width: 767px) {
          input, textarea, select {
            font-size: 16px !important;
          }
        }
      `}</style>
    </>
  );
}
