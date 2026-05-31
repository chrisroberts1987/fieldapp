// Fire-and-forget client helper for posting a push event to the
// fan-out endpoint. Used wherever something happens in the app that
// should result in a push notification to org members or a specific
// user. Never throws — push is best-effort, the calling flow's UX
// should never depend on it.

// `extra` lets specific events (trial_ending, future ones) attach
// additional context into the body without changing the call sites
// that already pass just (event, refId).
export function firePushEvent(event, refId, extra = null) {
  try {
    if (typeof fetch === 'undefined') return;
    const body = (extra && typeof extra === 'object')
      ? { event, refId, ...extra }
      : { event, refId };
    fetch('/api/push/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
