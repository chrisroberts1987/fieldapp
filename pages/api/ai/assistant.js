// In-app AI assistant. Voice (Web Speech API → text) or typed
// commands run through Claude with tool-calling so the model can
// actually mutate the user's data. Authenticated — every action
// runs under the user's session via a scoped Supabase client, so
// RLS still gates writes.
//
// Tools (intentionally a small set — adding more is cheap once
// the pattern is in):
//   - log_expense
//   - log_mileage
//   - read_stats   (revenue / unpaid / job counts)
//   - read_jobs_today

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { preflight, bearerToken } from '../../../lib/apiSecurity';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const client = new Anthropic();

const TOOLS = [
  {
    name: 'log_expense',
    description: 'Log an expense for the business. Use when the user says something like "log $X fuel" or "I just spent $Y on materials at Vendor".',
    input_schema: {
      type: 'object',
      properties: {
        amount:      { type: 'number', description: 'Dollar amount, no currency symbol.' },
        category:    { type: 'string', enum: ['materials','fuel','labor','equipment','meals','vehicle','tools','office','insurance','software','other'], description: 'Best-fit category.' },
        vendor:      { type: 'string', description: 'Vendor name if mentioned. Optional.' },
        description: { type: 'string', description: 'Short description. Optional.' },
      },
      required: ['amount', 'category'],
    },
  },
  {
    name: 'log_mileage',
    description: 'Log a business mileage trip. Use when the user says "log X miles" or "trip to ...".',
    input_schema: {
      type: 'object',
      properties: {
        miles:   { type: 'number', description: 'Miles driven.' },
        notes:   { type: 'string', description: 'Trip purpose / destination. Optional.' },
      },
      required: ['miles'],
    },
  },
  {
    name: 'read_stats',
    description: 'Read this month\'s revenue, expenses, net income, and unpaid invoice total. Use for "how am I doing this month", "what\'s my net", etc.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'read_jobs_today',
    description: 'Read today\'s scheduled and in-progress jobs. Use for "what\'s on my plate", "today\'s schedule", "anything today".',
    input_schema: { type: 'object', properties: {} },
  },
];

const SYSTEM = `You are MyForeman's in-app assistant for a field-service contractor (the signed-in user who runs the business). You can:
- Log expenses and mileage by calling tools
- Read this month's financials and today's jobs by calling tools
- Answer brief questions about the user's business

Voice:
- Direct, plain English. Short sentences.
- After running a tool, give a one-line confirmation. No long preamble.
- If the user's request needs information you don't have, ask ONE focused question. Don't pile on.
- Don't make up data. If a tool fails or returns nothing, say so plainly.
- Never quote or invent dollar amounts that didn't come from a tool call.

Today's date will be in the user's first message context.`;

export default async function handler(req, res) {
  if (preflight(req, res) === null) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'AI not configured.' });

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth:   { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: uErr } = await sb.auth.getUser();
  if (uErr || !user) return res.status(401).json({ error: 'Not signed in.' });

  const { messages, orgId } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || !orgId) {
    return res.status(400).json({ error: 'messages + orgId required.' });
  }
  if (messages.length > 30) return res.status(400).json({ error: 'Conversation too long. Refresh to start over.' });

  const todayIso = new Date().toISOString().slice(0, 10);
  // Inject today's date into the system context so the model can
  // resolve "yesterday" without us inventing a prompt-engineering
  // dance every turn.
  const sys = SYSTEM + `\n\nToday is ${todayIso}.`;

  const cleaned = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: Array.isArray(m.content) ? m.content : String(m.content || '').slice(0, 4000) }));

  // Agentic loop. Claude may return text, or a tool_use block. If
  // a tool_use, run it server-side and feed the tool_result back
  // until the model has nothing more to call. Cap at 4 iterations
  // so a hallucination loop can't run away.
  let convo = [...cleaned];
  let final = '';
  for (let i = 0; i < 4; i++) {
    let resp;
    try {
      resp = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: sys,
        tools: TOOLS,
        messages: convo,
      });
    } catch (e) {
      return res.status(502).json({ error: 'AI error: ' + (e?.message || 'unknown') });
    }

    const blocks = resp.content || [];
    const toolUses = blocks.filter(b => b.type === 'tool_use');
    const textParts = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
    if (textParts) final = textParts;

    if (toolUses.length === 0) break;

    // Append assistant turn + tool results, then loop.
    convo = [...convo,
      { role: 'assistant', content: blocks },
      {
        role: 'user',
        content: await Promise.all(toolUses.map(async (tu) => {
          const result = await runTool(sb, user, orgId, tu.name, tu.input || {});
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          };
        })),
      },
    ];
  }

  return res.status(200).json({ reply: final || 'Done.' });
}

async function runTool(sb, user, orgId, name, args) {
  try {
    switch (name) {
      case 'log_expense': {
        const { error, data } = await sb.from('expenses').insert({
          org_id: orgId,
          owner_id: user.id,
          amount: Number(args.amount) || 0,
          category: args.category || 'other',
          vendor: args.vendor || null,
          description: args.description || null,
          expense_date: new Date().toISOString().slice(0, 10),
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        }).select('id, amount, category, vendor').single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, expense: data };
      }
      case 'log_mileage': {
        const { error, data } = await sb.from('mileage_logs').insert({
          org_id: orgId,
          user_id: user.id,
          log_date: new Date().toISOString().slice(0, 10),
          miles: Number(args.miles) || 0,
          purpose: 'business',
          method: 'manual',
          notes: args.notes || null,
          approval_status: 'approved',
        }).select('id, miles, notes').single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, trip: data };
      }
      case 'read_stats': {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const [{ data: rev }, { data: exp }, { data: unpaid }] = await Promise.all([
          sb.from('invoices').select('amount').eq('org_id', orgId).eq('status', 'paid').gte('paid_date', monthStart),
          sb.from('expenses').select('amount').eq('org_id', orgId).gte('expense_date', monthStart),
          sb.from('invoices').select('amount').eq('org_id', orgId).eq('status', 'unpaid'),
        ]);
        const sum = (rs) => (rs || []).reduce((s, r) => s + Number(r.amount || 0), 0);
        const r = sum(rev), e = sum(exp), u = sum(unpaid);
        return {
          ok: true,
          revenue_this_month: r,
          expenses_this_month: e,
          net_income_this_month: r - e,
          unpaid_invoice_total: u,
          unpaid_invoice_count: (unpaid || []).length,
        };
      }
      case 'read_jobs_today': {
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await sb.from('jobs')
          .select('title, status, scheduled_time, customer_id')
          .eq('org_id', orgId)
          .or(`scheduled_date.eq.${today},and(scheduled_date.lte.${today},scheduled_end_date.gte.${today})`)
          .in('status', ['scheduled', 'in_progress']);
        if (error) return { ok: false, error: error.message };
        return { ok: true, jobs: (data || []).map(j => ({ title: j.title, status: j.status, time: j.scheduled_time?.slice(0, 5) || null })) };
      }
      default:
        return { ok: false, error: 'Unknown tool: ' + name };
    }
  } catch (e) {
    return { ok: false, error: e?.message || 'Tool error' };
  }
}
