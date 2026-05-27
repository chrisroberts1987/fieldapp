import { createClient } from '@supabase/supabase-js';
import { preflight } from '../../../lib/apiSecurity';
import { sendPushToUsers, sendPushToOrg } from '../../../lib/push/send';
import { notifyOrgBySMS } from '../../../lib/sms/notify';
import { newLeadSMS, quoteApprovedSMS, invoicePaidSMS } from '../../../lib/sms/templates';

// Fan-out endpoint for push events. Public callable (the lead-capture
// form and the customer's quote-approval page hit it without a JWT)
// so it relies on rate limiting + entity validation to keep abuse
// bounded:
//
//   • preflight applies the standard 10/min/IP limit + Origin check.
//   • Every event type re-reads the source entity from the DB and
//     verifies the entity exists (and, where relevant, that its
//     state matches the event — e.g. quote.status === 'approved').
//
// Pushes are best-effort; the endpoint always returns 200 even when
// the underlying webpush call fails, so the caller's UX never hangs.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fmt$(n) {
  const v = Number(n || 0);
  return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  if (!SERVICE_KEY) {
    // No service role configured — quietly succeed so the caller's
    // flow doesn't think push failed. Push is opt-in for the platform
    // operator anyway.
    return res.status(200).json({ ok: true, skipped: 'not configured' });
  }

  const { event, refId } = req.body || {};
  if (!event || !refId) return res.status(400).json({ error: 'event and refId required.' });

  const sb = admin();

  try {
    if (event === 'new_lead') {
      const { data: lead } = await sb.from('leads').select('id, name, estimated_value, org_id, source').eq('id', refId).maybeSingle();
      if (!lead) return res.status(404).json({ error: 'Lead not found.' });
      const value = Number(lead.estimated_value || 0);
      await sendPushToOrg(lead.org_id, {
        title: 'New lead 🎯',
        body:  `${lead.name}${value > 0 ? ` · ${fmt$(value)} est.` : ''}`,
        url:   '/leads',
        tag:   `lead-${lead.id}`,
      });
      // Owner SMS — silently skipped if no sms_phone or disabled.
      await notifyOrgBySMS(sb, lead.org_id, newLeadSMS({
        leadName: lead.name, estimatedValue: value, source: lead.source,
      }));
      return res.status(200).json({ ok: true });
    }

    if (event === 'quote_approved') {
      const { data: q } = await sb.from('quotes').select('id, customer_name, amount, status, org_id, converted_job_id').eq('id', refId).maybeSingle();
      if (!q || q.status !== 'approved') return res.status(404).json({ error: 'Quote not found or not approved.' });
      await sendPushToOrg(q.org_id, {
        title: 'Quote approved ✓',
        body:  `${q.customer_name} approved ${fmt$(q.amount)}.`,
        url:   q.converted_job_id ? '/jobs' : '/quotes',
        tag:   `quote-${q.id}`,
      });
      await notifyOrgBySMS(sb, q.org_id, quoteApprovedSMS({
        customerName: q.customer_name, amount: q.amount,
      }));
      return res.status(200).json({ ok: true });
    }

    if (event === 'invoice_paid') {
      const { data: inv } = await sb.from('invoices').select('id, amount, status, customer_id, org_id, customers ( name )').eq('id', refId).maybeSingle();
      if (!inv || inv.status !== 'paid') return res.status(404).json({ error: 'Invoice not found or not paid.' });
      const name = inv.customers?.name || 'A customer';
      await sendPushToOrg(inv.org_id, {
        title: 'Invoice paid 🎉',
        body:  `${name} paid ${fmt$(inv.amount)}.`,
        url:   '/invoices',
        tag:   `invoice-${inv.id}`,
      });
      await notifyOrgBySMS(sb, inv.org_id, invoicePaidSMS({
        customerName: name, amount: inv.amount,
      }));
      return res.status(200).json({ ok: true });
    }

    if (event === 'job_assigned') {
      const { data: j } = await sb.from('jobs').select('id, title, scheduled_date, assigned_to_user_id, org_id').eq('id', refId).maybeSingle();
      if (!j || !j.assigned_to_user_id) return res.status(404).json({ error: 'Job not found or no assignee.' });
      const when = j.scheduled_date
        ? ` · ${new Date(j.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : '';
      await sendPushToUsers([j.assigned_to_user_id], {
        title: 'New job assigned 🔧',
        body:  `${j.title}${when}`,
        url:   '/jobs',
        tag:   `job-${j.id}`,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown event type.' });
  } catch (err) {
    console.error('[push/event]', event, err);
    // Always 200 — caller doesn't need to retry.
    return res.status(200).json({ ok: true, error: err?.message || 'send failed' });
  }
}
