/**
 * Documents service — backed by the CASEONE API (/api/documents) for signed-in
 * customers and lawyers; the backend scopes everything to the signed-in user.
 *
 * Signed out (Demo Mode, see config.js storage mode), every call is served by
 * guestDocumentStore instead — documents stay in this browser only.
 *
 * Safety rules:
 *  - A document is always read and saved where it lives: account documents only
 *    through the API, browser (Demo Mode) documents only through the browser
 *    store. If the session ended, saving an account document FAILS with a clear
 *    message — it is never quietly saved in the browser instead.
 *  - AI drafting is account-only.
 */
import { apiRequest } from './apiClient';
import { AI_DRAFT_UNAVAILABLE_MESSAGE, getStorageMode, isGuestId } from './config';
import * as guestStore from './guestDocumentStore';
import {
  fromApi,
  toApiCreate,
  toApiPatch,
  versionFromApi,
  toApiType,
  toApiLanguage,
  structuredDataFrom,
} from './documentMapper';
import { normalizeDocuments } from './documentStorageService';
import { readStorage, writeStorage, STORAGE_KEYS } from '../utils/storage';

const enc = encodeURIComponent;

export class StorageModeError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StorageModeError';
    this.code = code;
    this.status = code === 'sign-in-required' ? 401 : 409;
  }
}

const SIGN_IN_TO_SAVE =
  'You are signed out, so this account document cannot be saved here. Sign in again to keep saving — your changes stay on this page.';
const BROWSER_ONLY =
  'This draft is saved only in this browser (Demo Mode). Import it to your account from My Documents to open it while signed in.';

/** Which store serves a request about one existing document. Never guesses. */
function storeFor(id) {
  const mode = getStorageMode();
  if (isGuestId(id)) {
    if (mode === 'guest') return 'guest';
    throw new StorageModeError(BROWSER_ONLY, 'browser-only');
  }
  if (mode === 'account') return 'account';
  throw new StorageModeError(SIGN_IN_TO_SAVE, 'sign-in-required');
}

function storeForNew() {
  const mode = getStorageMode();
  if (mode === 'account' || mode === 'guest') return mode;
  throw new StorageModeError('Your session is still loading. Please try again in a moment.', 'checking');
}

/** Phase 6: every page of the account's documents (the API returns at most 100 per page). */
const MAX_LIST_PAGES = 20;

export async function listDocuments() {
  if (storeForNew() === 'guest') return guestStore.listDocuments();
  const all = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const json = await apiRequest(`/documents?limit=100&sort=updated_desc${page > 1 ? `&page=${page}` : ''}`);
    all.push(...json.data.documents.map(fromApi));
    const totalPages = json.data.pagination?.totalPages ?? 1;
    if (page >= totalPages || json.data.documents.length === 0) break;
  }
  const seen = new Set();
  return all.filter((d) => (seen.has(d.id) ? false : seen.add(d.id)));
}

export async function getDocument(id) {
  if (storeFor(id) === 'guest') return guestStore.getDocument(id);
  const json = await apiRequest(`/documents/${enc(id)}`);
  return fromApi(json.data.document);
}

export async function createDocument(payload) {
  if (storeForNew() === 'guest') return guestStore.createDocument(payload);
  const json = await apiRequest('/documents', { method: 'POST', body: toApiCreate(payload) });
  return fromApi(json.data.document);
}

/**
 * @param {object} current   the document as the UI knows it
 * @param {object} changes   frontend-shaped changes (name, status, workspace, progress)
 * @param {{ versionReason?, detail?, keepalive?, baseRevision? }} options  versionReason also snapshots a version;
 *   baseRevision (Phase 6) makes the server refuse the save (ApiError serverCode 'document_conflict',
 *   data.document = the newer saved document) if the text was saved elsewhere in the meantime.
 */
export async function updateDocument(current, changes, { versionReason, detail, keepalive, baseRevision } = {}) {
  if (storeFor(current.id) === 'guest') {
    return guestStore.updateDocument(current, changes, { versionReason, detail });
  }
  const body = toApiPatch(current, changes);
  if (versionReason) {
    body.versionReason = versionReason;
    if (detail) body.detail = String(detail).slice(0, 200);
  }
  // A function is read when the request is actually sent (saves for one document are queued).
  const base = typeof baseRevision === 'function' ? baseRevision() : baseRevision;
  if (base && changes.workspace) body.baseRevision = base;
  const json = await apiRequest(`/documents/${enc(current.id)}`, {
    method: 'PATCH',
    body,
    keepalive,
  });
  return {
    document: fromApi(json.data.document),
    version: json.data.version ? versionFromApi(json.data.version) : null,
    versionError: json.data.versionError === true,
  };
}

/** True when a save was refused because the document was changed elsewhere (Phase 6). */
export function isConflictError(err) {
  return err?.status === 409 && err?.serverCode === 'document_conflict';
}

/** The newer saved document sent with a conflict, in the frontend shape (or null). */
export function conflictDocument(err) {
  const api = err?.data?.document;
  return api ? fromApi(api) : null;
}

/**
 * Phase 6: records a version of an account document without changing it — of the text given
 * (`content`, `fields`), or of the saved text when none is given. Used when a save conflict is
 * resolved, so neither side is lost.
 */
export async function snapshotVersion(doc, { content, fields, detail }) {
  if (storeFor(doc.id) === 'guest') return null;
  const body = { reason: 'manual_save', detail: String(detail || '').slice(0, 200) };
  if (content !== undefined) {
    body.content = content;
    body.structuredData = structuredDataFrom(fields || {}, doc.setup?.description);
  }
  const json = await apiRequest(`/documents/${enc(doc.id)}/versions`, { method: 'POST', body });
  return versionFromApi(json.data.version);
}

export async function deleteDocument(id) {
  if (storeFor(id) === 'guest') return guestStore.deleteDocument(id);
  await apiRequest(`/documents/${enc(id)}`, { method: 'DELETE' });
}

// ---------------- versions ----------------

export async function listVersions(id) {
  if (storeFor(id) === 'guest') return guestStore.listVersions(id);
  const json = await apiRequest(`/documents/${enc(id)}/versions`);
  return json.data.versions.map(versionFromApi).reverse(); // oldest first, like the UI expects
}

export async function getVersion(id, versionId) {
  if (storeFor(id) === 'guest') return guestStore.getVersion(id, versionId);
  const json = await apiRequest(`/documents/${enc(id)}/versions/${enc(versionId)}`);
  return versionFromApi(json.data.version);
}

export async function restoreVersion(id, versionId) {
  if (storeFor(id) === 'guest') return guestStore.restoreVersion(id, versionId);
  const json = await apiRequest(`/documents/${enc(id)}/versions/${enc(versionId)}/restore`, {
    method: 'POST',
  });
  return { document: fromApi(json.data.document), version: versionFromApi(json.data.version) };
}

// ---------------- AI draft generation (account only) ----------------

/**
 * POST /api/drafting/generate — the backend writes the draft with Gemini, checks it
 * for invented laws/numbers, saves it as a Document owned by the user and creates
 * version 1. Any failure rejects with the server's honest message; nothing is saved.
 */
export async function generateAiDraft({ typeId, language, description, fields, title, template }) {
  if (getStorageMode() !== 'account') throw new Error(AI_DRAFT_UNAVAILABLE_MESSAGE);
  const json = await apiRequest('/drafting/generate', {
    method: 'POST',
    body: {
      documentType: toApiType(typeId),
      language: toApiLanguage(language),
      matterDescription: description,
      structuredData: fields ?? {},
      ...(title ? { title } : {}),
      ...(template && (template.name || template.outline?.length) ? { template } : {}),
    },
  });
  if (!json.data?.document) throw new Error('The AI draft could not be saved.');
  return fromApi(json.data.document);
}

// ---------------- drafts kept only in this browser → account ----------------

/** Per-account record of browser drafts already copied (the server is the real guard). */
const importedKey = (userId) => `imported-browser-drafts:v2:${userId}`;
const LEGACY_IMPORTED_KEY = 'imported-local-documents:v1';

/**
 * Browser drafts that can be copied to the signed-in account: Demo Mode drafts
 * and drafts saved by the very first (pre-account) version of this app. Samples
 * and drafts already imported by this account are left out. Nothing is changed.
 * @returns {Array<{ guestImportId, name, updatedAt, kind: 'demo'|'legacy' }>}
 */
export function listBrowserDrafts(userId) {
  if (!userId) return [];
  const done = new Set(readStorage(importedKey(userId), []));
  const demo = guestStore.listRecords().map((record) => ({
    guestImportId: record.id,
    name: record.title || 'Untitled document',
    updatedAt: record.updatedAt,
    kind: 'demo',
  }));
  const stored = readStorage(STORAGE_KEYS.documents, null);
  const legacyDone = new Set(readStorage(LEGACY_IMPORTED_KEY, []));
  const legacy = Array.isArray(stored)
    ? normalizeDocuments(stored)
        .filter((doc) => !doc.isSample && !legacyDone.has(doc.id))
        .map((doc) => ({
          guestImportId: `legacy-${String(doc.id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)}`,
          localId: doc.id,
          name: doc.name,
          updatedAt: doc.updatedAt,
          kind: 'legacy',
        }))
    : [];
  return [...demo, ...legacy].filter(
    (item) => item.guestImportId.length >= 6 && !done.has(item.guestImportId),
  );
}

/** The create body for one browser draft (full content, as stored in this browser). */
function importBody(item) {
  if (item.kind === 'demo') {
    const record = guestStore.getRecord(item.guestImportId);
    return {
      title: record.title,
      documentType: record.documentType,
      source: record.source,
      language: record.language,
      status: record.status,
      content: record.content,
      structuredData: record.structuredData ?? {},
      metadata: record.metadata?.ui ? { ui: record.metadata.ui } : {},
    };
  }
  const stored = normalizeDocuments(readStorage(STORAGE_KEYS.documents, []));
  const doc = stored.find((d) => d.id === item.localId);
  if (!doc) throw new Error('This browser draft is no longer available.');
  return toApiCreate(doc);
}

/**
 * Copies ONE browser draft to the account (POST /api/documents/import).
 * Safe to retry: the server imports each browser draft at most once and returns
 * the existing copy otherwise. The browser copy is never changed or deleted.
 * @returns {Promise<{ document, alreadyImported: boolean }>}
 */
export async function importBrowserDraft(userId, item) {
  if (getStorageMode() !== 'account' || !userId) {
    throw new StorageModeError('Sign in to import drafts to your account.', 'sign-in-required');
  }
  const json = await apiRequest('/documents/import', {
    method: 'POST',
    body: { ...importBody(item), guestImportId: item.guestImportId },
  });
  const done = new Set(readStorage(importedKey(userId), []));
  done.add(item.guestImportId);
  writeStorage(importedKey(userId), [...done]);
  return { document: fromApi(json.data.document), alreadyImported: Boolean(json.data.alreadyImported) };
}
