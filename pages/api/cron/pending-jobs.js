import { createClient } from '@supabase/supabase-js';
import { sendBrandedEmail } from '../../../lib/email/send';
import { pendingJobNudgeEmail } from '../../../lib/email/templates';

// Daily cron that pings org owners about jobs sitting in 'pending'
// for 3+ days — usually quote-approved work the contractor forgot
// to schedule with the customer. Groups all pending jobs per org
// into a single digest email so we don't spam (e.g. an org with 5
// pending jobs gets one email, not five).
//
// We also drop an in-app notification for the bell icon. The cron
// stamps jobs.pending_nudge_sent_at so a job isn't re-nudged every
// day forever — one nudge per pending streak. If the contractor
// schedules-then-un-schedules (back to pending), they get nudged
// again 3 days later because the timestamp tracks the last nudge.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const PER_RUN_CAP  = 500;
const STALE_DAYS   = 3;

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

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

  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  const { data: jobs, error } = await sb
    .from('jobs')
    .select('id, org_id, title, customer_id, created_at, pending_nudge_sent_at, customers ( name )')
    .eq('status', 'pending')
    .lte('created_at', cutoff)
    .is('pending_nudge_sent_at', null)
    .limit(PER_RUN_CAP);

  if (error) return res.status(500).json({ error: error.message });

  if (!jobs || jobs.length === 0) {
    return res.status(200).json({ ok: true, scanned: 0, sent: 0, orgs: 0 });
  }

  // Group jobs by org so each contractor gets a single digest.
  const byOrg = new Map();
  const now = new Date();
  for (const j of jobs) {
    if (!byOrg.has(j.org_id)) byOrg.set(j.org_id, []);
    byOrg.get(j.org_id).push({
      id: j.id,
      title: j.title,
      customer_name: j.customers?.name || null,
      days_pending: daysBetween(new Date(j.created_at), now),
    });
  }

  let sent = 0, failed = 0;
  const errors = [];

  for (const [orgId, orgJobs] of byOrg) {
    // Look up org details + owner. Skip suspended orgs and orgs with
    // no owner email on file.
    const { data: org } = await sb
      .from('organizations')
      .select('id, name, owner_name, business_email, logo_url, suspended_at')
      .eq('id', orgId)
      .maybeSingle();
    if (!org || org.suspended_at) continue;

    const { data: owner } = await sb
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'owner')
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // In-app notification (regardless of whether we have an email).
    if (owner?.user_id) {
      await sb.from('notifications').insert({
        org_id: orgId,
        user_id: owner.user_id,
        kind:   'pending_jobs',
        title:  `${orgJobs.length} pending job${orgJobs.length === 1 ? '' : 's'} to schedule`,
        body:   orgJobs.length === 1
          ? `"${orgJobs[0].title}" has been waiting ${orgJobs[0].days_pending} days. Set a date to send the customer a confirmation.`
          : `${orgJobs.length} jobs are awaiting scheduling. Open Jobs to set dates.`,
        link:   '/jobs',
      });
    }

    // Digest email to the owner's business_email (which is the
    // contractor's working inbox, not the auth email — they may differ).
    if (org.business_email) {
      const tpl = pendingJobNudgeEmail({
        org: { name: org.name, logo_url: org.logo_url },
        ownerName: org.owner_name,
        count: orgJobs.length,
        jobs: orgJobs,
      });
      const r = await sendBrandedEmail({
        org: { name: org.name, business_email: org.business_email, logo_url: org.logo_url },
        to: org.business_email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      if (!r.ok) {
        failed++;
        errors.push({ org_id: orgId, error: r.error });
        continue;
      }
    }

    // Stamp all the jobs we just nudged about so they're not picked
    // up again until they're re-pendinged (re-pending isn't really a
    // thing today, but the stamp also prevents tomorrow's run from
    // double-emailing).
    const ids = orgJobs.map(j => j.id);
    await sb.from('jobs').update({ pending_nudge_sent_at: now.toISOString() }).in('id', ids);
    sent++;
  }

  return res.status(200).json({
    ok: true,
    scanned: jobs.length,
    orgs: byOrg.size,
    sent, failed,
    ...(errors.length ? { errors } : {}),
  });
}
