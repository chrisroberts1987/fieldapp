-- Subscription billing state on organizations. One Stripe Customer
-- and Subscription per org (not per user) so a multi-seat plan
-- naturally maps to the existing org membership model.
--
-- Lifecycle: org created → trial_ends_at = created_at + 14 days,
-- subscription_status = 'trialing'. When the foreman starts a paid
-- plan via Stripe Checkout, the webhook fills in stripe_customer_id,
-- stripe_subscription_id, subscription_tier, subscription_status,
-- subscription_current_period_end. Re-bills and cancels keep those
-- fields current.

alter table public.organizations
  add column if not exists trial_ends_at                       timestamptz,
  add column if not exists stripe_customer_id                  text,
  add column if not exists stripe_subscription_id              text,
  add column if not exists subscription_status                 text,
  add column if not exists subscription_tier                   text,
  add column if not exists subscription_current_period_end     timestamptz,
  add column if not exists subscription_cancel_at_period_end   boolean default false;

-- Existing orgs get a 14-day trial from when they were created. New
-- orgs get their trial set in code when create_org() runs.
update public.organizations
  set trial_ends_at = created_at + interval '14 days',
      subscription_status = coalesce(subscription_status, 'trialing')
  where trial_ends_at is null;

-- Make sure status / tier values stay sane.
alter table public.organizations
  drop constraint if exists organizations_sub_status_check;
alter table public.organizations
  add constraint organizations_sub_status_check check (
    subscription_status is null or subscription_status in (
      'trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','expired'
    )
  );

alter table public.organizations
  drop constraint if exists organizations_sub_tier_check;
alter table public.organizations
  add constraint organizations_sub_tier_check check (
    subscription_tier is null or subscription_tier in ('solo','crew','business')
  );

-- Cheap lookup paths for the webhook handler.
create unique index if not exists organizations_stripe_customer_uq
  on public.organizations (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists organizations_stripe_sub_uq
  on public.organizations (stripe_subscription_id) where stripe_subscription_id is not null;

-- ============================================================
-- Helper: every NEW org gets a 14-day trial baked in. Sets trial_ends_at
-- + initial status. Keeps the application code simple — we don't have
-- to remember to set these on every create_org() / signup path.
-- ============================================================
create or replace function public.set_org_trial_on_insert()
returns trigger
language plpgsql
as $$
begin
  if NEW.trial_ends_at is null then
    NEW.trial_ends_at := now() + interval '14 days';
  end if;
  if NEW.subscription_status is null then
    NEW.subscription_status := 'trialing';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_org_trial on public.organizations;
create trigger trg_set_org_trial
  before insert on public.organizations
  for each row execute function public.set_org_trial_on_insert();
