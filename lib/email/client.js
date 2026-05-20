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
