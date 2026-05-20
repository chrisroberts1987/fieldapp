-- Self-service account deletion. Deletes the caller from auth.users;
-- foreign-key ON DELETE CASCADE handles org_members, notifications,
-- mileage_logs, and any other row owned by this user. Rows that have
-- ON DELETE SET NULL on owner_id (customers, jobs, invoices, etc.) are
-- preserved with a null created-by reference so the business's history
-- isn't lost when an employee leaves.

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = v_user_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
