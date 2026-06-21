import { verifyAdmin } from '../../../../lib/adminAuth';

// Google Ads integration card. Reports current-month:
//   - Total spend
//   - Total clicks
//   - Cost per click (derived)
//
// Uses the Google Ads REST API directly (no google-ads-api SDK
// dependency) via the v18 searchStream endpoint. Auth is OAuth refresh
// token + developer token, the standard server-to-server pattern for
// Google Ads.
//
// Env vars required:
//   GOOGLE_ADS_DEVELOPER_TOKEN  — approved developer token
//   GOOGLE_ADS_CLIENT_ID        — OAuth 2.0 client id
//   GOOGLE_ADS_CLIENT_SECRET    — OAuth 2.0 client secret
//   GOOGLE_ADS_REFRESH_TOKEN    — long-lived refresh token issued for
//                                 the manager / advertiser account
//   GOOGLE_ADS_CUSTOMER_ID      — 10-digit customer id WITHOUT dashes
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID (optional) — manager (MCC) id used
//                                 when the auth user reaches the
//                                 advertiser via an MCC

const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const ADS_API    = 'https://googleads.googleapis.com/v18';

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type:    'refresh_token',
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

async function searchStream({ accessToken, developerToken, customerId, loginCustomerId, gaql }) {
  const r = await fetch(`${ADS_API}/customers/${customerId}/googleAds:searchStream`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      Authorization:     `Bearer ${accessToken}`,
      'developer-token': developerToken,
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
    },
    body: JSON.stringify({ query: gaql }),
  });
  const body = await r.json().catch(() => ([]));
  if (!r.ok) {
    const err = Array.isArray(body) ? body[0]?.error : body?.error;
    throw new Error(err?.message || `Google Ads API ${r.status}`);
  }
  // searchStream returns an array of chunks; flatten the results.
  const chunks = Array.isArray(body) ? body : [body];
  const rows = [];
  for (const c of chunks) if (c?.results) rows.push(...c.results);
  return rows;
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const lastUpdated = new Date().toISOString();

  const developerToken  = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId        = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret    = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken    = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId      = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');

  const missing = [
    !developerToken && 'GOOGLE_ADS_DEVELOPER_TOKEN',
    !clientId       && 'GOOGLE_ADS_CLIENT_ID',
    !clientSecret   && 'GOOGLE_ADS_CLIENT_SECRET',
    !refreshToken   && 'GOOGLE_ADS_REFRESH_TOKEN',
    !customerId     && 'GOOGLE_ADS_CUSTOMER_ID',
  ].filter(Boolean);
  if (missing.length) {
    return res.status(200).json({
      ok: false, configured: false, missingEnv: missing, lastUpdated,
    });
  }

  try {
    const accessToken = await getAccessToken({ clientId, clientSecret, refreshToken });

    const gaql = `
      SELECT metrics.cost_micros, metrics.clicks
      FROM customer
      WHERE segments.date DURING THIS_MONTH
    `;
    const rows = await searchStream({ accessToken, developerToken, customerId, loginCustomerId, gaql });

    let micros = 0;
    let clicks = 0;
    for (const row of rows) {
      micros += Number(row?.metrics?.costMicros || 0);
      clicks += Number(row?.metrics?.clicks     || 0);
    }
    const spend = micros / 1_000_000;
    const cpc   = clicks > 0 ? spend / clicks : 0;

    return res.status(200).json({
      ok: true, configured: true, lastUpdated,
      data: { spend, clicks, cpc },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'Google Ads request failed.',
      lastUpdated,
    });
  }
}
