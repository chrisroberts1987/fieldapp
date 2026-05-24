-- Contractor's manual payment methods. Shown on the customer-facing
-- /inv/<token> page alongside the Pay Now (Stripe) button. The
-- contractor still manually flips the invoice to Paid after the
-- transfer lands — but the rest of the workflow cascade (feedback
-- email, push, in-app notification) runs identically.
--
-- All fields are optional. We render only the methods the contractor
-- has filled in, so empty rows don't clutter the invoice page.

alter table public.organizations
  add column if not exists venmo_handle      text,
  add column if not exists zelle_contact     text,
  add column if not exists cashapp_handle    text,
  add column if not exists paypal_handle     text,
  add column if not exists check_payable_to  text,
  add column if not exists check_mail_to     text,
  add column if not exists payment_notes     text;

-- Update the public invoice RPC to include payment methods, so the
-- /inv/<token> page can render "Other ways to pay" without an extra
-- auth-leaking round trip. All values are strings the contractor
-- already chose to display; safe to surface publicly.
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
      'card_payments_enabled', (o.stripe_connect_account_id is not null and o.stripe_connect_charges_enabled),
      'venmo_handle',     o.venmo_handle,
      'zelle_contact',    o.zelle_contact,
      'cashapp_handle',   o.cashapp_handle,
      'paypal_handle',    o.paypal_handle,
      'check_payable_to', o.check_payable_to,
      'check_mail_to',    o.check_mail_to,
      'payment_notes',    o.payment_notes
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
