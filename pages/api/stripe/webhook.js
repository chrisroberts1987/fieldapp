import { createClient } from '@supabase/supabase-js';
import { stripe } from '../../../lib/stripe';

// Stripe webhook receiver. Stripe POSTs JSON to this endpoint when
// events happen on our account; we verify the signature against
// STRIPE_WEBHOOK_SECRET to prove the request came from Stripe.
//
// CRITICAL: bodyParser must be disabled here. The Stripe signature
// is computed over the raw request body — if Next parses+restringifies,
// even cosmetic whitespace changes will break the signature check.

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  const s = stripe();
  if (!s || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).end('Stripe not configured.');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing stripe-signature header');

  let event;
  try {
    const raw = await readRawBody(req);
    event = s.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[stripe webhook] bad signature:', err?.message);
    return res.status(400).send(`Webhook signature verification failed: ${err?.message}`);
  }

  const sb = admin();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // We attached invoice_id in checkout.sessions.create metadata.
      const invoiceId = session.metadata?.invoice_id;
      if (!invoiceId) {
        console.warn('[stripe webhook] checkout.session.completed without invoice_id metadata', session.id);
        return res.status(200).json({ received: true });
      }
      await markInvoicePaid(sb, invoiceId, {
        paymentIntentId: session.payment_intent || null,
        sessionId: session.id,
      });
    } else if (event.type === 'payment_intent.payment_failed') {
      // Best-effort log so it's visible in server logs.
      console.log('[stripe webhook] payment_intent.payment_failed', event.data.object?.id);
    }
    // Other event types are acknowledged but no-op.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    // Return 500 so Stripe retries.
    return res.status(500).json({ error: err?.message });
  }
}

// Mark the invoice paid and fan out the same downstream actions the
// client does when a foreman marks one manually: insert feedback,
// in-app notification, queue feedback email + push notification.
async function markInvoicePaid(sb, invoiceId, { paymentIntentId, sessionId }) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: inv } = await sb
    .from('invoices')
    .select('id, status, amount, org_id, customer_id, customers ( name, email ), organizations ( name, business_email, logo_url )')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) {
    console.warn('[stripe webhook] invoice not found', invoiceId);
    return;
  }
  if (inv.status === 'paid') return; // already done, idempotent

  await sb.from('invoices').update({
    status: 'paid',
    paid_date: today,
    paid_via: 'stripe',
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: sessionId,
  }).eq('id', inv.id);

  // Mirror onInvoicePaid() from pages/invoices/index.js
  const customer = inv.customers || {};
  const org      = inv.organizations || {};
  const custName = customer.name || 'Customer';
  const amount   = Number(inv.amount || 0);

  // 1. Feedback row (idempotent)
  let { data: existing } = await sb
    .from('feedback')
    .select('id, token')
    .eq('invoice_id', inv.id)
    .maybeSingle();
  if (!existing) {
    const { data: ins } = await sb.from('feedback').insert({
      org_id: inv.org_id,
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      customer_name: custName,
    }).select('id, token').single();
    existing = ins;
  }

  // 2. In-app notification (find any org member to attribute it to;
  // the bell will show it). Prefer the owner.
  const { data: owner } = await sb.from('org_members').select('user_id').eq('org_id', inv.org_id).eq('role', 'owner').maybeSingle();
  if (owner?.user_id) {
    await sb.from('notifications').insert({
      org_id:  inv.org_id,
      user_id: owner.user_id,
      kind:    'invoice_paid',
      title:   'Invoice paid 🎉',
      body:    `${custName} just paid $${amount.toFixed(2)} via card. Feedback link generated.`,
      link:    '/invoices',
    });
  }

  // 3. Feedback email to the customer (best-effort via Resend)
  if (customer.email && existing?.token) {
    try {
      const { Resend } = await import('resend');
      const { invoicePaidFeedbackEmail } = await import('../../../lib/email/templates');
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resend = new Resend(apiKey);
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
          || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://myforemanhq.com');
        const feedbackUrl = `${baseUrl}/feedback/${existing.token}`;
        const tpl = invoicePaidFeedbackEmail({
          org: { name: org.name, logo_url: org.logo_url, business_email: org.business_email },
          customerName: custName,
          amount,
          feedbackUrl,
        });
        const safeName = String(org.name || 'MyForeman').replace(/[<>"\\]/g, '').slice(0, 80).trim() || 'MyForeman';
        const fromAddr = process.env.RESEND_FROM_EMAIL || 'noreply@myforemanhq.com';
        await resend.emails.send({
          from: `${safeName} <${fromAddr}>`,
          to: [customer.email],
          replyTo: org.business_email || undefined,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });
      }
    } catch (e) {
      console.warn('[stripe webhook] feedback email send failed:', e?.message);
    }
  }

  // 4. Push notification (best-effort)
  try {
    const { sendPushToOrg } = await import('../../../lib/push/send');
    await sendPushToOrg(inv.org_id, {
      title: 'Invoice paid 🎉',
      body:  `${custName} paid $${amount.toFixed(2)} via card.`,
      url:   '/invoices',
      tag:   `invoice-${inv.id}`,
    });
  } catch (e) {
    console.warn('[stripe webhook] push send failed:', e?.message);
  }
}
