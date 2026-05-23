import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

// Stores a Web Push subscription for the currently signed-in user.
// The client calls this after pushManager.subscribe() succeeds.
// Subsequent calls with the same endpoint upsert (so reinstalling
// the app doesn't pile up dead rows).

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'subscription required.' });
  }
  const { endpoint, keys } = subscription;
  if (!keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'subscription keys missing.' });
  }

  const ua = (req.headers['user-agent'] || '').slice(0, 500);

  // Upsert on endpoint — re-subscribe replaces the old row's keys/UA.
  const { error } = await sb
    .from('push_subscriptions')
    .upsert({
      user_id:    user.id,
      endpoint,
      p256dh:     keys.p256dh,
      auth:       keys.auth,
      user_agent: ua,
    }, { onConflict: 'endpoint' });
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true });
}
