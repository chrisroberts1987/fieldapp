-- 0050_demo_readonly.sql
-- The public demo account (demo@myforemanhq.com) is a marketing
-- showcase. Visitors who click "Try the demo" on the landing page
-- get signed in as that user and can poke around real data without
-- creating an account. The daily demo-refresh cron resets that data
-- to a clean state. But until this migration, nothing stopped a
-- visitor from creating, editing, or deleting records during their
-- session. This locks them down.
--
-- Mechanism: a trigger function that checks auth.jwt() ->> 'email'.
-- When the JWT belongs to the demo user, any INSERT/UPDATE/DELETE
-- on a tenant-scoped table raises a friendly exception. Service-
-- role contexts (the demo-refresh cron, webhooks, admin imports)
-- run with no JWT, so the function short-circuits and the operation
-- proceeds normally.
--
-- The exception message starts with "demo_account_readonly:" so the
-- client-side fetch interceptor can detect it and pop a sign-up
-- modal instead of surfacing a raw Postgres error.
--
-- Platform-internal tables (admin_*, ai_*, iap_events, platform_*,
-- audit_log, expo_push_tokens, push_subscriptions) are excluded
-- from the trigger because the demo user never writes to them in
-- a normal session.

create or replace function public.block_demo_user_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
begin
  begin
    current_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  exception when others then
    current_email := '';
  end;

  if current_email = 'demo@myforemanhq.com' then
    raise exception 'demo_account_readonly: This is a demo account. Sign up free to create your own.'
      using errcode = 'P0001';
  end if;

  return coalesce(NEW, OLD);
end;
$$;

-- Apply the trigger to every tenant-scoped table in the public
-- schema. Loops dynamically so we don't have to re-edit this
-- migration every time a new table lands. The exclusion list covers
-- platform-internal tables the demo user never touches in their
-- session.
do $body$
declare
  tbl text;
  excluded text[] := array[
    'admin_broadcasts','admin_events',
    'ai_usage_log','ai_response_cache',
    'iap_events',
    'platform_books_config','platform_expenses',
    'platform_recurring_expenses','platform_tax_payments',
    'vendors_1099',
    'audit_log',
    'expo_push_tokens','push_subscriptions'
  ];
begin
  for tbl in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname <> all(excluded)
  loop
    execute format('drop trigger if exists trg_block_demo_writes on public.%I', tbl);
    execute format(
      'create trigger trg_block_demo_writes
         before insert or update or delete on public.%I
         for each row execute function public.block_demo_user_writes()',
      tbl
    );
  end loop;
end
$body$;
