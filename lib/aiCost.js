// Helpers for the AI cost-control wiring (caching + usage logging +
// rate limiting). Used by all /api/ai/* endpoints and the coach.
//
// All writes go through the Supabase service role passed in from the
// caller. The caller already has a service-role client for the
// booking-chat / insights paths, and for the authenticated assistant
// we accept the user-scoped client (the tables have no RLS so writes
// just work).

import crypto from 'crypto';

// Anthropic published rates ($ / 1M tokens). Used to estimate cost
// per call so the admin dashboard has a number to show without hitting
// the billing API. Update when models or prices change.
export const MODEL_RATES = {
  'claude-haiku-4-5-20251001':  { in: 1.00,  out: 5.00 },
  'claude-haiku-4-5':           { in: 1.00,  out: 5.00 },
  'claude-sonnet-4-20250514':   { in: 3.00,  out: 15.00 },
  'claude-sonnet-4-6':          { in: 3.00,  out: 15.00 },
  'claude-opus-4-7':            { in: 5.00,  out: 25.00 },
};

export function estimateCost(model, tokensIn, tokensOut) {
  const r = MODEL_RATES[model] || { in: 0, out: 0 };
  return ((tokensIn || 0) * r.in + (tokensOut || 0) * r.out) / 1_000_000;
}

// Hash a normalized prompt so cosmetic differences (whitespace, case)
// don't fragment the cache. We hash the full conversation history for
// the customer chat (every turn changes context); for the internal
// assistant we hash the last user message only (the most recent ask).
export function promptHash(input) {
  const normalized = String(input || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Look up a cache row that hasn't expired. Returns the reply text or
// null. Increments hit_count on a hit so the admin can see which
// prompts are saving the most spend.
export async function getCachedReply(sb, { source, orgId = null, userId = null, hash }) {
  const q = sb.from('ai_response_cache')
    .select('id, reply, hit_count')
    .eq('source', source)
    .eq('prompt_hash', hash)
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (source === 'customer_chat') q.eq('org_id', orgId);
  else                            q.eq('user_id', userId);
  const { data } = await q;
  const row = data?.[0];
  if (!row) return null;
  // Best-effort hit-count increment. Don't await — the cached reply
  // ships back to the user instantly.
  sb.from('ai_response_cache')
    .update({ hit_count: (row.hit_count || 0) + 1 })
    .eq('id', row.id)
    .then(() => {}, () => {});
  return row.reply;
}

export async function putCachedReply(sb, { source, orgId = null, userId = null, hash, reply, tokensIn = 0, tokensOut = 0, ttlSeconds }) {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  // Upsert by hash; if a row exists for the same prompt scope we
  // overwrite. Don't dedupe in a unique-index because the scope
  // dimension differs by source — easier to just upsert via insert
  // and rely on the TTL to prune old rows.
  await sb.from('ai_response_cache').insert({
    source,
    org_id:  source === 'customer_chat' ? orgId : null,
    user_id: source === 'internal_ai'   ? userId : null,
    prompt_hash: hash,
    reply,
    tokens_in:  tokensIn,
    tokens_out: tokensOut,
    expires_at: expires,
  });
}

export async function logUsage(sb, { source, orgId = null, userId = null, model, tokensIn = 0, tokensOut = 0, cached = false }) {
  const cost = cached ? 0 : estimateCost(model, tokensIn, tokensOut);
  await sb.from('ai_usage_log').insert({
    source,
    org_id: orgId,
    user_id: userId,
    model,
    tokens_in:  cached ? 0 : tokensIn,
    tokens_out: cached ? 0 : tokensOut,
    estimated_cost: cost,
    cached,
  });
}

// Service-role wrapper for the rate-limit RPC. Returns true if the
// user has tripped the limit. Falls back to "not limited" if the RPC
// errors so a Supabase blip can't lock contractors out of their AI.
export async function rateLimitExceeded(sb, { userId, source, max, windowSeconds }) {
  try {
    const { data } = await sb.rpc('ai_rate_limit_exceeded', {
      p_user_id: userId,
      p_source: source,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    return !!data;
  } catch {
    return false;
  }
}
