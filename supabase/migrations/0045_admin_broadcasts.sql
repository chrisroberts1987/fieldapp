-- Admin broadcast log. Every email blast sent from the admin
-- dashboard's "Broadcast" tab writes one row here after the send
-- completes (or partially completes). The table is the source of
-- truth for:
--   • the "today's count" rate limit (3 broadcasts per day, enforced
--     in /pages/api/admin/broadcasts/send.js)
--   • the history list rendered below the compose form
--   • a safety check showing the last broadcast date so the admin
--     doesn't accidentally re-send the same message
--
-- Inserts go through the service-role key from the API route, so RLS
-- is enabled with no policies — anon and authenticated reads/writes
-- are blocked outright.

drop table if exists public.admin_broadcasts cascade;

create table public.admin_broadcasts (
  id              bigserial    primary key,
  subject         text         not null,
  body            text         not null,
  tier_filter     text,                                -- null = all, else 'solo' | 'crew' | 'business'
  recipient_count integer      not null default 0,
  sent_count      integer      not null default 0,    -- successful sends (may be < recipient_count)
  failed_count    integer      not null default 0,
  sent_by         text         not null,              -- admin email
  sent_at         timestamptz  not null default now()
);

create index admin_broadcasts_sent_at_idx
  on public.admin_broadcasts (sent_at desc);

create index admin_broadcasts_sent_by_day_idx
  on public.admin_broadcasts (sent_by, sent_at desc);

alter table public.admin_broadcasts enable row level security;
