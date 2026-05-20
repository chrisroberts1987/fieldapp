-- Job labor tracking, expanded expense categories with deductibility,
-- receipt photo storage.

-- ============================================================
-- JOB LABOR — per-crew hours on a job, snapshotted hourly rate so a
-- later pay-rate change doesn't retroactively alter completed jobs'
-- profitability.
-- ============================================================
drop table if exists public.job_labor cascade;

create table public.job_labor (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  work_date     date not null default current_date,
  hours         numeric(8,2) not null check (hours > 0),
  hourly_rate   numeric(8,2) not null,
  cost          numeric(10,2) generated always as (hours * hourly_rate) stored,
  notes         text,
  created_at    timestamptz not null default now()
);

create index job_labor_org_idx  on public.job_labor (org_id);
create index job_labor_job_idx  on public.job_labor (job_id);
create index job_labor_user_idx on public.job_labor (user_id);

alter table public.job_labor enable row level security;

create policy "labor org select" on public.job_labor
  for select using (public.is_org_member(org_id));
create policy "labor org insert" on public.job_labor
  for insert with check (public.is_org_member(org_id));
create policy "labor org update" on public.job_labor
  for update using (public.is_org_member(org_id));
create policy "labor org delete" on public.job_labor
  for delete using (public.is_org_member(org_id));

-- ============================================================
-- EXPENSE CATEGORIES — add meals, advertising, lodging, vehicle.
-- (mileage stays in mileage_logs; deductible value is computed from
-- that table × IRS_RATE in the app, not stored as expense rows.)
-- ============================================================
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in (
    'materials','fuel','labor','equipment','insurance','office',
    'marketing','meals','advertising','lodging','vehicle','other'
  ));

-- ============================================================
-- RECEIPT PHOTO STORAGE
-- ============================================================
alter table public.expenses
  add column if not exists receipt_url text;

insert into storage.buckets (id, name, public)
  values ('expense-receipts', 'expense-receipts', true)
  on conflict (id) do update set public = true;

drop policy if exists "receipts public read"  on storage.objects;
drop policy if exists "receipts org insert"   on storage.objects;
drop policy if exists "receipts org update"   on storage.objects;
drop policy if exists "receipts org delete"   on storage.objects;

create policy "receipts public read" on storage.objects
  for select using (bucket_id = 'expense-receipts');

create policy "receipts org insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "receipts org update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'expense-receipts'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "receipts org delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
