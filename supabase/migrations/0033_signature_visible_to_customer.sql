-- Surface the job's completion signature on the customer-facing
-- invoice and portal pages. The image already lives in the public
-- job-signatures bucket; we just need the URL flowing through.

begin;

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
    -- Job + signature snapshot. Customer sees what they signed.
    'job', case when j.id is null then null else jsonb_build_object(
      'id',             j.id,
      'title',          j.title,
      'description',    j.description,
      'signature_url',  j.signature_url,
      'signed_by_name', j.signed_by_name,
      'signed_at',      j.signed_at
    ) end,
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
  left join public.jobs          j on j.id = i.job_id
  where i.public_token = p_token;

  if v_inv is null then
    raise exception 'invoice not found';
  end if;
  return v_inv;
end;
$$;

revoke all on function public.get_invoice_by_token(text) from public;
grant execute on function public.get_invoice_by_token(text) to anon, authenticated;

commit;
