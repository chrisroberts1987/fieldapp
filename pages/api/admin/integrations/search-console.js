import crypto from 'crypto';
import { verifyAdmin } from '../../../../lib/adminAuth';

// Google Search Console integration card.
//   - Total clicks this month
//   - Total impressions this month
//   - Top 5 performing pages (by clicks)
//   - Top 5 search queries (by clicks)
//
// Auth is via service account JWT — no googleapis SDK required so we
// don't bloat the bundle. The service account email must be added as
// an Owner / Full user on the Search Console property.
//
// Env vars:
//   GOOGLE_SERVICE_ACCOUNT_JSON  — entire service-account JSON file
//                                  contents as one string (escape
//                                  newlines in the private_key)
//   GSC_SITE_URL                 — exact URL property as registered
//                                  in Search Console, e.g.
//                                  https://myforemanhq.com/

const GSC_SCOPE   = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const QUERY_BASE  = 'https://searchconsole.googleapis.com/webmasters/v3/sites';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss:   serviceAccount.client_email,
    scope: GSC_SCOPE,
    aud:   TOKEN_URL,
    iat:   now,
    exp:   now + 3600,
  };
  const header  = { alg: 'RS256', typ: 'JWT' };
  const signing = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig     = crypto.createSign('RSA-SHA256').update(signing).sign(serviceAccount.private_key);
  const jwt     = `${signing}.${b64url(sig)}`;

  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion:  jwt,
  });
  const r = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error_description || body?.error || `Token exchange failed (${r.status})`);
  return body.access_token;
}

async function searchAnalytics(token, siteUrl, payload) {
  const url = `${QUERY_BASE}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error?.message || `Search Console API ${r.status}`);
  return body;
}

function monthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Search Console reports lag ~2 days, so 'today' is fine as endDate
  // even if the most recent rows are partial.
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(now) };
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const lastUpdated = new Date().toISOString();

  const json    = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const siteUrl = process.env.GSC_SITE_URL;
  if (!json || !siteUrl) {
    return res.status(200).json({
      ok: false, configured: false,
      missingEnv: [
        !json    && 'GOOGLE_SERVICE_ACCOUNT_JSON',
        !siteUrl && 'GSC_SITE_URL',
      ].filter(Boolean),
      lastUpdated,
    });
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(json);
  } catch {
    return res.status(200).json({
      ok: false, configured: true,
      error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.',
      lastUpdated,
    });
  }

  try {
    const token = await getAccessToken(serviceAccount);
    const { startDate, endDate } = monthBounds();

    const [byDay, byPage, byQuery] = await Promise.all([
      searchAnalytics(token, siteUrl, { startDate, endDate, dimensions: [] }),
      searchAnalytics(token, siteUrl, { startDate, endDate, dimensions: ['page'],  rowLimit: 5 }),
      searchAnalytics(token, siteUrl, { startDate, endDate, dimensions: ['query'], rowLimit: 5 }),
    ]);

    const totals = byDay?.rows?.[0] || { clicks: 0, impressions: 0 };

    return res.status(200).json({
      ok: true, configured: true, lastUpdated,
      data: {
        clicks:      Math.round(totals.clicks || 0),
        impressions: Math.round(totals.impressions || 0),
        topPages:    (byPage?.rows || []).map(r => ({
          url:         r.keys[0],
          clicks:      Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
        })),
        topQueries:  (byQuery?.rows || []).map(r => ({
          query:       r.keys[0],
          clicks:      Math.round(r.clicks || 0),
          impressions: Math.round(r.impressions || 0),
        })),
      },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'Search Console request failed.',
      lastUpdated,
    });
  }
}
