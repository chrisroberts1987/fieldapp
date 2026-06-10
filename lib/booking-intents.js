// Lightweight intent detection for the customer-facing booking chat
// (/book/<slug>). Lets us short-circuit cheap conversational responses
// like "yes" / "no" / "sounds good" so we don't burn the customer's
// 10-message limit OR an Anthropic API call on a one-word reply.
//
// Two exports:
//   detectIntent(text)       → { kind, confidence }
//   isShortMessage(text)     → boolean
//
// `kind` is one of:
//   'confirm'  — affirmative; the customer is saying yes
//   'reject'   — negative; the customer is saying no
//   'book'     — they want to schedule something
//   'price'    — they want pricing info
//   'unknown'  — couldn't classify
//   'empty'    — nothing typed
//
// `confidence` is 'high' (matched a known phrase exactly) or 'medium'
// (matched a token inside a longer sentence). Callers use 'high'-only
// for fully-local handling; 'medium' is a hint to enrich the message
// before sending it to Claude.

const CONFIRM_WORDS = new Set([
  'yes','yep','yeah','yup','y','ya',
  'sure','ok','okay','k','kk',
  'confirm','confirmed','approve','approved','agreed','agree',
  'correct','right','perfect','great',
  'absolutely','definitely',
]);
const CONFIRM_PHRASES = [
  /^sounds good$/,
  /^that.?s right$/,
  /^that.?s correct$/,
  /^let.?s do it$/,
  /^works for me$/,
  /^do it$/,
  /^go ahead$/,
  /^of course$/,
  /^for sure$/,
  /^you got it$/,
  /^all good$/,
  /^that works$/,
  /^ye[ps]+$/,
];

const REJECT_WORDS = new Set([
  'no','nope','nah','n','cancel','decline','declined','pass','stop',
]);
const REJECT_PHRASES = [
  /^no thanks?$/,
  /^not now$/,
  /^nevermind$/,
  /^never mind$/,
  /^not interested$/,
  /^maybe later$/,
  /^not right now$/,
  /^don.?t$/,
];

const BOOK_TOKENS  = /\b(book|schedule|appointment|come out|send someone|stop by|availability|available|when can you|how soon)\b/;
const PRICE_TOKENS = /\b(price|cost|how much|rate|rates|charge|fee|estimate|quote)\b/;

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[.!?]+$/, '')   // strip trailing punctuation
    .replace(/[,;]/g, '');    // strip mid-sentence punctuation
}

export function detectIntent(text) {
  const t = normalize(text);
  if (!t) return { kind: 'empty', confidence: 'high' };

  // Exact-match short confirmations / rejections first — these are the
  // hottest path for "yes" / "ok" / "no" type replies.
  if (CONFIRM_WORDS.has(t) || CONFIRM_PHRASES.some(re => re.test(t))) {
    return { kind: 'confirm', confidence: 'high' };
  }
  if (REJECT_WORDS.has(t) || REJECT_PHRASES.some(re => re.test(t))) {
    return { kind: 'reject', confidence: 'high' };
  }

  const tokens = t.split(/\s+/);
  const isShort = tokens.length <= 4;

  if (BOOK_TOKENS.test(t))  return { kind: 'book',  confidence: isShort ? 'high' : 'medium' };
  if (PRICE_TOKENS.test(t)) return { kind: 'price', confidence: isShort ? 'high' : 'medium' };

  return { kind: 'unknown', confidence: 'low' };
}

export function isShortMessage(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length < 3;
}
