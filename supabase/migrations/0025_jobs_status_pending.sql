-- The jobs table inherited a CHECK constraint from the original
-- Supabase template that locks status to ('scheduled', 'in_progress',
-- 'completed', 'cancelled'). Migration 0023 changed approve_quote
-- to insert with status='pending' so the contractor schedules with
-- the customer first — that now hits the constraint.
--
-- Drop and recreate to include 'pending'. Using a fixed constraint
-- name so this migration is idempotent.

alter table public.jobs drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled'));
