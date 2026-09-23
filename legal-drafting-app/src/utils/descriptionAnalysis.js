/**
 * Lightweight, client-side heuristic that detects which *kinds* of factual
 * detail appear in a free-text description (people, dates, amounts…).
 *
 * It does NOT interpret facts, assess merits or draw legal conclusions.
 * A backend analysis service can replace this later with the same shape.
 */

const MONTHS =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

const SIGNALS = {
  people: [
    /\b(?:mr|mrs|ms|shri|smt|kumari|dr|adv)\.?\s+[a-z]/i,
    /\b(?:named|name is|called)\s+[A-Z]/,
    /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/,
    /\b(?:person|seller|buyer|landlord|owner|tenant|licensor|licensee|husband|wife|spouse|petitioner|respondent|accused|neighbou?r|brother|sister|father|mother|employer|agent|deponent|caller)\b/i,
  ],
  dates: [
    /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/,
    new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b`, 'i'),
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}\\b`, 'i'),
    new RegExp(`\\b(?:${MONTHS})\\s+(?:19|20)\\d{2}\\b`, 'i'),
    /\b(?:yesterday|last (?:week|month|year)|since \d{4})\b/i,
    /\b\d+\s+(?:days?|weeks?|months?|years?)\b/i,
    /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i,
  ],
  locations: [
    /\b(?:at|in|near|from|to)\s+(?:the\s+)?[A-Z][a-z]+/,
    /\b(?:road|street|nagar|colony|society|apartment|residency|building|sector|lane|market|police station|district|city|village|taluka|address)\b/i,
    /\b(?:pune|mumbai|delhi|nagpur|nashik|thane|bengaluru|bangalore|chennai|kolkata|hyderabad|ahmedabad|jaipur|lucknow)\b/i,
  ],
  amounts: [
    /(?:₹|\brs\.?|\binr)\s?\d/i,
    /\d[\d,]*\s?(?:rupees|\/-|lakhs?|crores?|thousand)\b/i,
    /\b\d{1,3}(?:,\d{2,3})+\b/,
  ],
  evidence: [
    /\b(?:screenshots?|receipts?|invoices?|bank statements?|transaction|utr|upi (?:id|ref)|reference (?:no|number)|witness(?:es)?|cctv|photos?|photographs?|videos?|recordings?|chats?|whatsapp|emails?|sms|messages?|bills?|certificates?|proof|copy of)\b/i,
  ],
  property: [
    /\b(?:flat|apartment|house|shop|premises|property|office|room|bhk|floor|plot|bungalow)\b/i,
  ],
  terms: [
    /\b(?:lock-?in|notice|maintenance|electricity|utilit(?:y|ies)|renew(?:al)?|terminat\w*|furnish\w*|parking)\b/i,
  ],
  marriage: [/\b(?:married|marriage|wedding|solemni[sz]ed|rites)\b/i],
  children: [/\b(?:child|children|son|daughter|kids?|custody|no children)\b/i],
  relief: [
    /\b(?:divorce|custody|maintenance|alimony|relief|seek(?:ing)?|dissolution|mutual consent|visitation)\b/i,
  ],
  purpose: [
    /\b(?:purpose|required for|needed for|to update|name change|change of (?:name|address)|address proof|declar\w+|loss of|lost my|income|residence proof|gap)\b/i,
    /\baffidavit (?:for|to)\b/i,
  ],
};

const EVENT_VERBS =
  /\b(?:paid|sent|transferred|received|stopped|refused|threatened|stole|stolen|took|broke|called|agreed|signed|married|separated|left|moved|filed|happened|occurred|cheated|blocked|promised|delivered|bought|sold|lost|asked|told|demanded|abused|damaged)\b/gi;

function detect(id, text) {
  if (id === 'events') {
    const matches = text.match(EVENT_VERBS) ?? [];
    return new Set(matches.map((m) => m.toLowerCase())).size >= 2;
  }
  return (SIGNALS[id] ?? []).some((pattern) => pattern.test(text));
}

export const DETAIL_LEVELS = [
  { id: 'empty', label: 'Not started', min: 0 },
  { id: 'basic', label: 'Getting started', min: 1 },
  { id: 'some', label: 'Some detail', min: 35 },
  { id: 'good', label: 'Good detail', min: 60 },
  { id: 'detailed', label: 'Detailed', min: 85 },
];

/**
 * @param {string} text
 * @param {{id: string, label: string}[]} checks
 * @returns {{ score:number, level:object, words:number, results:{id,label,found}[], found:string[], missing:string[] }}
 */
export function analyzeDescription(text = '', checks = []) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const results = checks.map((check) => ({
    ...check,
    found: trimmed ? detect(check.id, trimmed) : false,
  }));
  const found = results.filter((r) => r.found);

  // 85% from coverage of detail kinds, up to 15% from length (caps at ~120 words).
  const coverage = checks.length ? found.length / checks.length : 0;
  const lengthScore = Math.min(1, words / 120);
  let score = trimmed ? Math.round(coverage * 85 + lengthScore * 15) : 0;
  if (trimmed && score === 0) score = 1;
  // Very short text cannot be "detailed", however many keywords it has.
  if (words < 25) score = Math.min(score, 59);

  const level = [...DETAIL_LEVELS].reverse().find((l) => score >= l.min) ?? DETAIL_LEVELS[0];

  return {
    score,
    level,
    words,
    results,
    found: found.map((r) => r.id),
    missing: results.filter((r) => !r.found).map((r) => r.id),
  };
}
