import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { stripe, stripeReady } from '../../../lib/stripe';

// Returns a one-time URL to the Stripe Customer Portal so the org
// owner can manage their subscription (update card, switch plan,
// view invoices, cancel). Stripe handles all of that UI — we just
// vend the redirect.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  if (!stripeReady()) return res.status(503).json({ error: 'Billing not configured.' });
  if (!SERVICE_KEY)  return res.status(500).json({ error: 'Server misconfigured.' });

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: mem } = await sb.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('role', 'owner').maybeSingle();
  if (!mem) return res.status(403).json({ error: 'Only the org owner can open billing.' });

  const { data: org } = await sb.from('organizations')
    .select('stripe_customer_id').eq('id', mem.org_id).maybeSingle();
  if (!org?.stripe_customer_id) {
    return res.status(400).json({ error: 'No active subscription to manage yet. Start a plan first.' });
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Stripe portal error.' });
  }
}
