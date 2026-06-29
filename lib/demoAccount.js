// Shared helpers for "is this user the public demo account".
//
// The demo account (demo@myforemanhq.com) is a marketing showcase
// that any visitor can sign into. Database triggers (see migration
// 0050) block writes server-side; client-side wrappers detect the
// resulting exception and pop a friendly sign-up modal instead of
// surfacing the raw error.

export const DEMO_EMAIL = 'demo@myforemanhq.com';

export function isDemoUser(user) {
  if (!user) return false;
  const email = (user.email || user.user_metadata?.email || '').toLowerCase();
  return email === DEMO_EMAIL;
}

// Signature that the server-side trigger raises. The fetch interceptor
// matches against this so non-demo errors (e.g. RLS denial, validation)
// don't trigger the demo modal.
export const DEMO_READONLY_MARKER = 'demo_account_readonly';
