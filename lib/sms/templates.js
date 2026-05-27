// SMS templates. Reserved for platform-to-contractor notifications
// (new lead landed, quote approved, invoice paid, trial ending).
// Customer-facing templates were removed — MyForeman doesn't text
// customers on a contractor's behalf anymore. Outbound to customers
// stays in email + in-app + the customer portal.
//
// Each template returns a short string. Twilio segments at 160 chars
// (GSM-7) so we aim for one segment per message.

function trim(s, max = 30) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// (Templates land here as we wire up platform notifications.)
// Examples to add later:
//   newLeadSMS({ leadName, leadService })
//   quoteApprovedSMS({ customerName, amount })
//   invoicePaidSMS({ customerName, amount })
//   trialEndingSMS({ daysLeft })

export { trim };
