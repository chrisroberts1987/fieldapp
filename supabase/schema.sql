-- Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ============================================================
-- JOBS
-- ============================================================
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null,
  title           text not null,
  description     text,
  status          text not null default 'scheduled'
                    check (status in ('scheduled','in_progress','completed','cancelled')),
  scheduled_date  date,
  price           numeric(10,2) default 0,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists jobs_owner_idx     on public.jobs (owner_id);
create index if not exists jobs_customer_idx  on public.jobs (customer_id);
create index if not exists jobs_status_idx    on public.jobs (status);

alter table public.jobs enable row level security;

drop policy if exists "jobs owner select" on public.jobs;
drop policy if exists "jobs owner insert" on public.jobs;
drop policy if exists "jobs owner update" on public.jobs;
drop policy if exists "jobs owner delete" on public.jobs;

create policy "jobs owner select" on public.jobs
  for select using (auth.uid() = owner_id);
create policy "jobs owner insert" on public.jobs
  for insert with check (auth.uid() = owner_id);
create policy "jobs owner update" on public.jobs
  for update using (auth.uid() = owner_id);
create policy "jobs owner delete" on public.jobs
  for delete using (auth.uid() = owner_id);

-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  job_id        uuid references public.jobs(id) on delete set null,
  customer_id   uuid references public.customers(id) on delete set null,
  amount        numeric(10,2) not null default 0,
  status        text not null default 'unpaid'
                  check (status in ('unpaid','paid')),
  issued_date   date not null default current_date,
  paid_date     date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists invoices_owner_idx    on public.invoices (owner_id);
create index if not exists invoices_job_idx      on public.invoices (job_id);
create index if not exists invoices_status_idx   on public.invoices (status);
create index if not exists invoices_paid_idx     on public.invoices (paid_date);

alter table public.invoices enable row level security;

drop policy if exists "invoices owner select" on public.invoices;
drop policy if exists "invoices owner insert" on public.invoices;
drop policy if exists "invoices owner update" on public.invoices;
drop policy if exists "invoices owner delete" on public.invoices;

create policy "invoices owner select" on public.invoices
  for select using (auth.uid() = owner_id);
create policy "invoices owner insert" on public.invoices
  for insert with check (auth.uid() = owner_id);
create policy "invoices owner update" on public.invoices
  for update using (auth.uid() = owner_id);
create policy "invoices owner delete" on public.invoices
  for delete using (auth.uid() = owner_id);
