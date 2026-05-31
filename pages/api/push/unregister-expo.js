import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

// Native app calls this on logout — deletes the device's Expo push
// token from the registry so the next person to sign in on that
// device doesn't inherit the prior user's notifications.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { expoToken } = req.body || {};
  if (!expoToken || typeof expoToken !== 'string') {
    return res.status(400).json({ error: 'expoToken (string) required.' });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Push not configured.' });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Scope the delete to the caller's user_id so a malicious client
  // can't sweep someone else's tokens by guessing token strings.
  await sb.from('expo_push_tokens').delete()
    .eq('token', expoToken)
    .eq('user_id', user.id);

  return res.status(200).json({ ok: true });
}
