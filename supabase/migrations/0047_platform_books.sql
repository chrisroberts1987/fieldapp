-- 0047_platform_books.sql
-- "MyForeman the business" bookkeeping. Lets the platform owner log
-- business expenses and tax payments from the admin panel so the
-- Finances tab can render a real P&L instead of just revenue.
--
-- Scope deliberately narrow at this stage: manual entry only, no
-- per-user accounts. Stripe + RevenueCat auto-import lands in a
-- follow-up migration. Access is gated at the API layer via
-- verifyAdmin — no RLS here for the same reason as ai_usage_log.
--
-- Re-runnable via drop-if-exists since the iteration cycle on these
-- tables is fast while we're still shaping the books model. Once a
-- year of real data is in, lock them down and stop dropping.

drop table if exists public.platform_expenses cascade;
drop table if exists public.platform_tax_payments cascade;

create table public.platform_expenses (
  id           uuid primary key default gen_random_uuid(),
  occurred_on  date not null,
  category     text not null check (category in (
    'hosting','ai','ads','software','contractors','salaries',
    'legal','equipment','travel','marketing','fees','other'
  )),
  vendor       text,
  amount       numeric(12,2) not null check (amount >= 0),
  notes        text,
  receipt_url  text,
  -- source = 'manual' for admin-entered rows. Reserved values
  -- 'stripe' and 'revenuecat' are for the Phase 2 auto-importer.
  -- source_id is the upstream record id and lets the importer
  -- skip rows it already inserted.
  source       text not null default 'manual' check (source in ('manual','stripe','revenuecat')),
  source_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index platform_expenses_source_uq
  on public.platform_expenses (source, source_id)
  where source_id is not null;
create index platform_expenses_occurred_idx
  on public.platform_expenses (occurred_on desc);
create index platform_expenses_category_idx
  on public.platform_expenses (category, occurred_on desc);

create table public.platform_tax_payments (
  id           uuid primary key default gen_random_uuid(),
  paid_on      date not null,
  -- Free-text period label so we can record "2026 Q2", "2026", or a
  -- specific month without forcing a rigid format. The P&L grouping
  -- uses paid_on, not this field, so it's purely human-readable.
  period       text not null,
  tax_type     text not null check (tax_type in (
    'federal_quarterly','federal_annual',
    'state_quarterly','state_annual',
    'self_employment','sales','other'
  )),
  amount       numeric(12,2) not null check (amount >= 0),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index platform_tax_payments_paid_idx
  on public.platform_tax_payments (paid_on desc);

-- Auto-bump updated_at on either table.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_platform_expenses_updated     on public.platform_expenses;
drop trigger if exists trg_platform_tax_payments_updated on public.platform_tax_payments;
create trigger trg_platform_expenses_updated
  before update on public.platform_expenses
  for each row execute function public.set_updated_at();
create trigger trg_platform_tax_payments_updated
  before update on public.platform_tax_payments
  for each row execute function public.set_updated_at();
