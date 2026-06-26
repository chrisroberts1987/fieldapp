import { Resend } from 'resend';
import { verifyAdmin } from '../../../../lib/adminAuth';
import { renderBroadcast } from '../../../../lib/email/broadcastTemplate';

// Send an admin broadcast email to every active / trialing
// organization (optionally filtered by plan tier). Safety rails:
//   • Rate limit: 3 broadcasts per admin per UTC day. Counted from
//     admin_broadcasts to avoid relying on an in-memory cache.
//   • Large-batch guard: if recipient count > 1000 the request must
//     include `confirmedLargeBatch: true` in the body. The UI shows a
//     second confirmation modal before flipping that flag on.
//   • Body / subject length caps so a typo can't blast a 5MB email.
//
// Sends go out via the Resend batch API (100 emails per call) with a
// small concurrency cap. Partial failures are tracked: we always log
// to admin_broadcasts even when some batches fail, with sent_count
// and failed_count split out for triage.

const ACTIVE_STATUSES        = ['active', 'trialing'];
const VALID_TIERS            = ['all', 'solo', 'crew', 'business'];
const MAX_PER_DAY            = 3;
const LARGE_BATCH_THRESHOLD  = 1000;
const RESEND_BATCH_SIZE      = 100;
const SEND_CONCURRENCY       = 3;
const MAX_SUBJECT_LEN        = 200;
const MAX_BODY_LEN           = 50_000;
const MAX_RECIPIENT_PULL     = 20_000;

const FROM_ADDR    = 'Chris Roberts <chris.roberts@myforemanhq.com>';
const REPLY_TO     = 'support@myforemanhq.com';

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['POST'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  const payload = req.body || {};
  const subject = String(payload.subject || '').trim();
  const body    = String(payload.body || '').trim();
  const tier    = String(payload.tier || 'all').toLowerCase();
  const confirmedLargeBatch = !!payload.confirmedLargeBatch;

  if (!subject)                     return res.status(400).json({ error: 'Subject is required.' });
  if (subject.length > MAX_SUBJECT_LEN) return res.status(400).json({ error: `Subject too long (max ${MAX_SUBJECT_LEN}).` });
  if (!body)                        return res.status(400).json({ error: 'Body is required.' });
  if (body.length > MAX_BODY_LEN)   return res.status(400).json({ error: `Body too long (max ${MAX_BODY_LEN}).` });
  if (!VALID_TIERS.includes(tier))  return res.status(400).json({ error: 'Invalid tier filter.' });

  // ---------------------------------------------------------------
  // 1. Rate limit
  // ---------------------------------------------------------------
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: todayCount, error: countErr } = await sb
    .from('admin_broadcasts')
    .select('id', { count: 'exact', head: true })
    .eq('sent_by', adminEmail)
    .gte('sent_at', dayStart.toISOString());
  if (countErr) return res.status(500).json({ error: countErr.message });
  if ((todayCount || 0) >= MAX_PER_DAY) {
    return res.status(429).json({
      error: `Daily broadcast limit reached (${MAX_PER_DAY}/day). Try again tomorrow.`,
      todayCount,
    });
  }

  // ---------------------------------------------------------------
  // 2. Pull recipients
  // ---------------------------------------------------------------
  let q = sb
    .from('organizations')
    .select('id, business_email, subscription_tier')
    .in('subscription_status', ACTIVE_STATUSES)
    .eq('is_test', false)
    .not('business_email', 'is', null);
  if (tier !== 'all') q = q.eq('subscription_tier', tier);

  const { data: orgs, error: orgErr } = await q.limit(MAX_RECIPIENT_PULL);
  if (orgErr) return res.status(500).json({ error: orgErr.message });

  // De-dupe across orgs that share an inbox (a contractor with two
  // active orgs should only receive one copy).
  const emails = Array.from(new Set(
    (orgs || [])
      .map(o => (o.business_email || '').trim().toLowerCase())
      .filter(e => e && e.includes('@'))
  ));
  const recipientCount = emails.length;

  if (recipientCount === 0) {
    return res.status(400).json({ error: 'No recipients match the selected filter.' });
  }

  if (recipientCount > LARGE_BATCH_THRESHOLD && !confirmedLargeBatch) {
    return res.status(409).json({
      error: `This broadcast targets ${recipientCount} recipients (> ${LARGE_BATCH_THRESHOLD}). Re-submit with confirmedLargeBatch:true to proceed.`,
      requiresLargeBatchConfirm: true,
      recipientCount,
    });
  }

  // ---------------------------------------------------------------
  // 3. Send via Resend batch API
  // ---------------------------------------------------------------
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured.' });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { html, text } = renderBroadcast({ subject, body });

  const batches = [];
  for (let i = 0; i < emails.length; i += RESEND_BATCH_SIZE) {
    batches.push(emails.slice(i, i + RESEND_BATCH_SIZE));
  }

  let sentCount   = 0;
  let failedCount = 0;
  const sampleErrors = []; // first few error messages, for the response

  for (let i = 0; i < batches.length; i += SEND_CONCURRENCY) {
    const chunk = batches.slice(i, i + SEND_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(async (batch) => {
      const emailObjs = batch.map(to => ({
        from:    FROM_ADDR,
        to:      [to],
        subject,
        html,
        text,
        replyTo: REPLY_TO,
      }));
      const r = await resend.batch.send(emailObjs);
      if (r?.error) throw new Error(r.error.message || 'Resend batch rejected.');
      return batch.length;
    }));
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        sentCount += result.value;
      } else {
        failedCount += chunk[idx].length;
        if (sampleErrors.length < 3) {
          sampleErrors.push(result.reason?.message || 'Unknown error');
        }
      }
    });
  }

  // ---------------------------------------------------------------
  // 4. Log (best-effort — even if partial failure, we want the row)
  // ---------------------------------------------------------------
  const { error: logErr } = await sb.from('admin_broadcasts').insert({
    subject,
    body,
    tier_filter:    tier === 'all' ? null : tier,
    recipient_count: recipientCount,
    sent_count:     sentCount,
    failed_count:   failedCount,
    sent_by:        adminEmail,
  });
  if (logErr) {
    console.error('[admin_broadcasts] insert failed:', logErr.message);
  }

  return res.status(200).json({
    ok: true,
    recipientCount,
    sentCount,
    failedCount,
    sampleErrors,
  });
}
