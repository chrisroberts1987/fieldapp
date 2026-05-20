-- Crew management: tier-aware roles, invitations, hourly pay,
-- job assignment, expense/mileage approval workflow, and tighter
-- RLS on the financial tables for non-foreman roles.

-- ============================================================
-- ORG_INVITATIONS — pending invites with role + pay rate + token
-- ============================================================
drop table if exists public.org_invitations cascade;

create table public.org_invitations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  invited_by        uuid references auth.users(id) on delete set null,
  invite_email      text,
  invite_phone      text,
  role              text not null default 'crew'
                      check (role in ('owner','admin','dispatcher','crew')),
  hourly_pay_rate   numeric(8,2),
  token             text not null default encode(gen_random_bytes(16), 'hex'),
  accepted_at       timestamptz,
  accepted_by       uuid references auth.users(id),
  expires_at        timestamptz not null default (now() + interval '14 days'),
  created_at        timestamptz not null default now()
);

create unique index org_invitations_token_unique on public.org_invitations (token);
create index org_invitations_org_idx on public.org_invitations (org_id);

alter table public.org_invitations enable row level security;

drop policy if exists "invites admin select" on public.org_invitations;
drop policy if exists "invites admin insert" on public.org_invitations;
drop policy if exists "invites admin update" on public.org_invitations;
drop policy if exists "invites admin delete" on public.org_invitations;

create policy "invites admin select" on public.org_invitations
  for select using (public.is_org_admin(org_id));
create policy "invites admin insert" on public.org_invitations
  for insert with check (public.is_org_admin(org_id));
create policy "invites admin update" on public.org_invitations
  for update using (public.is_org_admin(org_id));
create policy "invites admin delete" on public.org_invitations
  for delete using (public.is_org_admin(org_id));

-- ============================================================
-- ORG_MEMBERS — add hourly_pay_rate
-- ============================================================
alter table public.org_members
  add column if not exists hourly_pay_rate numeric(8,2);

-- ============================================================
-- JOBS — assignment fields
-- ============================================================
alter table public.jobs
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at         timestamptz;

create index if not exists jobs_assigned_idx on public.jobs (assigned_to_user_id);

-- ============================================================
-- EXPENSES — approval workflow
-- ============================================================
alter table public.expenses
  add column if not exists approval_status text not null default 'approved'
                            check (approval_status in ('pending','approved','rejected')),
  add column if not exists approved_by     uuid references auth.users(id) on delete set null,
  add column if not exists approved_at     timestamptz,
  add column if not exists rejected_reason text;

create index if not exists expenses_approval_idx on public.expenses (approval_status);

-- ============================================================
-- MILEAGE_LOGS — approval workflow (same shape as expenses)
-- ============================================================
alter table public.mileage_logs
  add column if not exists approval_status text not null default 'approved'
                            check (approval_status in ('pending','approved','rejected')),
  add column if not exists approved_by     uuid references auth.users(id) on delete set null,
  add column if not exists approved_at     timestamptz,
  add column if not exists rejected_reason text;

create index if not exists mileage_approval_idx on public.mileage_logs (approval_status);

-- ============================================================
-- HELPER: is_org_foreman_or_supervisor(p_org_id)
-- (any role except plain crew). Used to gate financial tables.
-- ============================================================
create or replace function public.is_org_office(p_org_id uuid)
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
      and role in ('owner','admin','dispatcher')
  );
$$;

revoke all on function public.is_org_office(uuid) from public;
grant execute on function public.is_org_office(uuid) to authenticated;

-- ============================================================
-- TIGHTEN RLS on financial tables
-- Crew should not be able to read invoices, quotes, or feedback.
-- We keep the existing org-scoped insert/update/delete policies but
-- replace SELECT with foreman/supervisor-only.
-- ============================================================
drop policy if exists "invoices org select" on public.invoices;
create policy "invoices office select" on public.invoices
  for select using (public.is_org_office(org_id));

drop policy if exists "quotes org select" on public.quotes;
create policy "quotes office select" on public.quotes
  for select using (public.is_org_office(org_id));

drop policy if exists "feedback org select" on public.feedback;
create policy "feedback office select" on public.feedback
  for select using (public.is_org_office(org_id));

-- ============================================================
-- PUBLIC RPC: get_public_invite(token)
-- Returns a small slice the invitee's page can render before sign-in.
-- ============================================================
create or replace function public.get_public_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
    'id',              i.id,
    'org_name',        o.name,
    'org_logo_url',    o.logo_url,
    'invite_email',    i.invite_email,
    'invite_phone',    i.invite_phone,
    'role',            i.role,
    'hourly_pay_rate', i.hourly_pay_rate,
    'expires_at',      i.expires_at,
    'accepted_at',     i.accepted_at
  ) into v
  from public.org_invitations i
  join public.organizations o on o.id = i.org_id
  where i.token = p_token;
  return v;
end;
$$;

revoke all on function public.get_public_invite(text) from public;
grant execute on function public.get_public_invite(text) to anon, authenticated;

-- ============================================================
-- RPC: accept_invite(token)
-- Requires authenticated user. Adds them to org_members with the
-- role + pay rate from the invitation, marks invitation accepted.
-- Idempotent if already a member.
-- ============================================================
create or replace function public.accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_user_id uuid := auth.uid();
  v_existing record;
begin
  if v_user_id is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_invite from public.org_invitations where token = p_token;
  if v_invite.id is null then
    raise exception 'invite not found';
  end if;
  if v_invite.accepted_at is not null then
    return jsonb_build_object('ok', true, 'already_accepted', true, 'org_id', v_invite.org_id);
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite has expired';
  end if;

  -- Already-a-member guard: do NOT change role/pay for an existing member.
  -- This is what was downgrading foremen who clicked their own crew-tier
  -- invite link.
  select * into v_existing from public.org_members
    where org_id = v_invite.org_id and user_id = v_user_id;

  if v_existing.user_id is not null then
    update public.org_invitations
      set accepted_at = now(), accepted_by = v_user_id
      where id = v_invite.id;
    return jsonb_build_object('ok', true, 'already_member', true, 'org_id', v_invite.org_id);
  end if;

  insert into public.org_members (org_id, user_id, role, hourly_pay_rate, joined_at)
    values (v_invite.org_id, v_user_id, v_invite.role, v_invite.hourly_pay_rate, now());

  update public.org_invitations
    set accepted_at = now(), accepted_by = v_user_id
    where id = v_invite.id;

  if v_invite.invited_by is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (v_invite.org_id, v_invite.invited_by, 'invite_accepted',
              'Crew member joined',
              coalesce(v_invite.invite_email, v_invite.invite_phone, 'A new member') || ' accepted their invite.',
              '/crew');
  end if;

  return jsonb_build_object('ok', true, 'org_id', v_invite.org_id);
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;

-- ============================================================
-- RPC: list_org_members(p_org_id)
-- Returns jsonb array of {user_id, email, role, hourly_pay_rate,
-- joined_at}. SECURITY DEFINER so the caller can reach auth.users.
-- Only members of the org can call it.
-- ============================================================
create or replace function public.list_org_members(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not a member of this org';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',         om.user_id,
    'email',           u.email,
    'role',            om.role,
    'hourly_pay_rate', om.hourly_pay_rate,
    'joined_at',       om.joined_at
  ) order by om.joined_at), '[]'::jsonb)
  into v
  from public.org_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = p_org_id;

  return v;
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;
