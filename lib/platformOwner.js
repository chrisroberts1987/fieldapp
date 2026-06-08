// Shared helpers for "is this user the platform owner".
//
// The platform owner (chris.roberts@myforemanhq.com) is exempt from
// every billing gate — trial banners, past-due banners, the
// no-subscription redirect, the isBlocked() guard, etc. They're the
// one running the platform; charging them a subscription on their
// own product would be circular. They use the regular app to track
// their own MyForeman LLC numbers (expenses, mileage, revenue, tax).

export const PLATFORM_OWNER_EMAIL = 'chris.roberts@myforemanhq.com';

export function isPlatformOwner(user) {
  if (!user) return false;
  const email = (user.email || user.user_metadata?.email || '').toLowerCase();
  return email === PLATFORM_OWNER_EMAIL;
}
