/**
 * Legal Drafting Phase 6 — save reliability: stale-save protection, version errors, conflict
 * snapshots, all document pages, keepalive size limit.
 *   npm run test:drafting
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  },
};
let calls = [];
let responder = () => ({ status: 500, body: { success: false, message: 'no responder' } });
globalThis.fetch = async (url, init = {}) => {
  const call = { url: String(url), method: init.method || 'GET', keepalive: init.keepalive, rawBody: init.body, body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(call);
  const r = responder(call);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: new Headers(), json: async () => r.body };
};

const { setStorageMode } = await import('../src/services/config.js');
const { setAccessToken, apiRequest, ApiError } = await import('../src/services/apiClient.js');
const docs = await import('../src/services/documentsService.js');
const { fromApi } = await import('../src/services/documentMapper.js');

const ID = '65a1b2c3d4e5f6a7b8c9d0e1';
const REV_A = 'a'.repeat(64);
const REV_B = 'b'.repeat(64);
const apiDoc = (over = {}) => ({
  id: ID,
  title: 'Affidavit',
  documentType: 'affidavit',
  source: 'created_draft',
  language: 'english',
  status: 'draft',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Saved text' }] }] },
  structuredData: { deponentName: 'Meera' },
  metadata: {},
  currentVersion: 1,
  revision: REV_A,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  ...over,
});
const current = { id: ID, name: 'Affidavit', typeId: 'affidavit', setup: { description: '' } };
const workspace = (text) => ({ workspace: { content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, fields: { deponentName: 'Meera' }, formatting: {} } });

function account() {
  setStorageMode('account');
  setAccessToken('tok-6');
  calls = [];
}

test('the saved revision is carried with every full document', () => {
  assert.equal(fromApi(apiDoc()).revision, REV_A);
  assert.equal('revision' in fromApi({ ...apiDoc(), revision: undefined, content: undefined }), false);
});

test('save sends baseRevision only with text changes, read when the request is sent', async () => {
  account();
  responder = () => ({ status: 200, body: { success: true, data: { document: apiDoc({ revision: REV_B }), version: null } } });
  let rev = REV_A;
  const out = await docs.updateDocument(current, workspace('New text'), { baseRevision: () => rev });
  assert.equal(calls[0].body.baseRevision, REV_A);
  assert.equal(out.document.revision, REV_B);
  rev = REV_B;
  await docs.updateDocument(current, workspace('Newer text'), { baseRevision: () => rev });
  assert.equal(calls[1].body.baseRevision, REV_B, 'the latest revision at send time');
  await docs.updateDocument(current, { name: 'Renamed' }, { baseRevision: () => rev });
  assert.equal(calls[2].body.baseRevision, undefined, 'a rename never conflicts');
  await docs.updateDocument(current, workspace('x'));
  assert.equal(calls[3].body.baseRevision, undefined, 'callers without a revision keep the old behaviour');
});

test('a conflict is reported as a conflict, with the newer saved document — never as saved', async () => {
  account();
  responder = () => ({
    status: 409,
    body: { success: false, code: 'document_conflict', message: 'This document was changed somewhere else…', data: { document: apiDoc({ revision: REV_B }) } },
  });
  let caught;
  try {
    await docs.updateDocument(current, workspace('Stale text'), { baseRevision: () => REV_A });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ApiError);
  assert.equal(docs.isConflictError(caught), true);
  assert.equal(caught.data.document.revision, REV_B);
  assert.equal(fromApi(caught.data.document).workspace.content.content[0].content[0].text, 'Saved text');
  // other failures are not conflicts
  responder = () => ({ status: 500, body: { success: false, message: 'Server error' } });
  await assert.rejects(docs.updateDocument(current, workspace('x')), (err) => !docs.isConflictError(err) && err.status === 500);
  responder = () => ({ status: 409, body: { success: false, code: 'other', message: 'x' } });
  await assert.rejects(docs.updateDocument(current, workspace('x')), (err) => !docs.isConflictError(err));
});

test('"saved but the version was not recorded" is passed through', async () => {
  account();
  responder = () => ({ status: 200, body: { success: true, message: 'Document saved. The version could not be recorded.', data: { document: apiDoc(), version: null, versionError: true } } });
  const out = await docs.updateDocument(current, workspace('t'), { versionReason: 'manual_save' });
  assert.equal(out.versionError, true);
  assert.equal(out.version, null);
});

test('conflict snapshots: this page’s text, or the saved text — never a document change', async () => {
  account();
  responder = (c) => ({ status: 201, body: { success: true, data: { version: { id: 'v9', versionNumber: 9, reason: 'manual_save', detail: c.body.detail, createdAt: 'x' } } } });
  const v = await docs.snapshotVersion(current, { content: { type: 'doc', content: [] }, fields: { deponentName: 'Meera' }, detail: 'Unsaved text from another tab (save conflict)' });
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.endsWith(`/documents/${ID}/versions`));
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['content', 'detail', 'reason', 'structuredData']);
  assert.equal(calls[0].body.structuredData.deponentName, 'Meera');
  assert.equal(v.number, 9);
  await docs.snapshotVersion(current, { detail: 'Text saved elsewhere' });
  assert.deepEqual(Object.keys(calls[1].body).sort(), ['detail', 'reason'], 'snapshot of the saved text');
  assert.ok(calls.every((c) => c.method === 'POST' && !c.url.includes('PATCH')));
});

test('My Documents loads every page, not only the first 100', async () => {
  account();
  const page = (n, total) => ({
    status: 200,
    body: { success: true, data: { documents: Array.from({ length: n === 3 ? 20 : 100 }, (_, i) => ({ ...apiDoc(), content: undefined, id: `${String(n).padStart(2, '0')}${'0'.repeat(19)}${String(i).padStart(3, '0')}` })), pagination: { page: n, totalPages: total } } },
  });
  responder = (c) => page(Number(new URL(c.url, 'http://x').searchParams.get('page') || 1), 3);
  const list = await docs.listDocuments();
  assert.equal(list.length, 220);
  assert.deepEqual(calls.map((c) => c.url.replace(/^.*\/api/, '')), [
    '/documents?limit=100&sort=updated_desc',
    '/documents?limit=100&sort=updated_desc&page=2',
    '/documents?limit=100&sort=updated_desc&page=3',
  ]);
  calls = [];
  responder = () => page(1, 1);
  assert.equal((await docs.listDocuments()).length, 100);
  assert.equal(calls.length, 1, 'one request when everything fits on one page');
});

test('save on page close: keepalive only for bodies browsers accept (under ~64 KB)', async () => {
  account();
  responder = () => ({ status: 200, body: { success: true, data: {} } });
  await apiRequest('/documents/x', { method: 'PATCH', body: { content: 'small' }, keepalive: true });
  assert.equal(calls[0].keepalive, true);
  await apiRequest('/documents/x', { method: 'PATCH', body: { content: 'x'.repeat(70000) }, keepalive: true });
  assert.equal(calls[1].keepalive, false, 'large body sent as a normal request instead of failing');
  await apiRequest('/documents/x', { method: 'PATCH', body: { content: 'small' } });
  assert.equal(calls[2].keepalive, false);
});

test('Demo Mode is unaffected: no requests, no revision, no snapshots', async () => {
  setStorageMode('guest');
  calls = [];
  const created = await docs.createDocument({ name: 'Demo', typeId: 'affidavit', status: 'draft' });
  await docs.updateDocument(created, workspace('Demo text'), { baseRevision: () => REV_A });
  assert.equal(await docs.snapshotVersion(created, { detail: 'x' }), null);
  assert.equal(calls.length, 0);
});

test('opening a document is not an edit: default editor attributes do not count as changes', async () => {
  const { canonicalKey } = await import('../src/utils/contentCanonical.js');
  const saved = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start.' }] }] };
  const opened = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null, pageBreakBefore: null }, content: [{ type: 'text', text: 'Start.' }] }] };
  assert.equal(canonicalKey(opened, { a: '1' }), canonicalKey(saved, { a: '1' }));
  const aligned = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'center', pageBreakBefore: null }, content: [{ type: 'text', text: 'Start.' }] }] };
  assert.notEqual(canonicalKey(aligned), canonicalKey(saved), 'a real attribute change counts');
  const broken = { type: 'doc', content: [{ type: 'paragraph', attrs: { pageBreakBefore: true }, content: [{ type: 'text', text: 'Start.' }] }] };
  assert.notEqual(canonicalKey(broken), canonicalKey(saved), 'a page break counts');
  assert.notEqual(canonicalKey(saved, { a: '1' }), canonicalKey(saved, { a: '2' }), 'a case-detail change counts');
  assert.notEqual(canonicalKey(saved, {}, { lineHeight: 1.5 }), canonicalKey(saved, {}, { lineHeight: 2 }), 'a formatting change counts');
  assert.equal(canonicalKey({ b: 1, a: 2 }), canonicalKey({ a: 2, b: 1 }), 'key order does not count');
});
