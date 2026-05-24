import Stripe from 'stripe';

// Server-side Stripe SDK. The secret key is server-only — never
// expose it to the browser. The publishable key (NEXT_PUBLIC_*) is
// safe to surface client-side.
//
// Returns null if the env var isn't set, so callers can degrade
// gracefully ("Stripe isn't configured yet") instead of throwing.

let cached = null;

export function stripe() {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  cached = new Stripe(key, {
    apiVersion: '2024-12-18.acacia',
    appInfo: { name: 'MyForeman', version: '1.0.0' },
  });
  return cached;
}

export function stripeReady() {
  return !!process.env.STRIPE_SECRET_KEY;
}
