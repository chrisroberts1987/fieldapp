import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../../lib/apiSecurity';
import { sendBrandedEmail } from '../../../../lib/email/send';
import { invoiceSentEmail } from '../../../../lib/email/templates';

// POST /api/invoices/[id]/send
//
// Emails the customer the invoice with a Pay Now link, then stamps
// invoices.last_emailed_at. Called from two places:
//   - jobs page, automatically, when a job transitions to "completed"
//     (best-effort; the DB trigger creates the invoice, this just
//     delivers it)
//   - the invoice detail page, manually, via the Send / Resend button
//
// Auth: bearer-token user must be an org member who owns the invoice.
// RLS on `invoices` enforces that selectively. We re-select with the
// caller's session token to confirm before we send.

export const config = {
  api: { bodyParser: { sizeLimit: '8kb' } },
};

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function origin(req) {
  // Vercel sets x-forwarded-host + x-forwarded-proto; fall back to host.
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing invoice id.' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  // RLS confines this select to invoices in orgs the user belongs to.
  // Selecting * to avoid coupling to a specific column list — the
  // invoices table has accreted columns across migrations 0001-0020.
  const { data: invoice, error: invErr } = await sb
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (invErr || !invoice) return res.status(404).json({ error: 'Invoice not found.' });

  if (!invoice.public_token) {
    return res.status(409).json({ error: 'Invoice has no public pay link yet.' });
  }

  // Pull customer + org for personalization. The customer/org rows are
  // already gated by RLS through org membership, so this is safe.
  const [{ data: customer }, { data: org }] = await Promise.all([
    invoice.customer_id
      ? sb.from('customers').select('name, email').eq('id', invoice.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('organizations').select('id, name, business_email, logo_url').eq('id', invoice.org_id).maybeSingle(),
  ]);

  if (!org) return res.status(404).json({ error: 'Org not found.' });
  if (!customer?.email) {
    return res.status(422).json({ error: 'Customer has no email on file.' });
  }

  const invoiceUrl = `${origin(req)}/inv/${invoice.public_token}`;
  const invoiceNumber = 'INV-' + String(invoice.id).slice(0, 8).toUpperCase();

  let built;
  try {
    built = invoiceSentEmail({
      org,
      customerName: customer.name,
      invoiceNumber,
      amount: invoice.amount,
      invoiceUrl,
      dueDate: null,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Template build failed.' });
  }

  const result = await sendBrandedEmail({
    org,
    to: customer.email,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
  if (!result.ok) {
    return res.status(502).json({ error: result.error || 'Send failed.' });
  }

  // Stamp last_emailed_at — best-effort. If this fails the email already
  // went out, so we don't error the response, but we log it.
  const { error: stampErr } = await sb
    .from('invoices')
    .update({ last_emailed_at: new Date().toISOString() })
    .eq('id', invoice.id);
  if (stampErr) {
    console.warn('[invoice/send] last_emailed_at stamp failed:', stampErr.message);
  }

  return res.status(200).json({
    ok: true,
    sent_to: customer.email,
    skipped: result.skipped || false,
  });
}
