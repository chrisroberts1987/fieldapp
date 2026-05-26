// Sends a simple "here's your portal link" email. Used by the
// EMAIL TO CUSTOMER button on the customer detail page. Branded
// with the caller's org so the From line reads like their business.

import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { sendBrandedEmail } from '../../../lib/email/send';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 254;
}
function isUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
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

  const { to, url, customerName } = req.body || {};
  if (!isEmail(to)) return res.status(400).json({ error: 'Recipient email is invalid.' });
  if (!isUrl(url))  return res.status(400).json({ error: 'URL must be http(s).' });

  const { data: mem } = await sb.from('org_members')
    .select('org_id').eq('user_id', user.id)
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!mem) return res.status(403).json({ error: 'No org membership.' });

  const { data: org } = await sb.from('organizations')
    .select('name, business_email, logo_url')
    .eq('id', mem.org_id).maybeSingle();

  const safeName = customerName ? String(customerName).slice(0, 80) : 'there';
  const html = `
    <p>Hi ${escapeHtml(safeName)},</p>
    <p>You can view your quotes, scheduled jobs, and invoices any time at the link below. No login needed.</p>
    <p style="margin:18px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#4f9eff;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;">Open My Portal</a></p>
    <p style="font-size:13px;color:#555;">Or copy this URL: <br>${escapeHtml(url)}</p>
    <p>— ${escapeHtml(org?.name || 'Your contractor')}</p>
  `;
  const text = `Hi ${safeName},\n\nView your quotes, jobs, and invoices: ${url}\n\n— ${org?.name || 'Your contractor'}`;

  const result = await sendBrandedEmail({
    org: org || { name: 'Your contractor' },
    to,
    subject: `Your portal — ${org?.name || 'view your account'}`,
    html, text,
  });
  if (!result.ok) return res.status(502).json({ error: result.error || 'Send failed.' });
  return res.status(200).json({ ok: true });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
