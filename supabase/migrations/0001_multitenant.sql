-- Multi-tenant foundation: organizations + org_members, org-scoped RLS.
-- Apply in Supabase SQL editor AFTER the original schema.sql has been applied.
-- This migration is additive + backfilled; safe to run on a DB that already
-- contains rows owned by individual users.

begin;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table if not exists public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  plan                    text not null default 'trial'
                            check (plan in ('trial','active','past_due','canceled')),
  trial_ends_at           timestamptz default (now() + interval '14 days'),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'crew'
                check (role in ('owner','admin','dispatcher','crew')),
  invited_email text,
  invited_at  timestamptz,
  joined_at   timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members (user_id);

-- ============================================================
-- HELPER: is the current user a member of this org?
-- SECURITY DEFINER so this function can read org_members regardless of RLS
-- on that table (otherwise the RLS policies that USE this helper would recurse).
-- ============================================================
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_admin(uuid)  from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid)  to authenticated;

-- ============================================================
-- RPC: create org + add caller as owner, atomically.
-- Called by the signup flow. SECURITY DEFINER bypasses the
-- restrictive RLS on organizations/org_members that prevents
-- direct client inserts.
-- ============================================================
create or replace function public.create_org(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id   uuid;
  v_user_id  uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'company name required';
  end if;
  insert into public.organizations (name)
    values (trim(p_name))
    returning id into v_org_id;
  insert into public.org_members (org_id, user_id, role, joined_at)
    values (v_org_id, v_user_id, 'owner', now());
  return v_org_id;
end;
$$;

revoke all on function public.create_org(text) from public;
grant execute on function public.create_org(text) to authenticated;

-- ============================================================
-- ADD org_id TO EXISTING TABLES (nullable for backfill)
-- ============================================================
alter table public.customers add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.jobs      add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.invoices  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- ============================================================
-- BACKFILL: plain-SQL version. For each user that has rows but no
-- membership, create an org and add them as owner. Then set org_id
-- on every existing row by looking up its owner's membership.
-- Fully idempotent: re-runs are no-ops once everyone has an org.
-- ============================================================
create temporary table if not exists tmp_backfill_pairs (
  user_id uuid not null,
  org_id  uuid not null default gen_random_uuid(),
  name    text not null
);

truncate tmp_backfill_pairs;

insert into tmp_backfill_pairs (user_id, name)
select u.id, coalesce(u.email, 'My Company')
from auth.users u
where (
  exists (select 1 from public.customers c where c.owner_id = u.id)
  or exists (select 1 from public.jobs      j where j.owner_id = u.id)
  or exists (select 1 from public.invoices  i where i.owner_id = u.id)
)
and not exists (select 1 from public.org_members om where om.user_id = u.id);

insert into public.organizations (id, name)
select org_id, name from tmp_backfill_pairs;

insert into public.org_members (org_id, user_id, role, joined_at)
select org_id, user_id, 'owner', now() from tmp_backfill_pairs;

drop table tmp_backfill_pairs;

update public.customers c
set org_id = om.org_id
from public.org_members om
where c.owner_id = om.user_id and c.org_id is null;

update public.jobs j
set org_id = om.org_id
from public.org_members om
where j.owner_id = om.user_id and j.org_id is null;

update public.invoices i
set org_id = om.org_id
from public.org_members om
where i.owner_id = om.user_id and i.org_id is null;

-- ============================================================
-- LOCK IN: org_id is now required on all owned tables.
-- ============================================================
alter table public.customers alter column org_id set not null;
alter table public.jobs      alter column org_id set not null;
alter table public.invoices  alter column org_id set not null;

create index if not exists customers_org_idx on public.customers (org_id);
create index if not exists jobs_org_idx      on public.jobs (org_id);
create index if not exists invoices_org_idx  on public.invoices (org_id);

-- ============================================================
-- REPLACE RLS POLICIES: drop owner-scoped, add org-scoped.
-- owner_id stays on the rows as a "created_by" audit field but no
-- longer gates access.
-- ============================================================

-- customers
drop policy if exists "customers owner select" on public.customers;
drop policy if exists "customers owner insert" on public.customers;
drop policy if exists "customers owner update" on public.customers;
drop policy if exists "customers owner delete" on public.customers;
drop policy if exists "customers org select"   on public.customers;
drop policy if exists "customers org insert"   on public.customers;
drop policy if exists "customers org update"   on public.customers;
drop policy if exists "customers org delete"   on public.customers;
-- (also drop any unnamed-or-older variants that may exist; harmless if absent)
drop policy if exists "Enable read access for owner" on public.customers;

create policy "customers org select" on public.customers
  for select using (public.is_org_member(org_id));
create policy "customers org insert" on public.customers
  for insert with check (public.is_org_member(org_id));
create policy "customers org update" on public.customers
  for update using (public.is_org_member(org_id));
create policy "customers org delete" on public.customers
  for delete using (public.is_org_member(org_id));

-- jobs
drop policy if exists "jobs owner select" on public.jobs;
drop policy if exists "jobs owner insert" on public.jobs;
drop policy if exists "jobs owner update" on public.jobs;
drop policy if exists "jobs owner delete" on public.jobs;
drop policy if exists "jobs org select"   on public.jobs;
drop policy if exists "jobs org insert"   on public.jobs;
drop policy if exists "jobs org update"   on public.jobs;
drop policy if exists "jobs org delete"   on public.jobs;

create policy "jobs org select" on public.jobs
  for select using (public.is_org_member(org_id));
create policy "jobs org insert" on public.jobs
  for insert with check (public.is_org_member(org_id));
create policy "jobs org update" on public.jobs
  for update using (public.is_org_member(org_id));
create policy "jobs org delete" on public.jobs
  for delete using (public.is_org_member(org_id));

-- invoices
drop policy if exists "invoices owner select" on public.invoices;
drop policy if exists "invoices owner insert" on public.invoices;
drop policy if exists "invoices owner update" on public.invoices;
drop policy if exists "invoices owner delete" on public.invoices;
drop policy if exists "invoices org select"   on public.invoices;
drop policy if exists "invoices org insert"   on public.invoices;
drop policy if exists "invoices org update"   on public.invoices;
drop policy if exists "invoices org delete"   on public.invoices;

create policy "invoices org select" on public.invoices
  for select using (public.is_org_member(org_id));
create policy "invoices org insert" on public.invoices
  for insert with check (public.is_org_member(org_id));
create policy "invoices org update" on public.invoices
  for update using (public.is_org_member(org_id));
create policy "invoices org delete" on public.invoices
  for delete using (public.is_org_member(org_id));

-- ============================================================
-- ORGANIZATIONS + ORG_MEMBERS RLS
-- Members can read their org. Only owners/admins can update org.
-- Inserts go through SECURITY DEFINER RPCs (create_org), so client
-- INSERT is denied — no policy = denied.
-- ============================================================
alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;

drop policy if exists "orgs member select" on public.organizations;
drop policy if exists "orgs admin update" on public.organizations;
create policy "orgs member select" on public.organizations
  for select using (public.is_org_member(id));
create policy "orgs admin update" on public.organizations
  for update using (public.is_org_admin(id));

drop policy if exists "org_members member select" on public.org_members;
drop policy if exists "org_members admin update" on public.org_members;
drop policy if exists "org_members admin delete" on public.org_members;
create policy "org_members member select" on public.org_members
  for select using (public.is_org_member(org_id));
create policy "org_members admin update" on public.org_members
  for update using (public.is_org_admin(org_id));
create policy "org_members admin delete" on public.org_members
  for delete using (public.is_org_admin(org_id));

commit;
