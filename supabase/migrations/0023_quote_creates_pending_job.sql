-- When a customer approves a quote, the resulting job should be
-- created in 'pending' status with NO scheduled date. The original
-- approve_quote RPC (migration 0007) was creating the job as
-- scheduled for the same day, which surprised contractors expecting
-- to schedule with the customer afterwards.
--
-- New behavior:
--   - status = 'pending' (new tier)
--   - scheduled_date = null
-- Once the contractor picks a date and saves, the jobs page detects
-- the pending→scheduled transition and emails the customer (handled
-- client-side via the existing email/send infrastructure).

create or replace function public.approve_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q     record;
  v_job_id  uuid;
  v_owner uuid;
begin
  select * into v_q from public.quotes where approval_token = p_token;
  if v_q.id is null then
    raise exception 'quote not found';
  end if;
  if v_q.status = 'approved' then
    return jsonb_build_object('ok', true, 'already_approved', true, 'job_id', v_q.converted_job_id);
  end if;
  if v_q.status not in ('draft','sent') then
    raise exception 'quote is %', v_q.status;
  end if;

  insert into public.jobs (org_id, owner_id, customer_id, title, description, price, status, scheduled_date)
    values (v_q.org_id, v_q.owner_id, v_q.customer_id,
            v_q.title, v_q.description, v_q.amount, 'pending', null)
    returning id into v_job_id;

  update public.quotes
    set status = 'approved',
        approved_at = now(),
        converted_job_id = v_job_id
    where id = v_q.id;

  select om.user_id into v_owner
    from public.org_members om
    where om.org_id = v_q.org_id and om.role = 'owner'
    order by om.joined_at asc
    limit 1;

  if v_owner is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (v_q.org_id, v_owner, 'quote_approved',
              'Quote approved · schedule it',
              v_q.customer_name || ' approved "' || v_q.title || '". Set a date to schedule with the customer.',
              '/jobs');
  end if;

  return jsonb_build_object('ok', true, 'job_id', v_job_id);
end;
$$;

revoke all on function public.approve_quote(text) from public;
grant execute on function public.approve_quote(text) to anon, authenticated;
