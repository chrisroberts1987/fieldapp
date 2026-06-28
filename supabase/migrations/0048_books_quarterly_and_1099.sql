-- 0048_books_quarterly_and_1099.sql
-- Phase 3 of the platform Books feature:
--   • platform_books_config — singleton row with the rates and state
--     used to project quarterly tax owed. Lets the admin override
--     defaults without redeploying.
--   • vendors_1099 — directory of contractors / vendors who hit the
--     $600 threshold and need a 1099-NEC at year end.
--   • platform_expenses.vendor_1099_id — links a contractor payment
--     to the right 1099 vendor so the year-end report can roll up
--     totals per recipient.
--
-- Re-runnable: drop-if-exists on the new tables. The ALTER on the
-- expenses table uses `if not exists` so dropping and re-adding the
-- config / vendor tables doesn't lose history.

drop table if exists public.platform_books_config cascade;
drop table if exists public.vendors_1099 cascade;

create table public.platform_books_config (
  id                    int primary key default 1 check (id = 1),  -- singleton
  filing_state          text,            -- 2-letter, e.g. 'TX'
  filing_status         text not null default 'single' check (filing_status in ('single','married_joint','married_separate','head_of_household')),
  -- Self-employment tax (Social Security + Medicare). 15.3% standard.
  se_tax_rate           numeric(5,4) not null default 0.1530,
  -- Social Security portion stops above the wage base; Medicare doesn't.
  ss_wage_base          numeric(12,2) not null default 168600.00,
  -- Effective federal income tax rate after deductions. The admin can
  -- override per their bracket / filing status.
  federal_income_rate   numeric(5,4) not null default 0.18,
  -- Effective state income tax rate (top marginal × ~0.7 in practice).
  -- 0 for no-state-income-tax states.
  state_income_rate     numeric(5,4) not null default 0.00,
  updated_at            timestamptz not null default now()
);

-- Seed the singleton row.
insert into public.platform_books_config (id) values (1) on conflict (id) do nothing;

create table public.vendors_1099 (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  business_name   text,
  email           text,
  tax_id          text,             -- EIN or SSN (encrypted at rest by Supabase)
  address         text,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index vendors_1099_active_idx on public.vendors_1099 (active, name);

alter table public.platform_expenses
  add column if not exists vendor_1099_id uuid references public.vendors_1099(id) on delete set null;

create index if not exists platform_expenses_vendor_1099_idx
  on public.platform_expenses (vendor_1099_id, occurred_on desc)
  where vendor_1099_id is not null;

-- updated_at triggers (set_updated_at defined in 0047).
drop trigger if exists trg_platform_books_config_updated on public.platform_books_config;
drop trigger if exists trg_vendors_1099_updated         on public.vendors_1099;
create trigger trg_platform_books_config_updated
  before update on public.platform_books_config
  for each row execute function public.set_updated_at();
create trigger trg_vendors_1099_updated
  before update on public.vendors_1099
  for each row execute function public.set_updated_at();
