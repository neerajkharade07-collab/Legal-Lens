/**
 * Legal Drafting Phase 6 — compare editor states without counting differences that mean nothing.
 *
 * When a saved document is opened, the editor adds default attributes (for example
 * `textAlign: null`, `pageBreakBefore: null`). Without this, simply OPENING a document looked
 * like an edit: it was saved again (an unneeded database write) and could make another open tab
 * report a false save conflict. Null / undefined values and empty `attrs` are ignored, and object
 * keys are sorted, so only real changes count.
 */
function strip(value) {
  if (Array.isArray(value)) return value.map(strip);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value)
    .sort()
    .forEach((k) => {
      const v = value[k];
      if (v === null || v === undefined) return;
      const s = strip(v);
      if (k === 'attrs' && s && typeof s === 'object' && !Array.isArray(s) && Object.keys(s).length === 0) return;
      out[k] = s;
    });
  return out;
}

/** Stable key for "is there anything new to save?" */
export function canonicalKey(...parts) {
  return JSON.stringify(parts.map(strip));
}
