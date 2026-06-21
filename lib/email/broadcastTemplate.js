// Platform → contractor broadcast email template. Distinct from the
// contractor → customer templates in templates.js: those wrap content
// in the contractor's own brand (their business name in the header,
// "Powered by MyForeman" in the footer). Broadcasts go the other
// direction — from us to the contractor — so the MyForeman logo sits
// at the top and the footer surfaces the platform's account hint.
//
// The body input is plain text. Single newlines become <br>, double
// newlines (blank line) become paragraph breaks. Everything is
// escaped, so message authors can't inject HTML / scripts.

const BROADCAST_FOOTER =
  "You're receiving this because you have a MyForeman account. Manage your account at myforemanhq.com";

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Convert plain-text body into safe HTML preserving paragraph + line
// breaks, and auto-link bare URLs so the contractor can click out.
function bodyToHtml(text) {
  const paragraphs = String(text || '').split(/\n{2,}/);
  return paragraphs.map(p => {
    const lines = p.split('\n').map(escapeHtml).map(linkify).join('<br/>');
    return `<p style="margin:0 0 14px;">${lines}</p>`;
  }).join('');
}

function linkify(escaped) {
  // Operates on already-escaped HTML, so we only have to match URLs
  // that survived escaping (no <, >, etc. inside).
  return escaped.replace(
    /\bhttps?:\/\/[^\s<]+[^\s<.,)\]"']/g,
    (url) => `<a href="${url}" style="color:#4f9eff;text-decoration:underline;">${url}</a>`
  );
}

export function renderBroadcast({ subject, body }) {
  const safeSubject = escapeHtml(subject || '');
  const bodyHtml    = bodyToHtml(body);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeSubject}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1f2b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td align="center" style="padding:20px 28px;background:#ffffff;border-bottom:1px solid #eef0f4;">
          <a href="https://myforemanhq.com" style="display:inline-block;border:0;outline:none;text-decoration:none;">
            <img src="https://myforemanhq.com/brand/myforeman-logo-horizontal.png" alt="MyForeman" width="200" style="width:200px;max-width:200px;height:auto;display:block;border:0;outline:none;">
          </a>
        </td></tr>
        <tr><td style="padding:22px 28px 26px;font-size:15px;line-height:1.55;color:#1a1f2b;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 28px 18px;border-top:1px solid #eef0f4;font-size:11px;color:#8a93a3;text-align:center;line-height:1.55;">
          ${escapeHtml(BROADCAST_FOOTER)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `${String(body || '').trim()}\n\n— —\n${BROADCAST_FOOTER}`;

  return { html, text };
}
