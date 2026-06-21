-- create_org gets a payment_source argument so the signup channel
-- (Stripe via web, Apple IAP via iOS) is recorded at org creation
-- time. Before this, payment_source was only ever written by the
-- IAP webhook, which left iOS signups looking like web/Stripe orgs
-- to paywall-gate.ts in the native app — the gate then skipped the
-- IAP paywall and dropped owners straight into the app without
-- subscribing.
--
-- Web continues to call create_org(p_name) with one argument; the
-- default null leaves payment_source unset for those orgs (the
-- existing Stripe webhook fills it in on first checkout via the
-- backfill in 0043). Native calls create_org(p_name, 'apple').

-- Drop the single-arg version so the new two-arg overload with a
-- default param resolves unambiguously when called with one arg.
drop function if exists public.create_org(text);

create or replace function public.create_org(
  p_name text,
  p_payment_source text default null
)
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
  if p_payment_source is not null
     and p_payment_source not in ('stripe', 'apple', 'google') then
    raise exception 'invalid payment_source: %', p_payment_source;
  end if;
  insert into public.organizations (name, payment_source)
    values (trim(p_name), p_payment_source)
    returning id into v_org_id;
  insert into public.org_members (org_id, user_id, role, joined_at)
    values (v_org_id, v_user_id, 'owner', now());
  return v_org_id;
end;
$$;

revoke all on function public.create_org(text, text) from public;
grant execute on function public.create_org(text, text) to authenticated;
