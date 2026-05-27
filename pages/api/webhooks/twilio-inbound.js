// Inbound SMS webhook from Twilio. Customer texts the contractor's
// number, Twilio POSTs to this endpoint, we:
//   1. Look up the customer by phone across all orgs
//   2. Load their last week of job/invoice context
//   3. Ask Claude to draft a reply
//   4. Send the reply back via Twilio
//   5. Store both messages in message_threads + messages
//   6. Notify the org owner so they can take over if they want
//
// Configure in Twilio: Phone Numbers → Manage → Active numbers →
// pick your number → Messaging → "A MESSAGE COMES IN" webhook →
// POST https://www.myforemanhq.com/api/webhooks/twilio-inbound
//
// We verify the X-Twilio-Signature header so random POSTs to this
// endpoint can't pretend to be Twilio.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendBrandedSMS, smsReady } from '../../../lib/sms/send';

// Let Next.js parse the form-urlencoded body — Vercel's runtime
// pre-buffers the request, so manual stream-reading hangs.
// req.body comes through as an object like { From, To, Body, ... }
// and Twilio's signature still validates because we can reconstruct
// the same sorted-key concatenation server-side.
export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy-init the clients. If we eagerly instantiate at module load
// and any env var is missing, the entire route fails with a 500
// AT IMPORT TIME — which then makes Twilio retry, which spams the
// customer with duplicate messages. Defensive: build on demand,
// inside the try/catch.
function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try { return new Anthropic(); } catch { return null; }
}

// Twilio's signature scheme: HMAC-SHA1 of (URL + sorted-and-
// concatenated POST params), base64. We compute it and compare.
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

// Shorthand for the empty TwiML response Twilio expects. We were
// using res.type() previously — that's an Express helper, not on
// Next's NextApiResponse, so it threw TypeError and Vercel returned
// a 500 page. setHeader is the cross-framework safe choice.
function sendTwiml(res) {
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send('<Response/>');
}

const SYSTEM = `You are a friendly auto-responder for a field service business (HVAC, landscaping, plumbing, handyman, etc). A customer just texted the business — you're helping while the owner is busy.

Voice:
- Plain English, warm, brief. Match the customer's casual tone.
- 1-2 sentences. SMS-length. No long paragraphs.
- Never invent prices, dates, or commitments. If asked, say the owner will confirm shortly.
- If the customer asks about their job: use the context you have. Time slot, status, last visit date are fair game.
- If the customer asks something you can't answer (price changes, complicated scheduling, complaints), say "I've passed this along — <owner first name or org name> will get back to you shortly."
- Sign off with a short "— <org name>" only if it fits naturally. Don't append it to every message.`;

export default async function handler(req, res) {
  // GET ?probe=1 returns a small JSON diagnostic so we can verify
  // env wiring without making Twilio happy. Safe — no secrets, just
  // booleans about which env vars are present.
  if (req.method === 'GET' && req.query?.probe) {
    return res.status(200).json({
      sms_ready: smsReady(),
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_key:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_anthropic_key:!!process.env.ANTHROPIC_API_KEY,
      has_twilio_sid:   !!process.env.TWILIO_ACCOUNT_SID,
      has_twilio_token: !!process.env.TWILIO_AUTH_TOKEN,
      has_twilio_from:  !!process.env.TWILIO_FROM_NUMBER,
      commit: 'fix-type-call',
    });
  }

  // Always-200 contract: Twilio retries 5xx, which double-fires the
  // AI reply. Wrap the whole flow so any unhandled error returns an
  // empty TwiML response — silent for the customer, retry-safe for
  // Twilio. The error gets logged for us to find later.
  try {
    return await handleInbound(req, res);
  } catch (e) {
    console.error('[twilio-inbound] crash:', e?.message || e);
    // TEMP debugging: surface the error message in the response
    // body so we can read it via curl. Twilio still gets 200 so
    // it won't retry. Remove once the underlying bug is found.
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send('crash: ' + (e?.message || String(e)).slice(0, 500));
  }
}

async function handleInbound(req, res) {
  if (req.method !== 'POST') return sendTwiml(res);

  // If Twilio isn't configured at all, we shouldn't have an
  // inbound webhook hitting us. Refuse politely (200 + empty TwiML
  // so Twilio doesn't retry on a misconfigured deploy).
  if (!smsReady()) return sendTwiml(res);

  const sb = getSupabase();
  if (!sb) return sendTwiml(res);

  // req.body is the parsed form object thanks to default bodyParser.
  // Coerce undefined → null and stringify everything so signature
  // matching is consistent (Twilio sends all values as strings).
  const params = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    params[k] = v == null ? '' : String(v);
  }
  const proto  = req.headers['x-forwarded-proto'] || 'https';
  const host   = req.headers['x-forwarded-host'] || req.headers.host;
  const fullUrl = `${proto}://${host}${req.url}`;

  // Signature check. In dev (no signature, no Twilio reaching us)
  // we still let the request through if TWILIO_SKIP_SIG_CHECK=true
  // — useful for local Postman testing.
  if (!process.env.TWILIO_SKIP_SIG_CHECK) {
    const sig = req.headers['x-twilio-signature'];
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken || !verifyTwilioSig(authToken, sig, fullUrl, params)) {
      // Always 200 here too — Twilio gives up faster on a clean
      // 200 than on a 403. Bad signature just gets ignored.
      return sendTwiml(res);
    }
  }

  const fromPhone = normalizePhone(params.From);
  const toPhone   = normalizePhone(params.To);
  const body      = (params.Body || '').trim();
  if (!fromPhone || !body) return sendTwiml(res);

  // Match the customer by phone. The same phone could in theory
  // exist in two orgs (one person hires two contractors); we take
  // the most recent customer record. Imperfect but rare and
  // recoverable — the owner can re-route in the threads UI.
  const { data: cust } = await sb.from('customers')
    .select('id, org_id, name, email, phone')
    .ilike('phone', '%' + fromPhone.slice(-7) + '%') // match by last 7 digits to handle format variance
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If we don't know who this is, log the inbound to a "general"
  // thread on whatever org owns this Twilio number. Today we
  // assume one Twilio number per platform — multi-tenant Twilio
  // routing is a future build.
  let orgId = cust?.org_id;
  if (!orgId) {
    // Best-effort: just pick the first org so the message is captured.
    const { data: anyOrg } = await sb.from('organizations').select('id').limit(1).maybeSingle();
    orgId = anyOrg?.id;
    if (!orgId) return sendTwiml(res);
  }

  // Load the org for name + business email + reply-from number.
  const { data: org } = await sb.from('organizations')
    .select('name, business_email, phone').eq('id', orgId).maybeSingle();

  // Find or create the message thread.
  let { data: thread } = await sb.from('message_threads')
    .select('id').eq('org_id', orgId).eq('phone', fromPhone).maybeSingle();
  if (!thread) {
    const { data: t } = await sb.from('message_threads').insert({
      org_id: orgId, customer_id: cust?.id || null, phone: fromPhone, last_at: new Date().toISOString(),
    }).select('id').single();
    thread = t;
  }

  // Store the inbound message.
  await sb.from('messages').insert({
    thread_id: thread.id, org_id: orgId,
    direction: 'inbound', channel: 'sms', body,
  });
  await sb.from('message_threads').update({ last_at: new Date().toISOString() }).eq('id', thread.id);

  // Notify the org owner with an in-app notification so they know
  // the AI is handling it (and they can take over if they want).
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

  // Build context for the AI. Customer + their recent jobs + open
  // invoices. Trimmed to the essentials so the prompt stays cheap.
  let contextLines = [];
  contextLines.push(`Business: ${org?.name || 'Your contractor'}`);
  if (cust) {
    contextLines.push(`Customer: ${cust.name}`);
    const { data: jobs } = await sb.from('jobs')
      .select('title, status, scheduled_date, scheduled_time')
      .eq('customer_id', cust.id)
      .order('scheduled_date', { ascending: false, nullsFirst: false }).limit(5);
    if (jobs?.length) {
      contextLines.push('Recent jobs:');
      for (const j of jobs) {
        contextLines.push(`  - ${j.title} · ${j.status} · ${j.scheduled_date || 'no date'}${j.scheduled_time ? ' @ ' + j.scheduled_time.slice(0,5) : ''}`);
      }
    }
    const { data: invs } = await sb.from('invoices')
      .select('amount, status, issued_date, paid_date')
      .eq('customer_id', cust.id)
      .order('issued_date', { ascending: false, nullsFirst: false }).limit(3);
    if (invs?.length) {
      contextLines.push('Recent invoices:');
      for (const i of invs) {
        contextLines.push(`  - $${Number(i.amount).toFixed(2)} · ${i.status}${i.paid_date ? ' on ' + i.paid_date : ''}`);
      }
    }
  } else {
    contextLines.push('Customer: UNKNOWN (no match in our system — be especially careful not to confirm any work or pricing).');
  }
  const ctx = contextLines.join('\n');

  // Ask Claude for a reply. Single turn — we don't carry SMS
  // history into the prompt here (could grow that later from the
  // messages table; for an MVP each reply is independent).
  let reply = '';
  const anthropic = getAnthropic();
  if (!anthropic) {
    reply = `Got your message — ${org?.name || 'we'}'ll get back to you shortly.`;
  } else try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      system: SYSTEM + '\n\nContext you have on this customer:\n' + ctx,
      messages: [{ role: 'user', content: body }],
    });
    reply = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (e) {
    reply = `Got your message — ${org?.name || 'we'}'ll get back to you shortly.`;
  }

  if (!reply) reply = `Got your message — ${org?.name || 'we'}'ll get back to you shortly.`;
  // Hard cap to two SMS segments (~320 chars) so we don't blow up
  // costs on a runaway response.
  if (reply.length > 320) reply = reply.slice(0, 317) + '...';

  // Send the reply via Twilio. Best-effort — if it fails we still
  // recorded the inbound + notified the owner.
  const sent = await sendBrandedSMS({ to: fromPhone, body: reply });
  await sb.from('messages').insert({
    thread_id: thread.id, org_id: orgId,
    direction: 'outbound', channel: 'sms', body: reply,
  });

  // Respond with an empty TwiML so Twilio doesn't also send its
  // own auto-reply.
  return sendTwiml(res);
}
