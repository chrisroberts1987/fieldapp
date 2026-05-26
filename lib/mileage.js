// Driving-distance lookup. Calls our /api/mileage/route which wraps
// the OSRM public OpenStreetMap routing server. If the API fails,
// the server returns a haversine fallback — caller always gets a
// usable number and never has to handle errors.
//
// Returns: { miles, source: 'osrm' | 'haversine', durationMinutes? }

import { supabase } from './supabase';

export async function lookupRouteMiles(startLat, startLng, endLat, endLng) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return haversineFallback(startLat, startLng, endLat, endLng, 'no session');

    const resp = await fetch('/api/mileage/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        start: [startLng, startLat],
        end:   [endLng,   endLat],
      }),
    });
    if (!resp.ok) return haversineFallback(startLat, startLng, endLat, endLng, 'http ' + resp.status);
    return await resp.json();
  } catch (e) {
    return haversineFallback(startLat, startLng, endLat, endLng, e?.message || 'fetch error');
  }
}

function haversineFallback(lat1, lng1, lat2, lng2, reason) {
  const R = 3959;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  const miles = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { miles: Number(miles.toFixed(2)), source: 'haversine', reason };
}
