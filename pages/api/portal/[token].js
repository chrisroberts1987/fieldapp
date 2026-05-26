// Public read-only endpoint backing /portal/<token>. Uses the
// service-role client (this token IS the customer's authentication —
// they don't have a Supabase session) and returns just what the
// portal page needs. Never returns internal columns like cost,
// labor, owner_id, etc.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length < 16) {
    return res.status(400).json({ error: 'Bad token.' });
  }

  const { data: customer, error: cErr } = await sb
    .from('customers')
    .select('id, name, email, phone, address, org_id, portal_token')
    .eq('portal_token', token)
    .maybeSingle();
  if (cErr || !customer) {
    return res.status(404).json({ error: 'Portal link not found. It may have been reset by the contractor.' });
  }

  const [{ data: org }, { data: jobs }, { data: quotes }, { data: invoices }] = await Promise.all([
    sb.from('organizations')
      .select('name, business_email, logo_url')
      .eq('id', customer.org_id).maybeSingle(),
    sb.from('jobs')
      .select('id, title, status, scheduled_date, scheduled_time, price, signature_url, signed_by_name, signed_at')
      .eq('customer_id', customer.id)
      .order('scheduled_date', { ascending: false, nullsFirst: false }),
    sb.from('quotes')
      .select('id, title, amount, status, sent_at, approval_token')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false }),
    sb.from('invoices')
      .select('id, amount, status, issued_date, paid_date, notes, public_token')
      .eq('customer_id', customer.id)
      .order('issued_date', { ascending: false, nullsFirst: false }),
  ]);

  return res.status(200).json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
    },
    org:      org || { name: 'Your contractor' },
    jobs:     jobs || [],
    quotes:   quotes || [],
    invoices: invoices || [],
  });
}
