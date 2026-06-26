// Platform-to-contractor SMS templates. Each returns a one-segment
// body (under 160 chars where possible) so we stay on one SMS
// segment, keeping per-message cost at ~$0.008.
//
// We append a short "—MyForeman" only when there's room. The
// recipient is the contractor; they already know who we are once
// they've onboarded, but the brand reminder helps in the first few
// weeks when the Twilio number is unfamiliar.

function trim(s, max = 30) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function fmt$(n) {
  const v = Number(n || 0);
  if (v >= 1000) return '$' + Math.round(v).toLocaleString();
  return '$' + v.toFixed(0);
}

// New lead landed in the contractor's pipeline (booking form, quote
// request, or QR scan).
export function newLeadSMS({ leadName, estimatedValue, source }) {
  const who = trim(leadName, 40) || 'A new lead';
  const val = Number(estimatedValue) > 0 ? ` · ${fmt$(estimatedValue)}` : '';
  const srcLabel = ({
    self_booking: ' (booking link)',
    website:      ' (web form)',
    referral:     ' (referral)',
  })[source] || '';
  return `New lead: ${who}${val}${srcLabel}. Tap Leads in MyForeman to follow up. —MyForeman`;
}

// Customer approved a quote.
export function quoteApprovedSMS({ customerName, amount }) {
  const who = trim(customerName, 40) || 'A customer';
  return `${who} approved your ${fmt$(amount)} quote. Job is in your pipeline. —MyForeman`;
}

// Invoice marked paid (Stripe webhook or manual mark-paid).
export function invoicePaidSMS({ customerName, amount }) {
  const who = trim(customerName, 40) || 'A customer';
  return `${who} just paid ${fmt$(amount)}. Funds en route to your Stripe. —MyForeman`;
}

// Trial expiring soon — sent from a daily cron. Contractors picked a
// plan and attached a card at signup, so the upcoming event is the
// first charge — frame it that way (not "pick a plan") so the message
// matches reality and the contractor knows to cancel if they don't
// want to be billed.
export function trialEndingSMS({ daysLeft }) {
  const n = Math.max(0, Number(daysLeft) || 0);
  if (n === 0) return `Your MyForeman trial ends today. Your card on file will be charged tomorrow. Cancel anytime at https://www.myforemanhq.com/billing`;
  return `Your MyForeman trial ends in ${n} day${n === 1 ? '' : 's'}. Your card on file will be charged after that. Cancel anytime at https://www.myforemanhq.com/billing`;
}

// ============================================================
// CUSTOMER-FACING templates (sent to homeowners, not contractors).
// A2P 10DLC compliance: every message must (a) identify the sender
// (the contractor's business name, NOT MyForeman), (b) include an
// opt-out hint. We always tack on "Reply STOP to opt out." on the
// first outbound to a customer; once they've replied or interacted,
// subsequent sends can omit it within the same campaign window —
// but cheap insurance to keep it on every message.
// ============================================================

const STOP_HINT = 'Reply STOP to opt out.';

export function appointmentConfirmedCustomerSMS({ orgName, dateStr, timeStr, jobTitle }) {
  const who   = trim(orgName, 40) || 'Your contractor';
  const what  = jobTitle ? `: ${trim(jobTitle, 40)}` : '';
  const when  = [dateStr, timeStr].filter(Boolean).join(' at ');
  return `${who}${what} is confirmed for ${when}. We'll text you when we're on our way. ${STOP_HINT}`;
}

export function onMyWayCustomerSMS({ orgName, crewName, etaMins }) {
  const who   = trim(orgName, 40) || 'Your contractor';
  const crew  = crewName ? `${trim(crewName, 30)} from ` : '';
  const eta   = etaMins ? ` (about ${etaMins} min out)` : '';
  return `${crew}${who} is on the way${eta}. ${STOP_HINT}`;
}

// Post-payment text. When a feedbackUrl is provided we fold the
// review ask into the same message — the email already carries the
// full receipt, so the text is purely a "thanks + quick review?"
// rather than two messages back-to-back. Keeps the customer's phone
// from buzzing twice for one event.
export function paymentReceivedCustomerSMS({ orgName, amount, invoiceUrl, feedbackUrl }) {
  const who = trim(orgName, 40) || 'Your contractor';
  if (feedbackUrl) {
    return `${who}: thanks for the ${fmt$(amount)} payment. 30 sec to share how we did? ${feedbackUrl} ${STOP_HINT}`;
  }
  const url = invoiceUrl ? ` ${invoiceUrl}` : '';
  return `${who}: thanks, we received your ${fmt$(amount)} payment.${url} ${STOP_HINT}`;
}

export function feedbackRequestCustomerSMS({ orgName, feedbackUrl }) {
  const who = trim(orgName, 40) || 'Your contractor';
  return `${who}: thanks for your business. Got 30 seconds to tell us how we did? ${feedbackUrl} ${STOP_HINT}`;
}

export function changeOrderRequestCustomerSMS({ orgName, amount, approvalUrl }) {
  const who = trim(orgName, 40) || 'Your contractor';
  return `${who}: change order for ${fmt$(amount)} needs your approval. ${approvalUrl} ${STOP_HINT}`;
}

// Auto-reply when a customer texts STOP. Twilio handles the
// carrier-level opt-out automatically; this message just confirms.
export function stopAckCustomerSMS() {
  return `You're unsubscribed and won't receive more texts from this number. Reply START to resubscribe.`;
}

// Reply to HELP keyword.
export function helpCustomerSMS({ orgName }) {
  const who = trim(orgName, 40) || 'your contractor';
  return `Replies to texts from ${who} are managed by MyForeman. Reply STOP to opt out, START to resubscribe. Support: support@myforemanhq.com`;
}

export { trim, fmt$ };
