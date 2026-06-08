// Vercel-cron backstop for the demo reset. The Supabase project has
// a pg_cron schedule that calls reset_demo_account_v2() at 06:00 UTC
// daily, but pg_cron is an opt-in extension and silent failures are
// hard to spot. This endpoint runs at 06:30 UTC via Vercel cron and
// re-invokes the same RPC so the demo data stays fresh every day,
// every month — without depending on whether pg_cron is enabled.
//
// Auth: identical pattern to the other crons here (Bearer
// CRON_SECRET, set in Vercel project settings, injected automatically
// by Vercel on cron invocations).

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

  const startedAt = new Date().toISOString();
  const { error } = await sb.rpc('reset_demo_account_v2');
  if (error) {
    console.error('[cron:demo-refresh]', error.message);
    return res.status(500).json({ ok: false, error: error.message, startedAt });
  }

  return res.status(200).json({ ok: true, startedAt, finishedAt: new Date().toISOString() });
}
