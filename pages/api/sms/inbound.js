// Twilio inbound SMS webhook. Set this URL in the Twilio console:
//
//   Phone Numbers → Active Numbers → <your number> → Messaging
//   "A MESSAGE COMES IN":  https://www.myforemanhq.com/api/sms/inbound
//   Method: POST
//
// Twilio POSTs form-urlencoded with at least: From, To, Body, MessageSid.
// We handle the carrier-mandated keywords:
//
//   STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT
//     → set customer.sms_opt_out=true, sms_opt_out_at=now
//   START / YES / UNSTOP
//     → clear sms_opt_out, set sms_opt_in_at=now
//   HELP / INFO
//     → reply with help text
//
// Twilio also handles STOP at the carrier layer (subsequent messages
// to that number fail with code 21610), so this endpoint is BOTH a
// belt-and-suspenders for our own send-gate AND a compliance receipt.
//
// Auth: Twilio signs every request with HMAC-SHA1 of the full URL +
// sorted form params, base64'd into the X-Twilio-Signature header.
// We validate that against TWILIO_AUTH_TOKEN before doing anything.

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { normalizeUSPhone } from '../../../lib/sms/send';
import { stopAckCustomerSMS, helpCustomerSMS } from '../../../lib/sms/templates';

export const config = {
  api: {
    bodyParser: {
      // Twilio sends application/x-www-form-urlencoded — Next's
      // default body parser handles this fine, but we keep the size
      // cap tight since legit Twilio payloads are tiny.
      sizeLimit: '8kb',
    },
  },
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.myforemanhq.com';

const STOP_WORDS  = new Set(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT']);
const START_WORDS = new Set(['START','YES','UNSTOP']);
const HELP_WORDS  = new Set(['HELP','INFO']);

function twimlEmpty() {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}
function twimlReply(text) {
  // Escape for XML — Twilio's TwiML expects entity-encoded body.
  const safe = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // ---- Twilio signature validation -------------------------------
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  if (!authToken) {
    // Mis-configured environment. Don't blindly trust the payload —
    // 500 so Twilio retries and we get an alert.
    return res.status(500).send('SMS inbound not configured.');
  }
  if (!signature) {
    return res.status(403).send('Missing signature.');
  }
  // Twilio signs the FULL URL it POSTed to. Behind Vercel's proxy we
  // need to reconstruct: scheme + host + path. Use SITE_URL for the
  // host so dev tunnels (where req.headers.host might be ngrok) don't
  // break verification — set NEXT_PUBLIC_SITE_URL to the dev tunnel
  // when testing locally.
  const fullUrl = `${SITE_URL.replace(/\/$/, '')}${req.url}`;
  const valid = twilio.validateRequest(authToken, signature, fullUrl, req.body || {});
  if (!valid) {
    console.warn('[sms:inbound] bad signature from', req.body?.From);
    return res.status(403).send('Bad signature.');
  }

  const fromRaw = req.body?.From;
  const body    = String(req.body?.Body || '').trim();
  const phone   = normalizeUSPhone(fromRaw);
  if (!phone) return res.status(200).send(twimlEmpty());

  if (!SERVICE_KEY) {
    // Acknowledge so Twilio doesn't retry forever; we silently drop.
    return res.status(200).send(twimlEmpty());
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look the customer up by phone. There may be multiple customers
  // across orgs sharing a number (rare) — we apply the opt-out to
  // every match so STOP genuinely stops everything.
  const phoneVariants = phoneVariants_(phone);
  const { data: matches } = await sb.from('customers')
    .select('id, org_id, name')
    .in('phone', phoneVariants);

  const word = body.toUpperCase().split(/\s+/)[0] || '';
  const now  = new Date().toISOString();

  if (STOP_WORDS.has(word)) {
    if (matches?.length) {
      await sb.from('customers')
        .update({ sms_opt_out: true, sms_opt_out_at: now })
        .in('id', matches.map(m => m.id));
      // Audit one log row per matched org so each contractor sees
      // the opt-out in their customer's history.
      for (const m of matches) {
        await sb.from('customer_sms_log').insert({
          org_id: m.org_id, customer_id: m.id, kind: 'inbound_stop',
          direction: 'inbound', phone, body, ok: true,
        });
      }
    }
    return res.status(200).send(twimlReply(stopAckCustomerSMS()));
  }

  if (START_WORDS.has(word)) {
    if (matches?.length) {
      await sb.from('customers')
        .update({ sms_opt_out: false, sms_opt_in_at: now, sms_opt_out_at: null })
        .in('id', matches.map(m => m.id));
      for (const m of matches) {
        await sb.from('customer_sms_log').insert({
          org_id: m.org_id, customer_id: m.id, kind: 'inbound_start',
          direction: 'inbound', phone, body, ok: true,
        });
      }
    }
    return res.status(200).send(twimlReply(
      `You're resubscribed. Reply STOP at any time to opt out again.`
    ));
  }

  if (HELP_WORDS.has(word)) {
    const orgName = matches?.[0]?.name ? null : null; // org name lookup happens via FK; the first matching org is good enough.
    // Best-effort fetch of one org's name so the reply addresses it.
    let orgLabel = null;
    if (matches?.length) {
      const { data: o } = await sb.from('organizations')
        .select('name').eq('id', matches[0].org_id).maybeSingle();
      orgLabel = o?.name || null;
    }
    for (const m of (matches || [])) {
      await sb.from('customer_sms_log').insert({
        org_id: m.org_id, customer_id: m.id, kind: 'inbound_help',
        direction: 'inbound', phone, body, ok: true,
      });
    }
    return res.status(200).send(twimlReply(helpCustomerSMS({ orgName: orgLabel })));
  }

  // Everything else: log it, no reply. Two-way conversational SMS is
  // out of scope for now — customers who text back arbitrary content
  // get silence, which Twilio + carriers tolerate fine.
  for (const m of (matches || [])) {
    await sb.from('customer_sms_log').insert({
      org_id: m.org_id, customer_id: m.id, kind: 'inbound_other',
      direction: 'inbound', phone, body, ok: true,
    });
  }
  return res.status(200).send(twimlEmpty());
}

// Numbers may be stored in customers.phone in any of several formats
// (E.164, "(512) 555-0100", "5125550100", etc.) since the column is
// free-text. Generate the variants that COULD match what's stored so
// the IN-list catches them. Cheap.
function phoneVariants_(e164) {
  const digits = e164.replace(/\D+/g, '').replace(/^1/, '');
  if (digits.length !== 10) return [e164];
  const area = digits.slice(0,3);
  const mid  = digits.slice(3,6);
  const last = digits.slice(6);
  return [
    e164,                     // +15125550100
    `1${digits}`,             // 15125550100
    digits,                   // 5125550100
    `${area}-${mid}-${last}`, // 512-555-0100
    `(${area}) ${mid}-${last}`,
    `${area}.${mid}.${last}`,
    `+1${digits}`,
  ];
}
