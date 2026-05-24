import { supabase } from '../supabase';

// Tiny client-side wrapper around POST /api/email/send. Returns
// { ok: true } on success, { ok: false, error } on failure. Never
// throws — callers can fire-and-forget without try/catch.
export async function sendEmail({ type, to, data }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not signed in.' };

    const r = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, to, data }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: body?.error || `Send failed (${r.status})` };
    return { ok: true, skipped: body.skipped, id: body.id };
  } catch (e) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}

// Dedicated wrapper for the per-invoice send endpoint. The /api/email/send
// route is generic and would need the caller to know the public_token,
// invoiceUrl origin, etc.; this one just takes the invoice id and lets
// the server look the rest up.
export async function sendInvoiceEmail(invoiceId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not signed in.' };

    const r = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: body?.error || `Send failed (${r.status})` };
    return { ok: true, sentTo: body.sent_to, skipped: body.skipped };
  } catch (e) {
    return { ok: false, error: e?.message || 'Network error.' };
  }
}
