import { createClient } from '@supabase/supabase-js';

// RevenueCat → Supabase sync for Apple In-App Purchase.
//
// Channel separation policy: web subscribers stay on Stripe forever,
// iOS subscribers stay on Apple forever. This webhook NEVER migrates
// an org between channels. If an Apple event arrives for an org that
// already has a Stripe subscription, the handler acks RevenueCat with
// 200 and refuses to touch the org row. The Apple charge must be
// refunded out of band (App Store Connect → Customer Support, or via
// Apple's refund API).
//
// Configure in RevenueCat:
//   Project Settings → Integrations → Webhooks
//   Authorization header value: `Bearer ${REVENUECAT_WEBHOOK_SECRET}`
//
// Idempotency: every event is logged to public.iap_events keyed on
// revenuecat_event_id. Duplicate POSTs hit the unique constraint
// (Postgres error code 23505) and ack as `duplicate: true` so
// RevenueCat does not retry.

const PRODUCT_TO_TIER = {
  'com.myforeman.app.solo':     'solo',
  'com.myforeman.app.crew':     'crew',
  'com.myforeman.app.business': 'business',
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  // Bearer-token auth. RevenueCat sends whatever Authorization header
  // value we configure in their dashboard.
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { event } = req.body || {};
  if (!event) return res.status(400).json({ error: 'missing event' });

  const eventId  = event.id;
  const type     = event.type;
  const userId   = event.app_user_id;
  const productId = event.product_id || null;

  if (!eventId || !type || !userId) {
    return res.status(400).json({ error: 'missing required fields' });
  }

  // Idempotency: insert the event into the audit log. A duplicate
  // delivery raises 23505 (unique violation) and we ack-and-skip.
  const { data: ins, error: insErr } = await supabase
    .from('iap_events')
    .insert({
      revenuecat_event_id: eventId,
      event_type:          type,
      app_user_id:         userId,
      product_id:          productId,
    })
    .select()
    .maybeSingle();
  if (insErr && insErr.code !== '23505') {
    console.error('[iap webhook] idempotency log failed', insErr);
    return res.status(500).json({ error: 'idempotency log failed' });
  }
  if (!ins) {
    return res.status(200).json({ duplicate: true });
  }

  // Resolve the org that owns this purchase. RevenueCat's
  // app_user_id is the Supabase auth user id, set by the iOS app
  // when initializing the RevenueCat SDK.
  const { data: member, error: memberErr } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle();
  if (memberErr) {
    console.error('[iap webhook] member lookup failed', memberErr);
    return res.status(500).json({ error: 'member lookup failed' });
  }
  if (!member?.org_id) {
    console.warn('[iap webhook] no org for user', { userId, type });
    return res.status(200).json({ ignored: 'no org' });
  }
  const orgId = member.org_id;

  // Resolve tier from product id. Bail cleanly if a purchase-like
  // event arrives with an unknown product so RevenueCat does not
  // retry (and so we never write tier: null on an active sub).
  const tier = productId ? PRODUCT_TO_TIER[productId] || null : null;
  const purchaseLike = [
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
  ].includes(type);
  if (purchaseLike && !tier) {
    console.warn('[iap webhook] unknown product on purchase event', {
      type, productId, orgId,
    });
    return res.status(200).json({ ignored: 'unknown product' });
  }

  // Channel-separation guard. On any event that would establish or
  // re-establish an Apple subscription, refuse if the org is on
  // Stripe. Logs and acks so RevenueCat does not retry, but the org
  // row stays untouched. The Apple charge must be refunded manually.
  if (type === 'INITIAL_PURCHASE' || type === 'PRODUCT_CHANGE') {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('stripe_subscription_id, payment_source')
      .eq('id', orgId)
      .maybeSingle();
    if (orgErr) {
      console.error('[iap webhook] org lookup failed', orgErr);
      return res.status(500).json({ error: 'org lookup failed' });
    }
    if (org?.stripe_subscription_id || org?.payment_source === 'stripe') {
      console.warn('[iap webhook] refusing Stripe to Apple migration', {
        orgId, userId, type, productId,
      });
      // TODO: alert (email / Slack / Sentry) so the Apple charge can
      // be refunded out of band via App Store Connect.
      return res.status(200).json({ ignored: 'stripe subscription exists' });
    }
  }

  // Map RevenueCat event type → subscription_status. Values are
  // constrained by organizations_sub_status_check (migration 0019).
  let status;
  let cancelAtPeriodEnd = false;
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'PRODUCT_CHANGE':
    case 'UNCANCELLATION':
      status = 'active';
      break;
    case 'CANCELLATION':
      // User canceled but access continues until expiration.
      status = 'active';
      cancelAtPeriodEnd = true;
      break;
    case 'EXPIRATION':
      status = 'canceled';
      break;
    case 'BILLING_ISSUE':
      status = 'past_due';
      break;
    default:
      return res.status(200).json({ ignored: type });
  }

  const periodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  const update = {
    payment_source:                    'apple',
    subscription_status:               status,
    subscription_current_period_end:   periodEnd,
    subscription_cancel_at_period_end: cancelAtPeriodEnd,
    revenuecat_app_user_id:            userId,
    apple_original_transaction_id:     event.original_transaction_id || null,
  };
  if (tier) update.subscription_tier = tier;

  const { error: updErr } = await supabase
    .from('organizations')
    .update(update)
    .eq('id', orgId);
  if (updErr) {
    console.error('[iap webhook] org update failed', updErr);
    return res.status(500).json({ error: 'org update failed' });
  }

  return res.status(200).json({ ok: true });
}
