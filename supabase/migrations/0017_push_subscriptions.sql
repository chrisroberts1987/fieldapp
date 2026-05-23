-- Web Push subscriptions, one row per browser/device per user.
-- The endpoint URL is the canonical identifier (unique). When a user
-- grants notification permission and subscribes via the browser's
-- pushManager.subscribe(), the client posts the subscription here.
-- Server-side send helpers query rows by user_id when an event fires.

drop table if exists public.push_subscriptions cascade;

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index push_endpoint_uq on public.push_subscriptions (endpoint);
create index        push_user_idx     on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push own select" on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy "push own insert" on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy "push own update" on public.push_subscriptions
  for update using (user_id = auth.uid());
create policy "push own delete" on public.push_subscriptions
  for delete using (user_id = auth.uid());
