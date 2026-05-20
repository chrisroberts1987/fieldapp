-- Persisted AI Coach recommendations. One row per (org, month-of-coverage)
-- so a foreman opening Insights gets the same advice for the rest of the
-- month and we don't burn Anthropic credits on every refresh.

drop table if exists public.insight_recommendations cascade;

create table public.insight_recommendations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  period_month    date not null,                   -- first day of the month it analyzes
  recommendations jsonb not null,                  -- [{area, title, body}, ...]
  data_snapshot   jsonb,                           -- the raw numbers fed to the model (for audit)
  model           text,
  generated_at    timestamptz not null default now()
);

create unique index insight_recs_org_month_uq
  on public.insight_recommendations (org_id, period_month);

create index insight_recs_org_idx
  on public.insight_recommendations (org_id);

alter table public.insight_recommendations enable row level security;

-- Read: any org member (TopNav gates the tab to foreman, but RLS
-- intentionally stays org-wide so a re-share/screen-grab inside the org
-- doesn't 403). Insert: only admin (Foreman). Update/delete: only admin.
create policy "insight_recs org select" on public.insight_recommendations
  for select using (public.is_org_member(org_id));

create policy "insight_recs admin insert" on public.insight_recommendations
  for insert with check (public.is_org_admin(org_id));

create policy "insight_recs admin update" on public.insight_recommendations
  for update using (public.is_org_admin(org_id));

create policy "insight_recs admin delete" on public.insight_recommendations
  for delete using (public.is_org_admin(org_id));
