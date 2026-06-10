-- Open change-order CRUD to crew. The original 0041 policies were
-- foreman + supervisor only — the office tier. In practice the crew
-- member on site is the one who sees the scope change, so making
-- them hand it off to the foreman just to write up a CO adds
-- friction and slows the customer's approval.
--
-- Crew can SELECT/INSERT/UPDATE change orders in their own org. RLS
-- on the job they're anchored to already prevents them from
-- creating COs on jobs they can't see.
--
-- DELETE stays foreman-only. Cancellation is the right verb for
-- crew + supervisor — hard delete is the foreman's safety hatch.

begin;

drop policy if exists "change_orders office select" on public.change_orders;
drop policy if exists "change_orders office insert" on public.change_orders;
drop policy if exists "change_orders office update" on public.change_orders;

create policy "change_orders org select" on public.change_orders
  for select using (public.is_org_member(org_id));

create policy "change_orders org insert" on public.change_orders
  for insert with check (public.is_org_member(org_id));

create policy "change_orders org update" on public.change_orders
  for update using (public.is_org_member(org_id));

-- DELETE policy from 0041 ("change_orders foreman delete") is left
-- in place — that one's correct as-is.

commit;
