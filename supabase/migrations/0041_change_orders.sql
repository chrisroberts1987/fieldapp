-- Change orders. When a job scope changes after the original quote
-- is approved (extra work, more materials, surprise behind the wall),
-- the contractor creates a change order, the customer approves it
-- on a public page, and the line items roll up into the final
-- invoice automatically.
--
-- Status transitions:
--   pending  → approved  (customer tapped Approve)
--   pending  → declined  (customer tapped Decline)
--   pending  → cancelled (contractor cancelled before customer answered)
--
-- A change order is always attached to either a job or a quote (or
-- both). At least one of (job_id, quote_id) must be set so the
-- approved CO can roll up into the right invoice.

begin;

drop table if exists public.change_orders cascade;

create table public.change_orders (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  job_id          uuid references public.jobs(id)   on delete cascade,
  quote_id        uuid references public.quotes(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null,

  -- Denormalized so the public approval page can render the
  -- customer's name without joining (anonymous read).
  customer_name   text,
  customer_email  text,
  customer_phone  text,

  description     text not null,
  reason          text,
  line_items      jsonb not null default '[]'::jsonb,
  amount          numeric(10,2) not null default 0,

  status          text not null default 'pending'
                    check (status in ('pending','approved','declined','cancelled')),

  public_token    text not null default encode(gen_random_bytes(16), 'hex'),

  sent_at         timestamptz,
  approved_at     timestamptz,
  declined_at     timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),

  -- Customer's reason on decline; optional.
  decline_reason  text,

  constraint change_orders_anchor_chk
    check (job_id is not null or quote_id is not null)
);

create unique index change_orders_token_uq on public.change_orders (public_token);
create index change_orders_org_idx       on public.change_orders (org_id, created_at desc);
create index change_orders_job_idx       on public.change_orders (job_id) where job_id is not null;
create index change_orders_quote_idx     on public.change_orders (quote_id) where quote_id is not null;
create index change_orders_status_idx    on public.change_orders (org_id, status);

alter table public.change_orders enable row level security;

-- SELECT: foreman + supervisor in the org. (Same financial-table
-- gating model as quotes/invoices — crew doesn't need to see pricing.)
create policy "change_orders office select" on public.change_orders
  for select using (
    public.is_org_foreman(org_id) or public.is_org_supervisor(org_id)
  );

-- INSERT / UPDATE: foreman + supervisor (the latter can create COs
-- on the jobs in their queue without bouncing back to the foreman).
create policy "change_orders office insert" on public.change_orders
  for insert with check (
    public.is_org_foreman(org_id) or public.is_org_supervisor(org_id)
  );
create policy "change_orders office update" on public.change_orders
  for update using (
    public.is_org_foreman(org_id) or public.is_org_supervisor(org_id)
  );

-- DELETE: foreman only.
create policy "change_orders foreman delete" on public.change_orders
  for delete using (public.is_org_foreman(org_id));

-- =============================================================
-- get_public_change_order(token)
-- Anonymous-callable. Returns the CO + org branding + the parent
-- quote/job context so the customer can see what they're agreeing
-- to. Mirror of get_public_quote.
-- =============================================================
create or replace function public.get_public_change_order(p_token text)
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
    'id',              co.id,
    'description',     co.description,
    'reason',          co.reason,
    'line_items',      co.line_items,
    'amount',          co.amount,
    'status',          co.status,
    'sent_at',         co.sent_at,
    'approved_at',     co.approved_at,
    'declined_at',     co.declined_at,
    'customer_name',   co.customer_name,
    -- Parent context so the customer can see what's being changed.
    'job', case when j.id is null then null else jsonb_build_object(
      'id',     j.id,
      'title',  j.title,
      'price',  j.price
    ) end,
    'quote', case when q.id is null then null else jsonb_build_object(
      'id',     q.id,
      'title',  q.title,
      'amount', q.amount
    ) end,
    'org', jsonb_build_object(
      'name',           o.name,
      'logo_url',       o.logo_url,
      'business_email', o.business_email,
      'phone',          o.phone
    )
  ) into v
  from public.change_orders co
  left join public.jobs           j on j.id = co.job_id
  left join public.quotes         q on q.id = co.quote_id
  left join public.organizations  o on o.id = co.org_id
  where co.public_token = p_token;
  return v;
end;
$$;

revoke all on function public.get_public_change_order(text) from public;
grant execute on function public.get_public_change_order(text) to anon, authenticated;

-- =============================================================
-- decide_change_order(token, decision, reason)
-- Anonymous-callable. decision = 'approve' | 'decline'.
-- One-way transition: re-deciding does nothing if already settled.
-- =============================================================
create or replace function public.decide_change_order(
  p_token    text,
  p_decision text,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_co  record;
begin
  select * into v_co from public.change_orders where public_token = p_token;
  if v_co.id is null then
    raise exception 'change order not found';
  end if;
  if v_co.status <> 'pending' then
    return jsonb_build_object('ok', true, 'already', v_co.status);
  end if;

  if p_decision = 'approve' then
    update public.change_orders
      set status = 'approved', approved_at = now()
      where id = v_co.id;
    -- Bump the parent job's price so invoice math + the action
    -- feed both reflect the accepted change immediately.
    if v_co.job_id is not null then
      update public.jobs
        set price = coalesce(price, 0) + coalesce(v_co.amount, 0)
        where id = v_co.job_id;
    end if;
    -- Notification for the foreman + owner who created the CO.
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      select v_co.org_id, v_co.owner_id, 'change_order_approved',
             'Change order approved ✓',
             coalesce(v_co.customer_name, 'Customer') || ' approved $' ||
               to_char(v_co.amount, 'FM999G999G990D00'),
             case when v_co.job_id is not null then '/jobs' else '/quotes' end
      where v_co.owner_id is not null;
    return jsonb_build_object('ok', true, 'status', 'approved');
  end if;

  if p_decision = 'decline' then
    update public.change_orders
      set status = 'declined',
          declined_at = now(),
          decline_reason = nullif(trim(coalesce(p_reason, '')), '')
      where id = v_co.id;
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      select v_co.org_id, v_co.owner_id, 'change_order_declined',
             'Change order declined',
             coalesce(v_co.customer_name, 'Customer') || ' declined $' ||
               to_char(v_co.amount, 'FM999G999G990D00') ||
               coalesce(' — "' || left(p_reason, 80) || '"', ''),
             case when v_co.job_id is not null then '/jobs' else '/quotes' end
      where v_co.owner_id is not null;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;

  raise exception 'unknown decision %', p_decision;
end;
$$;

revoke all on function public.decide_change_order(text, text, text) from public;
grant execute on function public.decide_change_order(text, text, text) to anon, authenticated;

-- =============================================================
-- list_job_change_orders(job_id)
-- Service-role/foreman-readable. The public invoice page calls this
-- via security-definer so the customer sees the full breakdown
-- without needing direct table access.
-- =============================================================
create or replace function public.list_job_change_orders(p_job_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',          id,
    'description', description,
    'reason',      reason,
    'amount',      amount,
    'status',      status,
    'approved_at', approved_at,
    'created_at',  created_at
  ) order by created_at asc), '[]'::jsonb)
    into v
    from public.change_orders
    where job_id = p_job_id and status = 'approved';
  return v;
end;
$$;

grant execute on function public.list_job_change_orders(uuid) to anon, authenticated;

commit;
