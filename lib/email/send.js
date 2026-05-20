import { Resend } from 'resend';

// Single sender domain. The contractor's business name goes in the From
// name; replies route back to the contractor's own business email via
// the Reply-To header so the customer never sees @myforemanhq.com when
// they hit reply.
const FROM_DOMAIN = process.env.RESEND_FROM_EMAIL || 'noreply@myforemanhq.com';

let resendClient = null;
function client() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) return null;
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// Sanitize the From name. Resend rejects '<', '>', '"' in the display
// part of the address and a contractor name can legitimately contain
// commas or periods, but the angle brackets / quotes would break the
// header.
function safeName(name) {
  return String(name || 'MyForeman').replace(/[<>"\\]/g, '').slice(0, 80).trim() || 'MyForeman';
}

// org: { name, business_email, logo_url }
// to: string | string[]
export async function sendBrandedEmail({ org, to, subject, html, text }) {
  const c = client();
  if (!c) {
    // No-op in dev / when the key isn't configured. Logged at info level
    // so we can spot a misconfiguration in the function logs without
    // erroring the calling flow.
    console.log('[email] RESEND_API_KEY not set — skipping send.', { to, subject });
    return { ok: true, skipped: true };
  }

  const fromName = safeName(org?.name);
  const replyTo  = org?.business_email || undefined;

  try {
    const { data, error } = await c.emails.send({
      from: `${fromName} <${FROM_DOMAIN}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      replyTo,
    });
    if (error) return { ok: false, error: error.message || 'Resend rejected the email.' };
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err?.message || 'Send failed.' };
  }
}
