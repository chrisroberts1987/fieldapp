import { verifyAdmin } from '../../../../lib/adminAuth';

// Facebook Ads (Meta Marketing API) integration card.
//   - Total ad spend this month
//   - Link clicks this month
//   - Cost per click
//   - Best-performing ad (highest link_clicks)
//
// Uses two REST calls (no facebook-nodejs-business-sdk dependency):
//   1. Account-level insights for the monthly totals
//   2. Ad-level insights to find the best performer
//
// Env vars required:
//   FACEBOOK_AD_ACCESS_TOKEN  — long-lived system user token with
//                               ads_read scope on the ad account
//   FACEBOOK_AD_ACCOUNT_ID    — "act_<id>" or just the numeric id

const GRAPH_VERSION = 'v23.0';

function actId(raw) {
  const v = String(raw || '').trim();
  return v.startsWith('act_') ? v : `act_${v}`;
}

async function fbGet(path, params, token) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  url.searchParams.set('access_token', token);
  const r = await fetch(url.toString());
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body?.error) {
    throw new Error(body?.error?.message || `Facebook API ${r.status}`);
  }
  return body;
}

function linkClicksFromActions(actions) {
  if (!Array.isArray(actions)) return 0;
  const hit = actions.find(a => a.action_type === 'link_click');
  return hit ? Number(hit.value) || 0 : 0;
}

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const lastUpdated = new Date().toISOString();

  const token   = process.env.FACEBOOK_AD_ACCESS_TOKEN;
  const account = process.env.FACEBOOK_AD_ACCOUNT_ID;
  if (!token || !account) {
    return res.status(200).json({
      ok: false, configured: false,
      missingEnv: [
        !token   && 'FACEBOOK_AD_ACCESS_TOKEN',
        !account && 'FACEBOOK_AD_ACCOUNT_ID',
      ].filter(Boolean),
      lastUpdated,
    });
  }

  try {
    const acct = actId(account);

    const [acctInsights, adInsights] = await Promise.all([
      fbGet(`${acct}/insights`, {
        fields: 'spend,clicks,cpc,actions',
        date_preset: 'this_month',
      }, token),
      fbGet(`${acct}/insights`, {
        level: 'ad',
        fields: 'ad_id,ad_name,spend,actions',
        date_preset: 'this_month',
        limit: 50,
      }, token),
    ]);

    const summary = acctInsights?.data?.[0] || {};
    const spend      = Number(summary.spend || 0);
    const linkClicks = linkClicksFromActions(summary.actions);
    const cpc        = linkClicks > 0 ? spend / linkClicks : 0;

    let bestAd = null;
    for (const ad of adInsights?.data || []) {
      const clicks = linkClicksFromActions(ad.actions);
      if (!bestAd || clicks > bestAd.linkClicks) {
        bestAd = {
          id:         ad.ad_id,
          name:       ad.ad_name || 'Unnamed ad',
          spend:      Number(ad.spend || 0),
          linkClicks: clicks,
        };
      }
    }

    return res.status(200).json({
      ok: true, configured: true, lastUpdated,
      data: { spend, linkClicks, cpc, bestAd },
    });
  } catch (e) {
    return res.status(200).json({
      ok: false, configured: true,
      error: e?.message || 'Facebook Ads request failed.',
      lastUpdated,
    });
  }
}
