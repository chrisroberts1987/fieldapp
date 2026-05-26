// Driving-distance lookup. Wraps the Mapbox Directions API so the
// access token never reaches the browser. Called from the job
// completion flow to log accurate miles instead of straight-line
// haversine.
//
// Body:  { start: [lng, lat], end: [lng, lat] }
// 200:   { miles, durationMinutes, source: 'mapbox' }
// 200:   { miles, source: 'haversine', reason } when the lookup fails
//        and we fall back to straight-line. Caller always gets a usable
//        number — never breaks job completion.

import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPBOX_TOKEN  = process.env.MAPBOX_TOKEN;

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
  // can't burn through the Mapbox quota.
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

  // Fallback path: no token configured. Return haversine so the
  // caller can still log mileage — same shape so they don't have to
  // branch on which mode is active.
  if (!MAPBOX_TOKEN) {
    const miles = haversineMiles(startLat, startLng, endLat, endLng);
    return res.status(200).json({
      miles: Number(miles.toFixed(2)),
      source: 'haversine',
      reason: 'MAPBOX_TOKEN not configured',
    });
  }

  try {
    const coords = `${startLng},${startLat};${endLng},${endLat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?access_token=${encodeURIComponent(MAPBOX_TOKEN)}` +
      `&overview=false&geometries=geojson&alternatives=false&steps=false`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      // Mapbox 422 = no route found (e.g., coords in ocean / on
      // separate landmasses). Treat as fallback rather than error.
      const miles = haversineMiles(startLat, startLng, endLat, endLng);
      return res.status(200).json({
        miles: Number(miles.toFixed(2)),
        source: 'haversine',
        reason: `Mapbox returned ${resp.status}`,
      });
    }
    const json = await resp.json();
    const route = json?.routes?.[0];
    if (!route || typeof route.distance !== 'number') {
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
      source: 'mapbox',
    });
  } catch (e) {
    const miles = haversineMiles(startLat, startLng, endLat, endLng);
    return res.status(200).json({
      miles: Number(miles.toFixed(2)),
      source: 'haversine',
      reason: 'Mapbox fetch failed: ' + (e?.message || 'unknown'),
    });
  }
}
