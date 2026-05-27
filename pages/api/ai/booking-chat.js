// AI receptionist for the public /book/<slug> page. Customer chats
// instead of filling a form. Anonymous — no auth required, but
// rate-limited per IP to keep our Anthropic spend in check and
// prevent abuse.
//
// The conversation is stateless from the server's perspective: the
// client posts the entire history each turn. The model is told to
// gather { service, requested_date, requested_time, name, contact,
// address, notes } and, when it has enough, emit a structured tool
// call to submit_booking which actually creates the lead.

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const client = new Anthropic();

// Per-IP rate limit kept light (anonymous endpoint).
const ipHits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const win = 60_000;
  const max = 30;
  const arr = (ipHits.get(ip) || []).filter(t => now - t < win);
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) ipHits.clear();
  return arr.length > max;
}

const TOOLS = [
  {
    name: 'submit_booking',
    description: 'Call ONLY when you have the customer\'s name, a phone OR email, a description of what they need, and (ideally) a preferred date. Submits the booking request to the contractor.',
    input_schema: {
      type: 'object',
      properties: {
        name:           { type: 'string', description: 'Customer full name.' },
        phone:          { type: 'string', description: 'Phone number, any format. Omit if not given.' },
        email:          { type: 'string', description: 'Email address. Omit if not given.' },
        address:        { type: 'string', description: 'Service address. Omit if customer declines.' },
        service_name:   { type: 'string', description: 'Short label for what they want done (e.g., "Lawn cleanup", "Drain unclogging"). Use one of the org services if it clearly matches; otherwise free text.' },
        requested_date: { type: 'string', description: 'YYYY-MM-DD. Omit if not provided.' },
        requested_time: { type: 'string', description: 'HH:MM (24-hour). Omit if not provided.' },
        notes:          { type: 'string', description: 'Everything else the customer mentioned that the contractor should know (problem details, access notes, urgency, etc).' },
      },
      required: ['name', 'service_name'],
    },
  },
];

function systemPrompt(org, services, todayIso) {
  const svcList = (services || []).map(s => `- ${s.name}${s.unit_price ? ` (~$${Math.round(Number(s.unit_price))}/${s.unit || 'job'})` : ''}`).join('\n') || '- (no published service list — accept whatever they ask for)';
  return `You are a friendly receptionist for ${org.name}, a field service business. You're chatting with a potential customer who wants to book work.

Today's date: ${todayIso}.

Services offered:
${svcList}

Your job is to gather the details to book the visit, in a natural conversation. You need: their name, a phone OR email, what they want done, and (ideally) a preferred date and time. Service address is helpful but optional.

Guidelines:
- Be warm and brief. Two short sentences per turn is plenty.
- Ask ONE question at a time. Don't barrage them.
- If they describe a problem ("my drain is clogged"), match it to one of the services if possible.
- If they suggest a date in natural language ("next Tuesday", "Friday"), resolve to YYYY-MM-DD using today's date.
- If they're vague on a date, suggest a couple of slots ("How's Tuesday or Wednesday morning?") but accept "anytime" too.
- When you have name + service + a way to reach them, call the submit_booking tool. Don't ask for more if you have enough.
- After submit_booking returns, confirm warmly and tell them ${org.name} will reach out to confirm. Don't ask further questions.
- Never make up information about ${org.name} that wasn't given to you. If asked something you don't know, say you'll have ${org.name} answer when they reach out.
- Never quote a price. Say the contractor will confirm pricing when they reach out.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured.' });

  const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Slow down — too many messages from this IP. Try again in a minute.' });

  const { slug, messages } = req.body || {};
  if (!slug || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'slug + messages required.' });
  }
  if (messages.length > 40) {
    return res.status(400).json({ error: 'Conversation too long. Refresh to start over.' });
  }

  // Load the org + service catalog so the prompt is grounded.
  const { data: page } = await sb.rpc('get_booking_page', { p_org_slug: slug });
  if (!page) return res.status(404).json({ error: 'Business not found.' });

  const today = new Date().toISOString().slice(0, 10);

  // Cap user messages so an attacker can't waste tokens.
  const cleanMessages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  let resp;
  try {
    resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      system: systemPrompt(page.org, page.services, today),
      tools: TOOLS,
      messages: cleanMessages,
    });
  } catch (e) {
    return res.status(502).json({ error: 'AI service error: ' + (e?.message || 'unknown') });
  }

  // Walk the content blocks. If a tool_use block is present, run it
  // server-side and return both the assistant message and the
  // tool result so the client can show a confirmation.
  let replyText = '';
  let bookingResult = null;
  for (const block of resp.content || []) {
    if (block.type === 'text') replyText += block.text;
    if (block.type === 'tool_use' && block.name === 'submit_booking') {
      const args = block.input || {};
      const { data, error } = await sb.rpc('submit_self_booking', {
        p_org_slug:      slug,
        p_name:          args.name || '',
        p_phone:         args.phone || null,
        p_email:         args.email || null,
        p_address:       args.address || null,
        p_service_name:  args.service_name || null,
        p_requested_date: args.requested_date || null,
        p_requested_time: args.requested_time || null,
        p_notes:         args.notes || null,
      });
      bookingResult = error ? { ok: false, error: error.message } : { ok: true, ...data };
    }
  }

  return res.status(200).json({
    reply: replyText.trim() || (bookingResult?.ok ? `Booked. ${page.org.name} will reach out to confirm.` : 'Sorry, can you say that again?'),
    booking: bookingResult,
  });
}
