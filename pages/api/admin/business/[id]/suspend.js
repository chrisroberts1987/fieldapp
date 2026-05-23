import { verifyAdmin, logAdminEvent } from '../../../../../lib/adminAuth';

// Toggle an org's suspended_at flag. Suspension is reversible — the
// data stays put, just flagged. Use Delete (separate endpoint) for
// the destructive path.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['POST'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing org id.' });

  const { action, reason } = req.body || {};
  if (!['suspend','unsuspend'].includes(action)) {
    return res.status(400).json({ error: 'action must be "suspend" or "unsuspend".' });
  }

  const patch = action === 'suspend'
    ? { suspended_at: new Date().toISOString(), suspended_reason: (reason || '').slice(0, 500) || null }
    : { suspended_at: null, suspended_reason: null };

  const { error } = await sb.from('organizations').update(patch).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  await logAdminEvent(sb, {
    adminEmail,
    action,
    targetOrgId: id,
    payload: action === 'suspend' ? { reason: patch.suspended_reason } : null,
  });

  res.status(200).json({ ok: true });
}
