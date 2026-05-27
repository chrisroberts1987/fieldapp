// Foreman manually replies to a thread. Stores the outbound
// message and ships it via Twilio.

import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { sendBrandedSMS, smsReady } from '../../../lib/sms/send';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: uErr } = await sb.auth.getUser();
  if (uErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { thread_id, body } = req.body || {};
  if (!thread_id || !body?.trim()) return res.status(400).json({ error: 'thread_id + body required.' });

  // RLS will only let the user read threads they have access to.
  const { data: thread } = await sb.from('message_threads')
    .select('id, org_id, phone').eq('id', thread_id).maybeSingle();
  if (!thread) return res.status(404).json({ error: 'Thread not found.' });

  if (!smsReady()) {
    // Still record what they tried to send so the conversation
    // history isn't lost — just flag it.
    await sb.from('messages').insert({
      thread_id: thread.id, org_id: thread.org_id,
      direction: 'outbound', channel: 'sms',
      body: body + ' [NOT SENT — Twilio not configured]',
      sent_by_user: user.id,
    });
    return res.status(503).json({ error: 'Twilio not configured. Message saved but not delivered.' });
  }

  const result = await sendBrandedSMS({ to: thread.phone, body: body.slice(0, 320) });
  await sb.from('messages').insert({
    thread_id: thread.id, org_id: thread.org_id,
    direction: 'outbound', channel: 'sms',
    body: body.slice(0, 320),
    sent_by_user: user.id,
  });
  await sb.from('message_threads').update({ last_at: new Date().toISOString() }).eq('id', thread.id);

  if (!result.ok && !result.skipped) {
    return res.status(502).json({ error: result.error || 'SMS send failed.' });
  }
  return res.status(200).json({ ok: true });
}
