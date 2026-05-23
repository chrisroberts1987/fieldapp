import { verifyAdmin } from '../../../lib/adminAuth';

// Cross-org list for the admin panel's Businesses table. Computes
// per-org rollups in one pass with grouped counts. Capped at 500 orgs;
// search by name or owner email narrows the result set client-side
// (post-filter on a small N). For real scale this becomes a
// paginated query — fine for now.

const TRIAL_DAYS = 14;
const HARD_LIMIT = 500;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  // Fetch base org list
  const { data: orgs, error } = await sb
    .from('organizations')
    .select('id, name, owner_name, business_email, phone, created_at, suspended_at, suspended_reason')
    .order('created_at', { ascending: false })
    .limit(HARD_LIMIT);
  if (error) return res.status(500).json({ error: error.message });

  // Pull counts and last-activity timestamps for each org in parallel
  // using the most recent row from jobs/invoices/customers as a
  // cheap "last active" proxy.
  const ids = orgs.map(o => o.id);
  if (ids.length === 0) return res.status(200).json({ businesses: [] });

  const [jobsAgg, custsAgg, invsAgg, lastJob, lastInv, lastCust, ownerEmails] = await Promise.all([
    sb.from('jobs').select('org_id').in('org_id', ids),
    sb.from('customers').select('org_id').in('org_id', ids),
    sb.from('invoices').select('org_id').in('org_id', ids),
    sb.from('jobs').select('org_id, created_at').in('org_id', ids).order('created_at', { ascending: false }).limit(2000),
    sb.from('invoices').select('org_id, created_at').in('org_id', ids).order('created_at', { ascending: false }).limit(2000),
    sb.from('customers').select('org_id, created_at').in('org_id', ids).order('created_at', { ascending: false }).limit(2000),
    sb.from('org_members').select('org_id, user_id').in('org_id', ids).eq('role', 'owner'),
  ]);

  // Aggregate counts client-side (faster than N count queries)
  const tally = (rows) => {
    const m = {};
    for (const r of rows || []) m[r.org_id] = (m[r.org_id] || 0) + 1;
    return m;
  };
  const jobsCount  = tally(jobsAgg.data);
  const custsCount = tally(custsAgg.data);
  const invsCount  = tally(invsAgg.data);

  const latest = (rows) => {
    const m = {};
    for (const r of rows || []) {
      if (!m[r.org_id] || r.created_at > m[r.org_id]) m[r.org_id] = r.created_at;
    }
    return m;
  };
  const lastJobMap  = latest(lastJob.data);
  const lastInvMap  = latest(lastInv.data);
  const lastCustMap = latest(lastCust.data);

  // Look up owner email for each org. We need this to map auth.users
  // → owner email, because organizations.business_email is the
  // public-facing one and may differ from the sign-in email.
  const ownerUserIds = [...new Set((ownerEmails.data || []).map(m => m.user_id).filter(Boolean))];
  let ownerEmailById = {};
  if (ownerUserIds.length > 0) {
    // Service role can read auth.users via admin API
    const { data: usersData } = await sb.auth.admin.listUsers({ perPage: 1000 });
    for (const u of usersData?.users || []) {
      if (ownerUserIds.includes(u.id)) ownerEmailById[u.id] = u.email;
    }
  }
  const ownerByOrg = {};
  for (const m of ownerEmails.data || []) {
    if (!ownerByOrg[m.org_id] && ownerEmailById[m.user_id]) {
      ownerByOrg[m.org_id] = ownerEmailById[m.user_id];
    }
  }

  const now = Date.now();
  const businesses = orgs.map(o => {
    const lasts = [lastJobMap[o.id], lastInvMap[o.id], lastCustMap[o.id]].filter(Boolean);
    const lastActive = lasts.length ? lasts.sort().pop() : o.created_at;
    const ageDays = (now - new Date(o.created_at).getTime()) / 86_400_000;
    const status = o.suspended_at
      ? 'suspended'
      : (ageDays < TRIAL_DAYS ? 'trial' : 'active');
    return {
      id: o.id,
      name: o.name,
      ownerName:     o.owner_name,
      ownerEmail:    ownerByOrg[o.id] || null,
      businessEmail: o.business_email,
      phone:         o.phone,
      createdAt:     o.created_at,
      suspendedAt:   o.suspended_at,
      suspendedReason: o.suspended_reason,
      lastActive,
      status,
      jobsCount:      jobsCount[o.id]  || 0,
      customersCount: custsCount[o.id] || 0,
      invoicesCount:  invsCount[o.id]  || 0,
    };
  });

  res.status(200).json({ businesses, total: businesses.length });
}
