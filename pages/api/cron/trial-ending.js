// Daily cron: text owners whose trial ends in 3, 1, or 0 days.
// We text at most once per org (trial_ending_sms_sent_at gates it)
// so an owner doesn't get the same nag three days in a row. The
// 3-day mark is the one we hit most reliably.
//
// Vercel injects Authorization: Bearer <CRON_SECRET> on cron
// invocations — same auth pattern as the other crons here.

import { createClient } from '@supabase/supabase-js';
import { notifyOrgBySMS } from '../../../lib/sms/notify';
import { trialEndingSMS } from '../../../lib/sms/templates';
import { sendPushToUsers } from '../../../lib/push/send';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const PER_RUN_CAP  = 200;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase service role not configured.' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Trial-status orgs that haven't already been texted, ending in
  // the next 3 days. We sort soonest-first so if the per-run cap
  // ever bites, the most urgent get through.
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: orgs, error } = await sb.from('organizations')
    .select('id, name, trial_ends_at, trial_ending_sms_sent_at, sms_phone, sms_notifications_enabled, subscription_status')
    .is('trial_ending_sms_sent_at', null)
    .gte('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', in3Days.toISOString())
    .order('trial_ends_at', { ascending: true })
    .limit(PER_RUN_CAP);
  if (error) return res.status(500).json({ error: error.message });

  let sent = 0, skipped = 0;
  for (const org of (orgs || [])) {
    // Skip orgs that already converted to a paid subscription
    // even if trial_ends_at hasn't been cleared.
    if (org.subscription_status && org.subscription_status !== 'trial') {
      skipped++;
      continue;
    }

    const msLeft = new Date(org.trial_ends_at) - now;
    const daysLeft = Math.max(0, Math.round(msLeft / (24 * 60 * 60 * 1000)));

    const r = await notifyOrgBySMS(sb, org.id, trialEndingSMS({ daysLeft }));
    if (r?.ok) {
      sent++;
      await sb.from('organizations')
        .update({ trial_ending_sms_sent_at: new Date().toISOString() })
        .eq('id', org.id);
    } else {
      skipped++;
    }

    // Push to the owner / admins (web + native). Best-effort; the
    // SMS above is the source-of-truth signal so we don't unwind
    // anything on failure.
    try {
      const { data: owners } = await sb.from('org_members')
        .select('user_id').eq('org_id', org.id).in('role', ['owner','admin']);
      const ids = (owners || []).map(m => m.user_id).filter(Boolean);
      if (ids.length > 0) {
        await sendPushToUsers(ids, {
          title: `Trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'} ⏰`,
          body:  'Add a payment method to keep your tools, customers, and history.',
          url:   '/billing',
          tag:   `trial-${org.id}`,
        });
      }
    } catch (e) { console.warn('[trial-ending] push failed', e?.message); }
  }

  return res.status(200).json({ ok: true, sent, skipped, scanned: orgs?.length || 0 });
}
