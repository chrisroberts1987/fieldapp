-- Apple In-App Purchase (IAP) support via RevenueCat. The iOS app
-- subscribes users through Apple while web signups continue through
-- Stripe. The two channels are kept strictly separate by the IAP
-- webhook at pages/api/iap/webhook.js, which refuses to migrate an
-- existing Stripe-paying org to Apple even if an Apple purchase
-- somehow slips through. An org is either Stripe or Apple, never both.

-- ============================================================
-- 1. New columns on organizations.
-- ============================================================
alter table public.organizations
  add column if not exists payment_source                  text,
  add column if not exists revenuecat_app_user_id          text,
  add column if not exists apple_original_transaction_id   text;

-- Constrain payment_source to known channels. Null is allowed for
-- orgs that are still on trial or have never started a paid plan.
alter table public.organizations
  drop constraint if exists organizations_payment_source_check;
alter table public.organizations
  add constraint organizations_payment_source_check check (
    payment_source is null or payment_source in ('stripe', 'apple', 'google')
  );

-- Backfill payment_source for orgs already on Stripe. Without this,
-- existing Stripe subscribers would have payment_source = null and
-- the IAP webhook's channel-separation guard could only catch them
-- via stripe_subscription_id. Belt-and-suspenders.
update public.organizations
  set payment_source = 'stripe'
  where payment_source is null
    and stripe_subscription_id is not null;

-- ============================================================
-- 2. iap_events: idempotency log for RevenueCat webhook deliveries.
--
-- RevenueCat retries on non-200 responses and can occasionally
-- re-send the same event. The unique index on revenuecat_event_id
-- makes duplicate POSTs no-op cleanly: the insert raises 23505
-- (unique violation) which the handler treats as a known-duplicate
-- and acks with 200.
-- ============================================================
drop table if exists public.iap_events cascade;
create table public.iap_events (
  id                     bigserial primary key,
  revenuecat_event_id    text        not null,
  event_type             text        not null,
  app_user_id            text        not null,  -- Supabase user uuid as string
  product_id             text,
  received_at            timestamptz not null default now()
);

create unique index iap_events_event_id_uq
  on public.iap_events (revenuecat_event_id);

create index iap_events_user_received_idx
  on public.iap_events (app_user_id, received_at desc);

-- The IAP webhook hits this table via the service-role key so RLS
-- is bypassed. Enable RLS with no policies so anon and authenticated
-- requests can never read or write the audit log.
alter table public.iap_events enable row level security;

-- ============================================================
-- 3. Cheap lookup paths for the IAP webhook.
-- ============================================================
create unique index if not exists organizations_revenuecat_user_uq
  on public.organizations (revenuecat_app_user_id)
  where revenuecat_app_user_id is not null;
