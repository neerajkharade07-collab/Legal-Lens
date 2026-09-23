/**
 * Builds and serialises the Draft Workspace state stored on a document:
 *
 * document.workspace = {
 *   version: 1,
 *   fields:     { [key]: rawValue },           // left panel values
 *   content:    TipTap JSON,                   // the (manually editable) draft
 *   formatting: { lineHeight },
 *   extraction: { source: 'demo', values },    // what demo extraction pre-filled
 *   savedAt:    ISO string
 * }
 */
import { getDocumentSchema, getFieldMap, getSchemaFields } from '../data/documentSchemas';
import { buildDraftTemplate } from '../data/draftTemplates';
import { DEFAULT_FORMATTING } from '../data/editorOptions';
import { extractDemoFields } from './extractDemoFields';
import { formatFieldValue, hydrateFieldTokens, isFilled } from './fieldTokens';

export const WORKSPACE_VERSION = 1;

export function createInitialWorkspace(document) {
  const schema = getDocumentSchema(document.typeId);
  const fieldMap = getFieldMap(schema);
  const saved = document.workspace;

  if (saved?.version === WORKSPACE_VERSION && saved.content) {
    return {
      fields: saved.fields ?? {},
      content: saved.content,
      formatting: { ...DEFAULT_FORMATTING, ...saved.formatting },
      extraction: saved.extraction ?? { source: 'demo', values: {} },
      isNew: false,
    };
  }

  const extraction = extractDemoFields(document.typeId, document.setup?.description);
  const fields = { ...extraction.values };
  return {
    fields,
    content: buildWorkspaceContent(document, fieldMap, fields),
    formatting: { ...DEFAULT_FORMATTING },
    extraction: { source: 'demo', values: extraction.values },
    isNew: true,
  };
}

/** Fresh template for the document type with current field values applied. */
export function buildWorkspaceContent(document, fieldMap, fields) {
  const template = buildDraftTemplate(document.typeId, {
    setup: document.setup,
    templateId: document.origin?.templateId,
  });
  return hydrateFieldTokens(template, fieldMap, fields);
}

export function computeDisplayValues(schema, fields) {
  return Object.fromEntries(
    getSchemaFields(schema).map((field) => [field.key, formatFieldValue(field, fields[field.key])]),
  );
}

export function computeCompletion(schema, fields) {
  const all = getSchemaFields(schema);
  const filled = all.filter((field) => isFilled(fields[field.key])).length;
  return {
    filled,
    total: all.length,
    percent: all.length ? Math.round((filled / all.length) * 100) : 0,
  };
}
