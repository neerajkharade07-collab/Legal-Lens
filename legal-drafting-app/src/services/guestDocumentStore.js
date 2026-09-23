/**
 * Guest / Demo Mode document store (SIH demo).
 *
 * Same functions as documentsService, but documents and their versions are
 * kept ONLY in this browser (localStorage). Nothing is sent to the backend,
 * no account is involved and nothing here pretends to be server-side: the UI
 * labels this as "saved in this browser (Demo Mode)".
 *
 * Records are stored in the backend's document shape so the existing
 * documentMapper (fromApi / toApiCreate / toApiPatch / versionFromApi) is
 * reused unchanged and the workspace behaves exactly as with the API.
 */
import { fromApi, toApiCreate, toApiPatch, versionFromApi } from './documentMapper';
import { readStorage, writeStorage } from '../utils/storage';
import { createId } from '../utils/id';

const DOCS_KEY = 'guest-documents:v1';
const VERSIONS_KEY = 'guest-document-versions:v1';

class GuestStoreError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'GuestStoreError';
    this.status = status;
  }
}

const STORAGE_FAILED =
  'Could not save in this browser (storage is full or blocked). Demo Mode keeps drafts in browser storage only.';

function readDocs() {
  const list = readStorage(DOCS_KEY, []);
  return Array.isArray(list) ? list.filter((d) => d && d.id) : [];
}

function writeDocs(list) {
  if (!writeStorage(DOCS_KEY, list)) throw new GuestStoreError(STORAGE_FAILED);
}

function readVersions() {
  const map = readStorage(VERSIONS_KEY, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function writeVersions(map) {
  if (!writeStorage(VERSIONS_KEY, map)) throw new GuestStoreError(STORAGE_FAILED);
}

function findRecord(id) {
  const record = readDocs().find((d) => d.id === id);
  if (!record) throw new GuestStoreError('Not found.', 404);
  return record;
}

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** Adds a version snapshot for a record (mutates the versions map). */
function pushVersion(map, record, reason, detail = '') {
  const list = Array.isArray(map[record.id]) ? map[record.id] : [];
  const versionNumber = (list[list.length - 1]?.versionNumber ?? 0) + 1;
  const version = {
    id: createId('ver'),
    versionNumber,
    reason,
    detail: detail || '',
    content: clone(record.content),
    structuredData: clone(record.structuredData ?? {}),
    createdAt: new Date().toISOString(),
  };
  map[record.id] = [...list, version].slice(-40);
  record.currentVersion = versionNumber;
  return version;
}

const summary = ({ content: _c, ...rest }) => rest;

export async function listDocuments() {
  return readDocs()
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((record) => fromApi(summary(record)));
}

export async function getDocument(id) {
  return fromApi(findRecord(id));
}

export async function createDocument(payload) {
  const body = toApiCreate(payload);
  const now = new Date().toISOString();
  const record = {
    ...body,
    id: createId('local'),
    createdAt: now,
    updatedAt: now,
    currentVersion: 0,
  };
  const versions = readVersions();
  pushVersion(versions, record, 'initial_version');
  writeDocs([record, ...readDocs()]);
  writeVersions(versions);
  return fromApi(record);
}

export async function updateDocument(current, changes, { versionReason, detail } = {}) {
  const body = toApiPatch(current, changes);
  const docs = readDocs();
  const index = docs.findIndex((d) => d.id === current.id);
  if (index === -1) throw new GuestStoreError('Not found.', 404);

  const record = { ...docs[index] };
  if (body.title !== undefined) record.title = body.title;
  if (body.status !== undefined) record.status = body.status;
  if (body.content !== undefined) record.content = body.content;
  if (body.structuredData !== undefined) record.structuredData = body.structuredData;
  if (body.metadata) record.metadata = { ...(record.metadata ?? {}), ...body.metadata };
  record.updatedAt = new Date().toISOString();

  const versions = readVersions();
  const version = versionReason
    ? pushVersion(versions, record, versionReason, detail ? String(detail).slice(0, 200) : '')
    : null;

  docs[index] = record;
  writeDocs(docs);
  if (version) writeVersions(versions);
  return { document: fromApi(record), version: version ? versionFromApi(version) : null };
}

export async function deleteDocument(id) {
  writeDocs(readDocs().filter((d) => d.id !== id));
  const versions = readVersions();
  delete versions[id];
  writeVersions(versions);
}

export async function listVersions(id) {
  const list = readVersions()[id] ?? [];
  return list.map(({ content: _c, structuredData: _s, ...rest }) => versionFromApi(rest));
}

export async function getVersion(id, versionId) {
  const version = (readVersions()[id] ?? []).find((v) => v.id === versionId);
  if (!version) throw new GuestStoreError('Not found.', 404);
  return versionFromApi(version);
}

export async function restoreVersion(id, versionId) {
  const docs = readDocs();
  const index = docs.findIndex((d) => d.id === id);
  if (index === -1) throw new GuestStoreError('Not found.', 404);
  const versions = readVersions();
  const source = (versions[id] ?? []).find((v) => v.id === versionId);
  if (!source) throw new GuestStoreError('Not found.', 404);

  const record = {
    ...docs[index],
    content: clone(source.content),
    structuredData: clone(source.structuredData ?? {}),
    updatedAt: new Date().toISOString(),
  };
  const version = pushVersion(versions, record, 'restored_version', `Version ${source.versionNumber}`);
  docs[index] = record;
  writeDocs(docs);
  writeVersions(versions);
  return { document: fromApi(record), version: versionFromApi(version) };
}
