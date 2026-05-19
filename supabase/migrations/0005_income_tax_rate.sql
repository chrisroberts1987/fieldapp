-- Income tax rate per org, used by the Tax view to estimate
-- quarterly + annual taxes due. Distinct from default_tax_rate which
-- is the sales tax rate.

alter table public.organizations
  add column if not exists income_tax_rate numeric(5,2) not null default 25.00;
