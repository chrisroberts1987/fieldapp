// Plan definitions + helpers shared between the billing page, the
// landing pricing section, and the subscription checkout endpoint.
// Annual cycles are 10x monthly (≈ 2 months free), matching what
// the landing page advertises.

export const PLANS = {
  solo: {
    key:      'solo',
    name:     'Solo',
    monthly:  39,
    annual:   390,
    users:    '1 user',
    subtitle: 'For owner-operators',
  },
  crew: {
    key:      'crew',
    name:     'Crew',
    monthly:  69,
    annual:   690,
    users:    'Up to 10 users',
    subtitle: 'For service crews',
    popular:  true,
  },
  business: {
    key:      'business',
    name:     'Business',
    monthly:  159,
    annual:   1590,
    users:    'Up to 25 users',
    subtitle: 'For multi-crew shops',
  },
};

export const PLAN_ORDER = ['solo', 'crew', 'business'];

// Look up the Stripe Price ID for (tier, billing). The platform owner
// creates these prices once in the Stripe Dashboard and pastes the
// IDs into Vercel env vars. Returns null if a price isn't configured
// — callers should fall back gracefully.
export function priceIdFor(tier, billing) {
  const key = `STRIPE_PRICE_${String(tier).toUpperCase()}_${String(billing).toUpperCase()}`;
  return process.env[key] || null;
}

// Is this status "blocking" — i.e. the org should be redirected to
// /billing because they can't legitimately use the app right now?
// Trial users with time left are NOT blocked.
export function isBlocked(org) {
  if (!org) return false;
  const status = org.subscription_status;
  if (status === 'active' || status === 'trialing') {
    // Trialing is fine as long as trial_ends_at is in the future
    if (status === 'trialing') {
      const end = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
      if (end && end.getTime() < Date.now()) return true; // trial ran out
    }
    return false;
  }
  if (status === 'past_due') return false;        // soft warning, not blocked
  if (status === 'canceled' || status === 'expired' || status === 'unpaid' || status === 'incomplete_expired') return true;
  return false;
}

// Days remaining in trial. null when not on a trial.
export function trialDaysLeft(org) {
  if (!org || org.subscription_status !== 'trialing' || !org.trial_ends_at) return null;
  const ms = new Date(org.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// Seat caps per plan tier. The numeric value is the **total** number
// of members allowed on the org (owner + crew). Solo allows 1 = the
// owner alone. Business caps at 25 with a "contact support" exception
// — we don't auto-upgrade beyond Business.
//
// During trial (no subscription_tier set yet) we honor Crew limits
// (10) so the trialing contractor can explore team features without
// being blocked. Once they pick a plan, the real cap kicks in.
export const SEAT_LIMITS = {
  solo:     1,
  crew:     10,
  business: 25,
};
export const SEAT_LIMIT_TRIAL = 10;

export function seatLimitFor(org) {
  if (!org) return SEAT_LIMIT_TRIAL;
  const tier = org.subscription_tier;
  if (tier && SEAT_LIMITS[tier] != null) return SEAT_LIMITS[tier];
  // No tier picked yet (still trialing) — generous default.
  return SEAT_LIMIT_TRIAL;
}

// Returns one of: 'ok' (under cap), 'at_cap' (cannot add more),
// 'upgrade_available' (cap reachable by upgrading to a higher tier),
// 'contact_support' (already at the highest tier — needs a custom
// arrangement). currentCount should include the owner.
export function seatStatus(org, currentCount) {
  const limit = seatLimitFor(org);
  if (currentCount < limit) return { state: 'ok', limit, currentCount };
  const tier = org?.subscription_tier;
  if (tier === 'business') {
    return { state: 'contact_support', limit, currentCount };
  }
  return { state: 'upgrade_available', limit, currentCount, nextTier: tier === 'crew' ? 'business' : 'crew' };
}
