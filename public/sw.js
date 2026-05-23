// MyForeman service worker.
//
// Caching strategy:
//   • App shell + icons + manifest: precached on install.
//   • Page navigations: network-first, fall back to cached version,
//     fall back to /offline.html when both fail.
//   • Static assets (Next.js /_next/static + /icons): stale-while-revalidate.
//   • API requests + cross-origin (Supabase, Anthropic, Resend, QR): never cached.
//
// Bump CACHE_VERSION whenever you ship a breaking change to the SW
// itself. The activate handler will then wipe stale caches.
//
// Push handlers live at the bottom — they fire showNotification when
// the server pushes via Web Push, and handle the open-on-click.

const CACHE_VERSION = 'v1';
const SHELL_CACHE   = `myforeman-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `myforeman-runtime-${CACHE_VERSION}`;

const SHELL_URLS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Never cache cross-origin (Supabase, Anthropic, Resend, fonts, QR
  // service). The browser handles those normally — and we don't want
  // to risk caching auth tokens or live data.
  if (url.origin !== self.location.origin) return;

  // Never cache API routes — they're per-user data behind auth.
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations: network-first, fall back to cache, then offline page.
  const isNavigation = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// =============================================================
// Push notifications
// =============================================================
self.addEventListener('push', (event) => {
  let payload = { title: 'MyForeman', body: '' };
  if (event.data) {
    try { payload = event.data.json(); }
    catch { payload = { title: 'MyForeman', body: event.data.text() }; }
  }

  const title = payload.title || 'MyForeman';
  const options = {
    body:  payload.body || '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data:  { url: payload.url || '/dashboard' },
    tag:   payload.tag,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If the app is already open in any tab/PWA window, focus it and
    // navigate. Otherwise open a fresh window.
    for (const client of all) {
      if ('focus' in client) {
        client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
