import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { stripe, stripeReady } from '../../../lib/stripe';
import { priceIdFor, PLANS } from '../../../lib/billing';

// Creates a Stripe Checkout Session for starting (or switching to) a
// paid plan. Authenticated: the caller must be the org's owner.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  if (!stripeReady()) {
    return res.status(503).json({ error: 'Billing is not configured yet. Try again soon.' });
  }
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  // Resolve user via their JWT (RLS-scoped) for the membership check…
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { tier, billing, return_to } = req.body || {};
  if (!PLANS[tier]) return res.status(400).json({ error: 'Unknown plan tier.' });
  if (!['monthly','annual'].includes(billing)) return res.status(400).json({ error: 'billing must be "monthly" or "annual".' });
  const returnPath = return_to === 'dashboard' ? '/dashboard' : '/billing';

  const priceId = priceIdFor(tier, billing);
  if (!priceId) return res.status(503).json({ error: 'That plan is not available for purchase yet.' });

  // …then a service-role client to mutate the org record after we
  // know which org they own.
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: mem } = await sb.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('role', 'owner').maybeSingle();
  if (!mem) return res.status(403).json({ error: 'Only the org owner can change billing.' });

  const { data: org } = await sb.from('organizations')
    .select('id, name, business_email, stripe_customer_id')
    .eq('id', mem.org_id).maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  const s = stripe();

  // Reuse a Stripe Customer if we have one; otherwise let Checkout
  // create it automatically (subscription mode always creates a
  // Customer — `customer_creation` is a payment-mode-only flag and
  // Stripe rejects it here). We'll pick up the new Customer ID from
  // the webhook. Reusing keeps saved payment methods + invoice
  // history intact for existing subscribers switching plans.
  let customerArg = {};
  if (org.stripe_customer_id) {
    customerArg = { customer: org.stripe_customer_id };
  } else {
    customerArg = {
      customer_email: user.email || org.business_email || undefined,
    };
  }

  // Only apply the 14-day trial when this is a *new* subscription
  // started from onboarding. Existing subscribers switching plans
  // shouldn't get a fresh trial — Stripe would otherwise pause
  // billing for them.
  const isFirstSubscription = !org.stripe_customer_id;
  const trialPeriodDays = (returnPath === '/dashboard' && isFirstSubscription) ? 14 : undefined;

  const origin = req.headers.origin || `https://${req.headers.host}`;
  try {
    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...customerArg,
      success_url: `${origin}${returnPath}?started=1`,
      cancel_url:  `${origin}${returnPath}?cancelled=1`,
      // Metadata so the webhook can wire the subscription back to
      // the right org without trusting client input.
      metadata: { org_id: org.id, tier, billing },
      subscription_data: {
        metadata: { org_id: org.id, tier, billing },
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      },
      allow_promotion_codes: true,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Stripe error.' });
  }
}
