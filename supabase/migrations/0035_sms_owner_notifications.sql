-- Per-org SMS notification preferences. Used for platform-to-owner
-- texts: new lead landed, quote approved, invoice paid, trial
-- ending. NOT for customer-facing SMS — MyForeman doesn't text
-- customers on the contractor's behalf.
--
-- sms_phone is the owner's mobile (separate from organizations.phone
-- which is the business' public-facing number on invoices).
--
-- trial_ending_sms_sent_at prevents the cron from texting the same
-- org every day until they sign up.

begin;

alter table public.organizations
  add column if not exists sms_phone                  text,
  add column if not exists sms_notifications_enabled  boolean not null default true,
  add column if not exists trial_ending_sms_sent_at   timestamptz;

commit;
