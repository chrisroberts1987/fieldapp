// SMS templates. Kept terse — most carriers segment a message at 160
// chars (GSM-7 alphabet) or 70 chars (UCS-2 if any emoji slip in).
// We aim for one segment so the contractor's per-message cost stays
// low ($0.008 per segment on Twilio).
//
// Each template returns just a string (the body). Twilio's 10DLC
// compliance system auto-appends an opt-out hint once the org's
// brand+campaign is registered — we don't tack one on manually.

function trim(s, max = 30) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function jobScheduledSMS({ org, customerName, jobTitle, scheduledDate }) {
  const orgName = trim(org?.name, 40) || 'Your contractor';
  const name    = customerName ? customerName.split(' ')[0] : 'there';
  const title   = trim(jobTitle, 35);
  return `Hi ${name}, confirming we have ${title} scheduled for ${scheduledDate}. Reply if you need to reschedule. — ${orgName}`;
}

export function invoiceSentSMS({ org, amount, invoiceUrl }) {
  const orgName = trim(org?.name, 40) || 'Your contractor';
  return `Your invoice for $${Number(amount).toFixed(2)} from ${orgName}: ${invoiceUrl}`;
}

export function paymentReceivedSMS({ org, amount }) {
  const orgName = trim(org?.name, 40) || 'Your contractor';
  return `Thanks — $${Number(amount).toFixed(2)} received. Receipt sent by email. — ${orgName}`;
}

export function onMyWaySMS({ org, customerName, jobTitle, crewName, etaMins }) {
  const orgName = trim(org?.name, 40) || 'Your contractor';
  const name    = customerName ? customerName.split(' ')[0] : 'there';
  const crew    = trim(crewName, 20) || 'Our crew';
  const title   = trim(jobTitle, 30);
  const eta     = Number(etaMins) > 0 ? ` (~${Number(etaMins)} min out)` : '';
  return `Hi ${name}, ${crew} is on the way for ${title}${eta}. — ${orgName}`;
}
