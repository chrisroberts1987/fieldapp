// Driving-distance lookup using the OSRM public demo server
// (router.project-osrm.org) — OpenStreetMap-backed, no API key,
// no env var. Called from the job completion flow to log driving
// distance instead of straight-line haversine.
//
// Body:  { start: [lng, lat], end: [lng, lat] }
// 200:   { miles, durationMinutes, source: 'osrm' }
// 200:   { miles, source: 'haversine', reason } when OSRM fails and
//        we fall back to straight-line. Caller always gets a usable
//        number — never breaks job completion.
//
// Note: OSRM's public demo is rate-limited and unmetered, intended
// for "modest" use. At scale (a few thousand routes/day across all
// orgs), self-host OSRM on a small VPS — same API contract, no
// code changes here.

import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OSRM_BASE     = process.env.OSRM_BASE || 'https://router.project-osrm.org';

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isFiniteCoord(n) { return typeof n === 'number' && Number.isFinite(n); }

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  // Auth check — keep the endpoint org-scoped so anonymous traffic
  // can't burn through the public OSRM demo's rate limit on our IP.
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { start, end } = req.body || {};
  if (!Array.isArray(start) || start.length !== 2 || !Array.isArray(end) || end.length !== 2) {
    return res.status(400).json({ error: 'start and end must be [lng, lat] arrays.' });
  }
  const [startLng, startLat] = start;
  const [endLng,   endLat]   = end;
  if (![startLat, startLng, endLat, endLng].every(isFiniteCoord)) {
    return res.status(400).json({ error: 'Coordinates must be finite numbers.' });
  }
  if (Math.abs(startLat) > 90 || Math.abs(endLat) > 90 || Math.abs(startLng) > 180 || Math.abs(endLng) > 180) {
    return res.status(400).json({ error: 'Coordinates out of range.' });
  }

  try {
    const coords = `${startLng},${startLat};${endLng},${endLat}`;
    const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=false&alternatives=false&steps=false`;
    const resp = await fetch(url, {
      method: 'GET',
      // Identify ourselves to the public OSRM server — the operators
      // ask for an identifying User-Agent so they can reach out if
      // they ever need to rate-limit per app.
      headers: { 'User-Agent': 'MyForeman/1.0 (https://myforemanhq.com)' },
    });
    if (!resp.ok) {
      const miles = haversineMiles(startLat, startLng, endLat, endLng);
      return res.status(200).json({
        miles: Number(miles.toFixed(2)),
        source: 'haversine',
        reason: `OSRM returned ${resp.status}`,
      });
    }
    const json = await resp.json();
    const route = json?.routes?.[0];
    if (!route || typeof route.distance !== 'number' || json?.code !== 'Ok') {
      const miles = haversineMiles(startLat, startLng, endLat, endLng);
      return res.status(200).json({
        miles: Number(miles.toFixed(2)),
        source: 'haversine',
        reason: 'No route returned',
      });
    }
    const miles = route.distance / 1609.344;
    const durationMinutes = route.duration ? Math.round(route.duration / 60) : null;
    return res.status(200).json({
      miles: Number(miles.toFixed(2)),
      durationMinutes,
      source: 'osrm',
    });
  } catch (e) {
    const miles = haversineMiles(startLat, startLng, endLat, endLng);
    return res.status(200).json({
      miles: Number(miles.toFixed(2)),
      source: 'haversine',
      reason: 'OSRM fetch failed: ' + (e?.message || 'unknown'),
    });
  }
}
