import { createClient } from '@supabase/supabase-js';
import { sendBrandedEmail } from '../../../lib/email/send';
import { invoiceReminderEmail } from '../../../lib/email/templates';

// Daily cron that nudges customers about unpaid invoices at 7, 14, and
// 30 days past due. Triggered by Vercel cron via vercel.json on a
// scheduled run; verified via the Bearer CRON_SECRET that Vercel
// injects on cron requests.
//
// Uses the Supabase service role key to read across all orgs because
// the cron has no user JWT to scope RLS by. The service key is
// server-only (no NEXT_PUBLIC_ prefix) and never reaches the browser.

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET     = process.env.CRON_SECRET;
const PER_RUN_CAP     = 500;  // safety cap per invocation

function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${(x.getUTCMonth()+1).toString().padStart(2,'0')}/${x.getUTCDate().toString().padStart(2,'0')}/${x.getUTCFullYear()}`;
}
function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export default async function handler(req, res) {
  // Vercel injects Authorization: Bearer <CRON_SECRET> on cron triggers.
  // Reject anything that doesn't match.
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

  const today = new Date();
  const cutoff7  = new Date(today.getTime() - 7  * 86_400_000).toISOString().slice(0,10);
  const cutoff14 = new Date(today.getTime() - 14 * 86_400_000).toISOString().slice(0,10);
  const cutoff30 = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0,10);

  // Pull every unpaid invoice that is at least 7 days past issued_date
  // and missing at least one reminder. We'll decide the stage per-row
  // below. Hard cap to keep one run bounded.
  const { data: invoices, error } = await sb
    .from('invoices')
    .select('id, org_id, customer_id, amount, issued_date, notes, reminder_7d_sent_at, reminder_14d_sent_at, reminder_30d_sent_at, customers ( name, email ), organizations ( name, business_email, logo_url )')
    .eq('status', 'unpaid')
    .lte('issued_date', cutoff7)
    .or('reminder_7d_sent_at.is.null,reminder_14d_sent_at.is.null,reminder_30d_sent_at.is.null')
    .limit(PER_RUN_CAP);

  if (error) return res.status(500).json({ error: error.message });

  let sent = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const inv of invoices || []) {
    const issued = new Date(inv.issued_date);
    const daysOver = daysBetween(issued, today);

    // Pick the highest stage that's both eligible (by age) and hasn't
    // been sent yet. Skip the row entirely if nothing eligible.
    let stage = null;
    if (daysOver >= 30 && !inv.reminder_30d_sent_at) stage = 30;
    else if (daysOver >= 14 && !inv.reminder_14d_sent_at) stage = 14;
    else if (daysOver >=  7 && !inv.reminder_7d_sent_at)  stage = 7;

    if (stage === null) { skipped++; continue; }

    const customer = inv.customers || {};
    const org      = inv.organizations || {};

    // No customer email on file — nothing to send. Mark all eligible
    // stages so we don't keep retrying.
    if (!customer.email) {
      skipped++;
      await markStagesSent(sb, inv.id, stage);
      continue;
    }

    const tpl = invoiceReminderEmail({
      org: { name: org.name, logo_url: org.logo_url, business_email: org.business_email },
      customerName:  customer.name,
      invoiceNumber: inv.notes ? `Invoice (${inv.notes.slice(0,40)})` : `Invoice #${inv.id.slice(0,8)}`,
      amount:        Number(inv.amount || 0),
      issuedDate:    fmtDate(inv.issued_date),
      daysOverdue:   daysOver,
      stage,
    });

    const result = await sendBrandedEmail({
      org: { name: org.name, business_email: org.business_email, logo_url: org.logo_url },
      to: customer.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });

    if (!result.ok) {
      failed++;
      errors.push({ invoice_id: inv.id, error: result.error });
      continue;
    }

    await markStagesSent(sb, inv.id, stage);
    sent++;
  }

  return res.status(200).json({
    ok: true,
    scanned: invoices?.length || 0,
    sent, skipped, failed,
    ...(errors.length ? { errors } : {}),
  });
}

// Mark the fired stage and any earlier stages with the same timestamp,
// so an invoice that's been overdue 31 days without prior reminders
// doesn't get all three nudges back-to-back on subsequent cron runs.
async function markStagesSent(sb, invoiceId, stage) {
  const now = new Date().toISOString();
  const patch = {};
  if (stage >=  7) patch.reminder_7d_sent_at  = now;
  if (stage >= 14) patch.reminder_14d_sent_at = now;
  if (stage >= 30) patch.reminder_30d_sent_at = now;
  await sb.from('invoices').update(patch).eq('id', invoiceId);
}
