-- Quote → job → invoice → paid → feedback automation, plus mileage and
-- in-app notifications. Per the saved memory about this Supabase project's
-- pre-existing tables, every new table is wrapped with drop-if-exists.

-- ============================================================
-- QUOTES
-- ============================================================
drop table if exists public.quotes cascade;

create table public.quotes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  owner_id          uuid references auth.users(id) on delete set null,
  lead_id           uuid references public.leads(id) on delete set null,
  customer_id       uuid references public.customers(id) on delete set null,
  customer_name     text not null,
  customer_email    text,
  customer_phone    text,
  title             text not null,
  description       text,
  amount            numeric(10,2) not null default 0,
  status            text not null default 'draft'
                      check (status in ('draft','sent','approved','declined','expired')),
  approval_token    text not null default encode(gen_random_bytes(16), 'hex'),
  sent_at           timestamptz,
  approved_at       timestamptz,
  declined_at       timestamptz,
  valid_until       date,
  converted_job_id  uuid references public.jobs(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now()
);

create unique index quotes_token_unique on public.quotes (approval_token);
create index quotes_org_idx        on public.quotes (org_id);
create index quotes_status_idx     on public.quotes (status);
create index quotes_lead_idx       on public.quotes (lead_id);

alter table public.quotes enable row level security;

create policy "quotes org select" on public.quotes
  for select using (public.is_org_member(org_id));
create policy "quotes org insert" on public.quotes
  for insert with check (public.is_org_member(org_id));
create policy "quotes org update" on public.quotes
  for update using (public.is_org_member(org_id));
create policy "quotes org delete" on public.quotes
  for delete using (public.is_org_member(org_id));

-- ============================================================
-- MILEAGE LOGS
-- ============================================================
drop table if exists public.mileage_logs cascade;

create table public.mileage_logs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  job_id          uuid references public.jobs(id) on delete set null,
  log_date        date not null default current_date,
  miles           numeric(10,2) not null,
  start_address   text,
  end_address     text,
  start_lat       numeric(9,6),
  start_lng       numeric(9,6),
  end_lat         numeric(9,6),
  end_lng         numeric(9,6),
  purpose         text not null default 'business'
                    check (purpose in ('business','commute','personal','other')),
  method          text not null default 'manual'
                    check (method in ('manual','gps')),
  notes           text,
  created_at      timestamptz not null default now()
);

create index mileage_org_idx   on public.mileage_logs (org_id);
create index mileage_user_idx  on public.mileage_logs (user_id);
create index mileage_date_idx  on public.mileage_logs (log_date);
create index mileage_job_idx   on public.mileage_logs (job_id);

alter table public.mileage_logs enable row level security;

create policy "mileage org select" on public.mileage_logs
  for select using (public.is_org_member(org_id));
create policy "mileage own insert" on public.mileage_logs
  for insert with check (public.is_org_member(org_id) and user_id = auth.uid());
create policy "mileage own update" on public.mileage_logs
  for update using (user_id = auth.uid() or public.is_org_admin(org_id));
create policy "mileage own delete" on public.mileage_logs
  for delete using (user_id = auth.uid() or public.is_org_admin(org_id));

-- ============================================================
-- NOTIFICATIONS (in-app)
-- ============================================================
drop table if exists public.notifications cascade;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notif_user_unread_idx on public.notifications (user_id, read_at);
create index notif_org_idx         on public.notifications (org_id);

alter table public.notifications enable row level security;

create policy "notif own select" on public.notifications
  for select using (user_id = auth.uid());
create policy "notif org insert" on public.notifications
  for insert with check (public.is_org_member(org_id));
create policy "notif own update" on public.notifications
  for update using (user_id = auth.uid());
create policy "notif own delete" on public.notifications
  for delete using (user_id = auth.uid());

-- ============================================================
-- FEEDBACK
-- ============================================================
drop table if exists public.feedback cascade;

create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  invoice_id    uuid references public.invoices(id) on delete set null,
  customer_id   uuid references public.customers(id) on delete set null,
  customer_name text,
  token         text not null default encode(gen_random_bytes(16), 'hex'),
  rating        int check (rating between 1 and 5),
  comment       text,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);

create unique index feedback_token_unique on public.feedback (token);
create index feedback_org_idx     on public.feedback (org_id);
create index feedback_invoice_idx on public.feedback (invoice_id);

alter table public.feedback enable row level security;

create policy "feedback org select" on public.feedback
  for select using (public.is_org_member(org_id));
create policy "feedback org insert" on public.feedback
  for insert with check (public.is_org_member(org_id));
create policy "feedback org update" on public.feedback
  for update using (public.is_org_member(org_id));
create policy "feedback org delete" on public.feedback
  for delete using (public.is_org_member(org_id));

-- ============================================================
-- PUBLIC RPC: get_public_quote(token)
-- Returns a quote slice + org branding for the customer's
-- approval page. Callable as anon.
-- ============================================================
create or replace function public.get_public_quote(p_token text)
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
    'id',             q.id,
    'title',          q.title,
    'description',    q.description,
    'amount',         q.amount,
    'status',         q.status,
    'customer_name',  q.customer_name,
    'valid_until',    q.valid_until,
    'sent_at',        q.sent_at,
    'approved_at',    q.approved_at,
    'declined_at',    q.declined_at,
    'org_name',       o.name,
    'org_logo_url',   o.logo_url,
    'org_phone',      o.phone,
    'org_email',      o.business_email
  ) into v
  from public.quotes q
  join public.organizations o on o.id = q.org_id
  where q.approval_token = p_token;
  return v;
end;
$$;

revoke all on function public.get_public_quote(text) from public;
grant execute on function public.get_public_quote(text) to anon, authenticated;

-- ============================================================
-- PUBLIC RPC: approve_quote(token)
-- Marks the quote approved, creates a job from it, links them,
-- and writes a notification to the org owner. Returns the new
-- job's id (or null if the quote is already actioned).
-- ============================================================
create or replace function public.approve_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q     record;
  v_job_id  uuid;
  v_owner uuid;
begin
  select * into v_q from public.quotes where approval_token = p_token;
  if v_q.id is null then
    raise exception 'quote not found';
  end if;
  if v_q.status = 'approved' then
    return jsonb_build_object('ok', true, 'already_approved', true, 'job_id', v_q.converted_job_id);
  end if;
  if v_q.status not in ('draft','sent') then
    raise exception 'quote is %', v_q.status;
  end if;

  insert into public.jobs (org_id, owner_id, customer_id, title, description, price, status, scheduled_date)
    values (v_q.org_id, v_q.owner_id, v_q.customer_id,
            v_q.title, v_q.description, v_q.amount, 'scheduled', current_date)
    returning id into v_job_id;

  update public.quotes
    set status = 'approved',
        approved_at = now(),
        converted_job_id = v_job_id
    where id = v_q.id;

  select om.user_id into v_owner
    from public.org_members om
    where om.org_id = v_q.org_id and om.role = 'owner'
    order by om.joined_at asc
    limit 1;

  if v_owner is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (v_q.org_id, v_owner, 'quote_approved',
              'Quote approved',
              v_q.customer_name || ' approved "' || v_q.title || '" — job created.',
              '/jobs');
  end if;

  return jsonb_build_object('ok', true, 'job_id', v_job_id);
end;
$$;

revoke all on function public.approve_quote(text) from public;
grant execute on function public.approve_quote(text) to anon, authenticated;

-- ============================================================
-- PUBLIC RPC: decline_quote(token)
-- ============================================================
create or replace function public.decline_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q record;
  v_owner uuid;
begin
  select * into v_q from public.quotes where approval_token = p_token;
  if v_q.id is null then
    raise exception 'quote not found';
  end if;
  if v_q.status not in ('draft','sent') then
    return jsonb_build_object('ok', true, 'already_actioned', true);
  end if;

  update public.quotes
    set status = 'declined', declined_at = now()
    where id = v_q.id;

  select om.user_id into v_owner
    from public.org_members om
    where om.org_id = v_q.org_id and om.role = 'owner'
    order by om.joined_at asc
    limit 1;

  if v_owner is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (v_q.org_id, v_owner, 'quote_declined',
              'Quote declined',
              v_q.customer_name || ' declined "' || v_q.title || '".',
              '/quotes');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.decline_quote(text) from public;
grant execute on function public.decline_quote(text) to anon, authenticated;

-- ============================================================
-- PUBLIC RPC: get_feedback_by_token(token)
-- ============================================================
create or replace function public.get_feedback_by_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',             f.id,
    'customer_name',  f.customer_name,
    'rating',         f.rating,
    'comment',        f.comment,
    'submitted_at',   f.submitted_at,
    'org_name',       o.name,
    'org_logo_url',   o.logo_url
  )
  from public.feedback f
  join public.organizations o on o.id = f.org_id
  where f.token = p_token;
$$;

revoke all on function public.get_feedback_by_token(text) from public;
grant execute on function public.get_feedback_by_token(text) to anon, authenticated;

-- ============================================================
-- PUBLIC RPC: submit_feedback(token, rating, comment)
-- ============================================================
create or replace function public.submit_feedback(p_token text, p_rating int, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f record;
  v_owner uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1-5';
  end if;

  select * into v_f from public.feedback where token = p_token;
  if v_f.id is null then
    raise exception 'feedback link not found';
  end if;
  if v_f.submitted_at is not null then
    return jsonb_build_object('ok', true, 'already_submitted', true);
  end if;

  update public.feedback
    set rating = p_rating,
        comment = nullif(trim(coalesce(p_comment, '')), ''),
        submitted_at = now()
    where id = v_f.id;

  select om.user_id into v_owner
    from public.org_members om
    where om.org_id = v_f.org_id and om.role = 'owner'
    order by om.joined_at asc
    limit 1;

  if v_owner is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (v_f.org_id, v_owner, 'feedback_received',
              p_rating || '-star review from ' || coalesce(v_f.customer_name, 'a customer'),
              coalesce(nullif(trim(coalesce(p_comment, '')), ''), 'No comment.'),
              '/insights');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_feedback(text, int, text) from public;
grant execute on function public.submit_feedback(text, int, text) to anon, authenticated;
