// Daily cron: insert a platform_expenses row for every active
// recurring expense whose day_of_month has arrived this calendar
// month and which hasn't already been inserted this month.
//
// Idempotency: last_inserted_on is updated to today's UTC date the
// moment we insert. A re-run on the same day finds last_inserted_on
// in the current month and skips. A day_of_month that doesn't exist
// in the current month (e.g. day=31 in February) is handled by
// pushing the insert to the last actual day of the month — so Claude
// Max set to the 31st still gets a Feb 28/29 entry.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase service role not configured.' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const todayMonth = today.getUTCMonth();
  const todayYear  = today.getUTCFullYear();
  const lastDayThisMonth = new Date(Date.UTC(todayYear, todayMonth + 1, 0)).getUTCDate();

  const { data: rows, error } = await sb
    .from('platform_recurring_expenses')
    .select('*')
    .eq('active', true)
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });

  let inserted = 0, skipped = 0;
  for (const r of rows || []) {
    // Has it already been inserted this calendar month?
    if (r.last_inserted_on) {
      const last = new Date(r.last_inserted_on + 'T00:00:00Z');
      if (last.getUTCFullYear() === todayYear && last.getUTCMonth() === todayMonth) {
        skipped++;
        continue;
      }
    }
    // Effective due day = min(day_of_month, last_day_of_this_month).
    const dueDay = Math.min(r.day_of_month, lastDayThisMonth);
    if (today.getUTCDate() < dueDay) { skipped++; continue; }

    const occurredOn = new Date(Date.UTC(todayYear, todayMonth, dueDay))
      .toISOString().slice(0, 10);

    const { error: insErr } = await sb.from('platform_expenses').insert({
      occurred_on: occurredOn,
      category:    r.category,
      vendor:      r.vendor,
      amount:      r.amount,
      notes:       r.notes ? `${r.name} · ${r.notes}` : r.name,
      source:      'manual',  // recurring rows count as manually-configured
    });
    if (insErr) {
      console.error('[recurring-expenses] insert failed', { id: r.id, error: insErr.message });
      skipped++;
      continue;
    }
    await sb.from('platform_recurring_expenses')
      .update({ last_inserted_on: todayIso })
      .eq('id', r.id);
    inserted++;
  }

  return res.status(200).json({ ok: true, inserted, skipped, scanned: rows?.length || 0 });
}
