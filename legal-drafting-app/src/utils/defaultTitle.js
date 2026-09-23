/**
 * Sensible default document titles from the Draft Setup description.
 * Uses only a short topic or surnames — never full personal details.
 * Falls back to "<Type> — <date>".
 */
import { extractDemoFields } from './extractDemoFields';
import { formatDate } from './date';

const FIR_TOPICS = [
  [/online|upi|payment|transaction|fraud|cheat/i, 'Online Payment Fraud'],
  [/theft|stolen|stole/i, 'Theft'],
  [/threat|harass/i, 'Threats or Harassment'],
  [/missing/i, 'Missing Person'],
  [/accident/i, 'Accident'],
];

const surname = (name) => (name ? name.trim().split(/\s+/).at(-1) : null);
const SMALL_WORDS = new Set(['of', 'and', 'or', 'for', 'to', 'in', 'on', 'the', 'a', 'an']);
const titleCase = (s) =>
  s
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');

function topicFor(typeId, description) {
  const text = description ?? '';
  const { values } = extractDemoFields(typeId, text);
  switch (typeId) {
    case 'fir-complaint':
      return FIR_TOPICS.find(([re]) => re.test(text))?.[1] ?? null;
    case 'rental-agreement': {
      const landlord = surname(values.landlordName);
      const tenant = surname(values.tenantName);
      if (landlord && tenant) return `${landlord} / ${tenant}`;
      if (tenant) return `Tenant ${tenant}`;
      return values.propertyType ? titleCase(values.propertyType) : null;
    }
    case 'affidavit':
      return values.affidavitPurpose ? titleCase(values.affidavitPurpose) : null;
    case 'divorce-petition':
      return /mutual consent/i.test(text) ? 'Mutual Consent' : null;
    default:
      return null;
  }
}

const SHORT_NAMES = {
  'fir-complaint': 'Police Complaint',
  'rental-agreement': 'Rental Agreement',
  'divorce-petition': 'Divorce Petition',
  affidavit: 'Affidavit',
};

export function defaultDocumentTitle(type, description, now = new Date()) {
  const topic = topicFor(type.id, description);
  const base = SHORT_NAMES[type.id] ?? type.name;
  return topic ? `${base} — ${topic}` : `${base} — ${formatDate(now)}`;
}
