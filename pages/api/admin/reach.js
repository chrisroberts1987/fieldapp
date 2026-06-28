import { verifyAdmin } from '../../../lib/adminAuth';
import { parseUSAddress } from '../../../lib/admin/address';

// Geographic reach for the admin panel. Parses each org's address
// (free-text) into a US state and city using a regex that requires
// a 5-digit ZIP to anchor — that keeps random prose out of the
// state column. Anything unparseable goes to an "Unknown" bucket
// so it's actionable (the admin can clean those up).
//
// Returns:
//   total                  total org count
//   states[].code          two-letter state
//   states[].count         orgs in that state
//   states[].pct           % of total
//   states[].topCities[]   up to 3 cities with their counts
//   states[].recentOrgs[]  up to 5 most recent orgs in that state
//   unknownOrgs[]          orgs whose address didn't parse

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const { data: orgs, error } = await sb
    .from('organizations')
    .select('id, name, owner_name, business_email, address, created_at, subscription_status, subscription_tier, suspended_at')
    .eq('is_test', false)
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) return res.status(500).json({ error: error.message });

  const total = orgs.length;
  const byState = new Map(); // state -> { count, cities: Map, recent: [] }
  const unknownOrgs = [];

  for (const o of orgs) {
    const parsed = parseUSAddress(o.address);
    if (!parsed) { unknownOrgs.push(slim(o)); continue; }
    const { state, city } = parsed;
    if (!byState.has(state)) byState.set(state, { count: 0, cities: new Map(), recent: [] });
    const entry = byState.get(state);
    entry.count++;
    if (city) entry.cities.set(city, (entry.cities.get(city) || 0) + 1);
    if (entry.recent.length < 5) entry.recent.push(slim(o));
  }

  const states = Array.from(byState.entries())
    .map(([code, e]) => ({
      code,
      count: e.count,
      pct: total > 0 ? Math.round((e.count / total) * 100) : 0,
      topCities: Array.from(e.cities.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
      recentOrgs: e.recent,
    }))
    .sort((a, b) => b.count - a.count);

  res.status(200).json({
    total,
    knownTotal: total - unknownOrgs.length,
    statesCovered: states.length,
    states,
    unknownOrgs: unknownOrgs.slice(0, 20),
    unknownTotal: unknownOrgs.length,
  });
}


function slim(o) {
  return {
    id: o.id,
    name: o.name,
    ownerName: o.owner_name,
    email: o.business_email,
    createdAt: o.created_at,
    status: o.suspended_at ? 'suspended' : (o.subscription_status || 'no-plan'),
    tier: o.subscription_tier || null,
  };
}
