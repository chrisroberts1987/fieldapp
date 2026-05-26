import { verifyAdmin, logAdminEvent } from '../../../../../lib/adminAuth';

// POST /api/admin/business/[id]/impersonate
//
// Generates a one-time magic-link URL for the org owner. The admin
// pastes it into an incognito window to sign in as that user without
// disrupting their own admin session. The admin's primary session
// stays intact — we don't sign them out and back in.
//
// Magic links expire in 1 hour by default (configurable in the
// Supabase auth dashboard). Single-use: clicking it once consumes it.
//
// Every call is logged to admin_events with the target org_id +
// owner email so we have an audit trail of who was impersonated.
//
// SECURITY: gated by verifyAdmin which checks the caller's email
// against ADMIN_EMAIL. Service role auth.admin API is the only way
// to mint a magic link without sending it via email.

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['POST'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  const { id: orgId } = req.query;
  if (!orgId) return res.status(400).json({ error: 'Missing org id.' });

  // Find the org and its owner.
  const { data: org } = await sb.from('organizations')
    .select('id, name')
    .eq('id', orgId).maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  const { data: owner } = await sb.from('org_members')
    .select('user_id')
    .eq('org_id', orgId).eq('role', 'owner')
    .order('joined_at', { ascending: true }).limit(1).maybeSingle();
  if (!owner?.user_id) return res.status(404).json({ error: 'No owner found for this org.' });

  // Look up the owner's email from auth.users (service role).
  const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(owner.user_id);
  if (authErr || !authUser?.user?.email) {
    return res.status(404).json({ error: 'Owner email not found.' });
  }
  const targetEmail = authUser.user.email;

  // Mint the magic link.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://www.myforemanhq.com');
  const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
    options: { redirectTo: `${baseUrl}/dashboard` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    return res.status(502).json({ error: linkErr?.message || 'Could not generate sign-in link.' });
  }

  await logAdminEvent(sb, {
    adminEmail,
    action: 'impersonate',
    targetOrgId: orgId,
    payload: { owner_email: targetEmail, owner_user_id: owner.user_id },
  });

  return res.status(200).json({
    ok: true,
    url: linkData.properties.action_link,
    owner_email: targetEmail,
    expires_in_hours: 1,
  });
}
