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

  // Two valid signing secrets:
  //   STRIPE_WEBHOOK_SECRET        — platform events (subscriptions)
  //   STRIPE_CONNECT_WEBHOOK_SECRET — events from connected accounts
  //                                   (customer invoice payments)
  // If Stripe is configured with a single endpoint that listens to
  // BOTH account + Connect events, only STRIPE_WEBHOOK_SECRET is
  // needed. If the user prefers two separate endpoints (cleaner
  // dashboard view), set both env vars. We try whichever verifies.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter(Boolean);

  let event;
  let lastErr = null;
  try {
    const raw = await readRawBody(req);
    for (const secret of secrets) {
      try {
        event = s.webhooks.constructEvent(raw, sig, secret);
        break;
      } catch (e) { lastErr = e; }
    }
    if (!event) throw lastErr || new Error('No signing secret accepted the payload.');
  } catch (err) {
    console.warn('[stripe webhook] bad signature:', err?.message);
    return res.status(400).send(`Webhook signature verification failed: ${err?.message}`);
  }

  const sb = admin();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      // Two flavors of Checkout: one-time invoice payment OR subscription start.
      if (session.mode === 'subscription' && session.metadata?.org_id) {
        await onSubscriptionCheckout(sb, session);
      } else {
        const invoiceId = session.metadata?.invoice_id;
        if (!invoiceId) {
          console.warn('[stripe webhook] checkout.session.completed without invoice_id metadata', session.id);
          return res.status(200).json({ received: true });
        }
        await markInvoicePaid(sb, invoiceId, {
          paymentIntentId: session.payment_intent || null,
          sessionId: session.id,
        });
      }
    } else if (event.type === 'customer.subscription.created'
            || event.type === 'customer.subscription.updated') {
      await syncSubscription(sb, event.data.object);
    } else if (event.type === 'customer.subscription.deleted') {
      await syncSubscription(sb, { ...event.data.object, status: 'canceled' });
    } else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object;
      if (inv.subscription) {
        await sb.from('organizations')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_subscription_id', inv.subscription);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      console.log('[stripe webhook] payment_intent.payment_failed', event.data.object?.id);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return res.status(500).json({ error: err?.message });
  }
}

// ============================================================
// Subscription handlers
// ============================================================

// Called after a subscription Checkout completes. Stores the Stripe
// customer id on the org so we can open the Customer Portal later
// without needing the user to re-enter anything.
async function onSubscriptionCheckout(sb, session) {
  const orgId = session.metadata.org_id;
  const customerId = session.customer;
  const subId = session.subscription;
  if (!orgId || !customerId) return;

  await sb.from('organizations').update({
    stripe_customer_id: customerId,
    stripe_subscription_id: subId || undefined,
  }).eq('id', orgId);

  // The customer.subscription.created event will also fire with the
  // tier/period info, but it might arrive before this one. Belt-and-
  // suspenders sync if we already know it.
  if (subId) {
    const sub = event_data_subscription_fetch_safe();
    // Skip — handled by the subscription.created/updated event.
  }
}

// Maps a Stripe Subscription onto the org row: status, tier (derived
// from price id via env-var lookup), current period end, cancel-
// at-period-end flag.
async function syncSubscription(sb, sub) {
  if (!sub?.id) return;
  const orgIdFromMeta = sub.metadata?.org_id;

  // Resolve the org either by metadata or by the Stripe Customer id.
  let orgId = orgIdFromMeta;
  if (!orgId && sub.customer) {
    const { data: o } = await sb.from('organizations')
      .select('id').eq('stripe_customer_id', sub.customer).maybeSingle();
    orgId = o?.id;
  }
  if (!orgId) {
    console.warn('[stripe webhook] subscription event with no resolvable org', sub.id);
    return;
  }

  // Reverse-lookup tier from the price id env vars. Walk the standard
  // 6 entries — fine for 3 tiers x 2 cycles.
  const priceId = sub.items?.data?.[0]?.price?.id;
  let tier = null;
  for (const t of ['solo','crew','business']) {
    for (const b of ['monthly','annual']) {
      const key = `STRIPE_PRICE_${t.toUpperCase()}_${b.toUpperCase()}`;
      if (process.env[key] && process.env[key] === priceId) { tier = t; break; }
    }
    if (tier) break;
  }

  await sb.from('organizations').update({
    stripe_subscription_id: sub.id,
    stripe_customer_id:     sub.customer || undefined,
    subscription_status:    sub.status,
    subscription_tier:      tier,
    subscription_current_period_end:
      sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    subscription_cancel_at_period_end: !!sub.cancel_at_period_end,
  }).eq('id', orgId);
}

// Placeholder kept so onSubscriptionCheckout above stays compilable
// — real period-end + tier sync happens in syncSubscription via the
// subscription.created event.
function event_data_subscription_fetch_safe() { return null; }

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
