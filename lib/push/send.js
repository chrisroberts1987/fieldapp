import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Server-side push fan-out. Looks up every push_subscriptions row for
// the target user(s) and fires a Web Push to each. Cleans up rows
// that come back as 404/410 (gone) so we don't keep pinging dead
// subscriptions.
//
// Requires three env vars:
//   VAPID_PUBLIC_KEY  (same value as NEXT_PUBLIC_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT     (a contact email or URL, e.g. mailto:support@myforemanhq.com)
// Plus SUPABASE_SERVICE_ROLE_KEY so this code can read across users.
// If anything is missing, sendPushToUsers() silently no-ops; the
// calling event flow (e.g. invoice paid) still completes normally.

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY  || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || 'mailto:support@myforemanhq.com';
  if (!pub || !prv) return false;
  webpush.setVapidDetails(sub, pub, prv);
  configured = true;
  return true;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// userIds: string | string[]
// payload: { title, body, url, tag }
export async function sendPushToUsers(userIds, payload) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
  if (ids.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  if (!ensureConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // No keys configured — fail open. Surfaced as a single info log
    // so a misconfiguration shows up in the server logs without
    // breaking the calling flow.
    console.log('[push] VAPID/service-role not configured — skipping push send.', { userCount: ids.length });
    return { sent: 0, failed: 0, skipped: ids.length };
  }

  const sb = adminClient();
  const { data: subs, error } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id')
    .in('user_id', ids);
  if (error || !subs?.length) return { sent: 0, failed: 0, skipped: 0 };

  let sent = 0, failed = 0;
  const deadIds = [];
  const json = JSON.stringify({
    title: payload.title || 'MyForeman',
    body:  payload.body  || '',
    url:   payload.url   || '/dashboard',
    tag:   payload.tag,
  });

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        json,
        { TTL: 60 * 60 } // 1 hour — for nudges, no point delivering older than that
      );
      sent++;
      // Best-effort last-used update; ignore failure.
      sb.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id).then(() => {});
    } catch (err) {
      failed++;
      const status = err?.statusCode || 0;
      if (status === 404 || status === 410) deadIds.push(s.id);
      else console.warn('[push] send failed', status, err?.body || err?.message);
    }
  }));

  if (deadIds.length > 0) {
    await sb.from('push_subscriptions').delete().in('id', deadIds);
  }

  return { sent, failed, skipped: 0, cleaned: deadIds.length };
}

// Send to every org member of a given org. Used when an event is
// org-wide (new lead, quote approved). The recipient list is "every
// member of the org" — foreman + supervisor + crew.
export async function sendPushToOrg(orgId, payload, { excludeUserId } = {}) {
  if (!ensureConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { sent: 0, failed: 0, skipped: 1 };
  }
  const sb = adminClient();
  const { data: members } = await sb.from('org_members').select('user_id').eq('org_id', orgId);
  const ids = (members || []).map(m => m.user_id).filter(id => id && id !== excludeUserId);
  return sendPushToUsers(ids, payload);
}
