import { verifyAdmin } from '../../../../lib/adminAuth';
import { renderBroadcast } from '../../../../lib/email/broadcastTemplate';

// Server-rendered preview of the broadcast email. Hitting this from
// the composer guarantees what the admin sees is byte-for-byte what
// recipients will receive — same template path, same escape rules.

export default async function handler(req, res) {
  const ctx = await verifyAdmin(req, res, { allowMethods: ['POST'] });
  if (!ctx) return;

  const { subject = '', body = '' } = req.body || {};
  const { html, text } = renderBroadcast({
    subject: String(subject),
    body:    String(body),
  });
  return res.status(200).json({ html, text });
}
