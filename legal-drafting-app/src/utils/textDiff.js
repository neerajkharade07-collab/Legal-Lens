/**
 * Dependency-free document diff used by the comparison service.
 *
 * 1. Paragraph-level LCS aligns unchanged paragraphs.
 * 2. Inside each gap, removed/added paragraphs with similar wording are paired
 *    as "modified" and given a word-level diff; the rest are pure additions or
 *    removals.
 * Replaceable later by a backend diff (the output shape is what the UI uses).
 */

export function splitParagraphs(text = '') {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Classic LCS table → list of [i, j] matched index pairs. */
function lcsPairs(a, b, equal) {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = equal(a[i], b[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (equal(a[i], b[j])) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
}

// Words (incl. numbers like 1,00,000 and Devanagari), whitespace, and single punctuation marks.
const tokenize = (s) =>
  s.match(/\s+|[\p{L}\p{M}\p{N}₹]+(?:[.,'’][\p{L}\p{M}\p{N}]+)*|[^\s\p{L}\p{M}\p{N}]/gu) ?? [];

/** Word-level diff → [{ op: 'equal'|'insert'|'delete', text }] (adjacent ops merged). */
export function diffWords(before, after) {
  const a = tokenize(before);
  const b = tokenize(after);
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const out = [];
  const push = (op, value) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += value;
    else out.push({ op, text: value });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length]]) {
    push('delete', a.slice(i, pi).join(''));
    push('insert', b.slice(j, pj).join(''));
    if (pi < a.length) push('equal', a[pi]);
    i = pi + 1;
    j = pj + 1;
  }
  // Whitespace-only equal runs between changes read better folded into the change.
  return out;
}

function similarity(x, y) {
  const wx = new Set(norm(x).split(' '));
  const wy = new Set(norm(y).split(' '));
  let common = 0;
  wx.forEach((w) => {
    if (wy.has(w)) common += 1;
  });
  return common / Math.max(wx.size, wy.size, 1);
}

const isHeading = (p) =>
  (/^[A-Z0-9 .,&/()'-]+$/.test(p) && /[A-Z]/.test(p) && p.split(' ').length <= 8) ||
  (/^\d+[.)]\s+\S/.test(p) && p.split(' ').length <= 6 && !/[.:;]$/.test(p));

/**
 * @returns {{ segments: ({kind:'same', text, origIndex, revIndex} | {kind:'change', changeId})[], changes: object[], summary }}
 * change: { id, number, type:'added'|'removed'|'modified', section, originalText, revisedText, words }
 */
export function diffDocuments(originalText, revisedText) {
  const a = splitParagraphs(originalText);
  const b = splitParagraphs(revisedText);
  const pairs = lcsPairs(a, b, (x, y) => norm(x) === norm(y));
  const segments = [];
  const changes = [];
  let sectionA = null;
  let sectionB = null;

  const addChange = (type, originalTextValue, revisedTextValue) => {
    const id = `chg-${changes.length + 1}`;
    changes.push({
      id,
      number: changes.length + 1,
      type,
      section: (type === 'removed' ? sectionA : sectionB) ?? sectionA ?? 'Opening',
      originalText: originalTextValue,
      revisedText: revisedTextValue,
      words: type === 'modified' ? diffWords(originalTextValue, revisedTextValue) : null,
    });
    segments.push({ kind: 'change', changeId: id });
  };

  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length]]) {
    const removed = a.slice(i, pi);
    const added = b.slice(j, pj);
    const usedAdded = new Set();
    for (const r of removed) {
      if (isHeading(r)) sectionA = r;
      let best = -1;
      let bestScore = 0.35;
      added.forEach((candidate, k) => {
        if (usedAdded.has(k)) return;
        const score = similarity(r, candidate);
        if (score > bestScore) {
          best = k;
          bestScore = score;
        }
      });
      // Emit additions that come before the matched one, keeping revised order.
      if (best >= 0) {
        added.forEach((candidate, k) => {
          if (k < best && !usedAdded.has(k)) {
            usedAdded.add(k);
            if (isHeading(candidate)) sectionB = candidate;
            addChange('added', '', candidate);
          }
        });
        usedAdded.add(best);
        if (isHeading(added[best])) sectionB = added[best];
        addChange('modified', r, added[best]);
      } else {
        addChange('removed', r, '');
      }
    }
    added.forEach((candidate, k) => {
      if (usedAdded.has(k)) return;
      if (isHeading(candidate)) sectionB = candidate;
      addChange('added', '', candidate);
    });
    if (pi < a.length) {
      if (isHeading(a[pi])) sectionA = a[pi];
      if (isHeading(b[pj])) sectionB = b[pj];
      segments.push({ kind: 'same', text: b[pj], origIndex: pi, revIndex: pj });
    }
    i = pi + 1;
    j = pj + 1;
  }

  const count = (type) => changes.filter((c) => c.type === type).length;
  return {
    segments,
    changes,
    summary: {
      added: count('added'),
      removed: count('removed'),
      modified: count('modified'),
      total: changes.length,
    },
  };
}

/**
 * Apply decisions → text. decisions: { [changeId]: 'accepted' | 'rejected' | 'pending' }
 * pending is treated as `pendingAs` ('revised' by default).
 */
export function applyDecisions(result, decisions, { pendingAs = 'revised' } = {}) {
  const byId = Object.fromEntries(result.changes.map((c) => [c.id, c]));
  const lines = [];
  for (const seg of result.segments) {
    if (seg.kind === 'same') {
      lines.push(seg.text);
      continue;
    }
    const change = byId[seg.changeId];
    const decision = decisions[change.id] ?? 'pending';
    const useRevised =
      decision === 'accepted' || (decision === 'pending' && pendingAs === 'revised');
    const value = useRevised ? change.revisedText : change.originalText;
    if (value) lines.push(value);
  }
  return lines.join('\n');
}
