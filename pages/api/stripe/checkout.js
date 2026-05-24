import { createClient } from '@supabase/supabase-js';
import { preflight } from '../../../lib/apiSecurity';
import { stripe, stripeReady } from '../../../lib/stripe';

// Public callable. The /inv/<token> page hits this with the
// invoice's public token to spin up a Stripe Checkout session. We
// re-read the invoice from the DB (using the service-role client)
// so the price can't be tampered with from the client.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  if (!stripeReady()) {
    return res.status(503).json({ error: 'Card payments are not configured on this account yet.' });
  }
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured.' });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing invoice token.' });
  }

  const sb = admin();
  const { data: inv, error } = await sb
    .from('invoices')
    .select('id, amount, status, org_id, customer_id, notes, public_token, customers ( name, email ), organizations ( name, business_email, stripe_connect_account_id, stripe_connect_charges_enabled )')
    .eq('public_token', token)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!inv) return res.status(404).json({ error: 'Invoice not found.' });
  if (inv.status === 'paid') return res.status(409).json({ error: 'This invoice has already been paid.' });

  // Gate: the contractor must have a Connect account with charges
  // enabled before we accept card payments. Without this, the
  // customer's money would land on our platform account — which is
  // explicitly not allowed: customer payments belong to the
  // contractor, our platform only earns SaaS subscription revenue.
  const connectAccountId = inv.organizations?.stripe_connect_account_id;
  const chargesEnabled   = !!inv.organizations?.stripe_connect_charges_enabled;
  if (!connectAccountId || !chargesEnabled) {
    return res.status(409).json({
      error: "This contractor hasn't enabled card payments yet. Please pay via the methods listed on the invoice (check, Zelle, Venmo, etc.) or contact them directly.",
    });
  }

  const amount = Math.round(Number(inv.amount || 0) * 100);
  if (amount < 50) {
    return res.status(400).json({ error: 'Amount too small for card payment.' });
  }

  const customerName = inv.customers?.name || 'Customer';
  const orgName      = inv.organizations?.name || 'MyForeman';

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const successUrl = `${origin}/inv/${token}?paid=1`;
  const cancelUrl  = `${origin}/inv/${token}?cancelled=1`;

  try {
    const s = stripe();
    // Direct charge on the contractor's Standard Connect account: we
    // pass `stripeAccount` in the request options so Stripe creates
    // the Checkout session on THEIR account. The funds flow into the
    // contractor's balance, not ours. application_fee_amount is
    // omitted — we take zero cut on customer payments.
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: `${orgName} — Invoice`,
            description: (inv.notes || `Invoice for ${customerName}`).slice(0, 500),
          },
        },
      }],
      customer_email: inv.customers?.email || undefined,
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata: {
        invoice_id:   inv.id,
        public_token: inv.public_token,
        org_id:       inv.org_id,
      },
      payment_intent_data: {
        description: `Invoice from ${orgName} for ${customerName}`,
        metadata: { invoice_id: inv.id, org_id: inv.org_id },
      },
    }, {
      stripeAccount: connectAccountId,
    });

    // Persist the session id immediately so a webhook race can still
    // find the invoice by session.
    await sb.from('invoices').update({ stripe_checkout_session_id: session.id }).eq('id', inv.id);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(502).json({ error: err?.message || 'Stripe error.' });
  }
}
