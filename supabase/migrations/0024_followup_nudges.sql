-- Reminder timestamps for two new nag flows:
--  - Quote follow-up: customer sat 5 days on a sent quote
--  - Pending-job nudge: contractor approved-from-quote a job but
--    hasn't scheduled it yet
--
-- Each gets a single timestamp so the cron knows what was already
-- nudged. We could escalate further (14d / 30d quote follow-ups)
-- later — for v1, one nudge per quote/job is enough signal without
-- becoming spammy.

alter table public.quotes
  add column if not exists followup_sent_at timestamptz;

alter table public.jobs
  add column if not exists pending_nudge_sent_at timestamptz;
