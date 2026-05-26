-- Per-member display name. Used wherever the app says "<crew> is on
-- the way" — before this, we fell back to the email prefix, which
-- meant customers saw "sam_47 is on the way" instead of "Sam".
--
-- Per-org rather than per-user so the same person can work for two
-- contractors under different names if needed (e.g., "Sam K." vs
-- "Sam Jones" for different brands).

begin;

alter table public.org_members
  add column if not exists display_name text;

-- list_org_members returns display_name so the jobs page (and any
-- future surface that names members) gets it without an extra
-- lookup.
create or replace function public.list_org_members(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'not a member of this org';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id',         om.user_id,
    'email',           u.email,
    'role',            om.role,
    'display_name',    om.display_name,
    'hourly_pay_rate', om.hourly_pay_rate,
    'joined_at',       om.joined_at
  ) order by om.joined_at), '[]'::jsonb)
  into v
  from public.org_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = p_org_id;

  return v;
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

-- RPC: set my own display name. Per-user, can't be used to rename
-- someone else. Trim + cap at 80 chars.
create or replace function public.set_my_display_name(p_org_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text;
begin
  v_clean := nullif(left(trim(coalesce(p_name, '')), 80), '');
  update public.org_members
    set display_name = v_clean
    where org_id = p_org_id and user_id = auth.uid();
  if not found then
    raise exception 'not a member of this org';
  end if;
  return jsonb_build_object('ok', true, 'display_name', v_clean);
end;
$$;

revoke all on function public.set_my_display_name(uuid, text) from public;
grant execute on function public.set_my_display_name(uuid, text) to authenticated;

commit;
