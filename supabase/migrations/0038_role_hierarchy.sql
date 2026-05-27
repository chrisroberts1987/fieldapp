-- Role hierarchy: turn the flat (foreman + supervisor + crew) model
-- into a real tree where each crew member reports to exactly one
-- supervisor and each job belongs to one supervisor's queue.
--
-- Data model:
--   org_members.supervisor_id  → which supervisor a crew member reports to.
--                               Only applies to role='crew'. NULL means
--                               "reports directly to foreman" (a one-shop
--                               solo crew member). Foreman + supervisors
--                               keep supervisor_id NULL.
--   jobs.supervisor_id         → which supervisor is responsible for the
--                               job. Foreman sets this on creation; if
--                               unset, ownership inherits via
--                               assigned_to_user_id → the assignee's
--                               supervisor.
--
-- Access pattern (enforced by RLS, not client code):
--   FOREMAN:    sees everything in their org.
--   SUPERVISOR: sees jobs in their queue (supervisor_id=me) AND jobs
--               assigned to one of their crew. Sees crew members where
--               supervisor_id=me. Sees expense + mileage submissions
--               by those crew members. Does NOT see invoices/quotes/
--               feedback (was previously visible to "office" — that
--               window closes here).
--   CREW:       sees jobs assigned to them + jobs in their supervisor's
--               open pool (assigned_to_user_id NULL, same supervisor).
--               Sees their own expenses + mileage. Does NOT see
--               financial tables.
--
-- The TopNav nav-tab gating is the second layer of defense, but RLS
-- is the only thing that actually protects data.

begin;

-- =============================================================
-- 1. Columns
-- =============================================================
alter table public.org_members
  add column if not exists supervisor_id uuid references auth.users(id) on delete set null;

alter table public.jobs
  add column if not exists supervisor_id uuid references auth.users(id) on delete set null;

create index if not exists org_members_supervisor_idx on public.org_members (supervisor_id);
create index if not exists jobs_supervisor_idx        on public.jobs (supervisor_id);

-- =============================================================
-- 2. Role-check helpers
-- =============================================================
-- is_org_admin already exists (returns true for owner|admin). We alias
-- it as is_org_foreman so call sites read naturally, but keep the old
-- name around for backward compat.
create or replace function public.is_org_foreman(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

create or replace function public.is_org_supervisor(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = 'dispatcher'
  );
$$;

-- Returns the caller's supervisor_id within an org. NULL if the caller
-- isn't a crew member of that org. Cached so RLS subqueries don't
-- re-execute per row.
create or replace function public.my_supervisor_id(p_org_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select supervisor_id
  from public.org_members
  where org_id = p_org_id
    and user_id = auth.uid()
    and role = 'crew'
  limit 1;
$$;

revoke all on function public.is_org_foreman(uuid)    from public;
revoke all on function public.is_org_supervisor(uuid) from public;
revoke all on function public.my_supervisor_id(uuid)  from public;
grant execute on function public.is_org_foreman(uuid)    to authenticated;
grant execute on function public.is_org_supervisor(uuid) to authenticated;
grant execute on function public.my_supervisor_id(uuid)  to authenticated;

-- =============================================================
-- 3. JOBS — hierarchy-aware SELECT, hierarchy-aware UPDATE
-- =============================================================
drop policy if exists "jobs org select"        on public.jobs;
drop policy if exists "jobs hierarchy select"  on public.jobs;
create policy "jobs hierarchy select" on public.jobs
  for select using (
    -- Foreman: full org access.
    public.is_org_foreman(org_id)
    -- Supervisor: jobs explicitly routed to them, OR jobs assigned to
    -- one of their direct reports (so they catch jobs the foreman
    -- dispatched directly to a crew member without setting supervisor_id).
    or (public.is_org_supervisor(org_id) and (
      jobs.supervisor_id = auth.uid()
      or jobs.assigned_to_user_id in (
        select user_id from public.org_members
        where org_id = jobs.org_id and supervisor_id = auth.uid()
      )
    ))
    -- Crew: direct assignment, OR open pool within their supervisor.
    or (
      jobs.assigned_to_user_id = auth.uid()
      or (
        jobs.assigned_to_user_id is null
        and jobs.supervisor_id is not null
        and jobs.supervisor_id = public.my_supervisor_id(org_id)
      )
    )
  );

drop policy if exists "jobs org update"        on public.jobs;
drop policy if exists "jobs hierarchy update"  on public.jobs;
create policy "jobs hierarchy update" on public.jobs
  for update using (
    public.is_org_foreman(org_id)
    or (public.is_org_supervisor(org_id) and (
      jobs.supervisor_id = auth.uid()
      or jobs.assigned_to_user_id in (
        select user_id from public.org_members
        where org_id = jobs.org_id and supervisor_id = auth.uid()
      )
      -- Supervisors need to be able to assign open-pool jobs in their
      -- queue, so include those too.
      or (jobs.supervisor_id = auth.uid() and jobs.assigned_to_user_id is null)
    ))
    or jobs.assigned_to_user_id = auth.uid()
    or (
      -- Crew claiming an unassigned job from their supervisor's pool.
      jobs.assigned_to_user_id is null
      and jobs.supervisor_id = public.my_supervisor_id(org_id)
    )
  );

-- INSERT + DELETE: foreman + supervisor only (crew can claim via update).
drop policy if exists "jobs org insert"        on public.jobs;
drop policy if exists "jobs hierarchy insert"  on public.jobs;
create policy "jobs hierarchy insert" on public.jobs
  for insert with check (
    public.is_org_foreman(org_id)
    or public.is_org_supervisor(org_id)
  );

drop policy if exists "jobs org delete"        on public.jobs;
drop policy if exists "jobs hierarchy delete"  on public.jobs;
create policy "jobs hierarchy delete" on public.jobs
  for delete using (
    public.is_org_foreman(org_id)
    or (public.is_org_supervisor(org_id) and jobs.supervisor_id = auth.uid())
  );

-- =============================================================
-- 4. EXPENSES — hierarchy-aware
-- =============================================================
drop policy if exists "expenses org select"       on public.expenses;
drop policy if exists "expenses hierarchy select" on public.expenses;
create policy "expenses hierarchy select" on public.expenses
  for select using (
    public.is_org_foreman(org_id)
    or (public.is_org_supervisor(org_id) and (
      expenses.owner_id = auth.uid()
      or expenses.owner_id in (
        select user_id from public.org_members
        where org_id = expenses.org_id and supervisor_id = auth.uid()
      )
    ))
    or expenses.owner_id = auth.uid()
  );

drop policy if exists "expenses org update"       on public.expenses;
drop policy if exists "expenses hierarchy update" on public.expenses;
create policy "expenses hierarchy update" on public.expenses
  for update using (
    public.is_org_foreman(org_id)
    or (public.is_org_supervisor(org_id) and expenses.owner_id in (
      select user_id from public.org_members
      where org_id = expenses.org_id and supervisor_id = auth.uid()
    ))
    or expenses.owner_id = auth.uid()
  );

-- INSERT + DELETE left org-scoped so crew can still submit; ownership
-- gates write access via owner_id check at the app layer.
drop policy if exists "expenses org insert"       on public.expenses;
drop policy if exists "expenses hierarchy insert" on public.expenses;
create policy "expenses hierarchy insert" on public.expenses
  for insert with check (public.is_org_member(org_id));

drop policy if exists "expenses org delete"       on public.expenses;
drop policy if exists "expenses hierarchy delete" on public.expenses;
create policy "expenses hierarchy delete" on public.expenses
  for delete using (
    public.is_org_foreman(org_id)
    or expenses.owner_id = auth.uid()
  );

-- =============================================================
-- 5. MILEAGE_LOGS — hierarchy-aware
-- =============================================================
drop policy if exists "mileage_logs org select"       on public.mileage_logs;
drop policy if exists "mileage_logs hierarchy select" on public.mileage_logs;
create policy "mileage_logs hierarchy select" on public.mileage_logs
  for select using (
    public.is_org_foreman(org_id)
    or (public.is_org_supervisor(org_id) and (
      mileage_logs.user_id = auth.uid()
      or mileage_logs.user_id in (
        select user_id from public.org_members
        where org_id = mileage_logs.org_id and supervisor_id = auth.uid()
      )
    ))
    or mileage_logs.user_id = auth.uid()
  );

drop policy if exists "mileage_logs org update"       on public.mileage_logs;
drop policy if exists "mileage_logs hierarchy update" on public.mileage_logs;
create policy "mileage_logs hierarchy update" on public.mileage_logs
  for update using (
    public.is_org_foreman(org_id)
    or (public.is_org_supervisor(org_id) and mileage_logs.user_id in (
      select user_id from public.org_members
      where org_id = mileage_logs.org_id and supervisor_id = auth.uid()
    ))
    or mileage_logs.user_id = auth.uid()
  );

drop policy if exists "mileage_logs org insert"       on public.mileage_logs;
drop policy if exists "mileage_logs hierarchy insert" on public.mileage_logs;
create policy "mileage_logs hierarchy insert" on public.mileage_logs
  for insert with check (public.is_org_member(org_id));

drop policy if exists "mileage_logs org delete"       on public.mileage_logs;
drop policy if exists "mileage_logs hierarchy delete" on public.mileage_logs;
create policy "mileage_logs hierarchy delete" on public.mileage_logs
  for delete using (
    public.is_org_foreman(org_id)
    or mileage_logs.user_id = auth.uid()
  );

-- =============================================================
-- 6. INVOICES / QUOTES / FEEDBACK — foreman-only SELECT
--
-- Migration 0008 opened these to "office" (foreman + supervisor).
-- The new hierarchy walls supervisors off from $$ entirely.
-- =============================================================
drop policy if exists "invoices office select"   on public.invoices;
drop policy if exists "invoices foreman select"  on public.invoices;
create policy "invoices foreman select" on public.invoices
  for select using (public.is_org_foreman(org_id));

drop policy if exists "quotes office select"     on public.quotes;
drop policy if exists "quotes foreman select"    on public.quotes;
create policy "quotes foreman select" on public.quotes
  for select using (public.is_org_foreman(org_id));

drop policy if exists "feedback office select"   on public.feedback;
drop policy if exists "feedback foreman select"  on public.feedback;
create policy "feedback foreman select" on public.feedback
  for select using (public.is_org_foreman(org_id));

-- =============================================================
-- 7. list_org_members — surface supervisor_id so the foreman UI can
-- show who reports to whom.
-- =============================================================
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
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v
    from (
      select om.user_id,
             u.email,
             om.role,
             om.hourly_pay_rate,
             om.joined_at,
             om.display_name,
             om.supervisor_id
      from public.org_members om
      left join auth.users u on u.id = om.user_id
      where om.org_id = p_org_id
      order by om.joined_at asc
    ) t;
  return v;
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

-- =============================================================
-- 8. set_member_supervisor — foreman-only RPC to wire up the tree.
-- Validates: caller is foreman of the org, target is a crew member,
-- supervisor is a dispatcher in the same org. Pass NULL supervisor
-- to clear an assignment.
-- =============================================================
create or replace function public.set_member_supervisor(
  p_member_user_id uuid,
  p_supervisor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_member_role text;
  v_sup_role text;
begin
  -- Resolve the org via the target member's row, so the foreman doesn't
  -- need to pass org_id explicitly. Locks us to "the member's org" —
  -- a foreman can only touch members within their own org.
  select org_id, role into v_org_id, v_member_role
    from public.org_members where user_id = p_member_user_id
    order by joined_at asc limit 1;
  if v_org_id is null then
    raise exception 'member not found';
  end if;
  if not public.is_org_foreman(v_org_id) then
    raise exception 'only the foreman can assign supervisors';
  end if;
  if v_member_role <> 'crew' then
    raise exception 'only crew members can be assigned to a supervisor (target is %)', v_member_role;
  end if;

  if p_supervisor_user_id is not null then
    select role into v_sup_role from public.org_members
      where org_id = v_org_id and user_id = p_supervisor_user_id;
    if v_sup_role is null then
      raise exception 'supervisor is not a member of this org';
    end if;
    if v_sup_role <> 'dispatcher' then
      raise exception 'target supervisor must have the Supervisor role (got %)', v_sup_role;
    end if;
  end if;

  update public.org_members
    set supervisor_id = p_supervisor_user_id
    where user_id = p_member_user_id and org_id = v_org_id;

  return jsonb_build_object('ok', true, 'member_user_id', p_member_user_id, 'supervisor_user_id', p_supervisor_user_id);
end;
$$;

revoke all on function public.set_member_supervisor(uuid, uuid) from public;
grant execute on function public.set_member_supervisor(uuid, uuid) to authenticated;

-- =============================================================
-- 9. set_job_supervisor — foreman or supervisor can route a job.
-- Supervisors can only assign jobs already in their queue.
-- =============================================================
create or replace function public.set_job_supervisor(
  p_job_id uuid,
  p_supervisor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_existing_sup uuid;
begin
  select org_id, supervisor_id into v_org_id, v_existing_sup
    from public.jobs where id = p_job_id;
  if v_org_id is null then
    raise exception 'job not found';
  end if;

  if not (
    public.is_org_foreman(v_org_id)
    or (public.is_org_supervisor(v_org_id) and v_existing_sup = auth.uid())
  ) then
    raise exception 'not authorized to route this job';
  end if;

  if p_supervisor_user_id is not null then
    if not exists (
      select 1 from public.org_members
      where org_id = v_org_id and user_id = p_supervisor_user_id and role = 'dispatcher'
    ) then
      raise exception 'target user is not a supervisor in this org';
    end if;
  end if;

  update public.jobs set supervisor_id = p_supervisor_user_id
    where id = p_job_id;

  return jsonb_build_object('ok', true, 'job_id', p_job_id, 'supervisor_id', p_supervisor_user_id);
end;
$$;

revoke all on function public.set_job_supervisor(uuid, uuid) from public;
grant execute on function public.set_job_supervisor(uuid, uuid) to authenticated;

-- =============================================================
-- 10. Backfill supervisor_id on jobs from the assignee's supervisor.
-- One-shot — if a job is already assigned to a crew member who reports
-- to a supervisor, mirror that on the job so the queue lights up.
-- =============================================================
update public.jobs j
  set supervisor_id = om.supervisor_id
  from public.org_members om
  where j.supervisor_id is null
    and j.assigned_to_user_id is not null
    and om.user_id = j.assigned_to_user_id
    and om.org_id  = j.org_id
    and om.supervisor_id is not null;

commit;
