/**
 * Document storage helpers (pure) — future: Documents API / database.
 *
 * Step 7 adds an optional `origin` field to documents:
 *   origin: { kind: 'draft' | 'template' | 'review' | 'comparison' | 'sample', templateId?, templateName? }
 * Older records don't have it; getDocumentOrigin() derives it from existing
 * fields, so no stored document needs to be rewritten.
 */
import { DOCUMENT_STATUSES } from '../data/documentStatuses';

export const ORIGIN_LABELS = {
  draft: 'Created draft',
  template: 'Template',
  review: 'Reviewed document',
  comparison: 'Comparison result',
  sample: 'Sample document',
};

export function getDocumentOrigin(doc) {
  if (doc?.origin?.kind)
    return { ...doc.origin, label: ORIGIN_LABELS[doc.origin.kind] ?? 'Document' };
  if (doc?.source === 'reviewed-document') return { kind: 'review', label: ORIGIN_LABELS.review };
  if (doc?.source === 'compared-document')
    return { kind: 'comparison', label: ORIGIN_LABELS.comparison };
  if (doc?.setup?.source === 'template') return { kind: 'template', label: ORIGIN_LABELS.template };
  if (doc?.isSample) return { kind: 'sample', label: ORIGIN_LABELS.sample };
  return { kind: 'draft', label: ORIGIN_LABELS.draft };
}

export const TITLE_MAX = 120;

/** @returns {string|null} error message, or null when valid */
export function validateTitle(title) {
  const value = title?.trim() ?? '';
  if (!value) return 'Enter a title.';
  if (value.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  return null;
}

/**
 * New, independent copy: new id (assigned by the store), copied content and
 * metadata, "(Copy)" title, fresh timestamps. Version history is not copied.
 */
export function buildDuplicatePayload(doc) {
  const { id: _id, createdAt: _c, updatedAt: _u, isSample: _s, ...rest } = doc;
  const copy = structuredClone(rest);
  const base = doc.name.replace(/ \(Copy(?: \d+)?\)$/, '');
  return {
    ...copy,
    name: `${base} (Copy)`,
    isSample: false,
    origin: { ...getDocumentOrigin(doc), duplicatedFrom: doc.id },
    ...(copy.workspace
      ? { workspace: { ...copy.workspace, savedAt: new Date().toISOString() } }
      : {}),
  };
}

/**
 * Non-destructive normalisation on load: repairs obviously broken records
 * (missing name/status) but never drops documents or unknown fields.
 */
export function normalizeDocuments(documents) {
  if (!Array.isArray(documents)) return documents;
  return documents
    .filter((doc) => doc && typeof doc === 'object' && doc.id)
    .map((doc) => ({
      ...doc,
      name: typeof doc.name === 'string' && doc.name.trim() ? doc.name : 'Untitled document',
      status: DOCUMENT_STATUSES[doc.status] ? doc.status : 'draft',
    }));
}

const LANGUAGE_LABELS = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

/** Drafting / review language label, or null when unknown. */
export function getDocumentLanguage(doc) {
  const id = doc?.language ?? doc?.setup?.language ?? doc?.review?.language ?? null;
  return id ? (LANGUAGE_LABELS[id] ?? id) : null;
}

export const SORT_OPTIONS = [
  { id: 'edited', label: 'Recently edited' },
  { id: 'created', label: 'Recently created' },
  { id: 'title', label: 'Title (A–Z)' },
];

const time = (value) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const SORTERS = {
  edited: (a, b) => time(b.updatedAt) - time(a.updatedAt),
  created: (a, b) => time(b.createdAt) - time(a.createdAt),
  title: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
};

/**
 * Search / filter / sort for My Documents (pure; never mutates the input).
 * query matches title, type name, origin and template name.
 */
export function queryDocuments(
  documents,
  { query = '', typeId = 'all', status = 'all', sort = 'edited', typeName = () => '' } = {},
) {
  const q = query.trim().toLowerCase();
  return documents
    .filter((doc) => typeId === 'all' || doc.typeId === typeId)
    .filter((doc) => status === 'all' || doc.status === status)
    .filter((doc) => {
      if (!q) return true;
      const origin = getDocumentOrigin(doc);
      return [doc.name, typeName(doc.typeId), origin.label, origin.templateName]
        .filter(Boolean)
        .some((text) => text.toLowerCase().includes(q));
    })
    .sort(SORTERS[sort] ?? SORTERS.edited);
}
