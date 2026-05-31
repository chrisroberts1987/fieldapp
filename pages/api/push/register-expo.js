import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

// Native (Expo) push-token registration. The mobile app calls this
// on every launch with the device's current Expo push token. We
// upsert so:
//   - first launch on a fresh install creates the row
//   - subsequent launches bump updated_at (used for quiet-device pruning)
//   - a token that bounced to a different user_id (e.g. account
//     switch on the same device) re-points to the new owner
//
// Authenticated. The caller's JWT identifies the user; the body
// just carries the token (and optional device label for the
// user-facing devices list).

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  // Resolve the caller via their session JWT.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { expoToken, device } = req.body || {};
  if (!expoToken || typeof expoToken !== 'string') {
    return res.status(400).json({ error: 'expoToken (string) required.' });
  }
  // Expo tokens look like "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  // — strict-enough sanity check that catches paste-errors without
  // false-positiving on future format changes.
  if (!expoToken.startsWith('ExponentPushToken[') || !expoToken.endsWith(']')) {
    return res.status(400).json({ error: 'expoToken does not look like a valid Expo push token.' });
  }

  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Push not configured: SUPABASE_SERVICE_ROLE_KEY missing.' });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Upsert on token (unique). If the same token previously belonged
  // to a different user (account-switch on the same phone), the
  // user_id flips and updated_at bumps.
  const now = new Date().toISOString();
  const { error } = await sb
    .from('expo_push_tokens')
    .upsert(
      {
        user_id:    user.id,
        token:      expoToken,
        device:     device ? String(device).slice(0, 80) : null,
        updated_at: now,
      },
      { onConflict: 'token' }
    );
  if (error) {
    console.error('[push:register-expo]', error.message);
    return res.status(500).json({ error: 'Could not save token.' });
  }

  return res.status(200).json({ ok: true });
}
