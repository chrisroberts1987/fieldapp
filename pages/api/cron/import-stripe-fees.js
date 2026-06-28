// Daily cron: pull Stripe processing fees from the previous N days of
// balance transactions and insert each one as a platform_expenses row.
// Lets the admin Books P&L subtract real Stripe fees automatically
// instead of relying on manual entry.
//
// Idempotency: each expense row carries source='stripe' and
// source_id=balance_transaction.id, and the platform_expenses table
// has a unique index on (source, source_id). Re-runs skip rows we've
// already inserted (the insert returns a 23505, we swallow and move
// on). Safe to re-run any time.
//
// Window: defaults to 7 days back so a missed cron run still fills
// in. Stripe rate-limits ~100 req/s — at 100/page we can pull weeks
// of history in seconds.

import { createClient } from '@supabase/supabase-js';
import { stripe } from '../../../lib/stripe';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const LOOKBACK_DAYS = 7;
const PAGE_LIMIT   = 100;
const MAX_PAGES    = 50;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase service role not configured.' });
  }
  const s = stripe();
  if (!s) {
    // No Stripe key → nothing to do. Ack 200 so cron stays healthy.
    return res.status(200).json({ ok: true, skipped: 'stripe not configured' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sinceUnix = Math.floor((Date.now() - LOOKBACK_DAYS * 86_400_000) / 1000);

  let inserted = 0, duplicate = 0, skipped = 0, scanned = 0;
  let starting_after;
  for (let page = 0; page < MAX_PAGES; page++) {
    const resp = await s.balanceTransactions.list({
      limit: PAGE_LIMIT,
      created: { gte: sinceUnix },
      ...(starting_after ? { starting_after } : {}),
    });
    if (!resp?.data?.length) break;

    for (const bt of resp.data) {
      scanned++;
      // We only book the FEE portion as a platform expense — the
      // gross charge is already counted as revenue (via MRR). Payouts,
      // adjustments, and zero-fee items skip out.
      if (!bt.fee || bt.fee <= 0) { skipped++; continue; }

      const row = {
        occurred_on: new Date(bt.created * 1000).toISOString().slice(0, 10),
        category:    'fees',
        vendor:      'Stripe',
        amount:      bt.fee / 100, // cents → dollars
        notes:       `${bt.type}${bt.description ? ` · ${bt.description}` : ''}`.slice(0, 2000),
        source:      'stripe',
        source_id:   bt.id,
      };
      const { error } = await sb.from('platform_expenses').insert(row);
      if (error) {
        if (error.code === '23505') duplicate++;
        else {
          console.error('[stripe-fee-import] insert failed', { id: bt.id, error: error.message });
          skipped++;
        }
      } else {
        inserted++;
      }
    }

    if (!resp.has_more) break;
    starting_after = resp.data[resp.data.length - 1].id;
  }

  return res.status(200).json({ ok: true, scanned, inserted, duplicate, skipped, lookbackDays: LOOKBACK_DAYS });
}
