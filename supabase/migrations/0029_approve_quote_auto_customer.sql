-- Auto-create a customer record when a lead-derived quote is
-- approved. Previously the approve_quote RPC just used the quote's
-- (possibly null) customer_id when creating the resulting job. If
-- the quote was generated from a lead, customer_id was null, so the
-- job had no customer link — and downstream the scheduling-email
-- flow had no email to send to.
--
-- New behavior on approval:
--   1. If quote.customer_id is set, reuse it.
--   2. Else look for an existing customer in the same org with a
--      matching email or phone (avoid creating a duplicate of a
--      contact the contractor already has).
--   3. Else create a new customer from the quote's denormalized
--      name/email/phone fields.
--   4. Use that customer_id on the resulting job.
--   5. Backfill customer_id on the quote itself so later lookups
--      resolve cleanly.
--   6. If the quote came from a lead, mark the lead 'won' and link
--      its converted_customer_id.

create or replace function public.approve_quote(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q       record;
  v_job_id  uuid;
  v_owner   uuid;
  v_cust_id uuid;
  v_phone_digits text;
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

  -- 1) Resolve customer.
  v_cust_id := v_q.customer_id;

  if v_cust_id is null and v_q.customer_email is not null and v_q.customer_email <> '' then
    select id into v_cust_id
      from public.customers
     where org_id = v_q.org_id
       and lower(email) = lower(v_q.customer_email)
     limit 1;
  end if;

  if v_cust_id is null and v_q.customer_phone is not null and v_q.customer_phone <> '' then
    v_phone_digits := regexp_replace(v_q.customer_phone, '\D+', '', 'g');
    if length(v_phone_digits) >= 7 then
      select id into v_cust_id
        from public.customers
       where org_id = v_q.org_id
         and regexp_replace(coalesce(phone, ''), '\D+', '', 'g') = v_phone_digits
       limit 1;
    end if;
  end if;

  if v_cust_id is null then
    insert into public.customers (org_id, owner_id, name, email, phone)
    values (
      v_q.org_id,
      v_q.owner_id,
      v_q.customer_name,
      nullif(v_q.customer_email, ''),
      nullif(v_q.customer_phone, '')
    )
    returning id into v_cust_id;
  end if;

  -- 2) Job (pending, no date — the contractor schedules with customer).
  insert into public.jobs (org_id, owner_id, customer_id, title, description, price, status, scheduled_date)
    values (v_q.org_id, v_q.owner_id, v_cust_id,
            v_q.title, v_q.description, v_q.amount, 'pending', null)
    returning id into v_job_id;

  -- 3) Backfill the quote so it points at the resolved customer +
  -- the new job.
  update public.quotes
    set status            = 'approved',
        approved_at       = now(),
        converted_job_id  = v_job_id,
        customer_id       = v_cust_id
    where id = v_q.id;

  -- 4) If the quote originated from a lead, mark the lead won and
  -- link its converted_customer_id.
  if v_q.lead_id is not null then
    update public.leads
       set status                = 'won',
           converted_customer_id = coalesce(converted_customer_id, v_cust_id)
     where id = v_q.lead_id;
  end if;

  -- 5) Owner notification (unchanged copy).
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

  return jsonb_build_object('ok', true, 'job_id', v_job_id, 'customer_id', v_cust_id);
end;
$$;

revoke all on function public.approve_quote(text) from public;
grant execute on function public.approve_quote(text) to anon, authenticated;
