-- Demo account: Summit Field Services
-- Self-contained seed + reset for the live demo. Creates the demo
-- foreman + 3 crew directly in auth.users, then wipes and reseeds a
-- realistic Austin TX dataset every time it runs. Idempotent — safe
-- to invoke from pg_cron, an API endpoint, or the SQL editor.

-- ============================================================
-- Self-heal the expense category constraint so the seed below
-- always passes regardless of which historical migration state
-- this DB happens to be in (some projects ended up with the
-- narrower 0006-era category list).
-- ============================================================
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check
  check (category in (
    'materials','fuel','labor','equipment','insurance','office',
    'marketing','meals','advertising','lodging','vehicle','other'
  ));

-- ============================================================
-- Helper: ensure an auth user exists with a given email + password.
-- Used by reset_demo_account() to materialize the demo foreman and
-- the 3 crew accounts without forcing anyone to sign up first.
-- ============================================================
create or replace function public.ensure_demo_auth_user(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = p_email limit 1;
  if v_id is not null then
    return v_id;
  end if;

  v_id := gen_random_uuid();
  -- Explicitly set every text/varchar column to empty string instead of
  -- leaving it default. GoTrue's "Database error querying schema" can fire
  -- when those token columns are NULL because the Go side scans them
  -- straight into string variables.
  insert into auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    null, '', null,
    '', null,
    '', '', null,
    '', 0,
    null,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    false, now(), now(),
    null, null, '', '', null,
    null, '', null,
    false, null, false
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object(
      'sub', v_id::text,
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  return v_id;
end;
$$;

-- ============================================================
-- Main reset function. Drops the demo org's transactional data
-- and recreates a fresh, dated-relative-to-today dataset.
-- ============================================================
create or replace function public.reset_demo_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demo_email    constant text := 'demo@myforemanhq.com';
  v_demo_password constant text := 'demo1234';

  v_demo_user_id   uuid;
  v_supervisor_id  uuid;
  v_crew1_id       uuid;
  v_crew2_id       uuid;

  v_org_id uuid;
  v_today  date := current_date;

  -- Customer ids
  c_robinson uuid; c_chen uuid; c_foster uuid; c_whitaker uuid;
  c_crestview uuid; c_thornton uuid; c_park uuid; c_anderson uuid;
  c_alvarez uuid; c_mitchell uuid;

  -- Job ids
  j_robinson_jan uuid; j_chen_jan uuid; j_foster_feb uuid; j_whitaker_feb uuid;
  j_crestview_mar uuid; j_anderson_mar uuid; j_park_apr uuid; j_foster_apr uuid;
  j_thornton_now uuid; j_chen_overdue uuid;
  j_anderson_active uuid; j_park_active uuid; j_robinson_today uuid;

  -- For the historical-jobs FOR LOOP further down
  v_job_id     uuid;
  v_hist_row   record;
  v_hourly     numeric;
begin
  -- 1. Auth users -------------------------------------------------
  v_demo_user_id  := public.ensure_demo_auth_user(v_demo_email, v_demo_password);
  v_supervisor_id := public.ensure_demo_auth_user('sarah.martinez@summitfieldservices.demo', v_demo_password);
  v_crew1_id      := public.ensure_demo_auth_user('david.cooper@summitfieldservices.demo',  v_demo_password);
  v_crew2_id      := public.ensure_demo_auth_user('marcus.lee@summitfieldservices.demo',    v_demo_password);

  -- 2. Org --------------------------------------------------------
  select om.org_id into v_org_id
  from public.org_members om
  where om.user_id = v_demo_user_id and om.role = 'owner'
  limit 1;

  if v_org_id is null then
    insert into public.organizations (
      name, owner_name, phone, business_email, address, default_tax_rate, income_tax_rate
    ) values (
      'Summit Field Services', 'Alex Summit', '512-555-0100',
      'demo@myforemanhq.com', '123 Congress Ave, Austin, TX 78701', 8.25, 25
    ) returning id into v_org_id;

    insert into public.org_members (org_id, user_id, role)
      values (v_org_id, v_demo_user_id, 'owner');
  else
    update public.organizations set
      name = 'Summit Field Services',
      owner_name = 'Alex Summit',
      phone = '512-555-0100',
      business_email = 'demo@myforemanhq.com',
      address = '123 Congress Ave, Austin, TX 78701',
      default_tax_rate = 8.25,
      income_tax_rate = 25
    where id = v_org_id;
  end if;

  -- 3. Wipe transactional data -----------------------------------
  delete from public.job_labor              where org_id = v_org_id;
  delete from public.invoices               where org_id = v_org_id;
  delete from public.expenses               where org_id = v_org_id;
  delete from public.mileage_logs           where org_id = v_org_id;
  delete from public.quotes                 where org_id = v_org_id;
  delete from public.jobs                   where org_id = v_org_id;
  delete from public.leads                  where org_id = v_org_id;
  delete from public.customers              where org_id = v_org_id;
  delete from public.notifications          where org_id = v_org_id;
  delete from public.insight_recommendations where org_id = v_org_id;
  delete from public.org_invitations        where org_id = v_org_id;

  -- 4. Crew memberships ------------------------------------------
  delete from public.org_members where org_id = v_org_id and user_id <> v_demo_user_id;
  insert into public.org_members (org_id, user_id, role, hourly_pay_rate) values
    (v_org_id, v_supervisor_id, 'dispatcher', 32.00),
    (v_org_id, v_crew1_id,      'crew',       24.00),
    (v_org_id, v_crew2_id,      'crew',       22.00);

  -- 5. Customers --------------------------------------------------
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Marcus Robinson', '512-555-0142', 'marcus.r@example.com', '4521 Travis Heights Blvd, Austin, TX 78704', 'Gate code 4521. Lab named Cooper.')
    returning id into c_robinson;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Patricia Chen', '512-555-0189', 'patricia.chen@example.com', '8902 Mesa Dr, Austin, TX 78759', 'Park in driveway, not the street.')
    returning id into c_chen;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'James & Linda Foster', '512-555-0234', 'foster.j@example.com', '1138 Oak Hill Pkwy, Austin, TX 78736', 'Two dogs (friendly).')
    returning id into c_foster;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Diana Whitaker', '512-555-0167', 'diana.w@example.com', '6021 Lake Austin Blvd, Austin, TX 78703', null)
    returning id into c_whitaker;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Crestview Property Mgmt', '512-555-0301', 'jobs@crestview-pm.example.com', '3400 Burnet Rd, Austin, TX 78757', 'Manages 14 rentals — invoice to office, not tenants.')
    returning id into c_crestview;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Robert Thornton', '512-555-0278', 'rthornton@example.com', '215 W 6th St, Austin, TX 78701', 'Loft on 4th floor, freight elevator only.')
    returning id into c_thornton;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Emily Park', '512-555-0156', 'epark@example.com', '7409 Spicewood Springs Rd, Austin, TX 78759', null)
    returning id into c_park;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Anderson Family Trust', '512-555-0345', 'anderson.trust@example.com', '2030 S Lamar Blvd, Austin, TX 78704', 'Repeat customer — monthly maintenance.')
    returning id into c_anderson;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Vincent Alvarez', '512-555-0193', 'valvarez@example.com', '1547 Cherry Creek Dr, Austin, TX 78745', null)
    returning id into c_alvarez;
  insert into public.customers (org_id, owner_id, name, phone, email, address, notes) values
    (v_org_id, v_demo_user_id, 'Sandra Mitchell', '512-555-0221', 'smitchell@example.com', '9012 Great Hills Trail, Austin, TX 78759', null)
    returning id into c_mitchell;

  -- 5b. HISTORICAL COMPLETED JOBS (5-12 months back) ------------
  -- A FOR LOOP keeps this readable: each row becomes a job + paid
  -- invoice + one labor entry + one materials expense, with the
  -- job ultimately ending in 'completed' status (we insert it as
  -- 'in_progress' first so the auto-invoice trigger from migration
  -- 0012 doesn't fire before we've added our pre-dated invoice).
  -- Seasonal mix: AC/HVAC heavy in summer, lighting in winter, etc.
  -- --------------------------------------------------------------
  for v_hist_row in
    select * from (values
      -- ~12 months ago — pre-summer prep
      (360, c_foster,     v_crew1_id,       'AC pre-summer service',      'Annual AC tune-up, capacitor check, filter swap.',                            850.00),
      (354, c_anderson,   v_supervisor_id,  'Deck staining',              'Power-wash and stain back deck. Two-day cure.',                              1200.00),
      -- ~11 months ago — peak summer begins
      (330, c_crestview,  v_crew2_id,       'Rental #3 disposal repair',  'Replaced under-sink garbage disposal at Westgate unit 3.',                    475.00),
      (325, c_park,       v_crew1_id,       'Ceiling fan installs (3)',   'Hung three Hampton Bay 52" fans in living room and bedrooms.',                620.00),
      -- ~10 months ago — peak summer
      (300, c_robinson,   v_crew1_id,       'AC condenser repair',        'Replaced condenser fan motor and start capacitor on outdoor unit.',          1850.00),
      (295, c_thornton,   v_crew2_id,       'Condo AC tune-up',           'Service call on 4th-floor unit — coil cleaning and filter.',                  325.00),
      -- ~9 months ago — heat wave, emergency work
      (270, c_whitaker,   v_supervisor_id,  'Pool pump replacement',      'Removed Hayward Super II, installed new 1.5HP variable-speed.',              1620.00),
      (264, c_foster,     v_crew1_id,       'Emergency AC repair',        'After-hours compressor replacement during heat wave.',                       2950.00),
      (260, c_chen,       v_crew2_id,       'Garage outlets x4',          'Added four 20A GFCI outlets in garage for workbench setup.',                  580.00),
      -- ~8 months ago — start of fall
      (240, c_anderson,   v_crew1_id,       'Gutter replacement',         'Removed bent aluminum gutter on east side. New seamless run.',               1450.00),
      (235, c_crestview,  v_crew2_id,       'Rental #5 toilet swap',      'Replaced cracked Kohler toilet at Cedar Ridge unit 5.',                        890.00),
      -- ~7 months ago — fall maintenance
      (215, c_robinson,   v_crew1_id,       'Water heater anode rod',     'Replaced sacrificial anode on Bradford White 50-gal tank.',                   290.00),
      (210, c_park,       v_crew2_id,       'Doorbell + camera install',  'Hard-wired Ring doorbell with chime kit. Two-camera setup.',                  480.00),
      (205, c_foster,     v_supervisor_id,  'Weatherstripping package',   'Replaced weatherstripping on 4 exterior doors. New door sweep on garage.',    640.00),
      -- ~6 months ago — slow stretch
      (185, c_whitaker,   v_crew1_id,       'Outdoor lighting',           'Low-voltage path lighting around front and side walkways.',                  1100.00),
      (180, c_crestview,  v_crew2_id,       'Rental #8 dishwasher',       'Removed and replaced dishwasher at Pinehurst unit 8.',                        510.00),
      -- ~5 months ago — holidays
      (155, c_chen,       v_crew1_id,       'Holiday lighting install',   'Hung exterior holiday lighting per customer specification.',                  380.00),
      (150, c_anderson,   v_crew2_id,       'Kitchen sink P-trap',        'Cleared kitchen drain, replaced P-trap and supply lines.',                    720.00)
    ) as t(days_ago, customer, assigned, title, description, price)
  loop
    v_hourly := case
                  when v_hist_row.assigned = v_supervisor_id then 32.00
                  when v_hist_row.assigned = v_crew1_id      then 24.00
                  else                                            22.00
                end;

    insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, v_hist_row.customer, v_hist_row.assigned, v_hist_row.title, v_hist_row.description,
            'in_progress', v_today - v_hist_row.days_ago, v_hist_row.price, (v_today - v_hist_row.days_ago - 2)::timestamptz)
    returning id into v_job_id;

    insert into public.invoices (org_id, owner_id, job_id, customer_id, amount, status, issued_date, paid_date, notes)
    values (v_org_id, v_demo_user_id, v_job_id, v_hist_row.customer, v_hist_row.price, 'paid',
            v_today - v_hist_row.days_ago, v_today - v_hist_row.days_ago + 7, v_hist_row.title);

    insert into public.job_labor (org_id, job_id, user_id, work_date, hours, hourly_rate, notes)
    values (v_org_id, v_job_id, v_hist_row.assigned, v_today - v_hist_row.days_ago,
            round((v_hist_row.price * 0.22 / v_hourly)::numeric, 1), v_hourly, 'Historical job');

    insert into public.expenses (org_id, owner_id, job_id, category, amount, expense_date, vendor, description)
    values (v_org_id, v_demo_user_id, v_job_id, 'materials',
            round((v_hist_row.price * 0.24)::numeric, 2),
            v_today - v_hist_row.days_ago - 1, 'Home Depot',
            'Materials — ' || v_hist_row.title);

    update public.jobs set status = 'completed' where id = v_job_id;
  end loop;

  -- 6. Completed jobs (in chronological order, all status=in_progress
  --    initially so the auto-invoice trigger doesn't fire; we'll add
  --    invoices manually with the dates we want, then flip status to
  --    'completed' — the trigger sees an existing invoice and skips).
  -- --------------------------------------------------------------
  -- ~4 months ago
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_robinson, v_crew1_id, 'Kitchen sink repair', 'Replaced corroded P-trap and supply lines under double sink.',
            'in_progress', v_today - 122, 1450, (v_today - 124)::timestamptz)
    returning id into j_robinson_jan;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_chen, v_crew2_id, 'Outlet replacement', 'Replaced 6 outlets in master bedroom and hallway with tamper-resistant GFCI where required.',
            'in_progress', v_today - 118, 800, (v_today - 120)::timestamptz)
    returning id into j_chen_jan;

  -- ~3 months ago
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_foster, v_crew1_id, 'AC tune-up + capacitor', 'Annual HVAC service. Replaced failing 45/5 capacitor on outdoor unit.',
            'in_progress', v_today - 92, 2200, (v_today - 94)::timestamptz)
    returning id into j_foster_feb;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_whitaker, v_crew2_id, 'Interior door hanging', 'Hung three pre-hung doors (master bath, guest bath, office). Adjusted strike plates.',
            'in_progress', v_today - 88, 650, (v_today - 90)::timestamptz)
    returning id into j_whitaker_feb;

  -- ~2 months ago
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_crestview, v_supervisor_id, 'Toilet replacement (rental #7)', 'Replaced Kohler Cimarron at 6712 Manor Rd unit 7. Tenant-reported leak.',
            'in_progress', v_today - 62, 1100, (v_today - 64)::timestamptz)
    returning id into j_crestview_mar;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_anderson, v_supervisor_id, 'Bathroom plumbing rough-in', 'Phase 1 of guest bath refresh — supply + drain re-route, valve replacements.',
            'in_progress', v_today - 56, 3400, (v_today - 58)::timestamptz)
    returning id into j_anderson_mar;

  -- ~1 month ago
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_park, v_crew2_id, 'Panel upgrade to 200A', 'Upgraded 125A FPE panel to 200A Square D, including meter base and inspection.',
            'in_progress', v_today - 32, 1750, (v_today - 34)::timestamptz)
    returning id into j_park_apr;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_foster, v_crew1_id, 'Water heater install', 'Removed leaking 50-gal natural gas WH, installed new 50-gal Rheem Performance Plus.',
            'in_progress', v_today - 28, 2100, (v_today - 30)::timestamptz)
    returning id into j_foster_apr;

  -- This month — one paid, one unpaid (overdue)
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_thornton, v_crew2_id, 'Light fixture installation', 'Hung two chandeliers and four sconces in entry/dining. Loft access by freight only.',
            'in_progress', v_today - 8, 1250, (v_today - 10)::timestamptz)
    returning id into j_thornton_now;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_chen, v_crew1_id, 'Main drain clearing', 'Cleared mainline blockage from kitchen branch out to cleanout. 60ft of cable.',
            'in_progress', v_today - 38, 890, (v_today - 40)::timestamptz)
    returning id into j_chen_overdue;

  -- 7. Active jobs (in progress / scheduled today) ---------------
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_anderson, v_supervisor_id, 'Fence section repair', 'Replace 3 damaged panels along property line, re-set 2 leaning posts.',
            'in_progress', v_today, 1500, (v_today - 4)::timestamptz)
    returning id into j_anderson_active;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_park, v_crew1_id, 'Bath faucet + tile patch', 'Replace Moen Brantford widespread, fix loose tiles around basin.',
            'in_progress', v_today + 1, 2800, (v_today - 2)::timestamptz)
    returning id into j_park_active;
  insert into public.jobs (org_id, owner_id, customer_id, assigned_to_user_id, title, description, status, scheduled_date, price, created_at)
    values (v_org_id, v_demo_user_id, c_robinson, v_crew2_id, 'Gutter cleaning + downspout', 'Quarterly gutter clean. Repair detached downspout on northeast corner.',
            'scheduled', v_today, 750, (v_today - 1)::timestamptz)
    returning id into j_robinson_today;

  -- 8. Invoices ---------------------------------------------------
  -- Paid invoices for the completed jobs (dates roughly aligned with when work finished)
  insert into public.invoices (org_id, owner_id, job_id, customer_id, amount, status, issued_date, paid_date, notes) values
    (v_org_id, v_demo_user_id, j_robinson_jan, c_robinson, 1450, 'paid', v_today - 122, v_today - 115, 'Kitchen sink repair'),
    (v_org_id, v_demo_user_id, j_chen_jan,     c_chen,     800,  'paid', v_today - 118, v_today - 112, 'Outlet replacement'),
    (v_org_id, v_demo_user_id, j_foster_feb,   c_foster,   2200, 'paid', v_today - 92,  v_today - 85,  'AC tune-up + capacitor'),
    (v_org_id, v_demo_user_id, j_whitaker_feb, c_whitaker, 650,  'paid', v_today - 88,  v_today - 80,  'Interior door hanging'),
    (v_org_id, v_demo_user_id, j_crestview_mar,c_crestview,1100, 'paid', v_today - 62,  v_today - 55,  'Toilet replacement (rental #7)'),
    (v_org_id, v_demo_user_id, j_anderson_mar, c_anderson, 3400, 'paid', v_today - 56,  v_today - 48,  'Bathroom plumbing rough-in'),
    (v_org_id, v_demo_user_id, j_park_apr,     c_park,     1750, 'paid', v_today - 32,  v_today - 24,  'Panel upgrade to 200A'),
    (v_org_id, v_demo_user_id, j_foster_apr,   c_foster,   2100, 'paid', v_today - 28,  v_today - 20,  'Water heater install'),
    (v_org_id, v_demo_user_id, j_thornton_now, c_thornton, 1250, 'paid', v_today - 8,   v_today - 3,   'Light fixture installation'),
    -- Overdue: issued 38 days ago, no paid_date
    (v_org_id, v_demo_user_id, j_chen_overdue, c_chen,     890,  'unpaid', v_today - 38, null,         'Main drain clearing');

  -- 9. Flip the seeded "completed" jobs to completed status now
  --    that invoices exist. Trigger sees the invoice and bails.
  -- --------------------------------------------------------------
  update public.jobs set status = 'completed'
  where id in (
    j_robinson_jan, j_chen_jan, j_foster_feb, j_whitaker_feb,
    j_crestview_mar, j_anderson_mar, j_park_apr, j_foster_apr,
    j_thornton_now, j_chen_overdue
  );

  -- 10. Quotes (sent + historical approved/declined/expired) ----
  insert into public.quotes (org_id, owner_id, customer_id, customer_name, customer_email, customer_phone, title, description, amount, status, sent_at, approved_at, declined_at, valid_until, notes, created_at) values
    -- Currently awaiting customer response
    (v_org_id, v_demo_user_id, c_chen,     'Patricia Chen',          'patricia.chen@example.com', '512-555-0189',
     'Master bath remodel — phase 1', 'Demolition, plumbing rough-in, new shower valve, sub-floor inspection. Materials estimate separate.',
     3500, 'sent',     (v_today - 5)::timestamptz, null, null, v_today + 25, null, (v_today - 5)::timestamptz),
    (v_org_id, v_demo_user_id, c_thornton, 'Robert Thornton',        'rthornton@example.com',     '512-555-0278',
     'AC system replacement', '3-ton Trane variable-speed unit, removal + disposal of existing, refrigerant line set inspection.',
     1850, 'sent',     (v_today - 2)::timestamptz, null, null, v_today + 28, null, (v_today - 2)::timestamptz),
    -- Historical approvals (customer said yes; job was scheduled)
    (v_org_id, v_demo_user_id, c_foster,   'James & Linda Foster',   'foster.j@example.com',      '512-555-0234',
     'Emergency AC repair', 'After-hours compressor replacement during heat wave.',
     2950, 'approved', (v_today - 268)::timestamptz, (v_today - 266)::timestamptz, null, v_today - 235, null, (v_today - 268)::timestamptz),
    (v_org_id, v_demo_user_id, c_whitaker, 'Diana Whitaker',         'diana.w@example.com',       '512-555-0167',
     'Pool pump replacement', 'Variable-speed Hayward 1.5HP swap.',
     1620, 'approved', (v_today - 274)::timestamptz, (v_today - 272)::timestamptz, null, v_today - 240, null, (v_today - 274)::timestamptz),
    (v_org_id, v_demo_user_id, c_anderson, 'Anderson Family Trust',  'anderson.trust@example.com','512-555-0345',
     'Gutter replacement (east side)', 'Removal of bent aluminum, new seamless run east elevation.',
     1450, 'approved', (v_today - 244)::timestamptz, (v_today - 242)::timestamptz, null, v_today - 210, null, (v_today - 244)::timestamptz),
    -- Declined
    (v_org_id, v_demo_user_id, null,       'Brad Henson',            'bh@example.com',            '512-555-0512',
     'Kitchen full re-plumb', 'Re-route supply + drain, fixtures by customer.',
     2200, 'declined', (v_today - 252)::timestamptz, null, (v_today - 247)::timestamptz, v_today - 220, 'Went with cheaper bid.', (v_today - 252)::timestamptz),
    -- Expired (customer never responded)
    (v_org_id, v_demo_user_id, null,       'Marcus DeWitt',          'md@example.com',            '512-555-0571',
     'Workshop outlets + circuit', 'Sub-panel feeder + 6 outlets in detached workshop.',
      600, 'expired',  (v_today - 148)::timestamptz, null, null, v_today - 117, null, (v_today - 148)::timestamptz);

  -- 11. Leads (active + historical for conversion-rate metric) --
  insert into public.leads (org_id, owner_id, name, phone, email, address, source, status, estimated_value, follow_up_date, notes, created_at) values
    -- Active
    (v_org_id, v_demo_user_id, 'Vincent Alvarez',  '512-555-0193', 'valvarez@example.com',  '1547 Cherry Creek Dr, Austin, TX 78745',
     'referral', 'new',       400, v_today + 2, 'Referred by Patricia Chen. Wants kitchen sink valve replaced.',     (v_today - 4)::timestamptz),
    (v_org_id, v_demo_user_id, 'Sandra Mitchell',  '512-555-0221', 'smitchell@example.com', '9012 Great Hills Trail, Austin, TX 78759',
     'website',  'contacted', 250, v_today,     'Called back Tue. Wants panel inspection — old FPE breakers concern.', (v_today - 6)::timestamptz),
    -- Historical — won
    (v_org_id, v_demo_user_id, 'Eduardo Mendoza',  '512-555-0461', 'em@example.com',        '4500 Bull Creek Rd, Austin, TX 78731',
     'referral', 'won',      1500, null,        'Converted — became regular handyman client.',                       (v_today - 320)::timestamptz),
    (v_org_id, v_demo_user_id, 'Karen Walsh',      '512-555-0488', 'kw@example.com',        '1124 W 38th St, Austin, TX 78705',
     'website',  'won',       800, null,        'Outlet add — moved to job same week.',                              (v_today - 280)::timestamptz),
    (v_org_id, v_demo_user_id, 'Olivia Park',      '512-555-0534', 'op@example.com',        '503 Brentwood St, Austin, TX 78757',
     'call',     'won',       450, null,        'Quick handyman job — done.',                                        (v_today - 195)::timestamptz),
    (v_org_id, v_demo_user_id, 'Tina Brookfield',  '512-555-0598', 'tb@example.com',        '4101 Avenue D, Austin, TX 78751',
     'referral', 'won',      1100, null,        'Referred by Anderson Trust.',                                       (v_today - 110)::timestamptz),
    -- Historical — lost
    (v_org_id, v_demo_user_id, 'Brad Henson',      '512-555-0512', 'bh@example.com',        '8800 Anderson Mill Rd, Austin, TX 78759',
     'website',  'lost',     2200, null,        'Went with cheaper bid.',                                            (v_today - 250)::timestamptz),
    (v_org_id, v_demo_user_id, 'Marcus DeWitt',    '512-555-0571', 'md@example.com',        '7218 Brodie Ln, Austin, TX 78745',
     'walk_in',  'lost',      600, null,        'Wanted same-day, couldn''t fit it in.',                             (v_today - 145)::timestamptz);

  -- 12. Expenses (mix of categories, job-tied and overhead) -----
  -- 4 months back
  insert into public.expenses (org_id, owner_id, job_id, category, amount, expense_date, vendor, description) values
    (v_org_id, v_demo_user_id, j_robinson_jan, 'materials', 248.40, v_today - 124, 'Home Depot',        'P-trap, supply lines, plumber putty'),
    (v_org_id, v_demo_user_id, j_chen_jan,     'materials', 142.80, v_today - 120, 'Lowe''s',           'GFCI outlets x6, wall plates, wire nuts'),
    (v_org_id, v_demo_user_id, null,           'fuel',       62.10, v_today - 119, 'Shell',             'Truck #1 fill'),
    (v_org_id, v_demo_user_id, null,           'insurance', 410.00, v_today - 121, 'Hartford',          'Monthly GL premium'),
  -- 3 months back
    (v_org_id, v_demo_user_id, j_foster_feb,   'materials', 380.55, v_today - 94,  'Ferguson HVAC',     '45/5 capacitor, refrigerant top-off'),
    (v_org_id, v_demo_user_id, j_whitaker_feb, 'materials', 215.20, v_today - 90,  'Home Depot',        'Pre-hung interior doors x3'),
    (v_org_id, v_demo_user_id, null,           'fuel',       68.45, v_today - 88,  'Shell',             'Truck #2 fill'),
    (v_org_id, v_demo_user_id, null,           'office',     85.00, v_today - 85,  'Adobe',             'Acrobat subscription'),
    (v_org_id, v_demo_user_id, null,           'insurance', 410.00, v_today - 91,  'Hartford',          'Monthly GL premium'),
    (v_org_id, v_demo_user_id, null,           'marketing', 250.00, v_today - 92,  'Google Ads',        'Local services ads — Apr'),
  -- 2 months back
    (v_org_id, v_demo_user_id, j_crestview_mar,'materials', 312.99, v_today - 64,  'Home Depot',        'Kohler Cimarron toilet + wax ring'),
    (v_org_id, v_demo_user_id, j_anderson_mar, 'materials', 845.30, v_today - 58,  'Ferguson Plumbing', 'Pex, fittings, shower valve'),
    (v_org_id, v_demo_user_id, null,           'fuel',       72.20, v_today - 60,  'Chevron',           'Truck #1'),
    (v_org_id, v_demo_user_id, null,           'equipment', 189.99, v_today - 55,  'Northern Tool',     'Pipe wrench set'),
    (v_org_id, v_demo_user_id, null,           'insurance', 410.00, v_today - 61,  'Hartford',          'Monthly GL premium'),
    (v_org_id, v_demo_user_id, null,           'meals',      48.75, v_today - 59,  'Torchy''s Tacos',   'Crew lunch — Anderson job'),
  -- 1 month back
    (v_org_id, v_demo_user_id, j_park_apr,     'materials', 480.10, v_today - 34,  'Home Depot',        '200A panel + breakers'),
    (v_org_id, v_demo_user_id, j_foster_apr,   'materials', 540.95, v_today - 30,  'Ferguson Plumbing', 'Rheem 50-gal NG water heater + flex lines'),
    (v_org_id, v_demo_user_id, null,           'fuel',       78.65, v_today - 32,  'Shell',             'Truck #2'),
    (v_org_id, v_demo_user_id, null,           'office',    149.99, v_today - 29,  'Microsoft',         'M365 Business — annual'),
    (v_org_id, v_demo_user_id, null,           'insurance', 410.00, v_today - 31,  'Hartford',          'Monthly GL premium'),
    (v_org_id, v_demo_user_id, null,           'advertising',125.00,v_today - 28,  'Nextdoor',          'Neighborhood promo'),
  -- This month
    (v_org_id, v_demo_user_id, j_thornton_now, 'materials', 295.40, v_today - 10,  'Lowe''s',           'Chandeliers, sconces, dimmers'),
    (v_org_id, v_demo_user_id, null,           'fuel',       74.20, v_today - 7,   'Shell',             'Truck #1'),
    (v_org_id, v_demo_user_id, null,           'fuel',       66.85, v_today - 3,   'Chevron',           'Truck #2'),
    (v_org_id, v_demo_user_id, null,           'insurance', 410.00, v_today - 1,   'Hartford',          'Monthly GL premium');

  -- 12b. OVERHEAD EXPENSES for the older 5-12 months ------------
  -- Monthly insurance — 8 entries to fill out the year
  insert into public.expenses (org_id, owner_id, category, amount, expense_date, vendor, description)
  select v_org_id, v_demo_user_id, 'insurance', 410.00, (v_today - (n * 30) - 5)::date, 'Hartford', 'Monthly GL premium'
  from generate_series(5, 12) as n;

  -- Fuel — roughly every 12 days going back the year (older months only,
  -- the recent months are already itemized above)
  insert into public.expenses (org_id, owner_id, category, amount, expense_date, vendor, description)
  select v_org_id, v_demo_user_id, 'fuel',
         round((58 + (n % 5) * 6)::numeric, 2),
         (v_today - 130 - n * 12)::date,
         case when n % 2 = 0 then 'Shell' else 'Chevron' end,
         'Truck #' || (1 + (n % 2))::text || ' fill'
  from generate_series(0, 19) as n;

  -- Quarterly marketing spend
  insert into public.expenses (org_id, owner_id, job_id, category, amount, expense_date, vendor, description) values
    (v_org_id, v_demo_user_id, null, 'marketing',   280.00, v_today - 350, 'Google Ads',       'Local services ads — Q1 last year'),
    (v_org_id, v_demo_user_id, null, 'marketing',   320.00, v_today - 260, 'Google Ads',       'Local services ads — summer push'),
    (v_org_id, v_demo_user_id, null, 'advertising', 195.00, v_today - 195, 'Yard sign printer','Yard sign reorder (50)'),
    (v_org_id, v_demo_user_id, null, 'marketing',   295.00, v_today - 170, 'Google Ads',       'Local services ads — Q4 last year'),
    (v_org_id, v_demo_user_id, null, 'advertising', 125.00, v_today - 145, 'Nextdoor',         'Neighborhood promo'),
    (v_org_id, v_demo_user_id, null, 'marketing',   260.00, v_today - 80,  'Google Ads',       'Local services ads — Q1 this year');

  -- Equipment one-offs across the year
  insert into public.expenses (org_id, owner_id, job_id, category, amount, expense_date, vendor, description) values
    (v_org_id, v_demo_user_id, null, 'equipment', 425.00, v_today - 320, 'Northern Tool', 'Cordless drill set (Milwaukee M18)'),
    (v_org_id, v_demo_user_id, null, 'equipment', 540.00, v_today - 235, 'Home Depot',    'Replacement ladder + safety harness'),
    (v_org_id, v_demo_user_id, null, 'equipment', 312.50, v_today - 165, 'Harbor Freight','Power tool kit replenishment');

  -- Office overhead spread out
  insert into public.expenses (org_id, owner_id, job_id, category, amount, expense_date, vendor, description) values
    (v_org_id, v_demo_user_id, null, 'office',     85.00, v_today - 245, 'Adobe',         'Acrobat subscription'),
    (v_org_id, v_demo_user_id, null, 'office',    149.99, v_today - 200, 'QuickBooks',    'QuickBooks Online — annual'),
    (v_org_id, v_demo_user_id, null, 'office',     65.00, v_today - 100, 'Office Depot',  'Receipt paper + printer ink'),
    (v_org_id, v_demo_user_id, null, 'office',     42.00, v_today - 75,  'Amazon',        'Filing supplies');

  -- Meals (deductible at 50%) — periodic crew lunches
  insert into public.expenses (org_id, owner_id, job_id, category, amount, expense_date, vendor, description) values
    (v_org_id, v_demo_user_id, null, 'meals',      52.10, v_today - 295, 'Torchy''s Tacos','Crew lunch — heat wave run'),
    (v_org_id, v_demo_user_id, null, 'meals',      38.40, v_today - 180, 'Whataburger',   'Crew lunch — gutter day'),
    (v_org_id, v_demo_user_id, null, 'meals',      44.85, v_today - 115, 'Torchy''s Tacos','Crew lunch — Crestview run');

  -- 13. Job labor (per-crew hours on jobs) ----------------------
  insert into public.job_labor (org_id, job_id, user_id, work_date, hours, hourly_rate, notes) values
    (v_org_id, j_robinson_jan,    v_crew1_id,      v_today - 122, 4.5, 24.00, 'Sink repair'),
    (v_org_id, j_chen_jan,        v_crew2_id,      v_today - 118, 3.0, 22.00, 'Outlet swap'),
    (v_org_id, j_foster_feb,      v_crew1_id,      v_today - 92,  5.0, 24.00, 'AC tune-up'),
    (v_org_id, j_whitaker_feb,    v_crew2_id,      v_today - 88,  3.5, 22.00, 'Door hanging'),
    (v_org_id, j_crestview_mar,   v_supervisor_id, v_today - 62,  3.0, 32.00, 'Toilet swap + supervised crew'),
    (v_org_id, j_anderson_mar,    v_supervisor_id, v_today - 56,  6.0, 32.00, 'Plumbing rough-in lead'),
    (v_org_id, j_anderson_mar,    v_crew1_id,      v_today - 56,  6.0, 24.00, 'Plumbing rough-in helper'),
    (v_org_id, j_park_apr,        v_crew2_id,      v_today - 32,  7.0, 22.00, 'Panel upgrade'),
    (v_org_id, j_foster_apr,      v_crew1_id,      v_today - 28,  5.5, 24.00, 'Water heater install'),
    (v_org_id, j_thornton_now,    v_crew2_id,      v_today - 8,   4.0, 22.00, 'Fixture install'),
    (v_org_id, j_chen_overdue,    v_crew1_id,      v_today - 38,  2.5, 24.00, 'Drain clearing'),
    (v_org_id, j_anderson_active, v_supervisor_id, v_today,       2.0, 32.00, 'Fence repair start'),
    (v_org_id, j_anderson_active, v_crew2_id,      v_today,       2.0, 22.00, 'Fence repair helper');

  -- 14. Mileage logs (business trips, mix of approved + pending) -
  insert into public.mileage_logs (org_id, user_id, log_date, miles, purpose, start_address, end_address, notes, approval_status) values
    (v_org_id, v_supervisor_id, v_today - 92, 14.8, 'business', '123 Congress Ave, Austin, TX', '1138 Oak Hill Pkwy, Austin, TX', 'Foster HVAC service',          'approved'),
    (v_org_id, v_crew1_id,      v_today - 88, 9.4,  'business', '123 Congress Ave, Austin, TX', '6021 Lake Austin Blvd, Austin, TX','Whitaker door install',        'approved'),
    (v_org_id, v_crew2_id,      v_today - 64, 7.2,  'business', '123 Congress Ave, Austin, TX', '3400 Burnet Rd, Austin, TX',      'Crestview rental toilet',      'approved'),
    (v_org_id, v_supervisor_id, v_today - 56, 5.1,  'business', '123 Congress Ave, Austin, TX', '2030 S Lamar Blvd, Austin, TX',   'Anderson plumbing rough-in',   'approved'),
    (v_org_id, v_crew1_id,      v_today - 32, 11.0, 'business', '123 Congress Ave, Austin, TX', '7409 Spicewood Springs Rd, Austin, TX','Park panel materials run',  'approved'),
    (v_org_id, v_crew1_id,      v_today - 28, 8.6,  'business', '123 Congress Ave, Austin, TX', '1138 Oak Hill Pkwy, Austin, TX',  'Foster water heater install',  'approved'),
    (v_org_id, v_crew2_id,      v_today - 10, 6.5,  'business', '123 Congress Ave, Austin, TX', '215 W 6th St, Austin, TX',        'Thornton fixtures',            'approved'),
    (v_org_id, v_crew1_id,      v_today - 8,  4.2,  'business', '123 Congress Ave, Austin, TX', '8902 Mesa Dr, Austin, TX',        'Chen drain clearing',          'approved'),
    (v_org_id, v_crew2_id,      v_today - 4,  3.8,  'business', '123 Congress Ave, Austin, TX', '4521 Travis Heights Blvd, Austin, TX','Robinson gutter scoping',   'pending'),
    (v_org_id, v_crew1_id,      v_today - 2,  12.7, 'business', '123 Congress Ave, Austin, TX', '7409 Spicewood Springs Rd, Austin, TX','Park bath job materials',  'pending'),
    (v_org_id, v_supervisor_id, v_today,      6.0,  'business', '123 Congress Ave, Austin, TX', '2030 S Lamar Blvd, Austin, TX',   'Anderson fence start',         'approved'),
    (v_org_id, v_crew2_id,      v_today,      3.8,  'business', '123 Congress Ave, Austin, TX', '4521 Travis Heights Blvd, Austin, TX','Robinson gutter clean',     'approved');

  -- 14b. HISTORICAL MILEAGE (5-12 months back) ------------------
  insert into public.mileage_logs (org_id, user_id, log_date, miles, purpose, start_address, end_address, notes, approval_status)
  select v_org_id,
         case when n % 3 = 0 then v_supervisor_id when n % 3 = 1 then v_crew1_id else v_crew2_id end,
         (v_today - 120 - n * 14)::date,
         round((4 + (n % 7) * 2.3)::numeric, 1),
         'business',
         '123 Congress Ave, Austin, TX',
         case (n % 5)
           when 0 then '4521 Travis Heights Blvd, Austin, TX'
           when 1 then '1138 Oak Hill Pkwy, Austin, TX'
           when 2 then '7409 Spicewood Springs Rd, Austin, TX'
           when 3 then '6021 Lake Austin Blvd, Austin, TX'
           else        '2030 S Lamar Blvd, Austin, TX'
         end,
         'Job site visit',
         'approved'
  from generate_series(0, 17) as n;

  -- 15. Sample AI Coach recommendations for the current month ---
  -- Hardcoded so the demo shows the Coach output without an API call.
  insert into public.insight_recommendations (org_id, period_month, recommendations, data_snapshot, model)
  values (
    v_org_id,
    date_trunc('month', current_date)::date,
    jsonb_build_array(
      jsonb_build_object(
        'area', 'pricing',
        'title', 'Raise plumbing service-call price',
        'body', 'Your plumbing jobs are clearing 62% margin on average — Foster''s water heater install netted $1,559 after costs. The market typically supports a 15% rate bump before pushback. Test it on the next two plumbing quotes and watch acceptance.'
      ),
      jsonb_build_object(
        'area', 'customer_retention',
        'title', 'Re-engage Foster — biggest LTV',
        'body', 'James & Linda Foster have paid $4,300 across two jobs in 90 days, making them your top customer by lifetime value. Send a "we noticed a stretch since your last service" follow-up. A second annual HVAC tune-up would be a natural fit before summer.'
      ),
      jsonb_build_object(
        'area', 'expense_reduction',
        'title', 'Renegotiate Hartford GL premium',
        'body', 'Insurance has been a flat $410/mo for four straight months — $4,920 annualized. At your loss-run record, an independent broker quote is worth 30 minutes. Even a 10% reduction is $492/yr that drops straight to profit.'
      ),
      jsonb_build_object(
        'area', 'job_mix',
        'title', 'Lean into electrical work',
        'body', 'Park''s 200A panel upgrade and Chen''s outlet swap both posted >70% margin, vs ~45% on your handyman jobs. Sandra Mitchell''s panel inspection lead fits the pattern — prioritize closing it.'
      ),
      jsonb_build_object(
        'area', 'slow_months',
        'title', 'Promote tune-ups in the slow window',
        'body', 'November and December historically show the lowest revenue. Stand up a pre-winter HVAC check-up package — Foster''s tune-up earned $1,820 on light materials, perfect filler work for the slow stretch.'
      )
    ),
    jsonb_build_object('demo', true),
    'demo-seed'
  );

  -- 16. A few realistic notifications -----------------------
  insert into public.notifications (org_id, user_id, kind, title, body, link, created_at) values
    (v_org_id, v_demo_user_id, 'quote_sent',  'Quote sent to Patricia Chen',
     'Master bath remodel — $3,500. Awaiting customer response.', '/quotes', (v_today - 5)::timestamptz),
    (v_org_id, v_demo_user_id, 'job_completed','Job completed → invoice created',
     '"Light fixture installation" is marked complete. Invoice drafted for $1,250.00.', '/invoices', (v_today - 8)::timestamptz),
    (v_org_id, v_demo_user_id, 'invoice_paid','Invoice paid',
     'Robert Thornton paid invoice for $1,250.00. Feedback request sent.', '/invoices', (v_today - 3)::timestamptz);
end;
$$;

-- ============================================================
-- Run it once now so the demo is available immediately after
-- the migration applies. Subsequent runs (via pg_cron or manual)
-- refresh the data without recreating the org or auth users.
-- ============================================================
select public.reset_demo_account();

-- ============================================================
-- Daily reset via pg_cron (if available). The Supabase dashboard
-- has pg_cron pre-enabled on most projects — if this fails on a
-- project without it, comment out the schedule line and either
-- enable the extension under Database > Extensions, or use a
-- Vercel cron pointing at a server endpoint that calls this RPC.
-- 06:00 UTC = ~01:00 Central, after which Austin demo viewers
-- get a clean dataset for the day.
-- ============================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('reset-demo-account-daily')
    where exists (select 1 from cron.job where jobname = 'reset-demo-account-daily');
    perform cron.schedule(
      'reset-demo-account-daily',
      '0 6 * * *',
      $cron$ select public.reset_demo_account(); $cron$
    );
  else
    raise notice 'pg_cron not installed — skipping daily schedule. Enable pg_cron and re-run the schedule block manually if you want auto-reset.';
  end if;
end;
$$;
