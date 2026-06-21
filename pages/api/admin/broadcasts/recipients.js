import { verifyAdmin } from '../../../../lib/adminAuth';

// Returns recipient counts for the admin Broadcast composer. Counts
// every organization with subscription_status in ('active', 'trialing')
// that has a usable business_email (orgs without one can't receive
// the broadcast and don't count against the recipient total).
//
// Response: { total, byTier: { solo, crew, business, unknown } }
// `unknown` covers active orgs whose subscription_tier is null or
// outside the known plan list — they still get counted in `total`
// when the filter is `all`, but never roll into a specific tier.

const ACTIVE_STATUSES = ['active', 'trialing'];

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const { data, error } = await sb
    .from('organizations')
    .select('id, business_email, subscription_status, subscription_tier')
    .in('subscription_status', ACTIVE_STATUSES)
    .not('business_email', 'is', null)
    .limit(10000);
  if (error) return res.status(500).json({ error: error.message });

  const byTier = { solo: 0, crew: 0, business: 0, unknown: 0 };
  let total = 0;
  for (const o of data || []) {
    const email = (o.business_email || '').trim();
    if (!email || !email.includes('@')) continue; // defensive: skip malformed addresses
    total++;
    const t = o.subscription_tier;
    if (t === 'solo' || t === 'crew' || t === 'business') byTier[t]++;
    else byTier.unknown++;
  }

  return res.status(200).json({ total, byTier });
}
