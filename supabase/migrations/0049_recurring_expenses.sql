-- 0049_recurring_expenses.sql
-- Recurring fixed expenses (Claude Max, GitHub, Vercel Pro, etc.).
-- The recurring-expenses cron checks this table daily and inserts a
-- platform_expenses row each month when the current day >= day_of_month
-- and we haven't already inserted for this calendar month.
--
-- last_inserted_on is the natural idempotency guard — comparing its
-- month+year against the cron's "now" prevents double-insertion if
-- the cron fires twice or runs late.

drop table if exists public.platform_recurring_expenses cascade;

create table public.platform_recurring_expenses (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  category         text not null check (category in (
    'hosting','ai','ads','software','contractors','salaries',
    'legal','equipment','travel','marketing','fees','other'
  )),
  vendor           text,
  amount           numeric(12,2) not null check (amount >= 0),
  day_of_month     int not null check (day_of_month between 1 and 31),
  notes            text,
  active           boolean not null default true,
  last_inserted_on date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index platform_recurring_expenses_active_idx
  on public.platform_recurring_expenses (active, day_of_month);

drop trigger if exists trg_platform_recurring_expenses_updated on public.platform_recurring_expenses;
create trigger trg_platform_recurring_expenses_updated
  before update on public.platform_recurring_expenses
  for each row execute function public.set_updated_at();
