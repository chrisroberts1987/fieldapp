-- Helper for the platform owner to spin up a test account that
-- bypasses the full onboarding flow (business info, Stripe Connect,
-- plan picker + card on file, welcome tour). Use this when you need
-- to log in and poke around without going through signup every time.
--
-- Workflow:
--   1. Sign up normally at /signup with the test email (any email
--      you want, e.g. test@myforemanhq.com). Confirm the email.
--   2. Run `select setup_test_account('test@myforemanhq.com');`
--      in the Supabase SQL editor. It creates the org, marks the
--      subscription active, fills in trial_ends_at, and flips the
--      onboarding-complete flag.
--   3. Sign in. You'll land straight on /dashboard with no gates.
--
-- Idempotent: re-run any time to reset the org back to a clean
-- "fully onboarded test account" state. Won't duplicate the org or
-- org_member row if those already exist.
--
-- SECURITY: revoked from public + authenticated. Only the service
-- role (Supabase SQL editor) can call it. Cannot be invoked from
-- the client app.

create or replace function public.setup_test_account(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
  v_slug    text;
begin
  -- Resolve the auth user from their email.
  select id into v_user_id
    from auth.users
   where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'No user found with email %. Sign up at /signup first, then re-run this.', p_email;
  end if;

  v_slug := 'test-' || substring(v_user_id::text, 1, 8);

  -- Reuse the existing org if the user already has one; otherwise
  -- create a fresh one with the slug pre-set.
  select om.org_id into v_org_id
    from public.org_members om
   where om.user_id = v_user_id
   order by om.joined_at asc
   limit 1;

  if v_org_id is null then
    insert into public.organizations (
      name, owner_name, business_email, phone, address, slug,
      default_tax_rate, income_tax_rate
    ) values (
      'Test Business', 'Test Owner', p_email, '555-555-0100',
      '123 Test Street' || E'\n' || 'Austin, TX 78701',
      v_slug, 8.25, 25
    )
    returning id into v_org_id;

    insert into public.org_members (org_id, user_id, role)
    values (v_org_id, v_user_id, 'owner');
  end if;

  -- Flip every gate the dashboard/onboarding flow checks:
  --   - subscription_status / trial_ends_at: trial banner stays
  --     quiet, isBlocked() returns false
  --   - stripe_subscription_id: dashboard owner-needs-subscription
  --     gate passes
  --   - subscription_tier: seat-limit gate honors crew tier (10)
  --   - stripe_connect_charges_enabled: customer card-payments
  --     banner won't nag you
  update public.organizations
     set subscription_status            = 'active',
         subscription_tier              = 'crew',
         trial_ends_at                  = now() + interval '1 year',
         subscription_current_period_end = now() + interval '1 year',
         stripe_subscription_id         = coalesce(stripe_subscription_id, 'sub_test_' || substring(v_user_id::text, 1, 12)),
         stripe_customer_id             = coalesce(stripe_customer_id,     'cus_test_' || substring(v_user_id::text, 1, 12)),
         stripe_connect_account_id      = coalesce(stripe_connect_account_id, 'acct_test_' || substring(v_user_id::text, 1, 12)),
         stripe_connect_charges_enabled = true,
         stripe_connect_payouts_enabled = true,
         stripe_connect_requirements_due = false
   where id = v_org_id;

  -- Mark the welcome tour as completed so it doesn't auto-fire.
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                              || jsonb_build_object('onboarding_completed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
   where id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'org_id',  v_org_id,
    'message', 'Test account ready. Sign in and you will land on /dashboard.'
  );
end;
$$;

revoke all on function public.setup_test_account(text) from public;
revoke all on function public.setup_test_account(text) from authenticated;
-- Only the service role (Supabase SQL editor) can run this.
