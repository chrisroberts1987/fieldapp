-- Expense tracking. Linked optionally to a job (work-order expense) or
-- left orphan for general overhead (insurance, fuel, marketing, etc.).

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  owner_id      uuid references auth.users(id) on delete set null,
  job_id        uuid references public.jobs(id) on delete set null,
  category      text not null default 'other'
                  check (category in ('materials','fuel','labor','equipment','insurance','office','marketing','other')),
  amount        numeric(10,2) not null default 0,
  expense_date  date not null default current_date,
  vendor        text,
  description   text,
  created_at    timestamptz not null default now()
);

create index if not exists expenses_org_idx       on public.expenses (org_id);
create index if not exists expenses_job_idx       on public.expenses (job_id);
create index if not exists expenses_date_idx      on public.expenses (expense_date);
create index if not exists expenses_category_idx  on public.expenses (category);

alter table public.expenses enable row level security;

drop policy if exists "expenses org select" on public.expenses;
drop policy if exists "expenses org insert" on public.expenses;
drop policy if exists "expenses org update" on public.expenses;
drop policy if exists "expenses org delete" on public.expenses;

create policy "expenses org select" on public.expenses
  for select using (public.is_org_member(org_id));
create policy "expenses org insert" on public.expenses
  for insert with check (public.is_org_member(org_id));
create policy "expenses org update" on public.expenses
  for update using (public.is_org_member(org_id));
create policy "expenses org delete" on public.expenses
  for delete using (public.is_org_member(org_id));
