import { supabase } from '../supabase';

// Client-side push notification helpers.
// All functions are fire-and-forget safe — they never throw, they
// return { ok, error? } so callers can decide UI without try/catch.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Requests permission, subscribes via pushManager, posts to /api/push/subscribe.
// Returns { ok, error?, permission }.
export async function enablePushNotifications() {
  try {
    if (!isPushSupported()) return { ok: false, error: 'Push not supported on this browser.', permission: 'unsupported' };

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) return { ok: false, error: 'Push not configured on the server.', permission: notificationPermission() };

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'Permission not granted.', permission: perm };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not signed in.', permission: perm };

    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      return { ok: false, error: body?.error || `Server rejected the subscription (${r.status}).`, permission: perm };
    }
    return { ok: true, permission: perm };
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not enable notifications.', permission: notificationPermission() };
  }
}

export async function disablePushNotifications() {
  try {
    if (!isPushSupported()) return { ok: true };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { ok: true };
    await sub.unsubscribe();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: true };

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message };
  }
}
