-- Demo refresh: bring the Summit Field Services demo up to date with
-- features added after migration 0013_demo_account.sql wrote the
-- original seed. New features the demo now showcases:
--   - Service catalog (migration 0031)
--   - Recurring jobs (migration 0031)
--   - Customer properties (migration 0031)
--   - Time entries on jobs (migration 0031)
--   - Sample AI usage so the Insights "AI Usage" panel reads as
--     active out of the gate, and the AI Coach last-run date renders
--   - A signed-off completed job so the customer signature feature
--     is visible (migration 0033)
--
-- Strategy: ship a focused reset_demo_extras() function that the
-- main reset_demo_account() invokes at the end of its run. Keeps
-- the 0013 monolith readable while letting demo content evolve.

-- =============================================================
-- Helper: per-feature seeders that run AFTER the existing reset.
-- All idempotent — they drop their own data first by org_id.
-- =============================================================
create or replace function public.reset_demo_extras(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_owner_id uuid;
  c_anderson uuid; c_crestview uuid; c_foster uuid; c_chen uuid;
  c_thornton uuid; c_park uuid;
  v_job_id uuid;
  v_property_id uuid;
begin
  -- Owner of the demo org (for *_owner_id columns on the seeds below)
  select user_id into v_owner_id
    from public.org_members
    where org_id = p_org_id and role = 'owner'
    limit 1;
  if v_owner_id is null then return; end if;

  -- Customer ids (resolved by name since the original 0013 seed
  -- recreates them on every reset with fresh uuids)
  select id into c_anderson  from public.customers where org_id = p_org_id and name = 'Anderson Family Trust'   limit 1;
  select id into c_crestview from public.customers where org_id = p_org_id and name = 'Crestview Property Mgmt' limit 1;
  select id into c_foster    from public.customers where org_id = p_org_id and name = 'James & Linda Foster'    limit 1;
  select id into c_chen      from public.customers where org_id = p_org_id and name = 'Patricia Chen'           limit 1;
  select id into c_thornton  from public.customers where org_id = p_org_id and name = 'Robert Thornton'         limit 1;
  select id into c_park      from public.customers where org_id = p_org_id and name = 'Emily Park'              limit 1;

  -- ---------- 1. SERVICE CATALOG ---------------------------------
  -- Wipe and reseed so the org page on /book/<slug> has something to
  -- show and the AI receptionist's system prompt has real services
  -- to reference.
  delete from public.services where org_id = p_org_id;
  insert into public.services (org_id, name, description, unit_price, unit, active) values
    (p_org_id, 'Handyman service call',  'Standard handyman visit. 2 hour minimum.',                   180.00, 'hour', true),
    (p_org_id, 'AC tune-up + filter',    'Seasonal HVAC service. Coil clean, capacitor check.',         185.00, 'each', true),
    (p_org_id, 'Drain unclogging',       'Mainline cable, kitchen branch, bathroom snake.',             225.00, 'each', true),
    (p_org_id, 'Gutter cleaning',        'Single-story home, gutters cleared and downspouts flushed.',  165.00, 'each', true),
    (p_org_id, 'Water heater install',   'Removal + new install. Standard 40 or 50 gallon tank.',      1800.00, 'each', true),
    (p_org_id, 'Outlet / GFCI install',  'Per-outlet pricing — includes wire, box, plate.',              95.00, 'each', true),
    (p_org_id, 'Light fixture install',  'Hang and wire a customer-supplied fixture.',                  140.00, 'each', true),
    (p_org_id, 'Fence panel repair',     'Replace damaged panels or reset leaning posts.',              275.00, 'each', true);

  -- ---------- 2. CUSTOMER PROPERTIES -----------------------------
  -- Crestview manages multiple rentals — a clean fit for the
  -- multi-property feature.
  delete from public.customer_properties where org_id = p_org_id;
  if c_crestview is not null then
    insert into public.customer_properties (org_id, customer_id, label, address) values
      (p_org_id, c_crestview, 'Cedar Ridge Unit 5',  '4815 Cedar Ridge Dr Unit 5, Austin, TX 78751'),
      (p_org_id, c_crestview, 'Westgate Unit 3',     '2117 Westgate Blvd Unit 3, Austin, TX 78745'),
      (p_org_id, c_crestview, 'Pinehurst Unit 8',    '6712 Pinehurst Cir Unit 8, Austin, TX 78727'),
      (p_org_id, c_crestview, 'Manor Road Unit 7',   '6712 Manor Rd Unit 7, Austin, TX 78723');
  end if;
  if c_anderson is not null then
    insert into public.customer_properties (org_id, customer_id, label, address)
      values (p_org_id, c_anderson, 'Anderson primary residence', '2030 S Lamar Blvd, Austin, TX 78704');
  end if;

  -- ---------- 3. RECURRING JOBS ----------------------------------
  delete from public.recurring_jobs where org_id = p_org_id;
  if c_anderson is not null then
    select id into v_property_id from public.customer_properties
      where org_id = p_org_id and customer_id = c_anderson
      order by created_at asc limit 1;
    insert into public.recurring_jobs
      (org_id, customer_id, property_id, title, description, price, cadence, day_of_month, next_run_date, active)
    values
      (p_org_id, c_anderson, v_property_id,
       'Monthly handyman walk-through',
       'Recurring maintenance plan — punch-list items, filter swaps, exterior check.',
       350.00, 'monthly', 15, (v_today + 7)::date, true);
  end if;
  if c_crestview is not null then
    select id into v_property_id from public.customer_properties
      where org_id = p_org_id and customer_id = c_crestview
      order by created_at asc limit 1;
    insert into public.recurring_jobs
      (org_id, customer_id, property_id, title, description, price, cadence, weekday, next_run_date, active)
    values
      (p_org_id, c_crestview, v_property_id,
       'Bi-weekly common area check',
       'Walkthrough rotation across managed rentals — quick fixes on the spot.',
       425.00, 'biweekly', 2, (v_today + 5)::date, true);
  end if;

  -- ---------- 4. TIME ENTRIES ------------------------------------
  -- Pin one or two completed time entries to the active jobs so the
  -- Time Clock card on the dashboard has something to render.
  delete from public.time_entries where org_id = p_org_id;
  select id into v_job_id from public.jobs
    where org_id = p_org_id and title = 'Fence section repair' limit 1;
  if v_job_id is not null then
    insert into public.time_entries (org_id, job_id, user_id, clock_in_at, clock_out_at, notes)
    select p_org_id, v_job_id, om.user_id,
           (v_today::timestamp + interval '8 hours'),
           (v_today::timestamp + interval '11 hours 30 minutes'),
           'Demo time entry'
      from public.org_members om
      where om.org_id = p_org_id and om.role <> 'owner'
      limit 1;
  end if;

  -- ---------- 5. SIGNED-OFF JOB ----------------------------------
  -- Backstamp the most recent completed job with a customer
  -- signature so the demo visibly shows the signature feature. The
  -- signature_url normally points at the job-signatures public
  -- bucket; for the demo we just record that it was signed (no real
  -- bucket object), which is enough for the UI to render the "Signed
  -- by" line on the invoice and portal.
  update public.jobs
     set signed_by_name = 'Robert Thornton',
         signed_at      = (v_today - 8)::timestamptz + interval '14 hours'
   where org_id = p_org_id
     and title = 'Light fixture installation';

  -- ---------- 6. SAMPLE AI USAGE LOGS ----------------------------
  -- Seed both kinds (live + cached) for both sources so the AI
  -- Usage panel on Insights has real numbers to show. Spread across
  -- the last 10 days to look organic.
  delete from public.ai_usage_log where org_id = p_org_id;
  insert into public.ai_usage_log (source, org_id, user_id, model, tokens_in, tokens_out, estimated_cost, cached, created_at)
  select
    case (n % 4) when 0 then 'customer_chat' when 1 then 'internal_ai' when 2 then 'customer_chat' else 'internal_ai' end,
    p_org_id,
    v_owner_id,
    'claude-haiku-4-5-20251001',
    case when (n % 5) = 0 then 0 else 400 + (n % 6) * 100 end,
    case when (n % 5) = 0 then 0 else 80 + (n % 4) * 30 end,
    case when (n % 5) = 0 then 0 else round( ((400 + (n % 6) * 100) * 1.00 + (80 + (n % 4) * 30) * 5.00) / 1000000.0, 4) end,
    (n % 5) = 0,
    now() - make_interval(days => n)
  from generate_series(0, 28) as n;

  -- ---------- 7. AI COACH LAST-RUN DATE --------------------------
  -- 0013 already seeds an insight_recommendations row for the
  -- current month. Leave it alone — the Insights "Next AI Coach run"
  -- card reads it directly.
end;
$$;

revoke all on function public.reset_demo_extras(uuid) from public;
revoke all on function public.reset_demo_extras(uuid) from authenticated;

-- =============================================================
-- Re-wire the main reset_demo_account() to call our extras as its
-- last step. We do this by appending a trigger-style call after the
-- existing function definition — `create or replace` would force
-- duplicating the whole 600-line monolith, which is exactly what
-- this seam exists to avoid.
--
-- Approach: add a row-level event trigger on customers (the last
-- table the seed touches) that, after a demo reset, fires the
-- extras. Cheaper: just call extras directly from a small wrapper
-- that the demo-launch button uses. We expose
-- reset_demo_account_v2() which calls both.
-- =============================================================
create or replace function public.reset_demo_account_v2()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  perform public.reset_demo_account();
  -- Resolve the demo org by its owner email (consistent with how
  -- 0013 finds it).
  select om.org_id into v_org_id
    from public.org_members om
    join auth.users u on u.id = om.user_id
    where u.email = 'demo@myforemanhq.com'
      and om.role = 'owner'
    limit 1;
  if v_org_id is not null then
    perform public.reset_demo_extras(v_org_id);
  end if;
end;
$$;

revoke all on function public.reset_demo_account_v2() from public;
revoke all on function public.reset_demo_account_v2() from authenticated;

-- Run it once now so the demo is fully refreshed after this
-- migration applies.
select public.reset_demo_account_v2();

-- Update the pg_cron schedule (if pg_cron is installed) to use the
-- v2 wrapper so the nightly reset picks up the extras.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('reset-demo-account-daily')
      where exists (select 1 from cron.job where jobname = 'reset-demo-account-daily');
    perform cron.schedule(
      'reset-demo-account-daily',
      '0 6 * * *',
      $cron$ select public.reset_demo_account_v2(); $cron$
    );
  end if;
end;
$$;
