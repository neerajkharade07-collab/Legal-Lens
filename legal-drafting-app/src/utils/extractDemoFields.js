/**
 * DEMO extraction: deterministic pattern matching over the Step 3 description.
 * Not AI and not interpretation — it only copies values that appear in an
 * obvious, explicit form. Anything uncertain is left blank.
 * Future: replaced by a backend extraction service returning { values, keys }.
 */

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const MONTH_RE =
  '(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';

/** "12 August 2026" / "12th Aug 2026" / "12/08/2026" → "2026-08-12" (null if not a real date). */
function toIsoDate(text) {
  let m = text.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\,?\\s+(\\d{4})\\b`, 'i'),
  );
  let day;
  let month;
  let year;
  if (m) {
    day = Number(m[1]);
    month = MONTHS.findIndex((name) => name.startsWith(m[2].toLowerCase().slice(0, 3))) + 1;
    year = Number(m[3]);
  } else {
    m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
    if (!m) return null;
    [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const AMOUNT_RE = /(?:₹|\bRs\.?|\bINR)\s?(\d+(?:,\d+)*(?:\.\d{1,2})?)/i;
const formatAmount = (digits) => `₹${digits}`;

const PAYMENT_METHODS = [
  [/\bUPI\b/i, 'UPI'],
  [/\bNEFT\b/i, 'NEFT'],
  [/\bIMPS\b/i, 'IMPS'],
  [/\bRTGS\b/i, 'RTGS'],
  [/\bnet ?banking\b/i, 'Net banking'],
  [/\bcredit card\b/i, 'Credit card'],
  [/\bdebit card\b/i, 'Debit card'],
  [/\bcheque\b/i, 'Cheque'],
  [/\bin cash\b|\bcash payment\b|\bpaid cash\b/i, 'Cash'],
];

const NAME = '([A-Z][a-z]+(?:\\s[A-Z][a-z]+){1,2})';

/** The sentence(s) containing any of the given keywords, verbatim. */
function sentencesWith(text, pattern) {
  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [];
  const hits = sentences.map((s) => s.trim()).filter((s) => pattern.test(s));
  return hits.length ? hits.join(' ') : null;
}

const firstMatch = (text, regex, group = 1) => text.match(regex)?.[group]?.trim() ?? null;

const EXTRACTORS = {
  'fir-complaint': (text) => ({
    incidentDate: toIsoDate(text),
    amountInvolved: (() => {
      const m = text.match(AMOUNT_RE);
      return m ? formatAmount(m[1]) : null;
    })(),
    paymentMethod: PAYMENT_METHODS.find(([re]) => re.test(text))?.[1] ?? null,
    accusedName: firstMatch(text, new RegExp(`\\b(?:person|man|woman|seller)\\s+named\\s+${NAME}`)),
    incidentDescription: text,
    evidenceAvailable: sentencesWith(
      text,
      /\b(screenshots?|receipts?|bank statements?|transaction (?:id|reference)|cctv|photos?|videos?|recordings?|witness(?:es)?)\b/i,
    ),
  }),

  'rental-agreement': (text) => ({
    tenantName: firstMatch(text, new RegExp(`\\bto\\s+(?:Mr|Mrs|Ms|Shri|Smt)\\.?\\s+${NAME}`)),
    propertyType: firstMatch(text, /\b(\d\s?BHK\s(?:flat|apartment|house))\b/i),
    propertyAddress: firstMatch(
      text,
      /\bat\s+((?:Flat|Shop|House|Office|Unit|Plot)\s[^.]*?)(?=\s+to\s|\s+for\s|\.|$)/,
    ),
    monthlyRent: (() => {
      const m =
        text.match(/\brent\b[^.₹]*?(?:₹|\bRs\.?)\s?(\d+(?:,\d+)*)/i) ??
        text.match(/(?:₹|\bRs\.?)\s?(\d+(?:,\d+)*)\s*(?:per month|\/month|a month)/i);
      return m ? formatAmount(m[1]) : null;
    })(),
    securityDeposit: (() => {
      const m = text.match(/\bdeposit\b[^.₹]*?(?:₹|\bRs\.?)\s?(\d+(?:,\d+)*)/i);
      return m ? formatAmount(m[1]) : null;
    })(),
    startDate: (() => {
      const m = text.match(
        new RegExp(
          `\\b(?:from|starting|commencing(?: from)?)\\s+(\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_RE}\\s+\\d{4})`,
          'i',
        ),
      );
      return m ? toIsoDate(m[1]) : null;
    })(),
    duration: firstMatch(text, /\bfor\s+(\d{1,2}\s+(?:months?|years?))\b/i),
    lockInPeriod: firstMatch(text, /\b(\d{1,2}\s+months?)\s+lock-?in\b/i),
    noticePeriod: firstMatch(text, /\b(\d{1,2}\s+months?)\s+notice\b/i),
  }),

  'divorce-petition': (text) => ({
    marriageDate: (() => {
      const m = text.match(
        new RegExp(`\\bmarried on\\s+(\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_RE}\\s+\\d{4})`, 'i'),
      );
      return m ? toIsoDate(m[1]) : null;
    })(),
    marriagePlace: firstMatch(
      text,
      new RegExp(
        `\\bmarried on\\s+\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_RE}\\s+\\d{4}\\s+(?:in|at)\\s+([A-Z][a-z]+)`,
      ),
      2,
    ),
    separationDate: firstMatch(
      text,
      new RegExp(
        `\\bseparately since\\s+(${MONTH_RE}\\s+\\d{4}|\\d{1,2}\\s+${MONTH_RE}\\s+\\d{4})`,
        'i',
      ),
    ),
    childrenDetails: sentencesWith(text, /\b(son|daughter|children|child)\b/i),
    caseContext: text,
  }),

  affidavit: (text) => ({
    deponentName: firstMatch(text, new RegExp(`\\bI,\\s*${NAME}`)),
    deponentAge: firstMatch(text, /\baged\s+(\d{1,3})\b/i),
    deponentOccupation: firstMatch(
      text,
      /\bworking as (?:an? )?([a-z][a-z ]{2,40}?)(?=,|\.|\s+and\b)/i,
    ),
    affidavitPurpose: firstMatch(text, /\baffidavit for\s+([^.,]+?)(?=\s+to\s|,|\.)/i),
    statementFacts: text,
    place: firstMatch(text, /\b(?:signed|executed|sworn) in\s+([A-Z][a-z]+)\b/),
  }),
};

/**
 * @returns {{ values: Record<string,string>, keys: string[] }} only non-empty, found values
 */
export function extractDemoFields(typeId, description) {
  const text = description?.trim();
  const extractor = EXTRACTORS[typeId];
  if (!text || !extractor) return { values: {}, keys: [] };
  const values = Object.fromEntries(
    Object.entries(extractor(text)).filter(([, v]) => typeof v === 'string' && v.trim()),
  );
  return { values, keys: Object.keys(values) };
}
