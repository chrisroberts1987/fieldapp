import { verifyAdmin, logAdminEvent } from '../../../../../lib/adminAuth';

// Destructive: drops the org row. FK cascades take customers, jobs,
// invoices, quotes, expenses, leads, crew, photos, recommendations,
// invitations, and notifications with it. The admin must include
// confirm: <org name> in the body so an accidental click can't wipe
// a business.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['POST'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Missing org id.' });

  const { confirm } = req.body || {};
  if (!confirm) return res.status(400).json({ error: 'Confirmation required.' });

  const { data: org } = await sb.from('organizations').select('id, name').eq('id', id).maybeSingle();
  if (!org) return res.status(404).json({ error: 'Org not found.' });

  if (String(confirm).trim() !== String(org.name).trim()) {
    return res.status(400).json({ error: 'Confirmation does not match the business name.' });
  }

  // Audit BEFORE delete so we have a record even if the cascade
  // surfaces an unexpected error mid-way.
  await logAdminEvent(sb, {
    adminEmail,
    action: 'delete_org',
    targetOrgId: id,
    payload: { name: org.name },
  });

  const { error } = await sb.from('organizations').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true });
}
