import { Resend } from 'resend';
import { preflight } from '../../lib/apiSecurity';

// Anonymous contact form. Rate-limited (10/min/IP) via preflight, no
// auth required — anyone who visits /contact can send. Email lands in
// support@myforemanhq.com with Reply-To set to the visitor so a one-tap
// reply goes back to them.

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

const SUPPORT_TO   = process.env.CONTACT_SUPPORT_EMAIL || 'support@myforemanhq.com';
const FROM_DOMAIN  = process.env.RESEND_FROM_EMAIL || 'noreply@myforemanhq.com';

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 254;
}
function clean(s, max) {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  const body = req.body || {};

  // Honeypot — bots fill hidden fields. Quietly accept and drop.
  if (body.website && body.website.length > 0) {
    return res.status(200).json({ ok: true });
  }

  const name    = clean(body.name,    120);
  const email   = clean(body.email,   254);
  const subject = clean(body.subject, 200);
  const message = clean(body.message, 4000);

  if (!name)    return res.status(400).json({ error: 'Name is required.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!subject) return res.status(400).json({ error: 'Subject is required.' });
  if (message.length < 5) return res.status(400).json({ error: 'Tell us a little more in the message.' });

  if (!process.env.RESEND_API_KEY) {
    // In dev / when the key isn't configured: log and treat as success
    // so the UI flow is testable without Resend.
    console.log('[contact] RESEND_API_KEY not set — would have sent:', { name, email, subject });
    return res.status(200).json({ ok: true, skipped: true });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const safeName = name.replace(/[<>"\\]/g, '');

  try {
    const { error } = await resend.emails.send({
      from: `MyForeman Contact <${FROM_DOMAIN}>`,
      to: [SUPPORT_TO],
      replyTo: email,
      subject: `[Contact] ${subject}`,
      text:
        `From: ${name} <${email}>\n` +
        `Subject: ${subject}\n\n` +
        `${message}\n`,
      html:
        `<p><strong>From:</strong> ${escapeHtml(name)} &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</p>` +
        `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>` +
        `<hr style="border:none;border-top:1px solid #eee;margin:14px 0"/>` +
        `<p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(message)}</p>`,
    });
    if (error) return res.status(502).json({ error: error.message || 'Send failed.' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Send failed.' });
  }
}
