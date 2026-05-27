import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';
import { logUsage } from '../../../lib/aiCost';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-enforced ceiling. Each base64-encoded file in the body is roughly
// 1.37x its on-disk size, so 14mb on the wire ≈ 10mb on disk per file.
// Combined with MAX_TOTAL_BYTES below and the per-request file count, this
// keeps an abusive client from feeding the Anthropic SDK arbitrarily large
// inputs.
export const config = {
  api: {
    bodyParser: { sizeLimit: '14mb' },
  },
};

const MAX_FILE_BYTES  = 10 * 1024 * 1024; // 10 MB per file (after base64 decode)
const MAX_TOTAL_BYTES = 30 * 1024 * 1024; // 30 MB combined per request
const ALLOWED_MIMES   = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = new Anthropic();

const SYSTEM_PROMPT = `You extract invoice line-data from documents uploaded to MyForeman, a SaaS for field-service contractors (handymen, landscapers, HVAC, plumbers, electricians).

The user is the contractor. The invoices they're uploading are ones THEY issued to THEIR customers — so:

- "customer_name" is the BILL TO / recipient on the invoice (the homeowner, business, or property manager the contractor billed). It is NOT the contractor's own business name. If a "Bill To", "Customer", "Client", "Property", or similar block exists, take the name from there. If only one party name appears and it sits at the top with a logo, that's the contractor — DO NOT use it as customer_name. If you genuinely cannot identify the recipient, return null and lower confidence.
- "amount" is the FINAL TOTAL the customer owes (Total / Amount Due / Grand Total / Balance Due). If subtotals, taxes, and a total are all shown, use the total. Numeric only — no currency symbols.
- "issued_date" is the invoice date / date issued / billing date. Format strictly as YYYY-MM-DD.
- "paid_date" is the date payment was received. If the invoice shows "PAID" with a date, use that. If "PAID" is stamped but no date is given, use the issued_date. If the invoice does NOT indicate payment, leave paid_date as null.
- "status" is "paid" if there is ANY clear indication the invoice was paid (PAID stamp, paid date filled in, Balance Due = $0, receipt-style document). Otherwise "unpaid".
- "notes" is a short summary of the work/services billed — line items concatenated, or the description if there's just one. Keep under ~140 chars. Null if no description is visible.
- "confidence" is your assessment of how confidently you extracted the fields: "high" when the document is a clean, structured invoice; "medium" when fields were partially obscured or had to be inferred; "low" when the document is unclear, handwritten, photo-of-photo, partially cut off, or might not be an invoice at all.

Date parsing rules:
- "03/15/2025" → 2025-03-15 (assume US MM/DD/YYYY when ambiguous, since the user base is US contractors)
- "Mar 15, 2025" → 2025-03-15
- "15-Mar-25" → 2025-03-15
- If only month/year is visible, use the 1st of the month.
- If no year is visible at all, leave issued_date null and set confidence to "low".

Amount parsing rules:
- "$1,234.56" → 1234.56
- "$1,234" → 1234
- "1234.56 USD" → 1234.56
- If multiple totals appear (subtotal + tax + total), use the final Total / Amount Due figure.
- Never return a negative number. If the document shows a credit/refund, treat amount as the absolute value and add "refund/credit" to notes.

If the document is clearly NOT an invoice (random photo, blank page, ID card, receipt that's missing required fields), return your best-effort fields with confidence "low" — DO NOT refuse. The user will review every extraction before importing.

Return ONLY the JSON object, no preamble or commentary.`;

const SCHEMA = {
  type: 'object',
  properties: {
    customer_name: { type: ['string', 'null'], description: 'BILL TO recipient (the contractor\'s customer), not the contractor themselves.' },
    amount:        { type: 'number',           description: 'Final total in dollars (no currency symbol).' },
    issued_date:   { type: ['string', 'null'], description: 'Invoice date as YYYY-MM-DD.' },
    paid_date:     { type: ['string', 'null'], description: 'Payment date as YYYY-MM-DD, or null if unpaid.' },
    status:        { type: 'string',           enum: ['paid', 'unpaid'] },
    notes:         { type: ['string', 'null'], description: 'Short summary of services billed.' },
    confidence:    { type: 'string',           enum: ['high', 'medium', 'low'] },
  },
  required: ['customer_name', 'amount', 'issued_date', 'paid_date', 'status', 'notes', 'confidence'],
  additionalProperties: false,
};

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });
  }

  // Require a valid Supabase session — previously anyone could POST here,
  // burning Anthropic credits on the org's tab.
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing auth token.' });
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (userErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  // Service-role client for the usage log only — extraction itself
  // still runs through the user-scoped sb above.
  const sbService = SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

  // Resolve the user's primary org for the usage rollup. Cheap.
  let logOrgId = null;
  try {
    const { data: mem } = await sb.from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1).maybeSingle();
    logOrgId = mem?.org_id || null;
  } catch {}

  const { files } = req.body || {};
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'files (array of {name,type,data}) required' });
  }
  if (files.length > 10) {
    return res.status(400).json({ error: 'Max 10 files per request.' });
  }

  // Per-file + total size validation against base64 length.
  let totalBytes = 0;
  for (const f of files) {
    const approxBytes = typeof f?.data === 'string' ? Math.floor(f.data.length * 3 / 4) : 0;
    if (approxBytes > MAX_FILE_BYTES) {
      return res.status(413).json({ error: `${f?.name || 'A file'} is over the 10 MB limit.` });
    }
    totalBytes += approxBytes;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return res.status(413).json({ error: 'Combined upload size exceeds 30 MB.' });
  }

  const results = [];

  for (const file of files) {
    const filename = file?.name || 'untitled';
    const mime = file?.type || '';
    const data = file?.data || '';

    if (!data) {
      results.push({ filename, success: false, error: 'Empty file data.' });
      continue;
    }

    if (!ALLOWED_MIMES.has(mime)) {
      results.push({ filename, success: false, error: `Unsupported file type: ${mime || 'unknown'}. Use PDF, JPG, PNG, or HEIC.` });
      continue;
    }

    const content = [];
    if (mime === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } });
    } else {
      // Anthropic's image input accepts jpeg/png/webp/gif. HEIC is not in that
      // list — tell the user to convert. (Server-side conversion would need a
      // native binary we don't ship here.)
      if (mime === 'image/heic' || mime === 'image/heif') {
        results.push({ filename, success: false, error: 'HEIC isn\'t supported by the AI extractor yet. Convert to JPG/PNG and re-upload.' });
        continue;
      }
      content.push({ type: 'image', source: { type: 'base64', media_type: mime, data } });
    }

    content.push({ type: 'text', text: 'Extract the invoice fields from this document and return them as JSON matching the schema.' });

    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (!textBlock) {
        results.push({ filename, success: false, error: 'No text returned from the model.' });
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(textBlock.text);
      } catch (e) {
        results.push({ filename, success: false, error: 'Could not parse model output as JSON.' });
        continue;
      }

      results.push({ filename, success: true, data: parsed });

      if (sbService) {
        logUsage(sbService, {
          source: 'invoice_extract',
          orgId: logOrgId,
          userId: user.id,
          model: 'claude-opus-4-7',
          tokensIn:  response.usage?.input_tokens  || 0,
          tokensOut: response.usage?.output_tokens || 0,
        }).catch(() => {});
      }
    } catch (err) {
      let msg = err?.message || 'Extraction failed.';
      if (err instanceof Anthropic.RateLimitError)      msg = 'Rate-limited by the model. Try fewer files at once.';
      else if (err instanceof Anthropic.AuthenticationError) msg = 'Server API key is invalid.';
      else if (err instanceof Anthropic.APIError)       msg = `Model error (${err.status}): ${err.message}`;
      results.push({ filename, success: false, error: msg });
    }
  }

  res.status(200).json({ results });
}
