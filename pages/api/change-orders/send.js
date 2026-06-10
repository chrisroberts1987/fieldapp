// Create a change order and dispatch the customer's approval link
// over email + SMS. Authenticated; the caller's session JWT scopes
// the insert via RLS (foreman + supervisor only).
//
// Body: { jobId? | quoteId?, description, reason?, amount, lineItems? }
// At least one anchor (jobId or quoteId) is required — enforced by
// the CHECK constraint on the table.

import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { sendCustomerSMS } from '../../../lib/sms/customer';
import { changeOrderRequestCustomerSMS } from '../../../lib/sms/templates';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { jobId, quoteId, description, reason, amount, lineItems } = req.body || {};
  if (!jobId && !quoteId) return res.status(400).json({ error: 'jobId or quoteId required.' });
  if (!description || typeof description !== 'string') return res.status(400).json({ error: 'description required.' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number.' });

  // Pull org + customer context from the anchor row. RLS scopes the
  // read so a malicious client can't poke jobs/quotes outside their
  // own org.
  let orgId = null, customerId = null, customer = null, jobTitle = null;
  if (jobId) {
    const { data: j } = await userClient.from('jobs')
      .select('id, org_id, customer_id, title, status, customers ( id, name, email, phone, sms_opt_in_at, sms_opt_out )')
      .eq('id', jobId).maybeSingle();
    if (!j) return res.status(404).json({ error: 'Job not found or no access.' });
    orgId = j.org_id; customerId = j.customer_id; customer = j.customers; jobTitle = j.title;
  } else if (quoteId) {
    const { data: q } = await userClient.from('quotes')
      .select('id, org_id, customer_id, title, customer_name, customer_email, customer_phone, customers ( id, name, email, phone, sms_opt_in_at, sms_opt_out )')
      .eq('id', quoteId).maybeSingle();
    if (!q) return res.status(404).json({ error: 'Quote not found or no access.' });
    orgId = q.org_id; customerId = q.customer_id;
    customer = q.customers || {
      id: null, name: q.customer_name, email: q.customer_email, phone: q.customer_phone,
      sms_opt_in_at: null, sms_opt_out: false,
    };
    jobTitle = q.title;
  }

  // Insert via the user client so RLS gates writes appropriately.
  const insertPayload = {
    org_id: orgId,
    owner_id: user.id,
    job_id: jobId || null,
    quote_id: quoteId || null,
    customer_id: customerId,
    customer_name:  customer?.name  || null,
    customer_email: customer?.email || null,
    customer_phone: customer?.phone || null,
    description: description.trim(),
    reason: reason ? String(reason).trim() : null,
    line_items: Array.isArray(lineItems) ? lineItems : [],
    amount: amt,
    sent_at: new Date().toISOString(),
  };
  const { data: co, error: insErr } = await userClient
    .from('change_orders').insert(insertPayload).select('id, public_token').single();
  if (insErr) return res.status(500).json({ error: insErr.message });

  // Build the approval URL. NEXT_PUBLIC_SITE_URL is the prod canonical;
  // falls back to the Vercel preview URL if running on a branch deploy.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://www.myforemanhq.com');
  const approvalUrl = `${baseUrl}/co/${co.public_token}`;

  // Email (always, when we have one on file). Reuses the existing
  // /api/email/send dispatcher so branding + Reply-To follow.
  if (customer?.email) {
    try {
      const { data: org } = await userClient.from('organizations')
        .select('name, logo_url, business_email').eq('id', orgId).maybeSingle();
      const { changeOrderRequestEmail } = await import('../../../lib/email/templates');
      const { sendBrandedEmail } = await import('../../../lib/email/send');
      const built = changeOrderRequestEmail({
        org: org || { name: 'Your contractor' },
        customerName: customer.name,
        jobTitle,
        description: insertPayload.description,
        reason: insertPayload.reason,
        amount: amt,
        approvalUrl,
      });
      await sendBrandedEmail({
        org: org || { name: 'Your contractor' },
        to: customer.email,
        subject: built.subject, html: built.html, text: built.text,
      });
    } catch (e) {
      console.warn('[co/send] email failed', e?.message);
    }
  }

  // SMS — gated server-side on sms_opt_in_at + !sms_opt_out by
  // sendCustomerSMS. Uses service-role client so the audit-log
  // insert lands cleanly.
  if (customer?.phone && SERVICE_KEY && customer.id) {
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();
      const body = changeOrderRequestCustomerSMS({
        orgName: org?.name, amount: amt, approvalUrl,
      });
      await sendCustomerSMS(sb, {
        orgId,
        customer,
        body,
        kind: 'change_order',
      });
    } catch (e) {
      console.warn('[co/send] sms failed', e?.message);
    }
  }

  return res.status(200).json({ ok: true, id: co.id, approvalUrl });
}
