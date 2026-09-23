/**
 * Documents service — backed by the Legal Lens API (/api/documents).
 * Every call is authenticated; the backend scopes everything to the signed-in user.
 *
 * SIH demo: in Guest / Demo Mode (DRAFTING_GUEST_MODE, the default) every call
 * is served by guestDocumentStore instead — documents stay in this browser only.
 */
import { apiRequest } from './apiClient';
import { DRAFTING_GUEST_MODE, AI_DRAFT_UNAVAILABLE_MESSAGE } from './config';
import * as guestStore from './guestDocumentStore';
import {
  fromApi,
  toApiCreate,
  toApiPatch,
  versionFromApi,
  toApiType,
  toApiLanguage,
} from './documentMapper';
import { normalizeDocuments } from './documentStorageService';
import { readStorage, writeStorage, STORAGE_KEYS } from '../utils/storage';

const enc = encodeURIComponent;

export async function listDocuments() {
  if (DRAFTING_GUEST_MODE) return guestStore.listDocuments();
  const json = await apiRequest('/documents?limit=100&sort=updated_desc');
  return json.data.documents.map(fromApi);
}

export async function getDocument(id) {
  if (DRAFTING_GUEST_MODE) return guestStore.getDocument(id);
  const json = await apiRequest(`/documents/${enc(id)}`);
  return fromApi(json.data.document);
}

export async function createDocument(payload) {
  if (DRAFTING_GUEST_MODE) return guestStore.createDocument(payload);
  const json = await apiRequest('/documents', { method: 'POST', body: toApiCreate(payload) });
  return fromApi(json.data.document);
}

/**
 * @param {object} current   the document as the UI knows it
 * @param {object} changes   frontend-shaped changes (name, status, workspace, progress)
 * @param {{ versionReason?, detail?, keepalive? }} options  versionReason also snapshots a version
 */
export async function updateDocument(current, changes, { versionReason, detail, keepalive } = {}) {
  if (DRAFTING_GUEST_MODE) return guestStore.updateDocument(current, changes, { versionReason, detail });
  const body = toApiPatch(current, changes);
  if (versionReason) {
    body.versionReason = versionReason;
    if (detail) body.detail = String(detail).slice(0, 200);
  }
  const json = await apiRequest(`/documents/${enc(current.id)}`, {
    method: 'PATCH',
    body,
    keepalive,
  });
  return {
    document: fromApi(json.data.document),
    version: json.data.version ? versionFromApi(json.data.version) : null,
  };
}

export async function deleteDocument(id) {
  if (DRAFTING_GUEST_MODE) return guestStore.deleteDocument(id);
  await apiRequest(`/documents/${enc(id)}`, { method: 'DELETE' });
}

// ---------------- versions ----------------

export async function listVersions(id) {
  if (DRAFTING_GUEST_MODE) return guestStore.listVersions(id);
  const json = await apiRequest(`/documents/${enc(id)}/versions`);
  return json.data.versions.map(versionFromApi).reverse(); // oldest first, like the UI expects
}

export async function getVersion(id, versionId) {
  if (DRAFTING_GUEST_MODE) return guestStore.getVersion(id, versionId);
  const json = await apiRequest(`/documents/${enc(id)}/versions/${enc(versionId)}`);
  return versionFromApi(json.data.version);
}

export async function restoreVersion(id, versionId) {
  if (DRAFTING_GUEST_MODE) return guestStore.restoreVersion(id, versionId);
  const json = await apiRequest(`/documents/${enc(id)}/versions/${enc(versionId)}/restore`, {
    method: 'POST',
  });
  return { document: fromApi(json.data.document), version: versionFromApi(json.data.version) };
}

// ---------------- AI draft generation (existing backend endpoint) ----------------

/**
 * POST /api/drafting/generate — the backend calls OpenAI, saves the draft as a
 * Document owned by the user and creates version 1.
 */
export async function generateAiDraft({ typeId, language, description, fields, title }) {
  // Demo Mode: the AI endpoint needs a signed-in backend session — say so instead of failing with a server error.
  if (DRAFTING_GUEST_MODE) throw new Error(AI_DRAFT_UNAVAILABLE_MESSAGE);
  const json = await apiRequest('/drafting/generate', {
    method: 'POST',
    body: {
      documentType: toApiType(typeId),
      language: toApiLanguage(language),
      matterDescription: description,
      structuredData: fields ?? {},
      ...(title ? { title } : {}),
    },
  });
  if (!json.data?.document) throw new Error('The AI draft could not be saved.');
  return fromApi(json.data.document);
}

// ---------------- documents saved only in this browser (pre-backend) ----------------

const IMPORTED_KEY = 'imported-local-documents:v1';

/** Local (Step 2–7 demo) documents that have not been imported yet. Samples are skipped. */
export function listLocalDocuments() {
  if (DRAFTING_GUEST_MODE) return []; // nothing to import: Demo Mode already keeps drafts in this browser
  const stored = readStorage(STORAGE_KEYS.documents, null);
  if (!Array.isArray(stored)) return [];
  const imported = new Set(readStorage(IMPORTED_KEY, []));
  return normalizeDocuments(stored).filter((doc) => !doc.isSample && !imported.has(doc.id));
}

/** Marks local documents as imported. The local copies are kept, never deleted. */
export function markLocalDocumentsImported(ids) {
  const imported = new Set(readStorage(IMPORTED_KEY, []));
  ids.forEach((id) => imported.add(id));
  writeStorage(IMPORTED_KEY, [...imported]);
}
