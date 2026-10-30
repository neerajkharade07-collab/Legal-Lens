/**
 * Legal Drafting Phase 4 — deterministic finalization checklist (no AI, no network).
 *
 * Inspects the actual TipTap document and reports objective, actionable findings:
 *   blocking — the document cannot be finalized reliably (empty document, no title);
 *   warning  — needs attention but may be intentional (placeholders, empty fields, empty headings…);
 *   info     — optional improvements.
 * Document-type checks run only for the supported types whose conventions are reliable
 * (signature section for affidavits, agreements, petitions and police complaints). Nothing here
 * states a legal requirement or treats an AI observation as a fact, and nothing changes the
 * document.
 */

const SIGNED_TYPES = new Set(['affidavit', 'rental-agreement', 'divorce-petition', 'fir-complaint']);

// "[NAME]", "[DATE]", "[DETAIL REQUIRED]", "[ADDRESS OF TENANT]", "[ ]", "[__]" …
const BRACKET_MARKER = /\[(?:\s*|_+|[A-Z][A-Z0-9 ,./&()'’_-]{0,60}|DETAIL REQUIRED)\]/g;
const OTHER_MARKERS = /\b(?:TBD|TODO|XXX+)\b|<<[^<>\n]{1,40}>>|\{\{[^{}\n]{1,40}\}\}/g;
const BLANK_LINE = /_{4,}/;
const DATE_PATTERN =
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\bdated\b|\bdate\s*:|दिनांक|तारीख/i;
const SIGNATURE_PATTERN = /signature|signed|sign here|deponent|executant|स्वाक्षरी|हस्ताक्षर|सही/i;

function inlineText(node, { tokens = 'value' } = {}) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'fieldToken') return node.attrs?.value || (tokens === 'label' ? `[${node.attrs?.label || ''}]` : '');
  return (node.content ?? []).map((c) => inlineText(c, { tokens })).join('');
}

/** Text blocks in reading order: { type, level?, text, path } (list items included). */
function textBlocks(json) {
  const out = [];
  const walk = (node, inList = false) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'paragraph' || node.type === 'heading') {
      out.push({ type: node.type, level: node.attrs?.level, text: inlineText(node), inList, node });
      return;
    }
    if (node.type === 'pageBreak') {
      out.push({ type: 'pageBreak', text: '', inList, node });
      return;
    }
    const nextInList = inList || node.type === 'bulletList' || node.type === 'orderedList';
    (node.content ?? []).forEach((c) => walk(c, nextInList));
  };
  walk(json);
  return out;
}

function emptyTokens(json) {
  const out = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'fieldToken' && !String(node.attrs?.value ?? '').trim()) {
      out.push({ key: node.attrs?.key, label: node.attrs?.label || node.attrs?.key || 'field' });
    }
    (node.content ?? []).forEach(walk);
  };
  walk(json);
  return out;
}

const snippet = (text, index, length) => text.slice(Math.max(0, index - 30), index + length + 30).trim();

/**
 * @param {{ content: object, title?: string, typeId?: string }} input
 * @returns {{ findings: {id, level, title, detail, location}[], counts: {blocking, warning, info}, canFinalize: boolean, words: number }}
 */
export function runFinalizeChecklist({ content, title, typeId } = {}) {
  const json = content && typeof content === 'object' ? content : { type: 'doc', content: [] };
  const blocks = textBlocks(json);
  const fullText = blocks.map((b) => b.text).join('\n');
  const words = (fullText.match(/[\p{L}\p{N}]+/gu) || []).length;
  const findings = [];
  const add = (f) => findings.push({ location: null, ...f, id: f.id ?? `f${findings.length + 1}` });

  // ---------------- blocking ----------------
  if (!String(title ?? '').trim()) {
    add({ id: 'no-title', level: 'blocking', title: 'The document has no title', detail: 'Give the document a name before finalizing it (rename it at the top of the editor).' });
  }
  if (!fullText.replace(/\s+/g, '').length) {
    add({ id: 'empty', level: 'blocking', title: 'The document is empty', detail: 'There is no text to finalize.' });
    return summarize(findings, words);
  }

  // ---------------- warnings: unresolved markers ----------------
  const markerHits = new Map();
  blocks.forEach((b) => {
    for (const re of [BRACKET_MARKER, OTHER_MARKERS]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(b.text))) {
        const key = m[0].replace(/\s+/g, ' ').toUpperCase();
        if (!markerHits.has(key)) markerHits.set(key, { marker: m[0], count: 0, text: b.text, index: m.index });
        markerHits.get(key).count += 1;
      }
    }
  });
  Array.from(markerHits.values()).forEach((h, n) => {
    add({
      id: `marker-${n}`,
      level: 'warning',
      title: `Unresolved placeholder ${h.marker}${h.count > 1 ? ` (${h.count} times)` : ''}`,
      detail: 'Replace it with the actual detail, or remove it if it is not needed.',
      location: { kind: 'text', text: h.marker, context: snippet(h.text, h.index, h.marker.length) },
    });
  });

  const tokens = emptyTokens(json);
  const seenTokens = new Set();
  tokens.forEach((t) => {
    if (seenTokens.has(t.key)) return;
    seenTokens.add(t.key);
    add({
      id: `field-${t.key}`,
      level: 'warning',
      title: `Empty field: ${t.label}`,
      detail: 'Fill it in Case details, or leave it blank on purpose to complete by hand (it prints as a blank line).',
      location: { kind: 'token', key: t.key },
    });
  });

  // ---------------- warnings: structure ----------------
  blocks.forEach((b, i) => {
    if (b.type !== 'heading') return;
    if (!b.text.trim()) {
      add({ id: `empty-heading-${i}`, level: 'warning', title: 'Empty heading', detail: 'A heading has no text. Add a heading or remove it.', location: null });
      return;
    }
    const next = blocks.slice(i + 1).find((x) => x.type !== 'pageBreak' && (x.text.trim() || x.type === 'heading'));
    if (!next || (next.type === 'heading' && (next.level ?? 2) <= (b.level ?? 2))) {
      add({
        id: `empty-section-${i}`,
        level: 'warning',
        title: `Section "${b.text.trim().slice(0, 60)}" has no content`,
        detail: 'Add the clause text under this heading, or remove the heading.',
        location: { kind: 'text', text: b.text.trim() },
      });
    }
  });

  // ---------------- document-type check (reliable conventions only) ----------------
  if (SIGNED_TYPES.has(typeId) && !SIGNATURE_PATTERN.test(fullText)) {
    add({
      id: 'no-signature',
      level: 'warning',
      title: 'No signature section found',
      detail: 'Documents of this type are normally signed, but no signature, “signed” or deponent line was found. Insert a signature block if one is needed.',
    });
  }

  // ---------------- informational ----------------
  if (!DATE_PATTERN.test(fullText)) {
    add({ id: 'no-date', level: 'info', title: 'No date found', detail: 'No date or “Date:” line was found. Add a date and place line if the document should carry one.' });
  }
  const blankLines = blocks.filter((b) => BLANK_LINE.test(b.text)).length;
  if (blankLines) {
    add({ id: 'blank-lines', level: 'info', title: `${blankLines} line${blankLines === 1 ? '' : 's'} with blanks to fill by hand`, detail: 'Lines such as “Signature: ________” print as blanks. Check that each is meant to be completed by hand.', location: { kind: 'text', text: '____' } });
  }
  if (words > 250 && !blocks.some((b) => b.type === 'heading')) {
    add({ id: 'no-headings', level: 'info', title: 'No headings', detail: 'Headings make a longer document easier to read and to refer to.' });
  }
  const longParagraph = blocks.find((b) => b.type === 'paragraph' && b.text.length > 2500);
  if (longParagraph) {
    add({ id: 'long-paragraph', level: 'info', title: 'Very long paragraph', detail: 'One paragraph is longer than about 400 words. Consider splitting it into numbered clauses.', location: { kind: 'text', text: longParagraph.text.slice(0, 40) } });
  }
  let emptyRun = 0;
  let maxRun = 0;
  blocks.forEach((b) => {
    if (b.type === 'paragraph' && !b.text.trim() && !b.inList) {
      emptyRun += 1;
      maxRun = Math.max(maxRun, emptyRun);
    } else emptyRun = 0;
  });
  if (maxRun >= 3) {
    add({ id: 'empty-paragraphs', level: 'info', title: 'Several empty lines in a row', detail: 'Use a page break instead of many empty lines, so the layout is the same in print and in Word.' });
  }
  return summarize(findings, words);
}

function summarize(findings, words) {
  const counts = { blocking: 0, warning: 0, info: 0 };
  findings.forEach((f) => {
    counts[f.level] += 1;
  });
  return { findings, counts, canFinalize: counts.blocking === 0, words };
}

export const _internals = { textBlocks, emptyTokens, inlineText, BRACKET_MARKER };
