import { createClient } from '@supabase/supabase-js';
import { sendBrandedEmail } from '../../../lib/email/send';
import { quoteFollowupEmail } from '../../../lib/email/templates';
import { sendBrandedSMS, smsReady } from '../../../lib/sms/send';

// Daily cron that nudges customers who got a quote 5+ days ago and
// haven't approved or declined yet. One nudge per quote (tracked via
// quotes.followup_sent_at) — no escalating tiers. If a customer wants
// to wait, repeated emails just annoy them.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const PER_RUN_CAP  = 500;
const STALE_DAYS   = 5;

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

  const { data: quotes, error } = await sb
    .from('quotes')
    .select('id, org_id, customer_id, customer_name, customer_email, customer_phone, title, amount, sent_at, approval_token, status, followup_sent_at, organizations ( name, business_email, logo_url )')
    .eq('status', 'sent')
    .lte('sent_at', cutoff)
    .is('followup_sent_at', null)
    .limit(PER_RUN_CAP);

  if (error) return res.status(500).json({ error: error.message });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://myforemanhq.com');

  let sent = 0, skipped = 0, failed = 0;
  const errors = [];
  const now = new Date();

  for (const q of quotes || []) {
    const org = q.organizations || {};
    const sentAt = q.sent_at ? new Date(q.sent_at) : null;
    const daysSinceSent = sentAt ? daysBetween(sentAt, now) : STALE_DAYS;
    const approvalUrl = q.approval_token ? `${baseUrl}/q/${q.approval_token}` : null;
    const amount = Number(q.amount || 0);

    // Skip if no contact info at all — mark followup_sent so we stop
    // scanning this quote on subsequent days.
    if (!q.customer_email && !q.customer_phone) {
      skipped++;
      await sb.from('quotes').update({ followup_sent_at: now.toISOString() }).eq('id', q.id);
      continue;
    }

    let stamped = false;

    if (q.customer_email) {
      const tpl = quoteFollowupEmail({
        org: { name: org.name, logo_url: org.logo_url, business_email: org.business_email },
        customerName: q.customer_name,
        quoteTitle:   q.title,
        amount,
        approvalUrl,
        daysSinceSent,
      });
      const r = await sendBrandedEmail({
        org: { name: org.name, business_email: org.business_email, logo_url: org.logo_url },
        to: q.customer_email,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
      if (!r.ok) {
        errors.push({ quote_id: q.id, channel: 'email', error: r.error });
      } else {
        stamped = true;
      }
    }

    if (q.customer_phone && smsReady() && approvalUrl) {
      const orgName = String(org.name || 'us').slice(0, 40);
      const body = `Following up on the estimate from ${orgName} for $${amount.toFixed(2)}. Review & approve: ${approvalUrl}`;
      const r = await sendBrandedSMS({ to: q.customer_phone, body });
      if (!r.ok && !r.skipped) {
        errors.push({ quote_id: q.id, channel: 'sms', error: r.error });
      } else if (r.ok) {
        stamped = true;
      }
    }

    if (stamped) {
      await sb.from('quotes').update({ followup_sent_at: now.toISOString() }).eq('id', q.id);
      sent++;
    } else {
      failed++;
    }
  }

  return res.status(200).json({
    ok: true,
    scanned: quotes?.length || 0,
    sent, skipped, failed,
    ...(errors.length ? { errors } : {}),
  });
}
