-- Lead pipeline: the front of the "lead to paid" funnel.
-- Apply in Supabase SQL editor.

create table if not exists public.leads (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id) on delete cascade,
  owner_id               uuid references auth.users(id) on delete set null,
  name                   text not null,
  phone                  text,
  email                  text,
  address                text,
  source                 text not null default 'other'
                           check (source in ('call','website','referral','walk_in','other')),
  status                 text not null default 'new'
                           check (status in ('new','contacted','qualified','won','lost')),
  estimated_value        numeric(10,2) default 0,
  follow_up_date         date,
  notes                  text,
  converted_customer_id  uuid references public.customers(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists leads_org_idx    on public.leads (org_id);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_followup_idx on public.leads (follow_up_date);

alter table public.leads enable row level security;

drop policy if exists "leads org select" on public.leads;
drop policy if exists "leads org insert" on public.leads;
drop policy if exists "leads org update" on public.leads;
drop policy if exists "leads org delete" on public.leads;

create policy "leads org select" on public.leads
  for select using (public.is_org_member(org_id));
create policy "leads org insert" on public.leads
  for insert with check (public.is_org_member(org_id));
create policy "leads org update" on public.leads
  for update using (public.is_org_member(org_id));
create policy "leads org delete" on public.leads
  for delete using (public.is_org_member(org_id));
