import { verifyAdmin } from '../../../../lib/adminAuth';

// History tab + safety hints for the Broadcast composer:
//   • last 50 broadcasts ordered by sent_at desc
//   • the current admin's count for today (for the 3/day rate-limit
//     indicator)
//   • the most recent broadcast's sent_at (so the UI can warn "last
//     broadcast went out 2 hours ago — sure you want to send another?")

const HISTORY_LIMIT = 50;
const MAX_PER_DAY   = 3;

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['GET'] });
  if (!ctx) return;
  const { sb, adminEmail } = ctx;

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [historyRes, countRes] = await Promise.all([
    sb.from('admin_broadcasts')
      .select('id, subject, tier_filter, recipient_count, sent_count, failed_count, sent_by, sent_at')
      .order('sent_at', { ascending: false })
      .limit(HISTORY_LIMIT),
    sb.from('admin_broadcasts')
      .select('id', { count: 'exact', head: true })
      .eq('sent_by', adminEmail)
      .gte('sent_at', dayStart.toISOString()),
  ]);

  if (historyRes.error) return res.status(500).json({ error: historyRes.error.message });
  if (countRes.error)   return res.status(500).json({ error: countRes.error.message });

  const broadcasts = historyRes.data || [];
  return res.status(200).json({
    broadcasts,
    todayCount:  countRes.count || 0,
    maxPerDay:   MAX_PER_DAY,
    lastSentAt:  broadcasts[0]?.sent_at || null,
  });
}
