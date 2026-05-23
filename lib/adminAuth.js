import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from './apiSecurity';

// Centralized admin gate for the /api/admin/* endpoints. Every admin
// endpoint calls verifyAdmin(req, res), which:
//   1. Runs the standard preflight (POST-only allow-list, rate limit,
//      Origin check).
//   2. Resolves the Bearer token to a Supabase user.
//   3. Checks the user's email against ADMIN_EMAIL (defaults to the
//      platform owner).
//   4. Returns { user, sb (service-role client) } on success, or
//      null after writing a 401/403 to the response.
//
// The service-role client is what lets the admin panel read across
// every org. The key is server-only (no NEXT_PUBLIC_ prefix) and
// never reaches the browser.

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL   = (process.env.ADMIN_EMAIL || 'chris.roberts@myforemanhq.com').toLowerCase();

export async function verifyAdmin(req, res, { allowMethods } = {}) {
  if (preflight(req, res, { allowMethods: allowMethods || ['GET','POST'] }) === null) return null;

  if (!SERVICE_KEY) {
    res.status(500).json({ error: 'Admin not configured: SUPABASE_SERVICE_ROLE_KEY missing.' });
    return null;
  }

  const token = bearerToken(req);
  if (!token) { res.status(401).json({ error: 'Missing auth token.' }); return null; }

  // Resolve the caller using anon key + their JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) { res.status(401).json({ error: 'Not signed in.' }); return null; }

  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin only.' });
    return null;
  }

  // Service-role client for cross-org reads/writes
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user, sb, adminEmail: user.email };
}

export async function logAdminEvent(sb, { adminEmail, action, targetOrgId = null, payload = null }) {
  // Best-effort; never throws.
  try {
    await sb.from('admin_events').insert({
      admin_email: adminEmail,
      action,
      target_org_id: targetOrgId,
      payload,
    });
  } catch (e) {
    console.error('[admin_events] log failed:', e?.message || e);
  }
}
