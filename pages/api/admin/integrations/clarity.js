import { verifyAdmin } from '../../../../lib/adminAuth';

// Microsoft Clarity (Data Export API) integration card.
//   - Human sessions (last 24h, bots excluded)
//   - Distinct users
//   - Average scroll depth
//   - Rage clicks
//
// Quota: Clarity caps the Data Export API at 10 requests per project
// per day, so this endpoint is built to issue exactly one call per
// admin refresh. Window is fixed at 1 day (the API only supports 1/2/3).
//
// Env vars required:
//   CLARITY_API_TOKEN  — JWT generated in Clarity → Settings →
//                        Data Export → Generate new API token.

const ENDPOINT = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';

// The API returns an array of { metricName, information: [...] }.
// Without dimensions the information array has a single aggregated row.
function pickRow(payload, metricName) {
  const entry = (payload || []).find(m => m?.metricName === metricName);
  return entry?.information?.[0] || null;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const lastUpdated = new Date().toISOString();

  const token = process.env.CLARITY_API_TOKEN;
  if (!token) {
    return res.status(200).json({
      ok: false, configured: false,
      missingEnv: ['CLARITY_API_TOKEN'],
      lastUpdated,
    });
  }

  try {
    const url = `${ENDPOINT}?numOfDays=1`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (r.status === 429) {
      return res.status(200).json({
        ok: false, configured: true,
        error: 'Clarity API daily quota reached (10/day). Retry tomorrow.',
        lastUpdated,
      });
    }
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Clarity API ${r.status}${body ? `: ${body.slice(0, 140)}` : ''}`);
    }

    const payload = await r.json();

    const traffic    = pickRow(payload, 'Traffic')        || {};
    const scroll     = pickRow(payload, 'ScrollDepth')    || {};
    const rage       = pickRow(payload, 'RageClickCount') || {};
    const dead       = pickRow(payload, 'DeadClickCount') || {};

    const totalSessions = toNum(traffic.totalSessionCount);
    const botSessions   = toNum(traffic.totalBotSessionCount);
    // Clarity's payload has a typo: `distantUserCount` is the distinct-user
    // count. Accept either spelling in case they ever fix it.
    const users         = toNum(traffic.distinctUserCount ?? traffic.distantUserCount);
    const pps           = toNum(traffic.PagesPerSessionPercentage);

    return res.status(200).json({
      ok: true, configured: true, lastUpdated,
      data: {
        sessions:        Math.max(totalSessions - botSessions, 0),
        totalSessions,
        botSessions,
        users,
        pagesPerSession: pps,
        avgScrollDepth:  toNum(scroll.averageScrollDepth),
        rageClicks:      toNum(rage.subTotal ?? rage.totalCount),
        deadClicks:      toNum(dead.subTotal ?? dead.totalCount),
        windowDays:      1,
      },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'Clarity request failed.',
      lastUpdated,
    });
  }
}
