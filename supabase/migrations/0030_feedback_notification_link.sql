-- The submit_feedback RPC inserts an in-app notification when a
-- customer submits a review. The link target was set to /insights
-- back when there was no dedicated reviews page. Now that
-- /reviews exists, point notifications there so tapping the bell
-- lands you on the right page.
--
-- Also rewords the notification body to include a star glyph so
-- the bell list shows the rating at a glance.

create or replace function public.submit_feedback(p_token text, p_rating int, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f record;
  v_owner uuid;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be 1-5';
  end if;

  select * into v_f from public.feedback where token = p_token;
  if v_f.id is null then
    raise exception 'feedback link not found';
  end if;
  if v_f.submitted_at is not null then
    return jsonb_build_object('ok', true, 'already_submitted', true);
  end if;

  update public.feedback
    set rating = p_rating,
        comment = nullif(trim(coalesce(p_comment, '')), ''),
        submitted_at = now()
    where id = v_f.id;

  select om.user_id into v_owner
    from public.org_members om
    where om.org_id = v_f.org_id and om.role = 'owner'
    order by om.joined_at asc
    limit 1;

  if v_owner is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (
        v_f.org_id,
        v_owner,
        'feedback_received',
        p_rating || '★ from ' || coalesce(v_f.customer_name, 'a customer'),
        coalesce(nullif(trim(coalesce(p_comment, '')), ''), 'No written comment.'),
        '/reviews'
      );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_feedback(text, int, text) from public;
grant execute on function public.submit_feedback(text, int, text) to anon, authenticated;
