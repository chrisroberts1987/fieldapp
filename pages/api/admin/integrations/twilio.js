import twilio from 'twilio';
import { verifyAdmin } from '../../../../lib/adminAuth';

// Twilio integration card. Reports SMS messages sent (direction =
// outbound-*) this month from the configured account.
//
// Uses the existing twilio SDK + TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
// already wired up for sendBrandedSMS. We count by paginating Messages
// with dateSentAfter = first of the UTC month. Twilio's list API is
// 100-per-page; we cap at MAX_PAGES to prevent runaway calls — at the
// cap we report a "showing 5000+" hint.

const PAGE_LIMIT = 100;
const MAX_PAGES  = 50;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const lastUpdated = new Date().toISOString();

  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) {
    return res.status(200).json({
      ok: false, configured: false,
      missingEnv: [!sid && 'TWILIO_ACCOUNT_SID', !auth && 'TWILIO_AUTH_TOKEN'].filter(Boolean),
      lastUpdated,
    });
  }

  try {
    const client = twilio(sid, auth);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    let count = 0;
    let pages = 0;
    let capped = false;
    let page = await client.messages.page({ dateSentAfter: monthStart, pageSize: PAGE_LIMIT });
    while (page) {
      for (const m of page.instances) {
        if (m.direction && m.direction.startsWith('outbound')) count++;
      }
      pages++;
      if (pages >= MAX_PAGES) { capped = true; break; }
      page = await page.nextPage();
    }

    return res.status(200).json({
      ok: true, configured: true, lastUpdated,
      data: { smsSentThisMonth: count, capped },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'Twilio request failed.',
      lastUpdated,
    });
  }
}
