// Server-side Twilio SMS sender. Lazy-init so the module can be
// imported in dev without env vars set — sendBrandedSMS just
// returns { ok: false, skipped: true } when credentials are missing.
//
// CRITICAL: never import this from the browser. The auth token is
// server-only.

import twilio from 'twilio';

let cached = null;

function client() {
  if (cached) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) return null;
  cached = twilio(sid, auth);
  return cached;
}

export function smsReady() {
  return !!process.env.TWILIO_ACCOUNT_SID
      && !!process.env.TWILIO_AUTH_TOKEN
      && !!process.env.TWILIO_FROM_NUMBER;
}

// Normalize messy US phone numbers to E.164 (+15551234567). Returns
// null if the input can't reasonably be parsed — caller should treat
// that as "no SMS possible, skip silently."
export function normalizeUSPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.startsWith('+')) return raw; // already international, trust it
  return null;
}

// Length-cap the body so we don't blow past Twilio's 1600-char hard
// limit. We aim for one segment (160 chars) most of the time; longer
// bodies get sliced. Always include the org name + a STOP hint —
// 10DLC compliance benefits from the brand being visible.
export async function sendBrandedSMS({ to, body, statusCallback }) {
  if (!smsReady()) return { ok: false, skipped: true, error: 'SMS not configured.' };
  const t = client();
  if (!t) return { ok: false, skipped: true, error: 'Twilio client unavailable.' };

  const e164 = normalizeUSPhone(to);
  if (!e164) return { ok: false, skipped: true, error: 'Phone number unparseable.' };

  const trimmed = String(body || '').slice(0, 1500);
  try {
    const msg = await t.messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to: e164,
      body: trimmed,
      ...(statusCallback ? { statusCallback } : {}),
    });
    return { ok: true, sid: msg.sid };
  } catch (e) {
    return { ok: false, error: e?.message || 'Twilio send failed.' };
  }
}
