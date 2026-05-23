import { verifyAdmin } from '../../../../lib/adminAuth';

// Single-business deep view for the admin "View as" panel. Pulls
// org, members + emails, latest jobs/invoices/customers, totals.
// Read-only — we don't actually impersonate (no auth state change),
// the admin just sees the data through this endpoint.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb } = ctx;

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing org id.' });

  const { data: org } = await sb.from('organizations').select('*').eq('id', id).maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  const [members, jobs, invoices, customers, expenses, recentInvoices, recentJobs, ownerLookup] = await Promise.all([
    sb.from('org_members').select('user_id, role, hourly_pay_rate, joined_at').eq('org_id', id).order('joined_at', { ascending: true }),
    sb.from('jobs').select('id', { count:'exact', head:true }).eq('org_id', id),
    sb.from('invoices').select('id, amount, status', { count:'exact' }).eq('org_id', id),
    sb.from('customers').select('id', { count:'exact', head:true }).eq('org_id', id),
    sb.from('expenses').select('id', { count:'exact', head:true }).eq('org_id', id),
    sb.from('invoices').select('id, amount, status, issued_date, paid_date, notes').eq('org_id', id).order('issued_date', { ascending: false }).limit(20),
    sb.from('jobs').select('id, title, status, scheduled_date, price').eq('org_id', id).order('scheduled_date', { ascending: false, nullsFirst: false }).limit(20),
    sb.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = {};
  for (const u of ownerLookup?.data?.users || []) emailById[u.id] = u.email;
  const memberRows = (members.data || []).map(m => ({
    user_id: m.user_id,
    email: emailById[m.user_id] || null,
    role: m.role,
    hourly_pay_rate: m.hourly_pay_rate,
    joined_at: m.joined_at,
  }));

  const paid   = (invoices.data || []).filter(i => i.status === 'paid');
  const unpaid = (invoices.data || []).filter(i => i.status === 'unpaid');
  const ltv    = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
  const out    = unpaid.reduce((s, i) => s + Number(i.amount || 0), 0);

  res.status(200).json({
    org,
    counts: {
      jobs:      jobs.count      || 0,
      invoices:  invoices.count  || 0,
      customers: customers.count || 0,
      expenses:  expenses.count  || 0,
      members:   memberRows.length,
    },
    money: {
      lifetimePaid: ltv,
      outstanding:  out,
    },
    members:        memberRows,
    recentInvoices: recentInvoices.data || [],
    recentJobs:     recentJobs.data     || [],
  });
}
