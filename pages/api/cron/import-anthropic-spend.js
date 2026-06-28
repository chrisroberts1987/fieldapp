// Daily cron: pull yesterday's actual Anthropic API spend from the
// Admin API and book it as a platform_expenses row. Replaces the
// per-call estimate in ai_usage_log with the real invoiced amount.
//
// Idempotency: source='anthropic' + source_id='anthropic-<YYYY-MM-DD>'
// hits the unique (source, source_id) index on a re-run. Safe to
// trigger manually for backfill — just pass ?days=30 to widen the
// lookback (max 90 to keep the import bounded).
//
// Requires ANTHROPIC_ADMIN_KEY (sk-ant-admin-...) generated at
// console.anthropic.com → Settings → Admin Keys. The regular API key
// does NOT work for this endpoint.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const ADMIN_KEY    = process.env.ANTHROPIC_ADMIN_KEY;

const ENDPOINT = 'https://api.anthropic.com/v1/organizations/cost_report';
const MAX_BACKFILL_DAYS = 90;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase service role not configured.' });
  }
  if (!ADMIN_KEY) {
    // Ack so the cron stays healthy when the key isn't set yet.
    return res.status(200).json({ ok: true, skipped: 'ANTHROPIC_ADMIN_KEY not configured' });
  }

  const days = Math.min(Math.max(1, Number(req.query.days) || 2), MAX_BACKFILL_DAYS);
  const now = new Date();
  const endingAt   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const startingAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days)).toISOString();

  let report;
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key':         ADMIN_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        starting_at:   startingAt,
        ending_at:     endingAt,
        bucket_width: '1d',
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        error: `Anthropic API ${r.status}: ${body?.error?.message || JSON.stringify(body).slice(0, 200)}`,
      });
    }
    report = body;
  } catch (e) {
    return res.status(200).json({ ok: false, error: `Anthropic fetch failed: ${e?.message || e}` });
  }

  // The cost_report response shape (as of this writing):
  //   { data: [ { starting_at, ending_at, results: [ { amount, currency, ... } ] }, ... ] }
  // We aggregate the per-bucket cost across results in case Anthropic
  // breaks it down by model / workspace.
  const buckets = Array.isArray(report?.data) ? report.data : [];
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let inserted = 0, updated = 0, skipped = 0;
  for (const b of buckets) {
    const day = String(b.starting_at || '').slice(0, 10);
    if (!day) { skipped++; continue; }
    const total = (b.results || []).reduce((s, r) => {
      const v = Number(r.amount ?? r.cost ?? r.cost_usd ?? 0);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
    if (total <= 0) { skipped++; continue; }

    const sourceId = `anthropic-${day}`;
    const row = {
      occurred_on: day,
      category:    'ai',
      vendor:      'Anthropic',
      amount:      Math.round(total * 100) / 100,
      notes:       `Anthropic API cost · ${day}`,
      source:      'anthropic',
      source_id:   sourceId,
    };
    // Upsert via (source, source_id) so re-running a backfill updates
    // the row instead of erroring — costs occasionally restate.
    const { data: existing } = await sb.from('platform_expenses')
      .select('id, amount').eq('source', 'anthropic').eq('source_id', sourceId).maybeSingle();
    if (existing) {
      if (Number(existing.amount) !== row.amount) {
        await sb.from('platform_expenses').update({ amount: row.amount }).eq('id', existing.id);
        updated++;
      } else {
        skipped++;
      }
    } else {
      const { error } = await sb.from('platform_expenses').insert(row);
      if (error) {
        console.error('[anthropic-import] insert failed', { day, error: error.message });
        skipped++;
      } else {
        inserted++;
      }
    }
  }

  return res.status(200).json({
    ok: true,
    window:   { from: startingAt.slice(0, 10), to: endingAt.slice(0, 10), days },
    buckets:  buckets.length,
    inserted, updated, skipped,
  });
}
