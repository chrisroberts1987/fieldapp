import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../../lib/apiSecurity';
import { stripe, stripeReady } from '../../../../lib/stripe';

// POST /api/stripe/connect/start
//
// Owner-only. Creates a Stripe Standard connected account for the
// org (if one doesn't exist yet) and returns an account-onboarding
// link. The user clicks it, completes Stripe's KYC flow, and lands
// back on /settings — we then re-check status to confirm.
//
// We deliberately use Standard (not Express): the contractor owns
// their relationship with Stripe end-to-end, can log into the full
// Stripe dashboard, and the customer's bank statement shows the
// contractor's business name. Platform-fee is zero — contractors
// keep 100% of customer payments. Our revenue comes only from the
// SaaS subscription on the platform account.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function origin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  if (!stripeReady()) {
    return res.status(503).json({ error: 'Stripe is not configured on this deployment.' });
  }

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  // Owner-only check. We need the user's org and their role within it.
  const { data: mem } = await sb.from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });
  if (mem.role !== 'owner') {
    return res.status(403).json({ error: 'Only the org owner can connect a Stripe account.' });
  }

  const { data: org } = await sb.from('organizations')
    .select('id, name, business_email, stripe_connect_account_id')
    .eq('id', mem.org_id)
    .maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  const s = stripe();
  let accountId = org.stripe_connect_account_id;

  // First-time setup: create the connected account. We pre-fill
  // business_profile from what we know so onboarding has less to ask
  // for. The contractor still confirms / edits everything in Stripe.
  if (!accountId) {
    try {
      const account = await s.accounts.create({
        type: 'standard',
        email: org.business_email || user.email,
        business_profile: {
          name: org.name,
          url: `${origin(req)}`,
        },
        metadata: { org_id: org.id, owner_user_id: user.id },
      });
      accountId = account.id;

      // Persist before generating the link — if the user abandons
      // mid-onboarding we still know which account to refresh later.
      await sb.from('organizations')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_updated_at: new Date().toISOString(),
        })
        .eq('id', org.id);
    } catch (e) {
      return res.status(502).json({ error: e?.message || 'Could not create Stripe account.' });
    }
  }

  // Account link sends them to Stripe-hosted onboarding. The link is
  // single-use and expires in ~5 minutes — refresh_url brings them
  // back if they bail. return_url is hit on success. Callers can
  // request 'dashboard' to land newly-onboarded users on the main
  // app; default is /settings (the canonical management surface).
  const returnTo = req.body?.return_to === 'dashboard' ? '/dashboard' : '/settings';
  try {
    const link = await s.accountLinks.create({
      account: accountId,
      refresh_url: `${origin(req)}${returnTo}?connect=refresh`,
      return_url:  `${origin(req)}${returnTo}?connect=return`,
      type: 'account_onboarding',
    });
    return res.status(200).json({ url: link.url, account_id: accountId });
  } catch (e) {
    return res.status(502).json({ error: e?.message || 'Could not create onboarding link.' });
  }
}
