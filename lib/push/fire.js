// Fire-and-forget client helper for posting a push event to the
// fan-out endpoint. Used wherever something happens in the app that
// should result in a push notification to org members or a specific
// user. Never throws — push is best-effort, the calling flow's UX
// should never depend on it.

export function firePushEvent(event, refId) {
  try {
    if (typeof fetch === 'undefined') return;
    fetch('/api/push/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, refId }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
