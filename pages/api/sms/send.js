import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { sendBrandedSMS, smsReady } from '../../../lib/sms/send';
import {
  jobScheduledSMS,
  invoiceSentSMS,
  paymentReceivedSMS,
} from '../../../lib/sms/templates';

// POST /api/sms/send
//
// Server-side SMS dispatcher mirroring /api/email/send. Callers pass
// a known type + recipient phone + a small data payload; we validate,
// build the body from the right template, and ship via Twilio.
//
// Returns 200 + { ok, skipped } even when Twilio isn't configured —
// the contractor shouldn't see scary errors during the period
// before they (the platform owner) finishes Twilio setup. The
// underlying email is the primary channel; SMS is additive.

export const config = {
  api: { bodyParser: { sizeLimit: '8kb' } },
};

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TYPES = {
  job_scheduled: {
    builder:  jobScheduledSMS,
    required: ['customerName', 'jobTitle', 'scheduledDate'],
  },
  invoice_sent: {
    builder:  invoiceSentSMS,
    required: ['amount', 'invoiceUrl'],
  },
  payment_received: {
    builder:  paymentReceivedSMS,
    required: ['amount'],
  },
};

function isUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  // Short-circuit when Twilio env isn't configured. We return 200 with
  // skipped: true so the caller treats this as a no-op (SMS will start
  // working as soon as the platform owner adds Twilio credentials).
  if (!smsReady()) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'Twilio not configured.' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { type, to, data } = req.body || {};
  const cfg = TYPES[type];
  if (!cfg) return res.status(400).json({ error: 'Unknown SMS type.' });
  if (!to || typeof to !== 'string') return res.status(400).json({ error: 'Recipient phone required.' });

  const safe = data || {};
  for (const k of cfg.required) {
    if (safe[k] === undefined || safe[k] === null || safe[k] === '') {
      return res.status(400).json({ error: `Missing field: ${k}` });
    }
  }
  for (const k of ['invoiceUrl']) {
    if (safe[k] != null && !isUrl(safe[k])) {
      return res.status(400).json({ error: `${k} must be a valid http(s) URL.` });
    }
  }

  // Org branding for the {org.name} placeholder.
  const { data: mem } = await sb.from('org_members')
    .select('org_id').eq('user_id', user.id)
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });

  const { data: org } = await sb.from('organizations')
    .select('name').eq('id', mem.org_id).maybeSingle();

  let body;
  try {
    body = cfg.builder({ org: org || {}, ...safe });
  } catch (e) {
    return res.status(500).json({ error: 'Template build failed.' });
  }

  const result = await sendBrandedSMS({ to, body });
  if (!result.ok && !result.skipped) {
    return res.status(502).json({ error: result.error || 'Send failed.' });
  }
  return res.status(200).json({ ok: true, sid: result.sid || null, skipped: !!result.skipped });
}
