// Server-side helper: send a platform-to-owner SMS for a given org.
// Reads sms_phone + sms_notifications_enabled off the organization
// row and skips silently if either is missing/off. Always
// best-effort — never throws into the caller's flow.
//
// Use from inside API routes (push/event, cron jobs, invoice-paid
// cascade) where we already have a service-role Supabase client in
// scope.

import { sendBrandedSMS, smsReady } from './send';

export async function notifyOrgBySMS(sb, orgId, body) {
  if (!sb || !orgId || !body) return { skipped: true, reason: 'missing args' };
  if (!smsReady())            return { skipped: true, reason: 'twilio not configured' };

  try {
    const { data: org } = await sb.from('organizations')
      .select('sms_phone, sms_notifications_enabled')
      .eq('id', orgId)
      .maybeSingle();
    if (!org)                                  return { skipped: true, reason: 'org not found' };
    if (!org.sms_phone)                        return { skipped: true, reason: 'no sms_phone set' };
    if (org.sms_notifications_enabled === false) return { skipped: true, reason: 'sms disabled by owner' };

    return await sendBrandedSMS({ to: org.sms_phone, body });
  } catch (e) {
    console.error('[sms/notify]', orgId, e?.message || e);
    return { skipped: true, reason: 'send error' };
  }
}
