-- Two fixes for the self-service account deletion flow:
--
-- 1) org_invitations.accepted_by was created (migration 0008) with
--    "references auth.users(id)" and NO on-delete clause. That
--    defaults to NO ACTION, which means deleting an auth.users row
--    that ever accepted an invitation throws a foreign-key
--    constraint violation. This is the actual root cause of the
--    delete failures contractors hit. Switching to ON DELETE
--    CASCADE so accepted invitations get cleaned up automatically.
--
-- 2) delete_my_account() previously just nuked auth.users and
--    relied on FK actions to clean up. That preserves the org for
--    multi-user teams (correct), but for a solo contractor who
--    has no co-members, it leaves an orphan org with no one able
--    to sign in. Now: if the caller is the sole owner of an org
--    with no other members, delete the org too (which cascades all
--    customers, jobs, invoices, quotes, etc via on-delete cascade
--    on their org_id columns). Multi-member orgs are untouched.

alter table public.org_invitations
  drop constraint if exists org_invitations_accepted_by_fkey;

alter table public.org_invitations
  add constraint org_invitations_accepted_by_fkey
  foreign key (accepted_by) references auth.users(id) on delete cascade;


create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id  uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- For each org where the caller is the only owner AND no other
  -- members exist, delete the org. CASCADE on org_id will sweep
  -- customers/jobs/invoices/quotes/expenses/mileage/feedback/
  -- notifications/job_photos/job_labor/insight_recommendations/
  -- push_subscriptions etc. that belong to the org.
  --
  -- Orgs with other members are intentionally left alone — losing
  -- one teammate must not nuke the business.
  for v_org_id in
    select om.org_id
      from public.org_members om
     where om.user_id = v_user_id
       and om.role    = 'owner'
       and not exists (
         select 1 from public.org_members om2
          where om2.org_id = om.org_id
            and om2.user_id <> v_user_id
       )
  loop
    delete from public.organizations where id = v_org_id;
  end loop;

  -- Now delete the auth user. The remaining FK actions handle the
  -- rest:
  --   org_members.user_id           CASCADE
  --   notifications.user_id         CASCADE
  --   push_subscriptions.user_id    CASCADE
  --   mileage_logs.user_id          CASCADE
  --   org_invitations.accepted_by   CASCADE (fixed above)
  --   org_invitations.invited_by    SET NULL
  --   leads.owner_id                SET NULL
  --   quotes.owner_id               SET NULL
  --   expenses.owner_id             SET NULL
  --   jobs.assigned_to_user_id      SET NULL
  --   job_photos.user_id            SET NULL
  --   job_labor.user_id             SET NULL
  delete from auth.users where id = v_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
