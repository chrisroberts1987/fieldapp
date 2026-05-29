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
  -- Usage panel on Insights has real numbers a contractor can read
  -- as a story: "lots of cached hits = cost controls are working".
  -- Target shape (this calendar month):
  --   Customer chat:  ~58 conversations, ~18 instant (cached)
  --   In-app AI:      ~36 questions,     ~12 instant (cached)
  delete from public.ai_usage_log where org_id = p_org_id;

  -- Customer chat — heavier traffic because it's the public booking
  -- page. Spread organically across the last 28 days.
  insert into public.ai_usage_log (source, org_id, user_id, model, tokens_in, tokens_out, estimated_cost, cached, created_at)
  select
    'customer_chat',
    p_org_id,
    v_owner_id,
    'claude-haiku-4-5-20251001',
    case when (n % 3) = 0 then 0 else 380 + (n % 7) * 90 end,
    case when (n % 3) = 0 then 0 else 70  + (n % 5) * 25 end,
    case when (n % 3) = 0 then 0 else round( ((380 + (n % 7) * 90) * 1.00 + (70 + (n % 5) * 25) * 5.00) / 1000000.0, 4) end,
    (n % 3) = 0,
    now() - make_interval(hours => (n * 11)::int)
  from generate_series(0, 57) as n;

  -- In-app AI assistant — the contractor poking at it during the
  -- workday. Fewer total questions, similar cache rate.
  insert into public.ai_usage_log (source, org_id, user_id, model, tokens_in, tokens_out, estimated_cost, cached, created_at)
  select
    'internal_ai',
    p_org_id,
    v_owner_id,
    'claude-haiku-4-5-20251001',
    case when (n % 3) = 0 then 0 else 250 + (n % 6) * 80 end,
    case when (n % 3) = 0 then 0 else 60  + (n % 4) * 30 end,
    case when (n % 3) = 0 then 0 else round( ((250 + (n % 6) * 80) * 1.00 + (60 + (n % 4) * 30) * 5.00) / 1000000.0, 4) end,
    (n % 3) = 0,
    now() - make_interval(hours => (n * 18)::int)
  from generate_series(0, 35) as n;

  -- ---------- 7. AI COACH LAST-RUN DATE --------------------------
  -- 0013 already seeds an insight_recommendations row for the
  -- current month. Leave it alone — the Insights "Next AI Coach run"
  -- card reads it directly.

  -- ---------- 7a. DEEPER HISTORY (months 13-24 back) ---------------
  -- The base 0013 seed only goes back ~12 months. The Insights
  -- "YoY growth (trailing 12)" KPI compares the last 12 months to the
  -- 12 before that, so without any data older than ~360 days ago it
  -- divides by zero and renders "—". Backfill ~10 paid invoices into
  -- the months-13-to-22 window so the YoY calc has something to
  -- compare against. Smaller volume than the recent year on purpose
  -- so YoY shows healthy growth rather than a flat line.
  insert into public.invoices (org_id, owner_id, customer_id, amount, status, issued_date, paid_date, notes)
  select
    p_org_id, v_owner_id, cu.id, v.amount, 'paid'::text,
    (v_today - v.days_ago)::date,
    (v_today - v.days_ago + 7)::date,
    v.title
  from (values
    (440, 'Marcus Robinson',         'Lighting tune-up',          425.00),
    (455, 'Patricia Chen',           'Bathroom GFCI add',         310.00),
    (470, 'James & Linda Foster',    'Spring HVAC service',       380.00),
    (495, 'Diana Whitaker',          'Front porch repair',        920.00),
    (510, 'Crestview Property Mgmt', 'Rental #1 disposal swap',   495.00),
    (540, 'Anderson Family Trust',   'Driveway sealcoat',         1100.00),
    (575, 'Emily Park',              'Pendant lighting (kitchen)',640.00),
    (605, 'Robert Thornton',         'Loft AC service',           295.00),
    (630, 'James & Linda Foster',    'Deck pressure-wash',        385.00),
    (660, 'Marcus Robinson',         'Outdoor outlet add',        220.00)
  ) as v(days_ago, customer_name, title, amount)
  join public.customers cu on cu.org_id = p_org_id and cu.name = v.customer_name;

  -- Sprinkle in a handful of older overhead expenses too so the
  -- year-over-year expense compare is fair (otherwise the Expense %
  -- of revenue KPI would also look distorted in the old window).
  insert into public.expenses (org_id, owner_id, category, amount, expense_date, vendor, description)
  select p_org_id, v_owner_id, 'insurance', 410.00, (v_today - (n * 30 + 400))::date, 'Hartford', 'Monthly GL premium'
    from generate_series(0, 7) as n;
  insert into public.expenses (org_id, owner_id, category, amount, expense_date, vendor, description)
  select p_org_id, v_owner_id, 'fuel',
         round((58 + (n % 5) * 6)::numeric, 2),
         (v_today - 420 - n * 14)::date,
         case when n % 2 = 0 then 'Shell' else 'Chevron' end,
         'Truck #' || (1 + (n % 2))::text || ' fill'
    from generate_series(0, 14) as n;

  -- ---------- 7b. CUSTOMER FEEDBACK (REVIEWS) ----------------------
  -- The /reviews tab reads from public.feedback. The base demo seed
  -- (0013) clears feedback at the start of every reset but never
  -- recreates any, so the Reviews screen looked empty. Backfill a
  -- handful of submitted reviews tied to historical paid invoices so
  -- the average-rating tile and the rating breakdown both light up.
  delete from public.feedback where org_id = p_org_id;
  insert into public.feedback (org_id, invoice_id, customer_id, customer_name, rating, comment, submitted_at, created_at)
  select
    p_org_id,
    inv.id,
    inv.customer_id,
    cu.name,
    v.rating,
    v.comment,
    (v_today - v.days_ago)::timestamptz + interval '15 hours',
    (v_today - v.days_ago - 1)::timestamptz
  from (values
    ('Water heater install',          5, 'Quick and clean. Knew exactly what they were doing, no upsell.', 18),
    ('Panel upgrade to 200A',         4, 'Good work overall. Took a little longer than I expected but they cleaned up after.', 22),
    ('Light fixture installation',    5, 'Looks great in the loft. Showed up on time and finished the same day.', 4),
    ('Toilet replacement (rental #7)',5, 'Tenant was happy too. Thanks for handling everything directly with them.', 50),
    ('Bathroom plumbing rough-in',    5, 'On budget and on schedule. Will use again for phase 2.', 48),
    ('AC tune-up + capacitor',        5, 'Honest diagnosis, fair price. Cool air the next day.', 82),
    ('Kitchen sink repair',           4, 'Solid work. Would have liked a heads-up text the morning of.', 110),
    ('Interior door hanging',         5, 'All three doors swing perfect now. Thanks Sarah and crew.', 78),
    ('Outlet replacement',            3, 'Job got done but had to call back the next day to fix one of the outlets.', 108)
  ) as v(title, rating, comment, days_ago)
  join public.invoices inv on inv.org_id = p_org_id and inv.notes = v.title and inv.status = 'paid'
  left join public.customers cu on cu.id = inv.customer_id;

  -- ---------- 8. SUPERVISOR HIERARCHY ----------------------------
  -- Wire David Cooper and Marcus Lee to report to Sarah Martinez
  -- (the dispatcher) so the supervisor view has something to show.
  -- Wrapped in a column existence guard so this runs cleanly on
  -- demo refreshes even if migration 0038 hasn't applied yet.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'org_members' and column_name = 'supervisor_id'
  ) then
    update public.org_members set supervisor_id = (
      select user_id from public.org_members
      where org_id = p_org_id and role = 'dispatcher' limit 1
    )
    where org_id = p_org_id and role = 'crew';

    -- Set supervisor_id on jobs assigned to crew members so the
    -- supervisor's queue lights up immediately.
    update public.jobs j set supervisor_id = om.supervisor_id
      from public.org_members om
      where j.org_id = p_org_id
        and j.assigned_to_user_id = om.user_id
        and om.org_id = p_org_id
        and om.supervisor_id is not null;
  end if;
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
