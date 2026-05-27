-- AI cost controls.
--
-- Two tables:
--   1. ai_response_cache — keyed by (source, prompt_hash). When a
--      common question is asked again within its TTL window we serve
--      the cached reply instead of calling Anthropic. Costs nothing.
--   2. ai_usage_log     — append-only audit of every Claude call so
--      the admin dashboard can roll up spend, watch cache hit rate,
--      and flag heavy users. Cached responses are logged with
--      cached=true and zero cost so we can show "free hits" alongside
--      paid calls without double-counting toward budgets.
--
-- Both tables are intentionally append-style with no RLS for direct
-- user access — they're touched only by the API routes which use the
-- service role. We expose `org_id` and `user_id` columns anyway so
-- the admin views can group/sort meaningfully.

-- =============================================================
-- Cache
-- =============================================================
drop table if exists public.ai_response_cache cascade;

create table public.ai_response_cache (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source in ('customer_chat','internal_ai')),
  -- Org scope: customer_chat is per-org (different contractors get
  -- different cached answers because the prompt embeds their service
  -- catalog); internal_ai is per-user (so "what's my net" cached for
  -- one foreman doesn't leak to another).
  org_id       uuid references public.organizations(id) on delete cascade,
  user_id      uuid,
  prompt_hash  text not null,
  reply        text not null,
  tokens_in    int  not null default 0,
  tokens_out   int  not null default 0,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  hit_count    int  not null default 0
);

-- Lookups are always by (source, scope, prompt_hash). Two indexes so
-- each scope path stays tight.
create index ai_response_cache_chat_idx
  on public.ai_response_cache (source, org_id, prompt_hash)
  where source = 'customer_chat';
create index ai_response_cache_internal_idx
  on public.ai_response_cache (source, user_id, prompt_hash)
  where source = 'internal_ai';
create index ai_response_cache_expires_idx
  on public.ai_response_cache (expires_at);

-- =============================================================
-- Usage log
-- =============================================================
drop table if exists public.ai_usage_log cascade;

create table public.ai_usage_log (
  id              bigserial primary key,
  source          text not null check (source in ('customer_chat','internal_ai','coach','invoice_extract')),
  org_id          uuid references public.organizations(id) on delete set null,
  user_id         uuid,
  model           text,
  tokens_in       int not null default 0,
  tokens_out      int not null default 0,
  -- Pre-computed dollar cost (cents) using the model's published rates
  -- at the time of the call. Recorded as numeric so we can sum without
  -- losing fractional cents on long horizons.
  estimated_cost  numeric(10,4) not null default 0,
  -- True only when the reply came from ai_response_cache. Cached calls
  -- always have estimated_cost = 0 and tokens_* = 0 so the rollups can
  -- treat the column as a boolean filter without double-counting.
  cached          boolean not null default false,
  created_at      timestamptz not null default now()
);

create index ai_usage_log_created_idx on public.ai_usage_log (created_at desc);
create index ai_usage_log_org_idx     on public.ai_usage_log (org_id, created_at desc);
create index ai_usage_log_source_idx  on public.ai_usage_log (source, created_at desc);

-- =============================================================
-- Per-user rate limit helper for the internal assistant.
-- Returns true if the user has already made >= p_max calls within
-- the trailing p_window_seconds. The API layer checks this and 429s
-- if true. Live count from ai_usage_log instead of an in-memory map
-- so it works across Vercel serverless instances.
-- =============================================================
create or replace function public.ai_rate_limit_exceeded(
  p_user_id       uuid,
  p_source        text,
  p_max           int,
  p_window_seconds int
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) >= p_max
  from public.ai_usage_log
  where user_id = p_user_id
    and source  = p_source
    and cached  = false
    and created_at >= now() - make_interval(secs => p_window_seconds);
$$;

revoke all on function public.ai_rate_limit_exceeded(uuid, text, int, int) from public;
-- Service role only — called from API routes that already authed the user.

-- =============================================================
-- Admin rollups. Single RPC, one round-trip from the admin panel.
-- =============================================================
create or replace function public.admin_ai_usage_summary(p_since timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since         timestamptz := coalesce(p_since, date_trunc('month', now() at time zone 'utc'));
  v_total_cost    numeric;
  v_total_calls   int;
  v_cache_hits    int;
  v_by_source     jsonb;
  v_top_orgs      jsonb;
begin
  select
      coalesce(sum(estimated_cost), 0),
      count(*) filter (where cached = false),
      count(*) filter (where cached = true)
    into v_total_cost, v_total_calls, v_cache_hits
    from public.ai_usage_log
    where created_at >= v_since;

  select coalesce(jsonb_object_agg(source, payload), '{}'::jsonb)
    into v_by_source
    from (
      select source, jsonb_build_object(
        'calls', count(*) filter (where cached = false),
        'cache_hits', count(*) filter (where cached = true),
        'cost',  coalesce(sum(estimated_cost), 0)
      ) payload
      from public.ai_usage_log
      where created_at >= v_since
      group by source
    ) s;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top_orgs
    from (
      select
        o.id   as org_id,
        o.name as org_name,
        coalesce(sum(u.estimated_cost), 0) as cost,
        count(*) filter (where u.cached = false) as calls,
        count(*) filter (where u.cached = true)  as cache_hits
      from public.ai_usage_log u
      join public.organizations o on o.id = u.org_id
      where u.created_at >= v_since
      group by o.id, o.name
      order by cost desc
      limit 10
    ) t;

  return jsonb_build_object(
    'since',         v_since,
    'total_cost',    v_total_cost,
    'total_calls',   v_total_calls,
    'cache_hits',    v_cache_hits,
    'cache_hit_rate', case when (v_total_calls + v_cache_hits) > 0
                           then round( v_cache_hits::numeric / (v_total_calls + v_cache_hits) * 100, 1)
                           else 0 end,
    'by_source',     v_by_source,
    'top_orgs',      v_top_orgs
  );
end;
$$;

revoke all on function public.admin_ai_usage_summary(timestamptz) from public;
revoke all on function public.admin_ai_usage_summary(timestamptz) from authenticated;
-- Service role only.

-- =============================================================
-- Per-org rollup used by the AI Usage section on the Insights tab.
-- The Insights page itself runs under the user's session, so this
-- RPC is invoker-rights, gated on org membership via is_org_member.
-- =============================================================
create or replace function public.ai_usage_for_org(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc');
  v_chat        jsonb;
  v_internal    jsonb;
  v_coach_last  date;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'Not a member of this org';
  end if;

  select jsonb_build_object(
    'calls',      count(*) filter (where cached = false),
    'cache_hits', count(*) filter (where cached = true)
  ) into v_chat
    from public.ai_usage_log
    where org_id = p_org_id
      and source = 'customer_chat'
      and created_at >= v_month_start;

  select jsonb_build_object(
    'calls',      count(*) filter (where cached = false),
    'cache_hits', count(*) filter (where cached = true)
  ) into v_internal
    from public.ai_usage_log
    where org_id = p_org_id
      and source = 'internal_ai'
      and created_at >= v_month_start;

  select max(period_month) into v_coach_last
    from public.insight_recommendations
    where org_id = p_org_id;

  return jsonb_build_object(
    'month_start', v_month_start,
    'customer_chat', coalesce(v_chat, jsonb_build_object('calls', 0, 'cache_hits', 0)),
    'internal_ai',   coalesce(v_internal, jsonb_build_object('calls', 0, 'cache_hits', 0)),
    'coach_last_run', v_coach_last
  );
end;
$$;

grant execute on function public.ai_usage_for_org(uuid) to authenticated;
