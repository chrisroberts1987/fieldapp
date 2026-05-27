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

// Trial expiring soon — sent from a daily cron.
export function trialEndingSMS({ daysLeft }) {
  const n = Math.max(0, Number(daysLeft) || 0);
  if (n === 0) return `Your MyForeman trial ends today. Pick a plan to keep your tools, customers, and history. https://www.myforemanhq.com/billing`;
  return `Your MyForeman trial ends in ${n} day${n === 1 ? '' : 's'}. Pick a plan to keep your tools and history. https://www.myforemanhq.com/billing`;
}

export { trim, fmt$ };
