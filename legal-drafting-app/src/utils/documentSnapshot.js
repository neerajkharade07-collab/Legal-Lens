/**
 * Read-only, serialisable view of the current draft used by the review
 * services (health, clauses, compliance, citations, research, assistant).
 * Built from TipTap JSON + field values; no editor instance required, so the
 * same shape can later be sent to a backend.
 */
import { getSchemaFields } from '../data/documentSchemas';
import { formatFieldValue, isFilled } from './fieldTokens';

function inlineText(node, parts) {
  if (node.type === 'text') parts.push({ kind: 'text', text: node.text ?? '' });
  else if (node.type === 'fieldToken') {
    const { key, label, value } = node.attrs ?? {};
    parts.push({ kind: 'token', key, text: value || `[${label}]`, empty: !value });
  } else if (node.type === 'hardBreak') parts.push({ kind: 'text', text: '\n' });
  node.content?.forEach((child) => inlineText(child, parts));
  return parts;
}

/** Flatten TipTap JSON into textblocks (paragraphs, headings, list-item paragraphs). */
function collectBlocks(json) {
  const blocks = [];
  const walk = (node, path, listDepth) => {
    const isTextblock = node.type === 'paragraph' || node.type === 'heading';
    if (isTextblock) {
      const parts = [];
      node.content?.forEach((child) => inlineText(child, parts));
      const text = parts.map((p) => p.text).join('');
      blocks.push({
        index: blocks.length,
        topIndex: path[0],
        type: node.type,
        level: node.attrs?.level ?? null,
        inList: listDepth > 0,
        text,
        plainText: parts
          .filter((p) => p.kind === 'text')
          .map((p) => p.text)
          .join(''),
        tokens: parts.filter((p) => p.kind === 'token'),
      });
      return;
    }
    const nextDepth =
      node.type === 'bulletList' || node.type === 'orderedList' ? listDepth + 1 : listDepth;
    node.content?.forEach((child, i) => walk(child, path.length === 0 ? [i] : path, nextDepth));
  };
  json?.content?.forEach((child, i) => walk(child, [i], 0));
  return blocks;
}

const GENERIC_LABELS = new Set([
  'Full Name',
  'Address',
  'Contact',
  'Age',
  'Name / Entity',
  'Contact Information',
]);

export function buildDocumentSnapshot({ json, fields, schema, typeId, setup }) {
  const blocks = collectBlocks(json);
  const groupTitles = Object.fromEntries((schema?.groups ?? []).map((g) => [g.id, g.title]));
  const schemaFields = getSchemaFields(schema).map((field) => ({
    key: field.key,
    label: field.label,
    // "Landlord · Full Name" — unambiguous when several groups share a label.
    longLabel: GENERIC_LABELS.has(field.label)
      ? `${groupTitles[field.groupId]} · ${field.label}`
      : field.label,
    groupId: field.groupId,
    type: field.type ?? 'text',
    raw: fields[field.key] ?? '',
    value: formatFieldValue(field, fields[field.key]),
    filled: isFilled(fields[field.key]),
  }));
  const tokenOccurrences = blocks.flatMap((b) =>
    b.tokens.map((t) => ({ ...t, blockIndex: b.index })),
  );
  return {
    typeId,
    setup: setup ?? null,
    fields: schemaFields,
    fieldMap: Object.fromEntries(schemaFields.map((f) => [f.key, f])),
    blocks,
    headings: blocks.filter((b) => b.type === 'heading').map((b) => b.text.trim()),
    text: blocks.map((b) => b.text).join('\n'),
    presentKeys: new Set(tokenOccurrences.map((t) => t.key)),
    emptyTokenKeys: new Set(tokenOccurrences.filter((t) => t.empty).map((t) => t.key)),
    wordCount: blocks.reduce(
      (n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0),
      0,
    ),
  };
}

/** Case-insensitive "does the document mention any of these phrases". */
export function snapshotMentions(snapshot, phrases) {
  const haystack = snapshot.text.toLowerCase();
  return phrases.some((phrase) => haystack.includes(phrase.toLowerCase()));
}

export function hasHeading(snapshot, phrases) {
  return snapshot.headings.some((h) =>
    phrases.some((p) => h.toLowerCase().includes(p.toLowerCase())),
  );
}
