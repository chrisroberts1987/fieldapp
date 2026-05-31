// Expo Push API helper. Used alongside Web Push so a single
// sendPushToUsers() call delivers to both surfaces.
//
// Expo's batch limit is 100 receipts per POST. We chunk if needed.
// Errors on individual tokens come back in the JSON response — we
// honor DeviceNotRegistered as a signal to delete the row from
// expo_push_tokens so we don't keep pinging dead phones.

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

// rows: [{ id, user_id, token }]
// payload: { title, body, url, tag, data }
// Returns { sent, failed, cleaned } where `cleaned` is the count of
// rows we'd recommend deleting from expo_push_tokens (caller does the
// DELETE so the cleanup is auditable).
export async function sendExpoPush(rows, payload, { onDeadTokens } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }
  const messages = rows.map(r => ({
    to: r.token,
    title: payload.title || 'MyForeman',
    body:  payload.body  || '',
    sound: 'default',
    // `data` is delivered to the native app as the notification's
    // userInfo dict. We mirror the same shape as web push so the
    // native nav code can treat them identically: type + id + url.
    data: {
      type: payload.tag ? payload.tag.split('-')[0] : 'generic',
      id:   payload.tag ? payload.tag.split('-').slice(1).join('-') : null,
      url:  payload.url || '/dashboard',
      ...(payload.data || {}),
    },
  }));

  const dead = [];
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const chunkRows = rows.slice(i, i + 100);
    try {
      const resp = await fetch(EXPO_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Accept':          'application/json',
          'Accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });
      if (!resp.ok) {
        console.warn('[push:expo] HTTP', resp.status, await resp.text().catch(() => ''));
        failed += chunk.length;
        continue;
      }
      const body = await resp.json().catch(() => ({}));
      const tickets = body?.data || [];
      // Per-receipt status. Expo returns one ticket per message in
      // the same order we sent them.
      tickets.forEach((t, idx) => {
        if (t?.status === 'ok') {
          sent++;
        } else {
          failed++;
          const err = t?.details?.error;
          if (err === 'DeviceNotRegistered' || err === 'InvalidCredentials') {
            dead.push(chunkRows[idx].id);
          } else {
            console.warn('[push:expo] ticket error', t?.message, t?.details);
          }
        }
      });
    } catch (e) {
      // Network blip or fetch threw — log + continue. Other chunks
      // (and other surfaces, like Web Push) keep firing.
      failed += chunk.length;
      console.warn('[push:expo] fetch failed', e?.message || e);
    }
  }

  if (dead.length && typeof onDeadTokens === 'function') {
    try { await onDeadTokens(dead); } catch (e) { console.warn('[push:expo] cleanup failed', e?.message); }
  }

  return { sent, failed, cleaned: dead.length };
}
