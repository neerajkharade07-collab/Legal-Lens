/**
 * DEMO document health check — deterministic STRUCTURAL checks only
 * (completeness, placeholders, consistency, formatting, clarity, structural
 * risks). It never assesses legal merit or validity.
 */
import { getHealthConfig } from '../../data/intelligence/healthConfig';

export const HEALTH_CATEGORIES = [
  { id: 'completeness', label: 'Completeness' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'formatting', label: 'Formatting' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'placeholders', label: 'Placeholders' },
  { id: 'risks', label: 'Potential risks' },
];

const WEIGHT = { high: 7, medium: 4, low: 2 };
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
const DATE_RE =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b|\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/gi;
const AMOUNT_RE = /(?:₹|\bRs\.?|\bINR)\s?(\d+(?:,\d+)*(?:\.\d{1,2})?)/gi;
const VAGUE = [
  'etc.',
  'and/or',
  'as soon as possible',
  'reasonable time',
  'some time',
  'approximately',
];

const words = (text) => (text?.trim() ? text.trim().split(/\s+/).length : 0);

function normaliseDates(text) {
  const found = [];
  for (const m of text.matchAll(DATE_RE)) {
    const [d, mo, y] = m[1]
      ? [Number(m[1]), MONTHS.indexOf(m[2].toLowerCase()) + 1, Number(m[3])]
      : [Number(m[4]), Number(m[5]), Number(m[6])];
    found.push({
      raw: m[0],
      iso: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }
  return found;
}

const amountsIn = (text) =>
  [...text.matchAll(AMOUNT_RE)].map((m) => ({ raw: m[0], value: Number(m[1].replace(/,/g, '')) }));
const monthsOf = (text) => {
  const m = text?.match(/(\d+(?:\.\d+)?)\s*(month|year)/i);
  if (!m) return null;
  return Number(m[1]) * (m[2].toLowerCase() === 'year' ? 12 : 1);
};

export function runHealthRules(snapshot) {
  const cfg = getHealthConfig(snapshot.typeId);
  const findings = [];
  const add = (f) => findings.push(f);
  const field = (key) => snapshot.fieldMap[key];

  // ---- Completeness: key fields individually, other empty fields grouped ----
  // Only fields the document actually uses (has a token for) are counted — a
  // reviewed/imported document has no tokens, so its empty case fields are not issues.
  const emptyFields = snapshot.fields.filter((f) => !f.filled && snapshot.presentKeys.has(f.key));
  const emptyKey = emptyFields.filter((f) => cfg.keyFields.includes(f.key));
  const emptyOther = emptyFields.filter((f) => !cfg.keyFields.includes(f.key));
  for (const f of emptyKey) {
    add({
      id: `completeness:${f.key}`,
      category: 'completeness',
      severity: 'high',
      title: 'Incomplete field',
      explanation: `${f.longLabel} has not been provided.`,
      location: {
        kind: 'field',
        key: f.key,
        label: f.longLabel,
        inDocument: snapshot.presentKeys.has(f.key),
      },
      suggestedAction: `Add ${f.longLabel} in case details.`,
    });
  }
  if (emptyOther.length) {
    add({
      id: 'completeness:other',
      category: 'completeness',
      severity: 'low',
      title: `${emptyOther.length} other field${emptyOther.length === 1 ? ' is' : 's are'} empty`,
      explanation: `${emptyOther
        .slice(0, 6)
        .map((f) => f.longLabel)
        .join(', ')}${emptyOther.length > 6 ? ', …' : ''}.`,
      location: {
        kind: 'field',
        key: emptyOther[0].key,
        label: emptyOther[0].longLabel,
        inDocument: snapshot.presentKeys.has(emptyOther[0].key),
      },
      suggestedAction: 'Fill in the fields that apply. Remove placeholders that do not apply.',
    });
  }

  // ---- Placeholders: empty tokens (for non-key fields) and bracketed notes ----
  for (const key of snapshot.emptyTokenKeys) {
    if (cfg.keyFields.includes(key)) continue; // already reported under completeness
    const f = field(key);
    const label = f?.longLabel ?? key;
    const tokenText =
      snapshot.blocks.flatMap((b) => b.tokens).find((t) => t.key === key)?.text ?? `[${label}]`;
    add({
      id: `placeholder:${key}`,
      category: 'placeholders',
      severity: 'medium',
      title: 'Unresolved placeholder',
      explanation: `${tokenText} is still present in the document.`,
      location: { kind: 'token', key, label, inDocument: true },
      suggestedAction: `Fill in ${label} or delete the placeholder if it does not apply.`,
    });
  }
  const notes = snapshot.blocks.filter((b) =>
    /\[[^\]]*(verif|to be|confirm|agreed|details of)[^\]]*\]/i.test(b.plainText),
  );
  notes.forEach((b, n) => {
    const note = b.plainText.match(/\[[^\]]+\]/)[0];
    add({
      id: `note:${n}:${note.slice(0, 40)}`,
      category: 'placeholders',
      severity: 'low',
      title: 'Drafting note remains',
      explanation: `The note “${note.length > 90 ? `${note.slice(0, 87)}…]` : note}” still needs to be resolved.`,
      location: { kind: 'text', text: note.slice(0, 40) },
      suggestedAction: 'Replace the note with final wording once it has been checked.',
    });
  });

  // ---- Consistency: dates / amounts in narrative vs structured fields ----
  for (const check of cfg.dateChecks) {
    const main = field(check.field);
    if (!main?.filled) continue;
    for (const key of check.in) {
      const other = field(key);
      if (!other?.filled) continue;
      const dates = normaliseDates(other.raw);
      const differing = dates.filter((d) => d.iso !== main.raw);
      if (dates.length && differing.length === dates.length) {
        add({
          id: `consistency:date:${check.field}:${key}`,
          category: 'consistency',
          severity: 'medium',
          title: 'Dates may not match',
          explanation: `${main.longLabel} is ${main.value}, but ${other.longLabel} mentions ${differing.map((d) => d.raw).join(', ')}.`,
          location: {
            kind: 'field',
            key,
            label: other.longLabel,
            inDocument: snapshot.presentKeys.has(key),
          },
          suggestedAction: 'Check which date is correct and make them consistent.',
        });
      }
    }
  }
  for (const check of cfg.amountChecks) {
    const main = field(check.field);
    if (!main?.filled) continue;
    const mainAmounts = amountsIn(main.value);
    const mainValue = mainAmounts[0]?.value ?? Number(main.raw.replace(/[^\d.]/g, ''));
    if (!mainValue) continue;
    for (const key of check.in) {
      const other = field(key);
      if (!other?.filled) continue;
      const amounts = amountsIn(other.raw);
      if (amounts.length && !amounts.some((a) => a.value === mainValue)) {
        add({
          id: `consistency:amount:${check.field}:${key}`,
          category: 'consistency',
          severity: 'medium',
          title: 'Amounts may not match',
          explanation: `${main.longLabel} is ${main.value}, but ${other.longLabel} mentions ${amounts.map((a) => a.raw).join(', ')}.`,
          location: {
            kind: 'field',
            key,
            label: other.longLabel,
            inDocument: snapshot.presentKeys.has(key),
          },
          suggestedAction: 'Check the amount and make the figures consistent.',
        });
      }
    }
  }
  for (const check of cfg.periodChecks) {
    const shorter = field(check.shorter);
    const longer = field(check.longer);
    const a = monthsOf(shorter?.raw);
    const b = monthsOf(longer?.raw);
    if (a !== null && b !== null && a > b) {
      add({
        id: `consistency:period:${check.shorter}`,
        category: 'consistency',
        severity: 'medium',
        title: 'Periods may conflict',
        explanation: `${shorter.longLabel} (${shorter.value}) is longer than ${longer.longLabel} (${longer.value}).`,
        location: {
          kind: 'field',
          key: check.shorter,
          label: shorter.longLabel,
          inDocument: snapshot.presentKeys.has(check.shorter),
        },
        suggestedAction: 'Check both periods.',
      });
    }
  }

  // ---- Formatting ----
  const blankLines = snapshot.blocks.filter((b) => b.plainText.includes('____'));
  if (blankLines.length) {
    add({
      id: 'formatting:blank-lines',
      category: 'formatting',
      severity: 'low',
      title: 'Signature section may require completion',
      explanation: `${blankLines.length} line${blankLines.length === 1 ? '' : 's'} with blanks remain (signature, place, date or witnesses).`,
      location: { kind: 'text', text: '____' },
      suggestedAction: 'Complete these lines by hand or in the draft before use.',
    });
  }
  let emptyRun = 0;
  let maxRun = 0;
  for (const b of snapshot.blocks) {
    emptyRun = b.text.trim() ? 0 : emptyRun + 1;
    maxRun = Math.max(maxRun, emptyRun);
  }
  if (maxRun >= 3) {
    add({
      id: 'formatting:empty-paragraphs',
      category: 'formatting',
      severity: 'low',
      title: 'Extra blank paragraphs',
      explanation: `${maxRun} consecutive empty paragraphs were found.`,
      location: null,
      suggestedAction: 'Remove extra blank lines to keep spacing consistent.',
    });
  }
  if (!snapshot.blocks.some((b) => b.type === 'heading' && b.level === 1)) {
    add({
      id: 'formatting:title',
      category: 'formatting',
      severity: 'low',
      title: 'No document title',
      explanation: 'The draft has no top-level heading.',
      location: null,
      suggestedAction: 'Add a title using Heading 1.',
    });
  }

  // ---- Clarity ----
  snapshot.blocks.forEach((b) => {
    const sentences = b.text.split(/(?<=[.!?])\s+/);
    const long = sentences.find((s) => words(s) > 60);
    if (long) {
      add({
        id: `clarity:long:${b.index}`,
        category: 'clarity',
        severity: 'low',
        title: 'Very long sentence',
        explanation: `A sentence of ${words(long)} words may be hard to follow.`,
        location: { kind: 'text', text: long.slice(0, 40) },
        suggestedAction: 'Consider splitting it into shorter sentences.',
      });
    }
    const vague = VAGUE.find((v) => b.plainText.toLowerCase().includes(v));
    if (vague) {
      add({
        id: `clarity:vague:${b.index}`,
        category: 'clarity',
        severity: 'low',
        title: 'Imprecise wording',
        explanation: `“${vague}” can be read in more than one way.`,
        location: { kind: 'text', text: vague },
        suggestedAction: 'Replace it with specific wording.',
      });
    }
  });

  // ---- Potential risks (structural only) ----
  for (const check of cfg.minWords) {
    const f = field(check.field);
    if (!f?.filled) continue;
    const n = words(f.raw);
    if (n < check.words) {
      add({
        id: `risks:thin:${check.field}`,
        category: 'risks',
        severity: 'medium',
        title: 'Narrative may be too brief',
        explanation: `${f.longLabel} has ${n} words. Important details may be missing.`,
        location: {
          kind: 'field',
          key: check.field,
          label: f.longLabel,
          inDocument: snapshot.presentKeys.has(check.field),
        },
        suggestedAction: 'Add who, what, when, where and how, in order.',
      });
    }
  }
  const unused = snapshot.fields.filter((f) => f.filled && !snapshot.presentKeys.has(f.key));
  unused.forEach((f) =>
    add({
      id: `risks:unused:${f.key}`,
      category: 'risks',
      severity: 'medium',
      title: 'Filled field not used in the draft',
      explanation: `${f.longLabel} has a value, but its placeholder is no longer in the document, so the value does not appear.`,
      location: { kind: 'field', key: f.key, label: f.longLabel, inDocument: false },
      suggestedAction: 'Re-insert the information in the document or clear the field.',
    }),
  );

  // ---- Score & categories ----
  return summarizeHealth(findings);
}

/** Score + category statuses for a list of findings (shared with document review). */
export function summarizeHealth(findings) {
  const penalty = findings.reduce((sum, f) => sum + WEIGHT[f.severity], 0);
  const score = Math.max(20, Math.min(100, Math.round(100 - penalty * 0.6)));
  const categories = HEALTH_CATEGORIES.map((c) => {
    const items = findings.filter((f) => f.category === c.id);
    const status = items.some((f) => f.severity === 'high')
      ? 'attention'
      : items.length
        ? 'warning'
        : 'pass';
    return { ...c, status, count: items.length };
  });
  return { score, categories, findings };
}
