// US address parser used by the admin overview + reach tabs to bucket
// signups by state and surface top cities. Real-world contractor
// addresses come in messy: full state names, lowercase abbreviations,
// missing ZIPs, tight spacing, multi-line strings. Be permissive.

const US_STATES = {
  alabama:'AL', alaska:'AK', arizona:'AZ', arkansas:'AR', california:'CA',
  colorado:'CO', connecticut:'CT', delaware:'DE', florida:'FL', georgia:'GA',
  hawaii:'HI', idaho:'ID', illinois:'IL', indiana:'IN', iowa:'IA',
  kansas:'KS', kentucky:'KY', louisiana:'LA', maine:'ME', maryland:'MD',
  massachusetts:'MA', michigan:'MI', minnesota:'MN', mississippi:'MS', missouri:'MO',
  montana:'MT', nebraska:'NE', nevada:'NV', 'new hampshire':'NH', 'new jersey':'NJ',
  'new mexico':'NM', 'new york':'NY', 'north carolina':'NC', 'north dakota':'ND', ohio:'OH',
  oklahoma:'OK', oregon:'OR', pennsylvania:'PA', 'rhode island':'RI', 'south carolina':'SC',
  'south dakota':'SD', tennessee:'TN', texas:'TX', utah:'UT', vermont:'VT',
  virginia:'VA', washington:'WA', 'west virginia':'WV', wisconsin:'WI', wyoming:'WY',
  'district of columbia':'DC',
};
const US_STATE_CODES = new Set(Object.values(US_STATES));

// Try to pull a 2-letter state code + city out of any reasonable
// US address string. Returns { state, city } or null.
export function parseUSAddress(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const cleaned = addr.replace(/\s+/g, ' ').replace(/\n/g, ', ').trim();
  if (!cleaned) return null;

  // Strategy 1: "ST 12345" — the standard US postal anchor. Case
  // insensitive, optional comma between state and zip, tolerant of
  // tight spacing (e.g. "TX77001" or "TX  77001").
  let m = cleaned.match(/(?:^|[,\s])([A-Za-z]{2})\s*,?\s*(\d{5})(?:-\d{4})?\b/);
  if (m) {
    const code = m[1].toUpperCase();
    if (US_STATE_CODES.has(code)) {
      return { state: code, city: extractCityBefore(cleaned, m.index + m[0].indexOf(m[1])) };
    }
  }

  // Strategy 2: full state name spelled out. "Houston, Texas 77001"
  // or "Houston, Texas". Iterate state names longest-first so
  // "North Carolina" matches before "Carolina" or "North."
  const names = Object.keys(US_STATES).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const re = new RegExp(`(?:^|[,\\s])(${name})(?:[,\\s]|$)`, 'i');
    const match = cleaned.match(re);
    if (match) {
      return {
        state: US_STATES[name],
        city: extractCityBefore(cleaned, match.index + match[0].indexOf(match[1])),
      };
    }
  }

  // Strategy 3: state code at the very end with no trailing ZIP,
  // e.g. "Houston, TX" or "Houston TX". Case insensitive.
  m = cleaned.match(/(?:^|[,\s])([A-Za-z]{2})\s*$/);
  if (m) {
    const code = m[1].toUpperCase();
    if (US_STATE_CODES.has(code)) {
      return { state: code, city: extractCityBefore(cleaned, m.index + m[0].indexOf(m[1])) };
    }
  }

  return null;
}

// Convenience for callers that only care about the state code.
export function stateFromAddress(addr) {
  return parseUSAddress(addr)?.state || null;
}

// Best-effort: city is whatever sits between the last comma and the
// state token. Strips trailing apartment/suite noise that occasionally
// gets parsed as the city when the address skips commas. Returns null
// if nothing usable is found.
function extractCityBefore(addr, stateStart) {
  if (stateStart <= 0) return null;
  const before = addr.slice(0, stateStart).replace(/[,\s]+$/, '');
  const lastComma = before.lastIndexOf(',');
  const raw = (lastComma >= 0 ? before.slice(lastComma + 1) : before).trim();
  if (!raw) return null;
  // Drop street-line tokens that aren't actually a city.
  const lower = raw.toLowerCase();
  if (/^(apt|apartment|suite|ste|unit|#)\b/.test(lower)) return null;
  if (/^\d/.test(raw)) return null; // starts with a digit → street number
  return raw;
}
