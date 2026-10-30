/**
 * Legal Drafting Phase 1 — unit tests for the document storage rules (no browser,
 * no backend: fetch and localStorage are replaced by in-memory fakes).
 *
 *   npm run test:phase1        (bundles with esbuild, which Vite already installs)
 *
 * Covers: signed-in → API only, signed-out → browser only, no silent fallback when a
 * session ends, honest errors (401 / 429 / 500), AI is account-only, and the
 * duplicate-/retry-safe, non-destructive import of browser drafts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------- in-memory browser ----------
const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
globalThis.localStorage = globalThis.window.localStorage;

let calls = [];
let responder = () => ({ status: 500, body: { success: false, message: 'no responder' } });
globalThis.fetch = async (url, init = {}) => {
  const call = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(call);
  const r = responder(call);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

const { setStorageMode, saveLocation, isGuestId } = await import('../src/services/config.js');
const docs = await import('../src/services/documentsService.js');
const guest = await import('../src/services/guestDocumentStore.js');
const { setAccessToken } = await import('../src/services/apiClient.js');

const ACCOUNT_ID = '65a1b2c3d4e5f6a7b8c9d0e1';
const apiDoc = (over = {}) => ({
  id: ACCOUNT_ID, title: 'Rent agreement', documentType: 'rental_agreement', source: 'created_draft',
  language: 'english', status: 'draft', contentFormat: 'tiptap_json',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
  structuredData: {}, metadata: {}, currentVersion: 1, createdAt: '2026-10-25T00:00:00Z', updatedAt: '2026-10-25T00:00:00Z', ...over,
});
const guestKeys = () => [...mem.keys()].filter((k) => k.includes('guest-document'));
const snapshot = () => JSON.stringify(guestKeys().map((k) => [k, mem.get(k)]));

function reset() {
  mem.clear();
  calls = [];
  setAccessToken(null);
}

test('ids and save-location labels follow the session', () => {
  assert.equal(isGuestId('local-abc-123'), true);
  assert.equal(isGuestId(ACCOUNT_ID), false);
  setStorageMode('guest');
  assert.match(saveLocation(), /this browser/);
  setStorageMode('account');
  assert.equal(saveLocation(), 'to your account');
  setStorageMode('checking');
  assert.doesNotMatch(saveLocation(), /account|browser/);
});

test('signed out (Demo Mode): documents stay in this browser and the API is never called', async () => {
  reset();
  setStorageMode('guest');
  const created = await docs.createDocument({ name: 'Demo affidavit', typeId: 'affidavit', status: 'draft' });
  assert.ok(isGuestId(created.id));
  const list = await docs.listDocuments();
  assert.equal(list.length, 1);
  await docs.updateDocument(created, { name: 'Demo affidavit 2' }, { versionReason: 'manual_save' });
  assert.equal((await docs.getDocument(created.id)).name, 'Demo affidavit 2');
  assert.equal(calls.length, 0, 'no network request in Demo Mode');
});

test('signed out: AI drafting is refused before any request', async () => {
  reset();
  setStorageMode('guest');
  await assert.rejects(() => docs.generateAiDraft({ typeId: 'affidavit', language: 'en', description: 'x' }), /signed-in CASEONE customer or lawyer/);
  assert.equal(calls.length, 0);
});

test('signed out: an account document is never saved in the browser instead', async () => {
  reset();
  setStorageMode('guest');
  const before = snapshot();
  await assert.rejects(
    () => docs.updateDocument({ id: ACCOUNT_ID, name: 'x' }, { name: 'y' }),
    (err) => err.code === 'sign-in-required' && /Sign in again/.test(err.message),
  );
  await assert.rejects(() => docs.deleteDocument(ACCOUNT_ID), (err) => err.code === 'sign-in-required');
  assert.equal(snapshot(), before, 'browser storage unchanged');
  assert.equal(calls.length, 0);
});

test('signed in: browser-only drafts are not opened or saved as account documents', async () => {
  reset();
  setStorageMode('account');
  await assert.rejects(() => docs.getDocument('local-abc-12345'), (err) => err.code === 'browser-only');
  assert.equal(calls.length, 0);
});

test('while the session is loading nothing is created anywhere', async () => {
  reset();
  setStorageMode('checking');
  await assert.rejects(() => docs.createDocument({ name: 'x', typeId: 'affidavit' }), (err) => err.code === 'checking');
  assert.equal(calls.length, 0);
  assert.equal(guestKeys().length, 0);
});

test('signed in: every operation goes to the API (documents, versions, AI)', async () => {
  reset();
  setStorageMode('account');
  setAccessToken('test-token');
  responder = (c) => {
    if (c.url.endsWith('/documents?limit=100&sort=updated_desc')) return { status: 200, body: { success: true, data: { documents: [apiDoc()] } } };
    if (c.method === 'POST' && c.url.endsWith('/documents')) return { status: 201, body: { success: true, data: { document: apiDoc() } } };
    if (c.method === 'PATCH') return { status: 200, body: { success: true, data: { document: apiDoc({ title: 'Renamed' }), version: null } } };
    if (c.url.endsWith('/drafting/generate')) return { status: 201, body: { success: true, data: { document: apiDoc({ metadata: { aiGenerated: true } }) } } };
    return { status: 404, body: { success: false, message: 'Not found.' } };
  };
  assert.equal((await docs.listDocuments()).length, 1);
  await docs.createDocument({ name: 'Rent agreement', typeId: 'rental-agreement' });
  const r = await docs.updateDocument({ id: ACCOUNT_ID, name: 'Rent agreement', typeId: 'rental-agreement' }, { name: 'Renamed' });
  assert.equal(r.document.name, 'Renamed');
  const ai = await docs.generateAiDraft({ typeId: 'rental-agreement', language: 'en', description: 'Rent flat in Pune' });
  assert.equal(ai.aiGenerated, true);
  assert.deepEqual(calls.map((c) => c.method + ' ' + c.url.replace(/^.*\/api/, '')), [
    'GET /documents?limit=100&sort=updated_desc',
    'POST /documents',
    'PATCH /documents/' + ACCOUNT_ID,
    'POST /drafting/generate',
  ]);
  assert.equal(guestKeys().length, 0, 'nothing written to browser document storage');
});

test('signed in: a failed save is reported as failed (500, 429, expired session) — never as saved', async () => {
  reset();
  setStorageMode('account');
  setAccessToken('test-token');
  const current = { id: ACCOUNT_ID, name: 'Doc', typeId: 'affidavit' };

  responder = () => ({ status: 500, body: { success: false, message: 'The server had a problem.' } });
  await assert.rejects(() => docs.updateDocument(current, { name: 'x' }), (e) => e.status === 500);

  responder = () => ({ status: 429, body: { success: false, code: 'ai_quota', message: "The AI service's usage limit has been reached (quota or rate limit). Please try again later. Nothing was saved." } });
  await assert.rejects(() => docs.generateAiDraft({ typeId: 'affidavit', language: 'en', description: 'x' }), /usage limit has been reached/);

  // access token rejected AND the refresh cookie no longer works → session ended
  responder = () => ({ status: 401, body: { success: false, message: 'Not authenticated.' } });
  await assert.rejects(() => docs.updateDocument(current, { name: 'x' }), (e) => e.status === 401 && /session has ended/.test(e.message));
  assert.equal(guestKeys().length, 0, 'never saved in the browser instead');
});

test('browser drafts: listed per account, samples and already-imported drafts left out', async () => {
  reset();
  setStorageMode('guest');
  const a = await guest.createDocument({ name: 'Demo one', typeId: 'affidavit' });
  await guest.createDocument({ name: 'Demo two', typeId: 'fir-complaint' });
  mem.set('legal-lens:documents:v1', JSON.stringify([
    { id: 'doc-legacy-0001', name: 'Old draft', status: 'draft', typeId: 'affidavit' },
    { id: 'doc-sample-0001', name: 'Sample', status: 'draft', isSample: true },
  ]));
  const list = docs.listBrowserDrafts('user-1');
  assert.deepEqual(list.map((i) => i.name).sort(), ['Demo one', 'Demo two', 'Old draft']);
  assert.ok(list.find((i) => i.name === 'Demo one').guestImportId === a.id);
  assert.equal(docs.listBrowserDrafts(null).length, 0, 'nothing offered without an account');
});

test('import: confirmed copy, retry-safe (same id), marked only after success, browser copies untouched', async () => {
  reset();
  setStorageMode('guest');
  const g = await guest.createDocument({ name: 'Demo notice', typeId: 'general-document' });
  const before = snapshot();
  const [item] = docs.listBrowserDrafts('user-1');

  setStorageMode('account');
  setAccessToken('test-token');
  // 1st attempt: server error → not marked as imported
  responder = () => ({ status: 500, body: { success: false, message: 'The server had a problem.' } });
  await assert.rejects(() => docs.importBrowserDraft('user-1', item));
  assert.equal(docs.listBrowserDrafts('user-1').length, 1, 'still offered after a failure');

  // retry: imported
  responder = () => ({ status: 201, body: { success: true, data: { document: apiDoc({ title: 'Demo notice' }), imported: true, alreadyImported: false } } });
  const r1 = await docs.importBrowserDraft('user-1', item);
  assert.equal(r1.alreadyImported, false);
  // a third press (e.g. another tab): the server says it already exists
  responder = () => ({ status: 200, body: { success: true, data: { document: apiDoc({ title: 'Demo notice' }), imported: false, alreadyImported: true } } });
  const r2 = await docs.importBrowserDraft('user-1', item);
  assert.equal(r2.alreadyImported, true);

  const posted = calls.filter((c) => c.url.endsWith('/documents/import'));
  assert.equal(posted.length, 3);
  assert.ok(posted.every((c) => c.body.guestImportId === g.id), 'the same browser id every time');
  assert.equal(posted[0].body.title, 'Demo notice');
  assert.equal(posted[0].body.content.type, 'doc', 'full content is sent');
  assert.equal(docs.listBrowserDrafts('user-1').length, 0, 'no longer offered to this account');
  assert.equal(docs.listBrowserDrafts('user-2').length, 1, 'another account on this browser is offered it separately');
  assert.equal(snapshot(), before, 'browser copy not changed or deleted');
});

test('import is refused when not signed in (no request)', async () => {
  reset();
  setStorageMode('guest');
  await assert.rejects(() => docs.importBrowserDraft('user-1', { guestImportId: 'local-x-123456', kind: 'demo' }), (e) => e.code === 'sign-in-required');
  assert.equal(calls.length, 0);
});
