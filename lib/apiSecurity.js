// Shared security primitives for the custom Next API routes:
//   - rateLimit(ip)         — 10 requests / minute / IP, in-memory.
//   - clientIp(req)          — extract caller IP through Vercel proxies.
//   - originAllowed(req)     — defense-in-depth CSRF check on POST.
//   - requireUser(req, sb)   — confirm a bearer token resolves to a user.
//
// The in-memory limiter is per Lambda instance, which means a determined
// attacker can spread requests across cold-started instances. For real
// production traffic, swap this for Upstash Redis / Vercel KV. For a
// single-tenant SaaS at MyForeman's current scale, it's a meaningful
// guardrail against accidental loops and casual abuse.

const RATE_WINDOW_MS = 60_000;
const RATE_MAX       = 10;
const buckets = new Map(); // ip -> { count, resetAt }

export function rateLimit(ip) {
  if (!ip) return { ok: false, retryAfter: 60 };
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true, remaining: RATE_MAX - 1, resetAt: now + RATE_WINDOW_MS };
  }
  if (b.count >= RATE_MAX) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, remaining: RATE_MAX - b.count, resetAt: b.resetAt };
}

export function clientIp(req) {
  // Vercel sets x-forwarded-for as a comma-separated list, the first entry
  // is the client. Fall back to the socket address for local dev.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || '';
}

// Browsers won't let cross-origin JS attach a custom Authorization header
// without an explicit CORS preflight, which means the bearer-token auth on
// our endpoints is already CSRF-safe. The Origin check below is defense in
// depth — it catches the small set of cases where an attacker can ride an
// existing session cookie or where a misconfigured proxy strips the
// Authorization header.
export function originAllowed(req) {
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return true; // server-to-server / curl — no CSRF surface
  const host = req.headers.host || '';
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

// Wraps the common "POST + rate limit + origin check" boilerplate. Returns
// `null` if the response was already sent (caller can early-return), or the
// request's client IP if the caller should continue.
export function preflight(req, res, { allowMethods = ['POST'] } = {}) {
  if (!allowMethods.includes(req.method)) {
    res.setHeader('Allow', allowMethods);
    res.status(405).end();
    return null;
  }
  if (!originAllowed(req)) {
    res.status(403).json({ error: 'Cross-origin request rejected.' });
    return null;
  }
  const ip = clientIp(req);
  const limit = rateLimit(ip);
  res.setHeader('X-RateLimit-Limit', String(RATE_MAX));
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return null;
  }
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  return ip;
}

export function bearerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
