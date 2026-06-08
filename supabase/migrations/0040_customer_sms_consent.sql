-- Customer-facing SMS opt-in / opt-out tracking. A2P 10DLC requires
-- documented consent before sending non-transactional messages, and
-- STOP-keyword opt-outs must be honored across all future sends.
--
-- Columns on public.customers:
--   sms_opt_in_at    -- when the customer agreed to receive texts
--   sms_opt_out_at   -- when they last replied STOP / equivalent
--   sms_opt_out      -- materialized boolean for the hot path
--                       (gate every send on this; saves a date compare)
-- The booking page writes opt_in_at when the customer checks the
-- consent box; the Twilio inbound webhook writes opt_out / opt_out_at
-- when STOP arrives, and clears opt_out + writes a fresh opt_in_at if
-- they send START / UNSTOP later.

begin;

alter table public.customers
  add column if not exists sms_opt_in_at  timestamptz,
  add column if not exists sms_opt_out_at timestamptz,
  add column if not exists sms_opt_out    boolean not null default false;

-- Mirror the consent timestamp on leads so when the contractor
-- converts a booking-form lead to a customer, the opt-in carries
-- over automatically without re-asking.
alter table public.leads
  add column if not exists sms_opt_in_at timestamptz;

-- Updated booking RPC: accepts p_sms_opt_in (boolean). Old callers
-- passing the original 9-arg signature still work; the new
-- 10-arg form records the consent timestamp on the lead.
create or replace function public.submit_self_booking(
  p_org_slug      text,
  p_name          text,
  p_phone         text,
  p_email         text,
  p_address       text,
  p_service_name  text,
  p_requested_date date,
  p_requested_time time,
  p_notes         text,
  p_sms_opt_in    boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_lead_id uuid;
  v_owner   uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if (p_phone is null or length(trim(p_phone)) = 0)
     and (p_email is null or length(trim(p_email)) = 0) then
    raise exception 'phone or email required';
  end if;

  select id into v_org_id from public.organizations where slug = p_org_slug;
  if v_org_id is null then
    raise exception 'business not found';
  end if;

  -- The first member of an org (typically the owner) gets the
  -- lead. Lets crew + foreman both see it via RLS thereafter.
  select user_id into v_owner from public.org_members
    where org_id = v_org_id order by joined_at asc limit 1;

  insert into public.leads (
    org_id, owner_id, name, phone, email, address,
    source, status, service_name, requested_date, requested_time, notes,
    sms_opt_in_at
  ) values (
    v_org_id, v_owner, trim(p_name),
    nullif(trim(coalesce(p_phone,'')), ''),
    nullif(trim(coalesce(p_email,'')), ''),
    nullif(trim(coalesce(p_address,'')), ''),
    'self_booking', 'new',
    nullif(trim(coalesce(p_service_name,'')), ''),
    p_requested_date,
    p_requested_time,
    nullif(trim(coalesce(p_notes,'')), ''),
    case when p_sms_opt_in then now() else null end
  )
  returning id into v_lead_id;

  -- Mirror the foreman notification path so this stays consistent
  -- with the legacy 9-arg signature behavior.
  insert into public.notifications (org_id, user_id, kind, title, body, link)
    select v_org_id, v_owner, 'new_lead',
           'New booking · ' || trim(p_name),
           coalesce(p_service_name, 'Booking request') ||
             case when p_requested_date is not null
                  then ' · ' || to_char(p_requested_date, 'Mon DD')
                  else '' end,
           '/leads';

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id);
end;
$$;

grant execute on function public.submit_self_booking(text,text,text,text,text,text,date,time,text,boolean) to anon, authenticated;

create index if not exists customers_phone_sms_idx
  on public.customers (phone)
  where sms_opt_out = false;

-- Audit log of every customer-facing SMS we send, so support can
-- answer "did the customer get the text?" without bouncing to the
-- Twilio dashboard. Append-only; never edited.
drop table if exists public.customer_sms_log cascade;

create table public.customer_sms_log (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  customer_id  uuid references public.customers(id) on delete set null,
  kind         text not null,                  -- 'appointment','on_my_way','payment','feedback','inbound_stop','inbound_start','inbound_help'
  direction    text not null check (direction in ('outbound','inbound')),
  phone        text not null,
  body         text,
  twilio_sid   text,
  ok           boolean not null default true,
  error        text,
  created_at   timestamptz not null default now()
);

create index customer_sms_log_org_idx       on public.customer_sms_log (org_id, created_at desc);
create index customer_sms_log_customer_idx  on public.customer_sms_log (customer_id, created_at desc);
create index customer_sms_log_phone_idx     on public.customer_sms_log (phone, created_at desc);

alter table public.customer_sms_log enable row level security;

create policy "customer_sms_log foreman select" on public.customer_sms_log
  for select using (public.is_org_foreman(org_id));

-- Inserts always come from the service role (server-side after a
-- send), so we leave INSERT/UPDATE/DELETE off RLS for authenticated
-- — service role bypasses RLS naturally.

commit;
