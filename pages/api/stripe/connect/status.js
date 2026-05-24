import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../../lib/apiSecurity';
import { stripe, stripeReady } from '../../../../lib/stripe';

// POST /api/stripe/connect/status
//
// Pulls the latest account state from Stripe and mirrors it into
// organizations. Called from the Settings → Payments section when
// the user lands back from onboarding, and on demand from the
// "Refresh" button.
//
// Owner-only — we don't want crew querying account-level Stripe data.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;
  if (!stripeReady()) return res.status(503).json({ error: 'Stripe not configured.' });

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { data: mem } = await sb.from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });
  if (mem.role !== 'owner') return res.status(403).json({ error: 'Owner only.' });

  const { data: org } = await sb.from('organizations')
    .select('id, stripe_connect_account_id')
    .eq('id', mem.org_id).maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  if (!org.stripe_connect_account_id) {
    return res.status(200).json({
      connected: false,
      charges_enabled: false,
      payouts_enabled: false,
      requirements_due: false,
    });
  }

  try {
    const s = stripe();
    const account = await s.accounts.retrieve(org.stripe_connect_account_id);
    const reqs = account.requirements || {};
    const requirementsDue =
      (reqs.currently_due?.length || 0) > 0 ||
      (reqs.past_due?.length || 0) > 0;

    await sb.from('organizations').update({
      stripe_connect_charges_enabled: !!account.charges_enabled,
      stripe_connect_payouts_enabled: !!account.payouts_enabled,
      stripe_connect_requirements_due: requirementsDue,
      stripe_connect_updated_at: new Date().toISOString(),
    }).eq('id', org.id);

    return res.status(200).json({
      connected: true,
      account_id: account.id,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      requirements_due: requirementsDue,
      details_submitted: !!account.details_submitted,
    });
  } catch (e) {
    return res.status(502).json({ error: e?.message || 'Stripe status check failed.' });
  }
}
