import type { NextConfig } from "next";

// Security headers applied to every response. The CSP is bounded:
// - script + style allow 'unsafe-inline' because Next.js injects hydration
//   scripts and the app uses inline styles throughout.
// - connect-src allows the Supabase project (auth + REST + storage + realtime)
//   and the QR-code service used by the leads share link.
// - img-src includes data: + blob: for the in-browser receipt previews and
//   the Supabase storage CDN.
// - font-src covers Google Fonts loaded by _document (Bebas Neue + Inter).
// - worker-src + manifest-src wired up so the PWA service worker and
//   web app manifest load under the strict CSP.
const SUPABASE_HOST = "*.supabase.co";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://${SUPABASE_HOST} https://api.qrserver.com https://www.facebook.com`,
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://www.facebook.com https://connect.facebook.net`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy",   value: CSP },
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(self), microphone=(), geolocation=(self), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Headers for the service worker file. SW MUST NOT be cached
// long-term — browsers respect 24h max-age caps anyway, but explicit
// no-cache means a deploy propagates within minutes. Service-Worker-
// Allowed lets the script declare a wider scope if needed.
const swHeaders = [
  { key: "Cache-Control",          value: "public, max-age=0, must-revalidate" },
  { key: "Service-Worker-Allowed", value: "/" },
];

// Manifest can be cached more aggressively but should revalidate.
const manifestHeaders = [
  { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*",       headers: securityHeaders },
      { source: "/sw.js",        headers: swHeaders },
      { source: "/manifest.json",headers: manifestHeaders },
    ];
  },
  async redirects() {
    return [
      // App reviewers expect /account to land somewhere coherent.
      // Until we build a dedicated account page, point it at /billing —
      // that's where subscription, plan, and payment management live.
      { source: "/account", destination: "/billing", permanent: false },
    ];
  },
};

export default nextConfig;
