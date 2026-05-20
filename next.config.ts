import type { NextConfig } from "next";

// Security headers applied to every response. The CSP is bounded:
// - script + style allow 'unsafe-inline' because Next.js injects hydration
//   scripts and the app uses inline styles throughout.
// - connect-src allows the Supabase project (auth + REST + storage + realtime)
//   and the QR-code service used by the leads share link.
// - img-src includes data: + blob: for the in-browser receipt previews and
//   the Supabase storage CDN.
// - font-src covers Google Fonts loaded by _document (Bebas Neue + Inter).
const SUPABASE_HOST = "*.supabase.co";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: https://${SUPABASE_HOST} https://api.qrserver.com`,
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
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

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
