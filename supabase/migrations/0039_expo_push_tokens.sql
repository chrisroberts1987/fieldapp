-- Native (Expo) push tokens. Sits alongside push_subscriptions
-- (which holds Web Push endpoints) so the fan-out layer can deliver
-- to both surfaces from a single sendPushToUsers() call.
--
-- One row per (user_id, token) pair. The token is the unique key —
-- a single token never belongs to two users, and a user can have
-- multiple tokens (e.g. phone + tablet). updated_at gets bumped on
-- every app open so we can prune tokens that go quiet.

begin;

drop table if exists public.expo_push_tokens cascade;

create table public.expo_push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  device     text, -- optional, e.g. "iPhone 15 Pro" — for the user-facing devices list
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expo_push_tokens_token_uq on public.expo_push_tokens (token);
create index        expo_push_tokens_user_idx  on public.expo_push_tokens (user_id);

alter table public.expo_push_tokens enable row level security;

-- Users can read + write only their own tokens. The fan-out layer
-- uses the service role (bypasses RLS), so cross-user reads only
-- happen server-side.
create policy "expo_push_tokens self select" on public.expo_push_tokens
  for select using (auth.uid() = user_id);
create policy "expo_push_tokens self insert" on public.expo_push_tokens
  for insert with check (auth.uid() = user_id);
create policy "expo_push_tokens self update" on public.expo_push_tokens
  for update using (auth.uid() = user_id);
create policy "expo_push_tokens self delete" on public.expo_push_tokens
  for delete using (auth.uid() = user_id);

commit;
