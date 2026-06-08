// Customer-facing SMS layer. Wraps sendBrandedSMS with the safety
// checks every customer-destined message needs:
//
//   1. The customer row must NOT have sms_opt_out=true.
//   2. The customer must have an sms_opt_in_at (proof of consent).
//   3. The phone must normalize to E.164.
//   4. Every send is logged to customer_sms_log (audit trail).
//
// Calling code passes in (sb, customer, body, kind). We never throw
// — failures return { ok: false, skipped: true/false, reason }.

import { sendBrandedSMS, normalizeUSPhone } from './send';

export async function sendCustomerSMS(sb, { orgId, customer, body, kind }) {
  if (!customer) return { ok: false, skipped: true, reason: 'no customer' };
  if (customer.sms_opt_out) return { ok: false, skipped: true, reason: 'opted out' };
  if (!customer.sms_opt_in_at) return { ok: false, skipped: true, reason: 'no consent on file' };
  const phone = normalizeUSPhone(customer.phone);
  if (!phone) return { ok: false, skipped: true, reason: 'unparseable phone' };

  const res = await sendBrandedSMS({ to: phone, body });

  // Append-only audit log. Best-effort; never blocks the send result.
  try {
    await sb.from('customer_sms_log').insert({
      org_id:      orgId,
      customer_id: customer.id,
      kind:        kind || 'other',
      direction:   'outbound',
      phone,
      body,
      twilio_sid:  res?.sid || null,
      ok:          !!res?.ok,
      error:       res?.error || null,
    });
  } catch (e) {
    console.warn('[sms:customer] log failed', e?.message);
  }

  return res;
}
