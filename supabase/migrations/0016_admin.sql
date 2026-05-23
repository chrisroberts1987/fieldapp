-- Admin support: suspend a tenant org without deleting their data,
-- plus an audit table of platform-owner actions for accountability.

alter table public.organizations
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

create index if not exists organizations_suspended_idx
  on public.organizations (suspended_at) where suspended_at is not null;

-- ============================================================
-- Audit log for the admin panel. Every privileged action (view-as,
-- suspend, unsuspend, delete) writes a row here so there's a trail.
-- Only the platform admin can read. Inserts come from the server
-- using the service role key, so RLS doesn't block writes.
-- ============================================================
drop table if exists public.admin_events cascade;

create table public.admin_events (
  id            uuid primary key default gen_random_uuid(),
  admin_email   text not null,
  action        text not null,
  target_org_id uuid references public.organizations(id) on delete set null,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index admin_events_created_idx on public.admin_events (created_at desc);
create index admin_events_org_idx     on public.admin_events (target_org_id);

alter table public.admin_events enable row level security;

-- Nobody can read or write through the API path. All access goes
-- through service-role queries in the admin endpoints, which bypass
-- RLS deliberately. The "deny by default" stance keeps anon and
-- authenticated users out even if a future endpoint is added by
-- mistake.
create policy "admin_events deny all" on public.admin_events
  for select using (false);
