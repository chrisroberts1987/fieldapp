-- Public quote form: per-org shareable URL that creates a lead from an
-- unauthenticated visitor. Apply in Supabase SQL editor.

-- ============================================================
-- ORG SLUG (the URL-safe identifier)
-- ============================================================
alter table public.organizations
  add column if not exists slug text;

-- Slug generator: lowercase the name, replace non-alphanumerics with
-- hyphens, trim, and append a numeric suffix if there's a collision.
create or replace function public.generate_org_slug(p_name text)
returns text
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 0;
begin
  base_slug := lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := btrim(base_slug, '-');
  base_slug := substring(base_slug from 1 for 40);
  if base_slug = '' then base_slug := 'company'; end if;

  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  return candidate;
end;
$$;

-- Trigger: auto-populate slug on insert if not provided.
create or replace function public.set_org_slug_on_insert()
returns trigger
language plpgsql
as $$
begin
  if NEW.slug is null or length(trim(NEW.slug)) = 0 then
    NEW.slug := public.generate_org_slug(NEW.name);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orgs_set_slug on public.organizations;
create trigger trg_orgs_set_slug
  before insert on public.organizations
  for each row execute function public.set_org_slug_on_insert();

-- Backfill existing rows.
update public.organizations
  set slug = public.generate_org_slug(name)
  where slug is null;

alter table public.organizations
  alter column slug set not null;

create unique index if not exists organizations_slug_unique
  on public.organizations (slug);

-- ============================================================
-- PUBLIC RPC: get a small, safe slice of org info by slug
-- (so the public quote page can render the business header).
-- Callable by anon. Returns nothing if no match.
-- ============================================================
create or replace function public.get_public_org_by_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url)
  from public.organizations
  where slug = p_slug;
$$;

revoke all on function public.get_public_org_by_slug(text) from public;
grant execute on function public.get_public_org_by_slug(text) to anon, authenticated;

-- ============================================================
-- PUBLIC RPC: create a lead for a given org slug.
-- Callable by anon. Validates required fields, finds the org by slug,
-- inserts a lead with source='website' and status='new'. Returns the
-- new lead id. Notes carry the free-text "what they need".
-- ============================================================
create or replace function public.create_lead_from_quote(
  p_slug    text,
  p_name    text,
  p_phone   text,
  p_email   text default null,
  p_address text default null,
  p_notes   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_lead_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;
  if p_phone is null or length(trim(p_phone)) = 0 then
    raise exception 'phone is required';
  end if;

  select id into v_org_id from public.organizations where slug = p_slug;
  if v_org_id is null then
    raise exception 'organization not found';
  end if;

  insert into public.leads (org_id, name, phone, email, address, notes, source, status)
    values (
      v_org_id,
      trim(p_name),
      trim(p_phone),
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_address, '')), ''),
      nullif(trim(coalesce(p_notes, '')), ''),
      'website',
      'new'
    )
    returning id into v_lead_id;

  return v_lead_id;
end;
$$;

revoke all on function public.create_lead_from_quote(text, text, text, text, text, text) from public;
grant execute on function public.create_lead_from_quote(text, text, text, text, text, text) to anon, authenticated;
