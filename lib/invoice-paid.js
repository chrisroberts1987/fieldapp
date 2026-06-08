import { supabase } from './supabase';
import { sendEmail } from './email/client';
import { firePushEvent } from './push/fire';

// Centralized "an invoice just got marked paid" cascade, callable
// from any place the foreman flips status (dashboard quick-pay,
// invoice list, invoice detail, bulk action). The Stripe webhook
// has its own server-side equivalent inside the webhook handler.
//
// Sequence (best-effort, never throws):
//   1. UPDATE invoices: status=paid, paid_date, paid_via, [reference in notes]
//   2. Insert a feedback row (idempotent — one per invoice)
//   3. Insert an in-app notification for the foreman
//   4. Email the customer a feedback request (if we have their email)
//   5. Fire the invoice_paid push event so org members get a ping

export async function markInvoicePaidWithCascade({
  invoiceId,
  orgId,
  userId,
  customerId,
  amount,
  paidVia,        // 'cash' | 'check' | 'zelle' | 'venmo' | 'ach' | 'stripe' | 'other'
  reference,      // optional check number / transaction id / etc
}) {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Update the invoice. Append the reference to notes so the
  // audit trail isn't lost (the existing notes stay above).
  const patch = { status: 'paid', paid_date: today, paid_via: paidVia };
  if (reference && reference.trim()) {
    // Read existing notes so we don't clobber what's there.
    const { data: cur } = await supabase.from('invoices').select('notes').eq('id', invoiceId).maybeSingle();
    const existing = (cur?.notes || '').trim();
    const ref = `Paid via ${paidVia}${reference.trim() ? ` (${reference.trim()})` : ''}`;
    patch.notes = existing ? `${existing}\n\n${ref}` : ref;
  }
  const { error: upErr } = await supabase.from('invoices').update(patch).eq('id', invoiceId);
  if (upErr) return { ok: false, error: upErr.message };

  // 2-5: cascade. Each step is best-effort and isolated.
  await cascade({ invoiceId, orgId, userId, customerId, amount, paidVia }).catch((e) => {
    console.warn('[invoice-paid cascade]', e?.message || e);
  });

  return { ok: true };
}

async function cascade({ invoiceId, orgId, userId, customerId, amount, paidVia }) {
  // Fetch customer (name + email + phone, plus SMS consent state
  // so we can decide whether to text after the email).
  let cust = null;
  if (customerId) {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, phone, sms_opt_in_at, sms_opt_out')
      .eq('id', customerId).maybeSingle();
    cust = data;
  }
  const custName = cust?.name || 'Customer';

  // Feedback row — idempotent on invoice_id
  let { data: existing } = await supabase.from('feedback').select('id, token').eq('invoice_id', invoiceId).maybeSingle();
  if (!existing && orgId) {
    const { data: ins } = await supabase.from('feedback').insert({
      org_id: orgId,
      invoice_id: invoiceId,
      customer_id: customerId,
      customer_name: custName,
    }).select('id, token').single();
    existing = ins;
  }

  // In-app notification
  if (orgId && userId) {
    await supabase.from('notifications').insert({
      org_id: orgId,
      user_id: userId,
      kind: 'invoice_paid',
      title: 'Invoice paid 🎉',
      body: `${custName} paid $${Number(amount || 0).toFixed(2)}. Feedback link generated.`,
      link: '/invoices',
    });
  }

  // One customer email: branded receipt with an inline feedback CTA at
  // the bottom. Customers were getting two emails back-to-back (receipt
  // + "leave feedback") which read as spammy. paymentReceivedEmail now
  // takes an optional feedbackUrl and folds the ask into the receipt.
  if (cust?.email && typeof window !== 'undefined') {
    const invoiceNumber = 'INV-' + String(invoiceId).slice(0, 8).toUpperCase();
    const invoiceUrl = `${window.location.origin}/inv/${await invoiceTokenFor(invoiceId)}`;
    const paidDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const feedbackUrl = existing?.token
      ? `${window.location.origin}/feedback/${existing.token}`
      : null;
    await sendEmail({
      type: 'payment_received',
      to: cust.email,
      data: { customerName: custName, invoiceNumber, amount, paidVia, paidDate, invoiceUrl, feedbackUrl },
    });
  }

  // Customer SMS sister to the email. One message that folds the
  // receipt acknowledgment + feedback ask together — the email is
  // the canonical receipt. Server-side endpoint gates on
  // sms_opt_in_at + !sms_opt_out so this is safe to fire whenever
  // the customer has a phone on file.
  if (cust?.phone && typeof window !== 'undefined') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const invoiceUrl = `${window.location.origin}/inv/${await invoiceTokenFor(invoiceId)}`;
        const feedbackUrl = existing?.token
          ? `${window.location.origin}/feedback/${existing.token}`
          : null;
        await fetch('/api/sms/customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            kind: 'payment',
            customerId: cust.id,
            data: { amount, invoiceUrl, feedbackUrl },
          }),
          keepalive: true,
        });
      }
    } catch { /* best-effort */ }
  }

  // Push to the rest of the org
  firePushEvent('invoice_paid', invoiceId);
}

async function invoiceTokenFor(invoiceId) {
  const { data } = await supabase.from('invoices').select('public_token').eq('id', invoiceId).maybeSingle();
  return data?.public_token || '';
}
