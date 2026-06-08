// Customer-facing SMS dispatcher. Single endpoint, multiple kinds:
//
//   POST /api/sms/customer
//   Body: { kind, customerId, data }
//
//     kind = 'on_my_way' | 'appointment' | 'payment' | 'feedback'
//
// Auth: Bearer JWT — caller must be an org member of the customer's
// org (RLS on the customers SELECT enforces this naturally).
//
// We resolve the customer's org name + phone server-side, gate on
// sms_opt_in_at / sms_opt_out, build the message from the correct
// template, send via Twilio, and log to customer_sms_log.

import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { sendCustomerSMS } from '../../../lib/sms/customer';
import {
  appointmentConfirmedCustomerSMS,
  onMyWayCustomerSMS,
  paymentReceivedCustomerSMS,
  feedbackRequestCustomerSMS,
} from '../../../lib/sms/templates';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (preflight(req, res, { allowMethods: ['POST'] }) === null) return;

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { kind, customerId, data } = req.body || {};
  if (!kind || !customerId) {
    return res.status(400).json({ error: 'kind and customerId required.' });
  }

  // RLS-scoped read first. If the caller can't see this customer,
  // they shouldn't be triggering SMS for it.
  const { data: cust } = await userClient
    .from('customers')
    .select('id, name, phone, org_id, sms_opt_in_at, sms_opt_out')
    .eq('id', customerId)
    .maybeSingle();
  if (!cust) return res.status(404).json({ error: 'Customer not found or no access.' });

  if (!SERVICE_KEY) return res.status(500).json({ error: 'SMS not configured.' });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Org name powers the "Smith Lawn Care: ..." prefix on every text.
  const { data: org } = await sb.from('organizations')
    .select('name').eq('id', cust.org_id).maybeSingle();
  const orgName = org?.name || 'Your contractor';

  let body;
  switch (kind) {
    case 'on_my_way':
      body = onMyWayCustomerSMS({ orgName, crewName: data?.crewName, etaMins: data?.etaMins });
      break;
    case 'appointment':
      body = appointmentConfirmedCustomerSMS({
        orgName,
        dateStr: data?.dateStr,
        timeStr: data?.timeStr,
        jobTitle: data?.jobTitle,
      });
      break;
    case 'payment':
      body = paymentReceivedCustomerSMS({
        orgName, amount: data?.amount, invoiceUrl: data?.invoiceUrl,
      });
      break;
    case 'feedback':
      body = feedbackRequestCustomerSMS({
        orgName, feedbackUrl: data?.feedbackUrl,
      });
      break;
    default:
      return res.status(400).json({ error: 'Unknown kind.' });
  }

  const result = await sendCustomerSMS(sb, {
    orgId: cust.org_id,
    customer: cust,
    body,
    kind,
  });
  return res.status(200).json(result);
}
