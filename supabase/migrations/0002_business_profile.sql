-- Adds business profile fields to organizations + logo storage bucket.
-- Apply in Supabase SQL editor.

-- ============================================================
-- ORGANIZATION PROFILE FIELDS
-- ============================================================
alter table public.organizations
  add column if not exists owner_name       text,
  add column if not exists phone            text,
  add column if not exists business_email   text,
  add column if not exists address          text,
  add column if not exists logo_url         text,
  add column if not exists license_number   text,
  add column if not exists default_tax_rate numeric(5,2) not null default 8.25;

-- ============================================================
-- LOGO STORAGE BUCKET
-- Public bucket so the logo URL works on printable invoices without
-- needing signed URLs. Logos are non-sensitive branding assets.
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('org-logos', 'org-logos', true)
  on conflict (id) do update set public = true;

-- Storage RLS: anyone authenticated can read (the bucket is public anyway),
-- and only org owners/admins can upload/replace/delete logos within their
-- org's folder. Path convention: '{org_id}/whatever.{ext}'.
drop policy if exists "org logos public read"   on storage.objects;
drop policy if exists "org logos admin insert"  on storage.objects;
drop policy if exists "org logos admin update"  on storage.objects;
drop policy if exists "org logos admin delete"  on storage.objects;

create policy "org logos public read" on storage.objects
  for select using (bucket_id = 'org-logos');

create policy "org logos admin insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "org logos admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'org-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );

create policy "org logos admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and public.is_org_admin(((storage.foldername(name))[1])::uuid)
  );
