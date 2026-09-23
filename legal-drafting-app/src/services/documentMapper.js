/**
 * Translation between the backend's Document shape and the shape the Step 2–7
 * UI already uses, so existing components keep working unchanged.
 *
 * Backend (canonical)                 Frontend
 *   title                         ↔    name
 *   documentType  fir / …         ↔    typeId  fir-complaint / …
 *   status        needs_review    ↔    status  needs-review
 *   source        created_draft … ↔    origin.kind draft / template / review / comparison
 *   language      english/…       ↔    language / setup.language  en / hi / mr
 *   content (TipTap JSON)         ↔    workspace.content
 *   structuredData (flat fields,  ↔    workspace.fields + setup.description
 *     + matterDescription)
 *   metadata.ui (UI bookkeeping)  ↔    progress, formatting, setup options, template, file info
 */
import {
  WORKSPACE_VERSION,
  createInitialWorkspace,
  computeCompletion,
} from '../utils/workspaceModel';
import { getDocumentSchema } from '../data/documentSchemas';
import { DEFAULT_FORMATTING } from '../data/editorOptions';
import { extractDemoFields } from '../utils/extractDemoFields';

const invert = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));

const TYPE_TO_API = {
  'fir-complaint': 'fir',
  'rental-agreement': 'rental_agreement',
  'divorce-petition': 'divorce_petition',
  affidavit: 'affidavit',
  'general-document': 'general_document',
};
const TYPE_FROM_API = invert(TYPE_TO_API);

const STATUS_TO_API = {
  draft: 'draft',
  'needs-review': 'needs_review',
  reviewed: 'reviewed',
  completed: 'completed',
};
const STATUS_FROM_API = invert(STATUS_TO_API);

const ORIGIN_TO_SOURCE = {
  draft: 'created_draft',
  sample: 'created_draft',
  template: 'template',
  review: 'reviewed_document',
  comparison: 'comparison_result',
};
const SOURCE_TO_ORIGIN = {
  created_draft: 'draft',
  template: 'template',
  reviewed_document: 'review',
  comparison_result: 'comparison',
};

const LANG_TO_API = { en: 'english', hi: 'hindi', mr: 'marathi' };
const LANG_FROM_API = invert(LANG_TO_API);

export const toApiType = (typeId) => TYPE_TO_API[typeId] ?? 'general_document';
export const toApiLanguage = (id) => LANG_TO_API[id] ?? 'english';

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));

function originKind(doc) {
  if (doc.origin?.kind) return doc.origin.kind;
  if (doc.source === 'reviewed-document') return 'review';
  if (doc.source === 'compared-document') return 'comparison';
  return 'draft';
}

function structuredDataFrom(fields, description) {
  const data = { ...(fields ?? {}) };
  if (description) data.matterDescription = description;
  return data;
}

/** UI-only bookkeeping kept in metadata.ui (non-sensitive, small). */
function uiMetadata(doc, workspace) {
  const schema = getDocumentSchema(doc.typeId);
  return clean({
    progress: workspace ? computeCompletion(schema, workspace.fields ?? {}).percent : doc.progress,
    formatting: workspace?.formatting,
    setup: doc.setup
      ? clean({
          useBnsFramework: doc.setup.useBnsFramework,
          source: doc.setup.source,
          descriptionDetail: doc.setup.descriptionDetail,
        })
      : undefined,
    generation: doc.generation,
    templateId: doc.origin?.templateId,
    templateName: doc.origin?.templateName,
    duplicatedFrom: doc.origin?.duplicatedFrom,
    sourceFile: doc.sourceFile,
    sourceFiles: doc.sourceFiles,
    review: doc.review,
  });
}

/** Body for POST /documents from a frontend payload (any creation flow). */
export function toApiCreate(doc) {
  const workspace = doc.workspace?.content
    ? doc.workspace
    : { ...createInitialWorkspace(doc), savedAt: undefined };
  return {
    title: doc.name,
    documentType: toApiType(doc.typeId),
    source: ORIGIN_TO_SOURCE[originKind(doc)] ?? 'created_draft',
    language: toApiLanguage(doc.language ?? doc.setup?.language ?? doc.review?.language ?? 'en'),
    status: STATUS_TO_API[doc.status] ?? 'draft',
    content: workspace.content,
    structuredData: structuredDataFrom(workspace.fields, doc.setup?.description),
    metadata: { ui: uiMetadata(doc, workspace) },
  };
}

/**
 * Body for PATCH /documents/:id. `current` is the document as the UI knows it;
 * metadata.ui is always sent whole because the backend merges metadata keys
 * shallowly.
 */
export function toApiPatch(current, changes) {
  const merged = { ...current, ...changes };
  const body = {};
  if ('name' in changes) body.title = changes.name;
  if ('status' in changes) body.status = STATUS_TO_API[changes.status] ?? 'draft';
  if (changes.workspace) {
    body.content = changes.workspace.content;
    body.structuredData = structuredDataFrom(changes.workspace.fields, merged.setup?.description);
  }
  if (changes.workspace || 'progress' in changes) {
    body.metadata = { ui: uiMetadata(merged, merged.workspace) };
  }
  return body;
}

/** Backend document (summary or full) → frontend document. */
export function fromApi(api) {
  const meta = api.metadata ?? {};
  const ui = meta.ui ?? {};
  const typeId = TYPE_FROM_API[api.documentType] ?? 'general-document';
  const language = LANG_FROM_API[api.language] ?? 'en';
  const hasContent = api.content !== undefined;
  const { matterDescription, ...fields } = api.structuredData ?? {};
  const description = matterDescription ?? '';

  const generation =
    ui.generation ??
    (meta.aiGenerated
      ? {
          source: 'ai',
          status: 'preliminary',
          generatedAt: meta.generatedAt,
          verificationStatus: 'unverified',
        }
      : undefined);

  const doc = clean({
    id: api.id,
    name: api.title,
    typeId,
    status: STATUS_FROM_API[api.status] ?? 'draft',
    progress: ui.progress ?? 0,
    isSample: false,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
    currentVersion: api.currentVersion,
    language,
    origin: clean({
      kind: SOURCE_TO_ORIGIN[api.source] ?? 'draft',
      templateId: ui.templateId,
      templateName: ui.templateName,
      duplicatedFrom: ui.duplicatedFrom,
    }),
    source:
      api.source === 'reviewed_document'
        ? 'reviewed-document'
        : api.source === 'comparison_result'
          ? 'compared-document'
          : undefined,
    setup: { description, language, ...(ui.setup ?? {}) },
    generation,
    sourceFile: ui.sourceFile,
    sourceFiles: ui.sourceFiles,
    review: ui.review,
    aiGenerated: meta.aiGenerated || undefined,
  });

  if (hasContent) {
    doc.workspace = {
      version: WORKSPACE_VERSION,
      fields,
      content: api.content,
      formatting: { ...DEFAULT_FORMATTING, ...(ui.formatting ?? {}) },
      // Demo extraction is deterministic, so it is recomputed instead of stored.
      extraction: { source: 'demo', values: extractDemoFields(typeId, description).values },
      savedAt: api.updatedAt,
    };
  }
  return doc;
}

// ---------------- versions ----------------

const REASON_FROM_API = {
  initial_version: 'created',
  generated_draft: 'generated',
  manual_save: 'manual-save',
  clause_added: 'clause-added',
  ai_edit_accepted: 'ai-edit',
  major_edit: 'major-edit',
  regenerated: 'regenerated',
  restored_version: 'restored',
};

const REASON_LABELS = {
  initial_version: 'Initial version',
  generated_draft: 'AI draft generated',
  manual_save: 'Manual save',
  clause_added: 'Clause added',
  ai_edit_accepted: 'AI edit accepted',
  major_edit: 'Major edit',
  regenerated: 'Regenerated from template',
};

export function versionFromApi(v) {
  const label =
    v.reason === 'restored_version'
      ? `Restored from ${v.detail || 'an earlier version'}`
      : v.detail
        ? `${REASON_LABELS[v.reason] ?? v.reason}: ${v.detail}`
        : (REASON_LABELS[v.reason] ?? v.reason);
  const out = {
    id: v.id,
    number: v.versionNumber,
    reason: REASON_FROM_API[v.reason] ?? v.reason,
    label,
    createdAt: v.createdAt,
  };
  if (v.content !== undefined) {
    const { matterDescription: _m, ...fields } = v.structuredData ?? {};
    out.content = v.content;
    out.fields = fields;
  }
  return out;
}
