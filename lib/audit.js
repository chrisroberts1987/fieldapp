// Thin wrapper around the public.log_audit RPC. Call this from any
// sensitive action (deletes, paid marks, settings changes, suspends)
// so we have a "who did what when" record per org. Fire-and-forget —
// audit failures must never block the underlying action.
//
//   logAudit({ orgId, action, targetType, targetId, details })
//
// Example:
//   logAudit({ orgId, action: 'invoice.deleted', targetType: 'invoice',
//              targetId: inv.id, details: { amount: inv.amount } });

import { supabase } from './supabase';

export async function logAudit({ orgId, action, targetType = null, targetId = null, details = null }) {
  if (!orgId || !action) return;
  try {
    await supabase.rpc('log_audit', {
      p_org_id:      orgId,
      p_action:      action,
      p_target_type: targetType,
      p_target_id:   targetId,
      p_details:     details,
    });
  } catch {
    // Silently ignore — audit is a side channel.
  }
}
