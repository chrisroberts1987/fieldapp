-- Stripe Connect (Standard) account info per organization. When a
-- contractor connects their Stripe account, customer invoice payments
-- route directly to THEIR balance — we never touch their money. The
-- platform Stripe account stays exclusively for subscription revenue.
--
-- charges_enabled / payouts_enabled mirror Stripe's account flags;
-- requirements_due is a yes/no signal we surface in the UI when
-- onboarding is incomplete (the account exists but Stripe is waiting
-- on docs / a bank link / etc).

alter table public.organizations
  add column if not exists stripe_connect_account_id     text,
  add column if not exists stripe_connect_charges_enabled boolean not null default false,
  add column if not exists stripe_connect_payouts_enabled boolean not null default false,
  add column if not exists stripe_connect_requirements_due boolean not null default false,
  add column if not exists stripe_connect_updated_at     timestamptz;

create index if not exists organizations_stripe_connect_idx
  on public.organizations (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

-- Update the public invoice-by-token RPC so the customer-facing
-- /inv/<token> page knows whether to render the Pay Now button. We
-- only return the boolean, never the account id itself.
create or replace function public.get_invoice_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv jsonb;
begin
  select jsonb_build_object(
    'id',            i.id,
    'amount',        i.amount,
    'status',        i.status,
    'issued_date',   i.issued_date,
    'paid_date',     i.paid_date,
    'paid_via',      i.paid_via,
    'notes',         i.notes,
    'customer_name', c.name,
    'customer_email',c.email,
    'org', jsonb_build_object(
      'name',            o.name,
      'business_email',  o.business_email,
      'phone',           o.phone,
      'address',         o.address,
      'logo_url',        o.logo_url,
      'license_number',  o.license_number,
      'card_payments_enabled', (o.stripe_connect_account_id is not null and o.stripe_connect_charges_enabled)
    )
  ) into v_inv
  from public.invoices i
  left join public.customers     c on c.id = i.customer_id
  left join public.organizations o on o.id = i.org_id
  where i.public_token = p_token;

  if v_inv is null then
    raise exception 'invoice not found';
  end if;
  return v_inv;
end;
$$;

revoke all on function public.get_invoice_by_token(text) from public;
grant execute on function public.get_invoice_by_token(text) to anon, authenticated;
