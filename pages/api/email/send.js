import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { sendBrandedEmail } from '../../../lib/email/send';
import {
  quoteSentEmail,
  invoiceSentEmail,
  invoicePaidFeedbackEmail,
  jobCompletedEmail,
  crewInviteEmail,
} from '../../../lib/email/templates';

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Each type maps to (a) the template builder and (b) the list of fields
// it expects in `data`. The endpoint validates `data` server-side so a
// malformed client call gets a clean 400 instead of a vague Resend error.
const TYPES = {
  quote_sent: {
    template: quoteSentEmail,
    required: ['customerName', 'quoteTitle', 'amount', 'approvalUrl'],
  },
  invoice_sent: {
    template: invoiceSentEmail,
    required: ['customerName', 'invoiceNumber', 'amount'],
  },
  invoice_paid_feedback: {
    template: invoicePaidFeedbackEmail,
    required: ['customerName', 'amount', 'feedbackUrl'],
  },
  job_completed: {
    template: jobCompletedEmail,
    required: ['customerName', 'jobTitle'],
  },
  crew_invite: {
    template: crewInviteEmail,
    required: ['role', 'inviteUrl'],
  },
};

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 254;
}
function isUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { type, to, data } = req.body || {};
  const cfg = TYPES[type];
  if (!cfg) return res.status(400).json({ error: 'Unknown email type.' });
  if (!isEmail(to)) return res.status(400).json({ error: 'Recipient email is invalid.' });

  const safe = data || {};
  for (const k of cfg.required) {
    if (safe[k] === undefined || safe[k] === null || safe[k] === '') {
      return res.status(400).json({ error: `Missing field: ${k}` });
    }
  }
  // URL fields, where present, must be http(s).
  for (const k of ['approvalUrl', 'invoiceUrl', 'feedbackUrl', 'inviteUrl']) {
    if (safe[k] != null && !isUrl(safe[k])) {
      return res.status(400).json({ error: `${k} must be a valid http(s) URL.` });
    }
  }

  // Look up the caller's org for branding. We use the user's session so
  // RLS confirms they're a member — they can only send "as" an org they
  // belong to.
  const { data: mem } = await sb.from('org_members')
    .select('org_id').eq('user_id', user.id)
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });

  const { data: org } = await sb.from('organizations')
    .select('name, business_email, logo_url')
    .eq('id', mem.org_id).maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  let built;
  try {
    built = cfg.template({ org, ...safe });
  } catch (e) {
    return res.status(500).json({ error: 'Template build failed: ' + (e?.message || 'unknown') });
  }

  const result = await sendBrandedEmail({
    org,
    to,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
  if (!result.ok) return res.status(502).json({ error: result.error || 'Send failed.' });

  return res.status(200).json({ ok: true, id: result.id || null, skipped: result.skipped || false });
}
