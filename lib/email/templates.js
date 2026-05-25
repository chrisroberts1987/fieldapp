// Branded HTML email templates. Every template wraps its body in the
// shared shell so:
//   • the contractor's business name (and logo if uploaded) appears
//     at the top
//   • a small "Powered by MyForeman" line lives at the bottom
//   • plain-text fallbacks are produced for clients that strip HTML
// All inline CSS — most email clients strip <style> blocks.

const FOOTER_TEXT = '— Powered by MyForeman · myforemanhq.com';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function shell({ orgName, orgLogo, bodyHtml }) {
  const safeName = escapeHtml(orgName || 'Your contractor');
  const logo = orgLogo
    ? `<img src="${escapeHtml(orgLogo)}" alt="${safeName}" style="max-height:42px;display:block;margin-bottom:6px;border:0;outline:none;">`
    : '';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeName}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1f2b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="padding:24px 28px 12px;border-bottom:1px solid #eef0f4;">
          ${logo}
          <div style="font-size:13px;font-weight:600;color:#1a1f2b;letter-spacing:.02em;">${safeName}</div>
        </td></tr>
        <tr><td style="padding:22px 28px 26px;font-size:15px;line-height:1.55;color:#1a1f2b;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:14px 28px 18px;border-top:1px solid #eef0f4;font-size:11px;color:#8a93a3;text-align:center;">
          Powered by <a href="https://myforemanhq.com" style="color:#8a93a3;text-decoration:underline;">MyForeman</a> — myforemanhq.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function ctaButton(href, label) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#4f9eff;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;letter-spacing:.02em;">${escapeHtml(label)}</a>`;
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// Quote sent — customer reviews + approves online
// ============================================================
export function quoteSentEmail({ org, customerName, quoteTitle, amount, approvalUrl, validUntil }) {
  const name = customerName || 'there';
  const intro = `Thanks for the chance to bid this work. Here's the quote we put together for you.`;
  const validLine = validUntil ? `<p style="margin:0 0 12px;color:#4a5468;font-size:13px;">Valid through ${escapeHtml(validUntil)}.</p>` : '';
  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">${intro}</p>
    <div style="margin:18px 0;padding:14px 16px;background:#f5f7fb;border-radius:8px;">
      <div style="font-size:12px;color:#7a8395;letter-spacing:.06em;text-transform:uppercase;font-weight:600;">${escapeHtml(quoteTitle || 'Quote')}</div>
      <div style="font-size:28px;font-weight:700;color:#1a1f2b;letter-spacing:.01em;margin-top:4px;">${fmtMoney(amount)}</div>
      ${validLine}
    </div>
    <p style="margin:0 0 16px;">Tap below to review the full details and approve. No account needed.</p>
    <p style="margin:0 0 18px;">${ctaButton(approvalUrl, 'Review & Approve')}</p>
    <p style="margin:18px 0 0;color:#4a5468;font-size:13px;">Reply to this email with any questions.</p>
    <p style="margin:6px 0 0;color:#4a5468;font-size:13px;">— ${escapeHtml(org.name || 'Your contractor')}</p>
  `;
  return {
    subject: `Quote from ${org.name || 'us'}: ${quoteTitle || 'Your project'} — ${fmtMoney(amount)}`,
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text: `Hi ${name},\n\n${intro}\n\n${quoteTitle || 'Quote'}: ${fmtMoney(amount)}${validUntil ? `\nValid through ${validUntil}` : ''}\n\nReview & approve: ${approvalUrl}\n\nReply to this email with any questions.\n— ${org.name || 'Your contractor'}\n\n${FOOTER_TEXT}`,
  };
}

// ============================================================
// Invoice sent — customer can view the invoice
// ============================================================
export function invoiceSentEmail({ org, customerName, invoiceNumber, amount, invoiceUrl, dueDate }) {
  const name = customerName || 'there';
  const due = dueDate ? `<p style="margin:0 0 12px;color:#4a5468;font-size:13px;">Due ${escapeHtml(dueDate)}.</p>` : '';
  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Here's the invoice for the work we completed. Thanks again for your business.</p>
    <div style="margin:18px 0;padding:14px 16px;background:#f5f7fb;border-radius:8px;">
      <div style="font-size:12px;color:#7a8395;letter-spacing:.06em;text-transform:uppercase;font-weight:600;">${escapeHtml(invoiceNumber || 'Invoice')}</div>
      <div style="font-size:28px;font-weight:700;color:#1a1f2b;margin-top:4px;">${fmtMoney(amount)}</div>
      ${due}
    </div>
    ${invoiceUrl ? `<p style="margin:0 0 18px;">${ctaButton(invoiceUrl, 'View Invoice')}</p>` : ''}
    <p style="margin:18px 0 0;color:#4a5468;font-size:13px;">Reply to this email with any questions.</p>
    <p style="margin:6px 0 0;color:#4a5468;font-size:13px;">— ${escapeHtml(org.name || 'Your contractor')}</p>
  `;
  return {
    subject: `Invoice from ${org.name || 'us'}: ${invoiceNumber || ''} — ${fmtMoney(amount)}`.trim(),
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text: `Hi ${name},\n\nHere's the invoice for the work we completed.\n\n${invoiceNumber || 'Invoice'}: ${fmtMoney(amount)}${dueDate ? `\nDue ${dueDate}` : ''}${invoiceUrl ? `\n\nView: ${invoiceUrl}` : ''}\n\nReply with any questions.\n— ${org.name || 'Your contractor'}\n\n${FOOTER_TEXT}`,
  };
}

// ============================================================
// Invoice reminder — three flavors (7d / 14d / 30d). Tone gets
// progressively firmer but stays professional and reply-friendly.
// ============================================================
export function invoiceReminderEmail({ org, customerName, invoiceNumber, amount, issuedDate, daysOverdue, stage }) {
  const name = customerName || 'there';
  const invLabel = invoiceNumber || 'the invoice';

  let opener, urgency, closer, subject;
  if (stage === 7) {
    opener  = `Just a friendly heads-up — our records show ${invLabel} for ${fmtMoney(amount)} (issued ${issuedDate}) hasn't been marked paid on our end.`;
    urgency = `It happens — invoices get buried in inboxes. If you've already paid, please disregard. Otherwise, we'd appreciate getting it squared away.`;
    closer  = `Thanks for being a customer.`;
    subject = `Friendly reminder: ${invLabel} — ${fmtMoney(amount)}`;
  } else if (stage === 14) {
    opener  = `Following up on ${invLabel} for ${fmtMoney(amount)}, which is now <strong style="color:#1a1f2b;">${daysOverdue} days past due</strong>.`;
    urgency = `If there's a question about the work, the amount, or the payment timeline, please reply to this email and we'll get it sorted right away.`;
    closer  = `We appreciate your prompt attention.`;
    subject = `Past due (${daysOverdue} days): ${invLabel} — ${fmtMoney(amount)}`;
  } else {
    // 30+ day stage
    opener  = `${invLabel} for ${fmtMoney(amount)} is now <strong style="color:#1a1f2b;">${daysOverdue} days past due</strong>. This is our final automated reminder before we follow up directly.`;
    urgency = `If payment has already been sent, please reply with the date and method so we can match it up on our end. If there's a dispute, let's discuss — reply to this email and we'll work it out.`;
    closer  = `We value working with you and want to keep it that way.`;
    subject = `Final reminder (${daysOverdue} days past due): ${invLabel} — ${fmtMoney(amount)}`;
  }

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">${opener}</p>
    <div style="margin:18px 0;padding:14px 16px;background:#f5f7fb;border-radius:8px;">
      <div style="font-size:12px;color:#7a8395;letter-spacing:.06em;text-transform:uppercase;font-weight:600;">${escapeHtml(invLabel)}</div>
      <div style="font-size:28px;font-weight:700;color:#1a1f2b;margin-top:4px;">${fmtMoney(amount)}</div>
      <div style="font-size:13px;color:#4a5468;margin-top:4px;">Issued ${escapeHtml(issuedDate)} · ${daysOverdue} days past due</div>
    </div>
    <p style="margin:0 0 16px;">${urgency}</p>
    <p style="margin:18px 0 0;color:#4a5468;font-size:13px;">${closer}</p>
    <p style="margin:6px 0 0;color:#4a5468;font-size:13px;">— ${escapeHtml(org.name || 'Your contractor')}</p>
  `;
  return {
    subject,
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text:
      `Hi ${name},\n\n${opener.replace(/<[^>]+>/g, '')}\n\n` +
      `${invLabel}: ${fmtMoney(amount)}\n` +
      `Issued ${issuedDate} — ${daysOverdue} days past due.\n\n` +
      `${urgency}\n\n${closer}\n— ${org.name || 'Your contractor'}\n\n${FOOTER_TEXT}`,
  };
}

// ============================================================
// Payment received — branded receipt for the customer
// ============================================================
// Fires alongside the feedback request (separate email so the
// receipt isn't tangled up with the review ask). Customer also
// gets Stripe's own card receipt when paying by card — this one
// is the contractor-branded acknowledgement that covers all
// payment methods (cash, check, Zelle, Venmo, etc).
export function paymentReceivedEmail({ org, customerName, invoiceNumber, amount, paidVia, paidDate, invoiceUrl }) {
  const name = customerName || 'there';
  const methodLabel = paidViaLabel(paidVia);
  const dateLine = paidDate
    ? `<tr><td style="padding:6px 0;color:#7a8395;font-size:13px;">Date</td><td style="padding:6px 0;text-align:right;color:#1a1f2b;font-size:13px;font-weight:600;">${escapeHtml(paidDate)}</td></tr>`
    : '';
  const methodLine = methodLabel
    ? `<tr><td style="padding:6px 0;color:#7a8395;font-size:13px;">Method</td><td style="padding:6px 0;text-align:right;color:#1a1f2b;font-size:13px;font-weight:600;">${escapeHtml(methodLabel)}</td></tr>`
    : '';
  const invoiceLink = invoiceUrl
    ? `<p style="margin:18px 0 0;text-align:center;"><a href="${invoiceUrl}" style="color:#4f9eff;font-size:13px;text-decoration:underline;">View invoice ↗</a></p>`
    : '';
  const body = `
    <p style="margin:0 0 6px;font-size:16px;color:#1a1f2b;"><strong>Payment received.</strong> Thank you, ${escapeHtml(name)}.</p>
    <p style="margin:0 0 18px;color:#4a5468;font-size:14px;">This email confirms we received your payment in full. Hang onto this for your records.</p>
    <div style="margin:18px 0;padding:16px 18px;background:#f5f7fb;border-radius:8px;">
      <div style="font-size:11px;color:#7a8395;letter-spacing:.06em;text-transform:uppercase;font-weight:600;margin-bottom:4px;">Amount paid</div>
      <div style="font-size:30px;font-weight:700;color:#1a1f2b;line-height:1;">${fmtMoney(amount)}</div>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        ${invoiceNumber ? `<tr><td style="padding:6px 0;color:#7a8395;font-size:13px;">Invoice</td><td style="padding:6px 0;text-align:right;color:#1a1f2b;font-size:13px;font-weight:600;">${escapeHtml(invoiceNumber)}</td></tr>` : ''}
        ${dateLine}
        ${methodLine}
      </table>
    </div>
    ${invoiceLink}
    <p style="margin:22px 0 0;color:#4a5468;font-size:13px;">If anything looks off, reply to this email and we'll sort it out.</p>
    <p style="margin:6px 0 0;color:#4a5468;font-size:13px;">— ${escapeHtml(org.name || 'Your contractor')}</p>
  `;
  return {
    subject: `Payment received from ${org.name || 'us'} — ${fmtMoney(amount)}`,
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text: `Hi ${name},\n\nPayment received. Thank you.\n\nAmount: ${fmtMoney(amount)}${invoiceNumber ? `\nInvoice: ${invoiceNumber}` : ''}${paidDate ? `\nDate: ${paidDate}` : ''}${methodLabel ? `\nMethod: ${methodLabel}` : ''}${invoiceUrl ? `\n\nView invoice: ${invoiceUrl}` : ''}\n\nIf anything looks off, reply to this email and we'll sort it out.\n\n— ${org.name || 'Your contractor'}\n\n${FOOTER_TEXT}`,
  };
}

function paidViaLabel(v) {
  if (!v) return null;
  const map = {
    stripe: 'Credit card',
    cash:   'Cash',
    check:  'Check',
    zelle:  'Zelle',
    venmo:  'Venmo',
    ach:    'ACH / bank transfer',
    other:  'Other',
  };
  return map[v] || v;
}

// ============================================================
// Invoice paid — feedback request to customer
// ============================================================
export function invoicePaidFeedbackEmail({ org, customerName, amount, feedbackUrl }) {
  const name = customerName || 'there';
  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Thanks for the ${fmtMoney(amount)} payment — it's received.</p>
    <p style="margin:0 0 16px;">Could you take 30 seconds to tell us how we did? It really helps us out, and feedback from customers like you is how we keep getting better.</p>
    <p style="margin:0 0 18px;">${ctaButton(feedbackUrl, 'Leave Feedback')}</p>
    <p style="margin:18px 0 0;color:#4a5468;font-size:13px;">Thanks again,</p>
    <p style="margin:0;color:#4a5468;font-size:13px;">— ${escapeHtml(org.name || 'Your contractor')}</p>
  `;
  return {
    subject: `Thanks for the payment — quick favor?`,
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text: `Hi ${name},\n\nThanks for the ${fmtMoney(amount)} payment — it's received.\n\nCould you take 30 seconds to tell us how we did? It really helps us out.\n\n${feedbackUrl}\n\nThanks again,\n— ${org.name || 'Your contractor'}\n\n${FOOTER_TEXT}`,
  };
}

// ============================================================
// Job completed — customer notification
// ============================================================
export function jobCompletedEmail({ org, customerName, jobTitle, description }) {
  const name = customerName || 'there';
  const desc = description ? `<p style="margin:0 0 14px;color:#4a5468;">${escapeHtml(description)}</p>` : '';
  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 14px;">Quick note that we've wrapped up <strong>${escapeHtml(jobTitle || 'your job')}</strong>.</p>
    ${desc}
    <p style="margin:14px 0 0;">An invoice will follow shortly. If anything's off or you have questions, just reply to this email.</p>
    <p style="margin:18px 0 0;color:#4a5468;font-size:13px;">Thanks,</p>
    <p style="margin:0;color:#4a5468;font-size:13px;">— ${escapeHtml(org.name || 'Your contractor')}</p>
  `;
  return {
    subject: `Job complete: ${jobTitle || 'Update from ' + (org.name || 'us')}`,
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text: `Hi ${name},\n\nQuick note that we've wrapped up ${jobTitle || 'your job'}.${description ? '\n\n' + description : ''}\n\nAn invoice will follow shortly. If anything's off or you have questions, just reply.\n\nThanks,\n— ${org.name || 'Your contractor'}\n\n${FOOTER_TEXT}`,
  };
}

// ============================================================
// Crew invite — invitee joins org
// ============================================================
export function crewInviteEmail({ org, role, inviteUrl, payRate }) {
  const roleLabel = ({ admin:'Foreman', dispatcher:'Supervisor', crew:'Crew Member' })[role] || 'Crew Member';
  const payLine = payRate ? `<p style="margin:0 0 14px;color:#4a5468;">Pay rate: <strong>$${Number(payRate).toFixed(2)}/hr</strong></p>` : '';
  const body = `
    <p style="margin:0 0 14px;">You've been invited to join <strong>${escapeHtml(org.name || 'the team')}</strong> on MyForeman as a <strong>${escapeHtml(roleLabel)}</strong>.</p>
    ${payLine}
    <p style="margin:0 0 16px;">Tap below to accept the invite, set up your account, and see what's scheduled.</p>
    <p style="margin:0 0 18px;">${ctaButton(inviteUrl, 'Accept Invite')}</p>
    <p style="margin:18px 0 0;color:#4a5468;font-size:13px;">If you weren't expecting this, you can ignore the email — nothing will be set up.</p>
  `;
  return {
    subject: `${org.name || 'A contractor'} invited you to join their crew`,
    html: shell({ orgName: org.name, orgLogo: org.logo_url, bodyHtml: body }),
    text: `You've been invited to join ${org.name || 'the team'} on MyForeman as a ${roleLabel}.${payRate ? `\n\nPay rate: $${Number(payRate).toFixed(2)}/hr` : ''}\n\nAccept here: ${inviteUrl}\n\nIf you weren't expecting this, you can ignore the email.\n\n${FOOTER_TEXT}`,
  };
}
