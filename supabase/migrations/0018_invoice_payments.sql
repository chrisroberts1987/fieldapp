-- Customer-facing payment columns. The public_token lets a contractor
-- share a single URL like /inv/<token> with their customer — the
-- recipient can view the invoice and tap Pay Now to open Stripe
-- Checkout. The stripe_* columns track the live session and the
-- final PaymentIntent for reconciliation. paid_via records HOW the
-- invoice was settled (card via Stripe, or a manual mark-paid with
-- the method noted) so the contractor's accountant can categorize.

alter table public.invoices
  add column if not exists public_token                text,
  add column if not exists stripe_checkout_session_id  text,
  add column if not exists stripe_payment_intent_id    text,
  add column if not exists paid_via                    text;

-- Backfill tokens for existing rows so any pre-existing invoice is
-- immediately shareable. Use a 24-char hex (12 bytes random) — same
-- pattern as quotes.approval_token.
update public.invoices
  set public_token = encode(gen_random_bytes(12), 'hex')
  where public_token is null;

-- Now make the column NOT NULL and unique, and give it a default
-- for future inserts.
alter table public.invoices
  alter column public_token set not null;

alter table public.invoices
  alter column public_token set default encode(gen_random_bytes(12), 'hex');

create unique index if not exists invoices_public_token_uq
  on public.invoices (public_token);

-- paid_via check — keeps the field clean for reporting.
alter table public.invoices
  drop constraint if exists invoices_paid_via_check;
alter table public.invoices
  add constraint invoices_paid_via_check
  check (paid_via is null or paid_via in ('stripe','cash','check','zelle','venmo','ach','other'));

-- Stripe session lookup index for webhook handler.
create index if not exists invoices_stripe_session_idx
  on public.invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ============================================================
-- Public RPC: get_invoice_by_token(token)
-- Returns the invoice payload the public /inv/<token> page needs,
-- including the org's branding fields so we can render a clean
-- branded view without leaking other org data.
-- ============================================================
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
      'license_number',  o.license_number
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
