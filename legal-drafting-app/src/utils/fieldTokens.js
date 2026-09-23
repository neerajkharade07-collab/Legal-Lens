/**
 * Field-token helpers shared by the editor and the workspace state.
 * A field token is an inline, atomic editor node: { type: 'fieldToken', attrs: { key, label, value } }
 *   key   — stable schema key (e.g. "policeStationName")
 *   label — placeholder shown when empty (e.g. "POLICE STATION NAME")
 *   value — display-formatted value ('' when empty)
 */

const longDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Raw field state → text shown in the document. */
export function formatFieldValue(field, raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw);
  if (!value) return '';
  if (field?.type === 'date') {
    const [y, m, d] = value.split('-').map(Number);
    if (y && m && d) return longDate.format(new Date(y, m - 1, d));
  }
  if (field?.type === 'time') {
    const [hh, mm] = value.split(':').map(Number);
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      const suffix = hh >= 12 ? 'pm' : 'am';
      const hour = hh % 12 || 12;
      return `${hour}:${String(mm).padStart(2, '0')} ${suffix}`;
    }
  }
  return value;
}

export function tokenLabel(field, key) {
  return field?.token ?? key.replace(/([A-Z])/g, ' $1').toUpperCase();
}

/** Deep-walk TipTap JSON, filling each token's label and current value. */
export function hydrateFieldTokens(json, fieldMap, values) {
  const walk = (node) => {
    if (node.type === 'fieldToken') {
      const key = node.attrs?.key;
      const field = fieldMap[key];
      return {
        ...node,
        attrs: { key, label: tokenLabel(field, key), value: formatFieldValue(field, values[key]) },
      };
    }
    return node.content ? { ...node, content: node.content.map(walk) } : node;
  };
  return walk(json);
}

/** Keys of all field tokens present in TipTap JSON. */
export function collectTokenKeys(json) {
  const keys = new Set();
  const walk = (node) => {
    if (node.type === 'fieldToken' && node.attrs?.key) keys.add(node.attrs.key);
    node.content?.forEach(walk);
  };
  if (json) walk(json);
  return keys;
}

export function isFilled(value) {
  return typeof value === 'string' ? value.trim().length > 0 : value != null && value !== '';
}
