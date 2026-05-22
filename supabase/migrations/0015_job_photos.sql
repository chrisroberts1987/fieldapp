-- Job photos: before/after/work shots attached to a job. Common request
-- on field-service work — customers want a picture of the finished
-- work, the contractor wants the same record for insurance + portfolio.

drop table if exists public.job_photos cascade;

create table public.job_photos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  photo_url   text not null,
  kind        text not null default 'work'
                check (kind in ('before','after','work','damage','other')),
  caption     text,
  created_at  timestamptz not null default now()
);

create index job_photos_job_idx on public.job_photos (job_id);
create index job_photos_org_idx on public.job_photos (org_id);

alter table public.job_photos enable row level security;

create policy "job_photos org select" on public.job_photos
  for select using (public.is_org_member(org_id));
create policy "job_photos org insert" on public.job_photos
  for insert with check (public.is_org_member(org_id));
create policy "job_photos org update" on public.job_photos
  for update using (public.is_org_member(org_id));
create policy "job_photos org delete" on public.job_photos
  for delete using (public.is_org_member(org_id));

-- ============================================================
-- Storage bucket. Public read (so we can render the photo in the
-- app via simple URLs) but writes are RLS-gated by org membership on
-- the folder convention {org_id}/{job_id}/{filename}.
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('job-photos', 'job-photos', true)
  on conflict (id) do update set public = true;

drop policy if exists "job_photos public read"  on storage.objects;
drop policy if exists "job_photos org insert"   on storage.objects;
drop policy if exists "job_photos org update"   on storage.objects;
drop policy if exists "job_photos org delete"   on storage.objects;

create policy "job_photos public read" on storage.objects
  for select using (bucket_id = 'job-photos');

create policy "job_photos org insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "job_photos org update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'job-photos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "job_photos org delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
