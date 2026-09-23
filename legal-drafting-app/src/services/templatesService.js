/**
 * Templates service — future: Template API.
 * Demo mode serves the static Template Library catalogue.
 */
import { DOCUMENT_TYPES } from '../data/documentTypes';
import { TEMPLATE_LIBRARY, TEMPLATE_CATEGORIES } from '../data/templates/demoTemplates';
import { buildDraftTemplate } from '../data/draftTemplates';
import { getDocumentSchema, getFieldMap } from '../data/documentSchemas';
import { hydrateFieldTokens } from '../utils/fieldTokens';
import { readStorage, writeStorage, STORAGE_KEYS } from '../utils/storage';
import { formatDate } from '../utils/date';
import { USE_MOCKS, simulateLatency, notConnected } from './config';

export { TEMPLATE_CATEGORIES };

/** Kept for backwards compatibility (Step 2): the structured document types. */
export async function listTemplates() {
  if (!USE_MOCKS) throw notConnected('Template API');
  return simulateLatency(DOCUMENT_TYPES, 150);
}

export function getTemplate(id) {
  return TEMPLATE_LIBRARY.find((t) => t.id === id) ?? null;
}

/**
 * Search + filter. query matches name, description, purpose and sections.
 * category: category id | 'all' | 'favourites' | 'recent'
 */
export function searchTemplates({
  query = '',
  category = 'all',
  favourites = [],
  recent = [],
} = {}) {
  const q = query.trim().toLowerCase();
  let list = TEMPLATE_LIBRARY;
  if (category === 'favourites') list = list.filter((t) => favourites.includes(t.id));
  else if (category === 'recent') list = recent.map((id) => getTemplate(id)).filter(Boolean);
  else if (category !== 'all') list = list.filter((t) => t.categories.includes(category));
  if (q) {
    list = list.filter((t) =>
      [t.name, t.description, t.purpose, ...t.sections].some((s) => s.toLowerCase().includes(q)),
    );
  }
  return list;
}

export function categoryLabel(id) {
  return TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Template body as TipTap JSON, placeholders shown as [LABEL] tokens — for previews. */
export function getTemplatePreview(template) {
  const typeId = template.typeId ?? 'general-document';
  const json = buildDraftTemplate(typeId, {
    templateId: template.typeId ? undefined : template.id,
    setup: template.typeId === 'fir-complaint' ? { useBnsFramework: false } : null,
  });
  return hydrateFieldTokens(json, getFieldMap(getDocumentSchema(typeId)), {});
}

// ---------- Recently used ----------
export function listRecentTemplateIds() {
  return readStorage(STORAGE_KEYS.recentTemplates, []);
}

export function markTemplateUsed(id) {
  const next = [id, ...listRecentTemplateIds().filter((x) => x !== id)].slice(0, 6);
  writeStorage(STORAGE_KEYS.recentTemplates, next);
  return next;
}

/**
 * Document record for a library template WITHOUT structured fields. It opens
 * in the existing Draft Workspace, which builds the body from the template id.
 */
export function buildTemplateDocumentPayload(template) {
  return {
    name: `${template.name} — ${formatDate(new Date())}`,
    typeId: 'general-document',
    status: 'draft',
    progress: 0,
    origin: { kind: 'template', templateId: template.id, templateName: template.name },
    language: 'en',
  };
}
