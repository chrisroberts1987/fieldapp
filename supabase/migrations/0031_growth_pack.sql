-- Growth Pack: calendar/dispatch helpers, recurring jobs, time clock,
-- job checklists, customer properties, quote line items + service
-- catalog, job materials, on-the-way events, customer portal token,
-- review deflection settings, audit log, two-way SMS scaffold,
-- payments-platform settings. Per memory: new tables get
-- drop-if-exists. Adds to jobs/customers/feedback/organizations are
-- column-level alters and check the constraint trick.

begin;

-- ============================================================
-- jobs.scheduled_time (HH:MM, optional) — for calendar slot display.
-- jobs.on_my_way_at — when the crew tapped the "we're on the way"
--   button. Drives "ETA: arriving" copy in any future portal view.
-- ============================================================
alter table public.jobs
  add column if not exists scheduled_time time,
  add column if not exists on_my_way_at   timestamptz,
  add column if not exists property_id    uuid;

-- ============================================================
-- CUSTOMER PROPERTIES (multi-site customers — strip malls, HOAs)
-- ============================================================
drop table if exists public.customer_properties cascade;

create table public.customer_properties (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  label         text not null,
  address       text,
  notes         text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now()
);

create index customer_properties_customer_idx on public.customer_properties (customer_id);
create index customer_properties_org_idx      on public.customer_properties (org_id);

alter table public.customer_properties enable row level security;

create policy "customer_properties org select" on public.customer_properties
  for select using (public.is_org_member(org_id));
create policy "customer_properties org insert" on public.customer_properties
  for insert with check (public.is_org_member(org_id));
create policy "customer_properties org update" on public.customer_properties
  for update using (public.is_org_member(org_id));
create policy "customer_properties org delete" on public.customer_properties
  for delete using (public.is_org_member(org_id));

-- Backfill: every existing customer with a non-empty address gets one
-- primary property record. New customers can keep using customers.address
-- as the implicit primary property; if they ever add a second site, the
-- UI will surface this table.
insert into public.customer_properties (org_id, customer_id, label, address, is_primary)
select c.org_id, c.id, 'Primary', c.address, true
from public.customers c
where c.address is not null and trim(c.address) <> ''
  and not exists (
    select 1 from public.customer_properties p where p.customer_id = c.id
  );

-- Wire jobs.property_id to the new table now that it exists.
alter table public.jobs
  add constraint jobs_property_fk
  foreign key (property_id) references public.customer_properties(id)
  on delete set null
  not valid;

-- ============================================================
-- RECURRING JOBS — maintenance plans, weekly lawn care, etc.
-- A row here is a "template + cadence". The cron materializes the
-- next job from each active row on the cadence boundary.
-- ============================================================
drop table if exists public.recurring_jobs cascade;

create table public.recurring_jobs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  customer_id    uuid not null references public.customers(id) on delete cascade,
  property_id    uuid references public.customer_properties(id) on delete set null,
  title          text not null,
  description    text,
  price          numeric(10,2) not null default 0,
  cadence        text not null
                  check (cadence in ('weekly','biweekly','monthly','quarterly','yearly')),
  -- ISO weekday for weekly/biweekly cadences. 1=Mon, 7=Sun. Null for
  -- monthly+ where day-of-month is what matters.
  weekday        int check (weekday is null or (weekday between 1 and 7)),
  -- day of month for monthly/quarterly/yearly (1-28 to avoid Feb edge case)
  day_of_month   int check (day_of_month is null or (day_of_month between 1 and 28)),
  next_run_date  date not null default current_date,
  active         boolean not null default true,
  last_job_id    uuid references public.jobs(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index recurring_org_idx        on public.recurring_jobs (org_id);
create index recurring_active_idx     on public.recurring_jobs (active, next_run_date);

alter table public.recurring_jobs enable row level security;

create policy "recurring org select" on public.recurring_jobs
  for select using (public.is_org_member(org_id));
create policy "recurring org insert" on public.recurring_jobs
  for insert with check (public.is_org_member(org_id));
create policy "recurring org update" on public.recurring_jobs
  for update using (public.is_org_member(org_id));
create policy "recurring org delete" on public.recurring_jobs
  for delete using (public.is_org_member(org_id));

-- Cron-callable RPC: advance every due recurring_jobs row by creating
-- the next job and bumping next_run_date. Returns the number of jobs
-- created. Security definer so a service-role API can call it.
create or replace function public.materialize_recurring_jobs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_next  date;
  v_job   uuid;
begin
  for r in
    select * from public.recurring_jobs
    where active = true and next_run_date <= current_date
  loop
    insert into public.jobs (
      org_id, customer_id, property_id, title, description, price,
      status, scheduled_date
    ) values (
      r.org_id, r.customer_id, r.property_id, r.title, r.description, r.price,
      'scheduled', r.next_run_date
    )
    returning id into v_job;

    v_next := case r.cadence
      when 'weekly'    then r.next_run_date + interval '7 days'
      when 'biweekly'  then r.next_run_date + interval '14 days'
      when 'monthly'   then r.next_run_date + interval '1 month'
      when 'quarterly' then r.next_run_date + interval '3 months'
      when 'yearly'    then r.next_run_date + interval '1 year'
    end;

    update public.recurring_jobs
      set next_run_date = v_next,
          last_job_id   = v_job
      where id = r.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.materialize_recurring_jobs() from public;
grant execute on function public.materialize_recurring_jobs() to service_role, authenticated;

-- ============================================================
-- TIME ENTRIES — crew clock in/out per job (replaces manual job_labor
-- minutes when crew uses the clock). We keep job_labor for back-of-
-- napkin entries; time_entries is the source of truth when present.
-- ============================================================
drop table if exists public.time_entries cascade;

create table public.time_entries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  job_id       uuid not null references public.jobs(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  clock_in_at  timestamptz not null default now(),
  clock_out_at timestamptz,
  -- snapshot of GPS where the clock action happened, optional. Truncated
  -- to ~10m precision (4 decimals) so we never store more than needed.
  in_lat       numeric(9,6),
  in_lng       numeric(9,6),
  out_lat      numeric(9,6),
  out_lng      numeric(9,6),
  notes        text,
  created_at   timestamptz not null default now()
);

create index time_entries_job_idx  on public.time_entries (job_id);
create index time_entries_user_idx on public.time_entries (user_id);
create index time_entries_open_idx on public.time_entries (user_id) where clock_out_at is null;

alter table public.time_entries enable row level security;

create policy "time_entries org select" on public.time_entries
  for select using (public.is_org_member(org_id));
create policy "time_entries own insert" on public.time_entries
  for insert with check (public.is_org_member(org_id) and user_id = auth.uid());
create policy "time_entries own update" on public.time_entries
  for update using (user_id = auth.uid() or public.is_org_admin(org_id));
create policy "time_entries admin delete" on public.time_entries
  for delete using (public.is_org_admin(org_id));

-- ============================================================
-- JOB CHECKLISTS — per-job items. Reusable templates live in
-- checklist_templates and can be applied at job create time.
-- ============================================================
drop table if exists public.checklist_templates cascade;
drop table if exists public.checklist_template_items cascade;
drop table if exists public.job_checklist_items cascade;

create table public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.checklist_template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.checklist_templates(id) on delete cascade,
  label         text not null,
  position      int  not null default 0
);

create table public.job_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  job_id       uuid not null references public.jobs(id) on delete cascade,
  label        text not null,
  position     int  not null default 0,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index checklist_tpl_org_idx       on public.checklist_templates (org_id);
create index checklist_tpl_items_idx     on public.checklist_template_items (template_id, position);
create index job_checklist_job_idx       on public.job_checklist_items (job_id, position);

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.job_checklist_items enable row level security;

create policy "checklist_templates org" on public.checklist_templates
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

create policy "checklist_template_items org" on public.checklist_template_items
  for all using (
    exists (
      select 1 from public.checklist_templates t
      where t.id = template_id and public.is_org_member(t.org_id)
    )
  );

create policy "job_checklist_items org" on public.job_checklist_items
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ============================================================
-- SERVICE CATALOG (price book) + QUOTE LINE ITEMS
-- ============================================================
drop table if exists public.services cascade;

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text,
  unit_price  numeric(10,2) not null default 0,
  unit        text not null default 'each',   -- 'each', 'hour', 'sq ft', etc.
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index services_org_idx on public.services (org_id);

alter table public.services enable row level security;
create policy "services org" on public.services
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop table if exists public.quote_line_items cascade;

create table public.quote_line_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  service_id  uuid references public.services(id) on delete set null,
  name        text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(10,2) not null default 0,
  position    int  not null default 0
);

create index quote_line_items_quote_idx on public.quote_line_items (quote_id, position);

alter table public.quote_line_items enable row level security;
create policy "quote_line_items org" on public.quote_line_items
  for all using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id and public.is_org_member(q.org_id)
    )
  );

-- ============================================================
-- JOB MATERIALS — parts/items consumed on a job, rolls into profitability
-- ============================================================
drop table if exists public.job_materials cascade;

create table public.job_materials (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  name        text not null,
  quantity    numeric(10,2) not null default 1,
  unit_cost   numeric(10,2) not null default 0,
  notes       text,
  created_at  timestamptz not null default now()
);

create index job_materials_job_idx on public.job_materials (job_id);

alter table public.job_materials enable row level security;
create policy "job_materials org" on public.job_materials
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ============================================================
-- AUDIT LOG — surfaces "who did what" for support + compliance.
-- Written by a security-definer RPC so the app can log without
-- granting INSERT permission to authenticated users directly.
-- ============================================================
drop table if exists public.audit_log cascade;

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  action      text not null,   -- 'invoice.deleted', 'job.completed', etc.
  target_type text,
  target_id   uuid,
  details     jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

create index audit_log_org_idx  on public.audit_log (org_id, created_at desc);
create index audit_log_user_idx on public.audit_log (user_id);

alter table public.audit_log enable row level security;
create policy "audit_log admin read" on public.audit_log
  for select using (public.is_org_admin(org_id));

create or replace function public.log_audit(
  p_org_id uuid, p_action text, p_target_type text default null,
  p_target_id uuid default null, p_details jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  insert into public.audit_log (org_id, user_id, user_email, action, target_type, target_id, details)
    values (p_org_id, auth.uid(), v_email, p_action, p_target_type, p_target_id, p_details)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.log_audit(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.log_audit(uuid, text, text, uuid, jsonb) to authenticated;

-- ============================================================
-- CUSTOMER PORTAL TOKENS — per-customer magic link. The customer
-- views their quotes/jobs/invoices in a read-only portal.
-- ============================================================
alter table public.customers
  add column if not exists portal_token text;

update public.customers
  set portal_token = encode(gen_random_bytes(16), 'hex')
  where portal_token is null;

create unique index if not exists customers_portal_token_idx
  on public.customers (portal_token);

-- ============================================================
-- ORG SETTINGS for review deflection + on-the-way ETA defaults
-- ============================================================
alter table public.organizations
  add column if not exists google_review_url   text,
  add column if not exists yelp_review_url     text,
  add column if not exists on_my_way_eta_mins  int default 30,
  add column if not exists review_deflect_threshold int default 4;

-- ============================================================
-- TWO-WAY SMS SCAFFOLD (deferred wire-up, schema only).
-- Inbound SMS would be routed by a Twilio webhook into message_threads.
-- ============================================================
drop table if exists public.message_threads cascade;
drop table if exists public.messages cascade;

create table public.message_threads (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  job_id       uuid references public.jobs(id) on delete set null,
  phone        text,
  email        text,
  last_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.message_threads(id) on delete cascade,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  direction    text not null check (direction in ('inbound','outbound')),
  channel      text not null check (channel in ('sms','email')),
  body         text not null,
  sent_by_user uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index message_threads_org_idx on public.message_threads (org_id, last_at desc);
create index messages_thread_idx     on public.messages (thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;

create policy "message_threads org" on public.message_threads
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "messages org" on public.messages
  for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ============================================================
-- HELPER RPCs
-- ============================================================

-- Sum labor cost on a job. Prefers time_entries when present (open
-- entries are ignored), falls back to job_labor manual rows. Used by
-- dashboards and profitability views.
create or replace function public.job_labor_minutes(p_job_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select sum(extract(epoch from (clock_out_at - clock_in_at)) / 60)::int
      from public.time_entries
      where job_id = p_job_id and clock_out_at is not null
    ),
    (
      select sum(hours * 60)::int
      from public.job_labor
      where job_id = p_job_id
    ),
    0
  );
$$;

grant execute on function public.job_labor_minutes(uuid) to authenticated;

commit;
