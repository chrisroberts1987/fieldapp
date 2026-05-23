import { verifyAdmin } from '../../../lib/adminAuth';

// Platform-wide usage rollups. Cheap counts via service role.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const now = new Date();
  const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();
  const monthStartDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString().slice(0, 10);

  const [jobs, invoices, quotes, expenses, mileage, photos, leads, coachRuns, members] = await Promise.all([
    sb.from('jobs').select('id', { count: 'exact', head: true }),
    sb.from('invoices').select('id', { count: 'exact', head: true }),
    sb.from('quotes').select('id', { count: 'exact', head: true }),
    sb.from('expenses').select('id', { count: 'exact', head: true }),
    sb.from('mileage_logs').select('id', { count: 'exact', head: true }),
    sb.from('job_photos').select('id', { count: 'exact', head: true }),
    sb.from('leads').select('id', { count: 'exact', head: true }),
    sb.from('insight_recommendations').select('id', { count: 'exact', head: true })
      .gte('period_month', monthStartDate),
    sb.from('org_members').select('user_id', { count: 'exact', head: true }),
  ]);

  // Storage usage requires Supabase storage admin RPC — pending. Stub
  // the field so the UI shows a tasteful placeholder.
  res.status(200).json({
    jobs:        jobs.count        || 0,
    invoices:    invoices.count    || 0,
    quotes:      quotes.count      || 0,
    expenses:    expenses.count    || 0,
    mileage:     mileage.count     || 0,
    jobPhotos:   photos.count      || 0,
    leads:       leads.count       || 0,
    coachRunsThisMonth: coachRuns.count || 0,
    totalSeats:  members.count     || 0,
    storageBytes: null,
    storagePending: true,
  });
}
