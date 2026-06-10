// What did the assistant last ask? We need this to interpret a
// short "yes" / "ok" / "no" correctly — a "yes" after "what's your
// name?" means something different than "yes" after "shall I book
// this?". Patterns are deliberately broad and ordered most-specific
// to least-specific so the first match wins.
//
// Returns one of:
//   'name', 'phone', 'email', 'contact', 'service', 'date', 'time',
//   'address', 'confirm', 'open' (no clear ask)

const PATTERNS = [
  { kind: 'confirm', re: /(does this|sound|look) (right|good)|all set\??|ready to (book|submit)|shall (i|we) (submit|send|book)|confirm( this)?|book it/ },
  { kind: 'phone',   re: /\bphone( number)?\b|\bbest number\b|number to (call|reach)|call you/ },
  { kind: 'email',   re: /\bemail( address)?\b|email to send|send (you|that) to/ },
  { kind: 'contact', re: /(reach|contact) you|how (can|should) (i|we) reach|phone or email|way to (reach|contact)/ },
  { kind: 'name',    re: /(your |first |last )?name\??|who am i (talking to|chatting with)|what should i call you|can i (get|grab) your name/ },
  { kind: 'service', re: /what (kind of|type of) (work|service|job)|what (do you|are you) (need|looking)|what.?s (wrong|going on)|how can (i|we) help|what brings/ },
  { kind: 'date',    re: /\b(what|which) (day|date)\b|preferred (day|date)|when (works|would)|day works|how about (tuesday|monday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)/ },
  { kind: 'time',    re: /what time|preferred time|morning or afternoon|time of day/ },
  { kind: 'address', re: /(service |what )?address|where (will|is) (the (work|service))|location of the|where do you need/ },
];

export function lastAskedKind(assistantText) {
  const t = String(assistantText || '').toLowerCase();
  if (!t) return 'open';
  for (const { kind, re } of PATTERNS) {
    if (re.test(t)) return kind;
  }
  return 'open';
}

// Local follow-up reply for a CONFIRM intent. Returns null when we
// can't safely advance the flow locally (booking confirmation
// requires the API tool call to actually submit).
export function localConfirmReply(askedKind, orgName) {
  const who = orgName || 'us';
  switch (askedKind) {
    case 'name':    return `Sure. What name should I put down?`;
    case 'phone':   return `Great. What's the best phone number?`;
    case 'email':   return `Got it. What's your email address?`;
    case 'contact': return `Perfect. Phone or email — which works best?`;
    case 'service': return `Awesome. What kind of work do you need done?`;
    case 'date':    return `Sounds good. What day works for you?`;
    case 'time':    return `Great. What time works best — morning or afternoon?`;
    case 'address': return `Perfect. What's the address where you need the work done?`;
    case 'confirm': return null; // booking submission → must hit the API
    default:        return `Glad to hear it. Want me to book a visit with ${who}, or just answer questions?`;
  }
}

// Local follow-up reply for a REJECT intent.
export function localRejectReply(askedKind, orgName) {
  const who = orgName || 'us';
  switch (askedKind) {
    case 'name':
    case 'phone':
    case 'email':
    case 'contact':
      return `No problem. You can also reach ${who} by calling directly or filling out the form above.`;
    case 'confirm':
      return `No problem — nothing's been submitted. Anything you'd like to change?`;
    default:
      return `That's okay. Is there anything else ${who} can help with?`;
  }
}
