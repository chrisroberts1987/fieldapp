-- Create a test account in a single SQL call. No signup form, no
-- email confirmation, no onboarding wizard. The function:
--
--   1. Creates a confirmed auth.users row with the given email +
--      password (or resets the password if the user already exists)
--   2. Wires up auth.identities so password sign-in works
--   3. Creates an organization with placeholder details
--   4. Adds the user as the org owner
--   5. Flips every onboarding gate: subscription active, stripe
--      ids stubbed, connect charges enabled, tour marked complete
--
-- Usage from Supabase SQL editor:
--
--   select create_test_account('test@myforemanhq.com', 'YourPass123!');
--
-- Then go to /login and sign in with those credentials. Lands you
-- straight on /dashboard with zero setup. Idempotent — re-running
-- with the same email resets the password and bypasses again.
--
-- SECURITY: service-role only. Grants are explicitly revoked from
-- public and authenticated, so this can't be called from the app.

create or replace function public.create_test_account(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id  uuid;
  v_email   text := lower(trim(p_email));
  v_now     text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if v_email is null or v_email = '' then
    raise exception 'email is required';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'password must be at least 6 characters';
  end if;

  -- 1) Auth user. Reuse existing if email matches; otherwise insert
  --    fresh with email already confirmed.
  select id into v_user_id from auth.users where lower(email) = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('onboarding_completed_at', v_now),
      now(), now(), '', '', '', ''
    );

    -- auth.identities is what makes password sign-in actually work.
    -- provider_id mirrors the user id for the email provider.
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id, v_user_id::text, v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  else
    -- Existing user: reset password, ensure confirmed, mark tour done.
    update auth.users
       set encrypted_password   = extensions.crypt(p_password, extensions.gen_salt('bf')),
           email_confirmed_at   = coalesce(email_confirmed_at, now()),
           raw_user_meta_data   = coalesce(raw_user_meta_data, '{}'::jsonb)
                                  || jsonb_build_object('onboarding_completed_at', v_now),
           updated_at           = now()
     where id = v_user_id;
  end if;

  -- 2) Org. Reuse if owner-membership exists, otherwise create.
  select om.org_id into v_org_id
    from public.org_members om
   where om.user_id = v_user_id
   order by om.joined_at asc limit 1;

  if v_org_id is null then
    insert into public.organizations (
      name, owner_name, business_email, phone, address, slug,
      default_tax_rate, income_tax_rate
    ) values (
      'Test Business', 'Test Owner', v_email, '555-555-0100',
      '123 Test Street' || E'\n' || 'Austin, TX 78701',
      'test-' || substring(v_user_id::text, 1, 8),
      8.25, 25
    )
    returning id into v_org_id;

    insert into public.org_members (org_id, user_id, role)
    values (v_org_id, v_user_id, 'owner');
  end if;

  -- 3) Flip every gate the dashboard/onboarding flow checks.
  update public.organizations
     set subscription_status              = 'active',
         subscription_tier                = 'crew',
         trial_ends_at                    = now() + interval '1 year',
         subscription_current_period_end  = now() + interval '1 year',
         stripe_subscription_id           = coalesce(stripe_subscription_id, 'sub_test_'  || substring(v_user_id::text, 1, 12)),
         stripe_customer_id               = coalesce(stripe_customer_id,     'cus_test_'  || substring(v_user_id::text, 1, 12)),
         stripe_connect_account_id        = coalesce(stripe_connect_account_id, 'acct_test_' || substring(v_user_id::text, 1, 12)),
         stripe_connect_charges_enabled   = true,
         stripe_connect_payouts_enabled   = true,
         stripe_connect_requirements_due  = false
   where id = v_org_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'org_id',  v_org_id,
    'email',   v_email,
    'message', 'Test account ready. Sign in at /login with the email + password you provided.'
  );
end;
$$;

revoke all on function public.create_test_account(text, text) from public;
revoke all on function public.create_test_account(text, text) from authenticated;
revoke all on function public.create_test_account(text, text) from anon;
-- Only the service role (Supabase SQL editor) can run this.
