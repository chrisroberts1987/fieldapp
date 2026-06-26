-- 0046_org_is_test_flag.sql
-- Test / internal accounts shouldn't pollute the platform's revenue
-- aggregates (MRR, conversion rate, signups, geographic reach) on the
-- admin overview + finances tabs. The flag defaults to false so any
-- org created via the production signup flow counts as real revenue
-- by default.
--
-- Backfill: every org currently in the database is a pre-launch test
-- account. Apply this migration BEFORE the first real customer signs
-- up — afterwards, real signups stay is_test=false by default and
-- start counting. If a known test account is ever created in the
-- production flow (e.g. for ongoing QA), toggle it manually via the
-- Supabase SQL editor:
--
--   update public.organizations set is_test = true where id = '<id>';

alter table public.organizations
  add column if not exists is_test boolean not null default false;

update public.organizations
   set is_test = true
 where is_test = false;
