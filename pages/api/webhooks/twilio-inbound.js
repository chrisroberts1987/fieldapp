// Inbound SMS webhook from Twilio. Customer texts the contractor's
// number, Twilio POSTs to this endpoint, we:
//   1. Match the inbound phone to a customer (best-effort) to find
//      the right org
//   2. Append the message to a message_threads + messages row
//   3. Push an in-app notification to the org owner so they see it
//
// No auto-reply. The owner reads the thread in /messages and texts
// back manually. The AI-receptionist version was scoped out because:
//   - SMS is a trust channel; customers expect a human
//   - A bot quoting commitments creates legal exposure
//   - Carrier filtering / A2P is heavier for automated replies
//   - The owner-notification + manual-reply flow is the actually-
//     useful piece anyway.
//
// Configure in Twilio: Phone Numbers → Manage → Active numbers →
// pick your number → Messaging → "A MESSAGE COMES IN" webhook →
// POST https://www.myforemanhq.com/api/webhooks/twilio-inbound
//
// We verify the X-Twilio-Signature header so random POSTs to this
// endpoint can't pretend to be Twilio.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { smsReady } from '../../../lib/sms/send';

// Let Next.js parse the form-urlencoded body — Vercel's runtime
// pre-buffers the request, so manual stream-reading hangs.
export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Twilio's signature scheme: HMAC-SHA1 of (URL + sorted-and-
// concatenated POST params), base64.
function verifyTwilioSig(authToken, signature, fullUrl, params) {
  const data = Object.keys(params || {}).sort().reduce((s, k) => s + k + params[k], fullUrl);
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  if (!signature || !expected) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}

function normalizePhone(p) {
  return (p || '').replace(/[^\d+]/g, '');
}

// Empty TwiML. NextApiResponse doesn't have Express's .type() —
// setHeader is the cross-framework safe choice.
function sendTwiml(res) {
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send('<Response/>');
}

export default async function handler(req, res) {
  // Always-200 contract: Twilio retries 5xx, which would double-
  // fire any side-effects. Wrap the whole flow so any unhandled
  // error returns an empty TwiML response.
  try {
    return await handleInbound(req, res);
  } catch (e) {
    console.error('[twilio-inbound] crash:', e?.message || e);
    return sendTwiml(res);
  }
}

async function handleInbound(req, res) {
  if (req.method !== 'POST') return sendTwiml(res);
  if (!smsReady())            return sendTwiml(res);

  const sb = getSupabase();
  if (!sb) return sendTwiml(res);

  // req.body is the parsed form object thanks to default bodyParser.
  // Stringify everything for consistent signature matching.
  const params = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    params[k] = v == null ? '' : String(v);
  }
  const proto  = req.headers['x-forwarded-proto'] || 'https';
  const host   = req.headers['x-forwarded-host'] || req.headers.host;
  const fullUrl = `${proto}://${host}${req.url}`;

  // Signature check. TWILIO_SKIP_SIG_CHECK=true lets local Postman
  // testing through without a real signature.
  if (!process.env.TWILIO_SKIP_SIG_CHECK) {
    const sig = req.headers['x-twilio-signature'];
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken || !verifyTwilioSig(authToken, sig, fullUrl, params)) {
      return sendTwiml(res);
    }
  }

  const fromPhone = normalizePhone(params.From);
  const body      = (params.Body || '').trim();
  if (!fromPhone || !body) return sendTwiml(res);

  // Match the customer by phone. Last 7 digits matches across format
  // variance (+15125550190 vs (512) 555-0190 etc).
  const { data: cust } = await sb.from('customers')
    .select('id, org_id, name, phone')
    .ilike('phone', '%' + fromPhone.slice(-7) + '%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If we don't know who this is, fall back to the first org so the
  // text is still captured. Owner can re-route in the threads UI.
  // Future work: multi-tenant routing via per-org Twilio numbers
  // (use the To field), at which point this fallback goes away.
  let orgId = cust?.org_id;
  if (!orgId) {
    const { data: anyOrg } = await sb.from('organizations').select('id').limit(1).maybeSingle();
    orgId = anyOrg?.id;
    if (!orgId) return sendTwiml(res);
  }

  // Find or create the thread.
  let { data: thread } = await sb.from('message_threads')
    .select('id').eq('org_id', orgId).eq('phone', fromPhone).maybeSingle();
  if (!thread) {
    const { data: t } = await sb.from('message_threads').insert({
      org_id: orgId, customer_id: cust?.id || null, phone: fromPhone, last_at: new Date().toISOString(),
    }).select('id').single();
    thread = t;
  }

  // Record the inbound message + bump thread timestamp so it sorts to the top.
  await sb.from('messages').insert({
    thread_id: thread.id, org_id: orgId,
    direction: 'inbound', channel: 'sms', body,
  });
  await sb.from('message_threads').update({ last_at: new Date().toISOString() }).eq('id', thread.id);

  // Ping the owner so they see the message land and can reply.
  const { data: owner } = await sb.from('org_members')
    .select('user_id').eq('org_id', orgId).eq('role', 'owner').limit(1).maybeSingle();
  if (owner?.user_id) {
    await sb.from('notifications').insert({
      org_id: orgId, user_id: owner.user_id, kind: 'inbound_sms',
      title: `Text from ${cust?.name || fromPhone}`,
      body:  body.length > 140 ? body.slice(0, 140) + '…' : body,
      link: '/messages',
    });
  }

  // Empty TwiML so Twilio doesn't tack on its own auto-reply.
  return sendTwiml(res);
}
