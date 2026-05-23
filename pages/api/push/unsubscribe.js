import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

// Removes a push subscription for the currently signed-in user.
// Called when the user revokes permission or signs out.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

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

  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint required.' });

  await sb.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
  res.status(200).json({ ok: true });
}
