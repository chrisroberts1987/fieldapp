-- Three feature schemas at once: customer self-booking, multi-day
-- jobs, and customer signature capture on completion.

begin;

-- ============================================================
-- jobs: multi-day jobs + completion signature
--   - scheduled_end_date: optional. When set, the job runs from
--     scheduled_date through scheduled_end_date inclusive. Calendar
--     renders it as a bar across days.
--   - signature_url / signed_by_name / signed_at: stamped when the
--     customer signs off at completion. All optional — job can
--     complete without a signature.
-- ============================================================
alter table public.jobs
  add column if not exists scheduled_end_date date,
  add column if not exists signature_url      text,
  add column if not exists signed_by_name     text,
  add column if not exists signed_at          timestamptz;

-- ============================================================
-- leads: self-booking source + requested datetime
--   - source needs a new 'self_booking' value so booking-form
--     submissions don't get lumped in with generic 'website' leads.
--   - requested_date / requested_time are what the customer asked
--     for on the form. The foreman confirms (or moves) on the leads
--     page; we don't auto-create a job from a self-booking yet.
--   - service_name lets the customer say WHAT they want done so the
--     foreman doesn't have to guess.
-- ============================================================
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check
  check (source in ('call','website','referral','walk_in','self_booking','other'));

alter table public.leads
  add column if not exists requested_date date,
  add column if not exists requested_time time,
  add column if not exists service_name   text;

-- ============================================================
-- Public RPC: insert a self-booking lead.
-- Anonymous (customer is unauthenticated). Looks up the org by its
-- slug so the booking page can be URL-driven. Notifies the org's
-- owner via the existing notifications table.
-- ============================================================
create or replace function public.submit_self_booking(
  p_org_slug      text,
  p_name          text,
  p_phone         text,
  p_email         text,
  p_address       text,
  p_service_name  text,
  p_requested_date date,
  p_requested_time time,
  p_notes         text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_lead_id uuid;
  v_owner   uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if (p_phone is null or length(trim(p_phone)) = 0)
     and (p_email is null or length(trim(p_email)) = 0) then
    raise exception 'phone or email required';
  end if;

  select id into v_org_id from public.organizations where slug = p_org_slug;
  if v_org_id is null then
    raise exception 'business not found';
  end if;

  insert into public.leads (
    org_id, name, phone, email, address,
    source, status, service_name, requested_date, requested_time, notes
  ) values (
    v_org_id, trim(p_name),
    nullif(trim(coalesce(p_phone,'')), ''),
    nullif(trim(coalesce(p_email,'')), ''),
    nullif(trim(coalesce(p_address,'')), ''),
    'self_booking', 'new',
    nullif(trim(coalesce(p_service_name,'')), ''),
    p_requested_date,
    p_requested_time,
    nullif(trim(coalesce(p_notes,'')), '')
  )
  returning id into v_lead_id;

  -- In-app notification for the owner so they see the booking land.
  select om.user_id into v_owner
    from public.org_members om
    where om.org_id = v_org_id and om.role = 'owner'
    order by om.joined_at asc
    limit 1;
  if v_owner is not null then
    insert into public.notifications (org_id, user_id, kind, title, body, link)
      values (
        v_org_id, v_owner, 'self_booking',
        'New booking: ' || trim(p_name),
        coalesce(p_service_name, 'New customer booking request')
          || case when p_requested_date is not null
               then ' on ' || to_char(p_requested_date, 'Mon DD')
               else '' end,
        '/leads'
      );
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_lead_id);
end;
$$;

revoke all on function public.submit_self_booking(text, text, text, text, text, text, date, time, text) from public;
grant execute on function public.submit_self_booking(text, text, text, text, text, text, date, time, text) to anon, authenticated;

-- ============================================================
-- Public RPC: read enough about the org so the booking page can
-- render branding + service catalog + business hours blurb.
-- Anonymous; only returns public-safe fields.
-- ============================================================
create or replace function public.get_booking_page(p_org_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when o.id is null then null
    else jsonb_build_object(
      'org', jsonb_build_object(
        'id',           o.id,
        'name',         o.name,
        'phone',        o.phone,
        'business_email', o.business_email,
        'address',      o.address,
        'logo_url',     o.logo_url,
        'slug',         o.slug
      ),
      'services', coalesce(
        (select jsonb_agg(jsonb_build_object(
            'id',          s.id,
            'name',        s.name,
            'description', s.description,
            'unit_price',  s.unit_price,
            'unit',        s.unit
          ) order by s.name)
         from public.services s
         where s.org_id = o.id and s.active = true), '[]'::jsonb)
    )
  end
  from public.organizations o
  where o.slug = p_org_slug
  limit 1;
$$;

revoke all on function public.get_booking_page(text) from public;
grant execute on function public.get_booking_page(text) to anon, authenticated;

-- ============================================================
-- Storage bucket for completion signatures. Public-read so signed
-- jobs can render the image in receipt emails / PDFs without auth.
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('job-signatures', 'job-signatures', true)
  on conflict (id) do update set public = true;

drop policy if exists "job-signatures org write"  on storage.objects;
drop policy if exists "job-signatures org read"   on storage.objects;
drop policy if exists "job-signatures public read" on storage.objects;

-- Anyone authenticated can write to their org's folder. Path layout
-- enforced at app level (orgId/jobId/...) — RLS just requires that
-- the first path segment matches an org the user belongs to.
create policy "job-signatures org write"
  on storage.objects for insert
  with check (
    bucket_id = 'job-signatures'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "job-signatures public read"
  on storage.objects for select
  using (bucket_id = 'job-signatures');

commit;
