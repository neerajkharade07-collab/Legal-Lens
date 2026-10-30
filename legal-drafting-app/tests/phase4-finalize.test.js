/**
 * Legal Drafting Phase 4 — finalization checklist, content hash, print document, exports.
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
  },
};
const clicks = [];
globalThis.document = {
  createElement: () => {
    const el = { click: () => clicks.push({ href: el.href, download: el.download }), remove: () => {} };
    return el;
  },
  body: { appendChild: () => {} },
};
URL.createObjectURL = () => 'blob:test';
URL.revokeObjectURL = () => {};

let calls = [];
let responder = () => ({ status: 500, body: { success: false, message: 'no responder' } });
globalThis.fetch = async (url, init = {}) => {
  const call = {
    url: String(url),
    method: init.method || 'GET',
    headers: init.headers || {},
    body: init.body ? JSON.parse(init.body) : undefined,
  };
  calls.push(call);
  const r = responder(call);
  const headers = new Headers(r.headers || {});
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    headers,
    json: async () => r.body,
    blob: async () => new Blob([r.bytes ?? '']),
  };
};

const { setStorageMode } = await import('../src/services/config.js');
const { setAccessToken, filenameFromDisposition } = await import('../src/services/apiClient.js');
const { runFinalizeChecklist } = await import('../src/utils/finalizeChecklist.js');
const { contentHash, stableStringify } = await import('../src/utils/contentHash.js');
const { buildPrintHtml, escapeHtml } = await import('../src/utils/printHtml.js');
const { paginateBlocks } = await import('../src/utils/paginate.js');
const { startsNewPage } = await import('../src/utils/pageBreak.js');
const { LEGAL_BLOCKS, legalBlockContent } = await import('../src/data/legalBlocks.js');
const { versionFromApi } = await import('../src/services/documentMapper.js');
const fin = await import('../src/services/finalizeService.js');

const ID = '65a1b2c3d4e5f6a7b8c9d0e1';
const p = (text, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: text ? [{ type: 'text', text }] : [] });
const h = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: text ? [{ type: 'text', text }] : [] });
const tok = (key, value = '') => ({ type: 'fieldToken', attrs: { key, label: key.toUpperCase(), value } });
const doc = (...content) => ({ type: 'doc', content });
const ids = (r) => r.findings.map((f) => f.id);

// ---------------------------------------------------------------- checklist

test('checklist: empty document and missing title are blocking', () => {
  const r = runFinalizeChecklist({ content: doc(p(''), p('   ')), title: '' });
  assert.deepEqual(ids(r).sort(), ['empty', 'no-title']);
  assert.equal(r.counts.blocking, 2);
  assert.equal(r.canFinalize, false);
  const none = runFinalizeChecklist({ content: undefined, title: 'X' });
  assert.deepEqual(ids(none), ['empty']);
});

test('checklist: placeholders, empty fields, empty headings and sections are warnings', () => {
  const r = runFinalizeChecklist({
    title: 'Rent agreement',
    typeId: 'rental-agreement',
    content: doc(
      h('RENT AGREEMENT', 1),
      p('This agreement is made at [PLACE] on 01/02/2026 between [NAME] and [NAME].'),
      p('Rent: TBD per month. Tenant: ', undefined),
      { type: 'paragraph', content: [{ type: 'text', text: 'Landlord: ' }, tok('landlordName')] },
      h(''),
      h('Deposit'),
      h('Term'),
      p('Eleven months. Signature: ________'),
    ),
  });
  assert.equal(r.canFinalize, true, 'warnings never block');
  const titles = r.findings.map((f) => f.title);
  assert.ok(titles.includes('Unresolved placeholder [PLACE]'));
  assert.ok(titles.includes('Unresolved placeholder [NAME] (2 times)'));
  assert.ok(titles.includes('Unresolved placeholder TBD'));
  const field = r.findings.find((f) => f.id === 'field-landlordName');
  assert.equal(field.level, 'warning');
  assert.deepEqual(field.location, { kind: 'token', key: 'landlordName' });
  assert.ok(ids(r).some((i) => i.startsWith('empty-heading')));
  const section = r.findings.find((f) => f.title === 'Section "Deposit" has no content');
  assert.equal(section.level, 'warning');
  assert.deepEqual(section.location, { kind: 'text', text: 'Deposit' });
  assert.ok(!r.findings.some((f) => f.title.includes('"Term"')), 'a section with text is fine');
  assert.ok(!ids(r).includes('no-signature'), 'a signature line was found');
  assert.ok(!ids(r).includes('no-date'), 'a date was found');
  assert.ok(ids(r).includes('blank-lines'));
  // navigation target for a placeholder is the exact marker text
  assert.equal(r.findings.find((f) => f.title.startsWith('Unresolved placeholder [PLACE]')).location.text, '[PLACE]');
});

test('checklist: signature check only for document types that are normally signed', () => {
  const content = doc(p('The deponent states the facts below. Dated 3 March 2026.'));
  assert.ok(!ids(runFinalizeChecklist({ content, title: 'A', typeId: 'affidavit' })).includes('no-signature'));
  const unsigned = doc(p('I state the facts below. 3 March 2026.'));
  assert.ok(ids(runFinalizeChecklist({ content: unsigned, title: 'A', typeId: 'affidavit' })).includes('no-signature'));
  assert.ok(!ids(runFinalizeChecklist({ content: unsigned, title: 'A', typeId: 'legal-notice' })).includes('no-signature'));
  assert.ok(!ids(runFinalizeChecklist({ content: unsigned, title: 'A' })).includes('no-signature'));
});

test('checklist: Hindi / Marathi signature and date words are recognised', () => {
  const r = runFinalizeChecklist({ content: doc(p('शपथपत्र'), p('दिनांक: ३ मार्च २०२६'), p('स्वाक्षरी: ________')), title: 'शपथपत्र', typeId: 'affidavit' });
  assert.ok(!ids(r).includes('no-signature'));
  assert.ok(!ids(r).includes('no-date'));
  assert.ok(r.words > 0);
});

test('checklist: informational items and no false positives on a complete document', () => {
  const clean = runFinalizeChecklist({
    title: 'Notice',
    content: doc(h('LEGAL NOTICE', 1), p('To Mr. Ravi Kumar, Pune. Date: 4 April 2026.'), p('My client demands payment within 15 days.')),
  });
  assert.deepEqual(clean.findings, []);
  assert.equal(clean.counts.warning, 0);
  const long = 'word '.repeat(600);
  const r = runFinalizeChecklist({ title: 'T', content: doc(p(long), p(''), p(''), p(''), p('end')) });
  assert.ok(ids(r).includes('no-headings'));
  assert.ok(ids(r).includes('long-paragraph'));
  assert.ok(ids(r).includes('empty-paragraphs'));
  assert.ok(ids(r).includes('no-date'));
  assert.ok(r.findings.filter((f) => ['no-headings', 'long-paragraph', 'empty-paragraphs', 'no-date'].includes(f.id)).every((f) => f.level === 'info'));
});

test('checklist never modifies the document', () => {
  const content = doc(h('A'), p('[NAME] signed'), { type: 'paragraph', content: [tok('x')] }, { type: 'pageBreak' });
  const before = JSON.stringify(content);
  runFinalizeChecklist({ content, title: 'T', typeId: 'affidavit' });
  assert.equal(JSON.stringify(content), before);
});

test('inserted legal blocks are valid nodes and their placeholders are flagged', () => {
  assert.ok(LEGAL_BLOCKS.length >= 3);
  for (const b of LEGAL_BLOCKS) {
    const nodes = legalBlockContent(b.id);
    assert.ok(Array.isArray(nodes) && nodes.length);
    nodes.forEach((n) => assert.equal(n.type, 'paragraph'));
    assert.notEqual(legalBlockContent(b.id), nodes, 'fresh copy each time');
  }
  assert.equal(legalBlockContent('nope'), null);
  const r = runFinalizeChecklist({ title: 'T', typeId: 'affidavit', content: doc(...legalBlockContent('signature')) });
  assert.ok(r.findings.some((f) => f.title.startsWith('Unresolved placeholder [NAME]')));
  assert.ok(!ids(r).includes('no-signature'));
});

// ---------------------------------------------------------------- content hash

test('content hash: same algorithm as the backend (golden values), key order irrelevant', async () => {
  // Golden values computed with backend services/documentFinalizeService.savedContentHash().
  const sample = { type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'नमस्ते [NAME] & <b>' }] }] };
  assert.equal(await contentHash(sample), '70143fdc61f11a9089386deac2733ecdc862525796d9cdb19dc3e0607bb4d0d4');
  assert.equal(await contentHash({ b: 1, a: [1, 'x', null, true] }), 'ecb73d12906ef1ff8df92255f5a2c370ccddf124400ea8f0fa0aa1a82a1fae23');
  assert.equal(await contentHash({ a: [1, 'x', null, true], b: 1 }), await contentHash({ b: 1, a: [1, 'x', null, true] }));
  assert.equal(stableStringify({ a: undefined, b: 2 }), '{"b":2}', 'undefined keys are dropped like JSON');
  assert.notEqual(await contentHash(doc(p('a'))), await contentHash(doc(p('b'))));
});

// ---------------------------------------------------------------- print document

test('print document: A4, escaped content, no scripts, whitelisted styles only', () => {
  const html = buildPrintHtml(
    doc(
      h('Title </h1><script>alert(1)</script>', 1),
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'x" onmouseover="y', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: '14pt; background:url(evil)', fontFamily: 'Arial' } }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'नमस्ते' }, tok('name'), tok('city', 'Pune')] },
      { type: 'paragraph', attrs: { pageBreakBefore: true }, content: [{ type: 'text', text: 'new page' }] },
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p('first')] }] },
      { type: 'mystery', content: [{ type: 'text', text: 'kept as text' }] },
    ),
    { title: 'Deed <img src=x onerror=alert(1)>', options: { margins: 'binding', fontSize: '14', lineSpacing: '2' } },
  );
  assert.ok(!/<script/i.test(html), 'no script element');
  assert.ok(!html.includes('<img'), 'title escaped (also in the CSS footer string)');
  const breakout = buildPrintHtml(doc(p('a')), { title: 'x</style><script>alert(1)</script>"' });
  assert.equal((breakout.match(/<\/style>/g) || []).length, 1, 'a title cannot close the style element');
  assert.ok(!/<script/i.test(breakout));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('x&quot; onmouseover=&quot;y'));
  assert.ok(!html.includes('background:url(evil)'), 'unsafe style value dropped');
  assert.ok(html.includes('font-family:Arial'));
  assert.ok(html.includes('size: A4') && html.includes('margin: 25mm 20mm 25mm 38mm'));
  assert.ok(html.includes('font-size: 14pt') && html.includes('line-height: 2'));
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes('नमस्ते') && html.includes('Pune'));
  assert.ok(html.includes('class="blank"'), 'an empty field prints as a blank line');
  assert.ok(html.includes('<p class="pb">new page</p>'), 'page break → break-before: page');
  assert.ok(html.includes('.pb { break-before: page'));
  assert.ok(html.includes('<ol><li><p>first</p></li></ol>'));
  assert.ok(html.includes('kept as text'), 'unknown nodes keep their text');
  assert.ok(html.includes('class="a-center"'));
  assert.ok(html.includes('counter(pages)'));
  const labels = buildPrintHtml(doc({ type: 'paragraph', content: [tok('name')] }), { options: { placeholders: 'label', pageNumbers: false, footerTitle: false } });
  assert.ok(labels.includes('[NAME]'));
  assert.ok(!labels.includes('counter(pages)'));
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('preview pagination: a page break starts a new page', () => {
  assert.deepEqual(paginateBlocks([{ height: 100 }, { height: 100, breakBefore: true }, { height: 100 }], 1000), [[0], [1, 2]]);
  assert.deepEqual(paginateBlocks([{ height: 100, breakBefore: true }], 1000), [[0]], 'no empty first page');
  assert.equal(startsNewPage({ type: 'paragraph', attrs: { pageBreakBefore: true } }), true);
  assert.equal(startsNewPage({ type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { pageBreakBefore: true } }] }] }), true);
  assert.equal(startsNewPage({ type: 'paragraph', attrs: { pageBreakBefore: null } }), false);
  const blocks = [{ height: 100 }, { height: 0, breakAfter: true }, { height: 100 }, { height: 100 }];
  assert.deepEqual(paginateBlocks(blocks, 1000), [[0, 1], [2, 3]]);
  assert.deepEqual(paginateBlocks([{ height: 10, breakAfter: true }], 1000), [[0]], 'no empty trailing page');
  assert.deepEqual(paginateBlocks([{ height: 600 }, { height: 600 }], 1000), [[0], [1]], 'unchanged without breaks');
});

// ---------------------------------------------------------------- services

test('download file names from Content-Disposition', () => {
  assert.equal(filenameFromDisposition(`attachment; filename="Rent-Agreement.docx"; filename*=UTF-8''%E0%A4%95%E0%A4%B0%E0%A4%BE%E0%A4%B0.docx`), 'करार.docx');
  assert.equal(filenameFromDisposition('attachment; filename="Notice.docx"'), 'Notice.docx');
  assert.equal(filenameFromDisposition('', 'fallback.docx'), 'fallback.docx');
  assert.equal(filenameFromDisposition(`attachment; filename*=UTF-8''%E0%A4`, 'x'), 'x', 'bad encoding falls back');
});

test('version mapping labels finalized versions as "Finalized Draft"', () => {
  const v = versionFromApi({ id: 'v1', versionNumber: 3, reason: 'finalized', detail: 'Finalized draft', createdAt: '2026-10-28T10:00:00Z', metadata: { finalizedAt: '2026-10-28T10:00:01Z' } });
  assert.equal(v.label, 'Finalized Draft');
  assert.equal(v.reason, 'finalized');
  assert.equal(v.finalized, true);
  assert.equal(v.finalizedAt, '2026-10-28T10:00:01Z');
  const plain = versionFromApi({ id: 'v2', versionNumber: 2, reason: 'manual_save', createdAt: 'x' });
  assert.equal(plain.finalized, undefined);
  for (const forbidden of [/legally approved/i, /court certified/i, /government verified/i, /lawyer approved/i]) {
    assert.ok(!forbidden.test(v.label));
  }
});

test('finalize and Word export need a signed-in account document', async () => {
  setStorageMode('guest');
  assert.equal(fin.canUseServerExport(ID), false);
  await assert.rejects(fin.finalizeSavedVersion(ID, { savedContent: doc(p('a')) }), /signed-in CASEONE/);
  await assert.rejects(fin.downloadDocx(ID), /signed-in CASEONE/);
  assert.deepEqual(await fin.listFinalized(ID), []);
  setStorageMode('account');
  assert.equal(fin.canUseServerExport('local-123'), false, 'a browser-only draft is never sent');
  assert.equal(fin.canUseServerExport(ID), true);
  assert.equal(calls.length, 0, 'no request was made');
});

test('finalize sends only the hash of the saved content and the warning count', async () => {
  setStorageMode('account');
  setAccessToken('tok-1');
  calls = [];
  const saved = doc(p('Final text'));
  responder = () => ({
    status: 201,
    body: { success: true, message: 'Saved as a Finalized Draft.', data: { created: true, finalized: { id: 'f1', versionNumber: 4, reason: 'finalized', metadata: { finalizedAt: '2026-10-28T10:00:00Z', title: 'Notice', warningsAcknowledged: 2 } }, document: { currentVersion: 4 } } },
  });
  const out = await fin.finalizeSavedVersion(ID, { savedContent: saved, warningsAcknowledged: 2 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.endsWith(`/documents/${ID}/finalize`));
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['expectedContentHash', 'warningsAcknowledged']);
  assert.equal(calls[0].body.expectedContentHash, await contentHash(saved));
  assert.equal(calls[0].body.warningsAcknowledged, 2);
  assert.equal(out.created, true);
  assert.equal(out.finalized.number, 4);
  assert.equal(out.finalized.warningsAcknowledged, 2);
});

test('finalize failures reject with the server message (no false success)', async () => {
  setStorageMode('account');
  responder = () => ({ status: 409, body: { success: false, code: 'document_changed', message: 'The saved document is not the version you are finalizing.' } });
  await assert.rejects(fin.finalizeSavedVersion(ID, { savedContent: doc(p('x')) }), (err) => err.status === 409 && /not the version/.test(err.message));
  responder = () => ({ status: 422, body: { success: false, code: 'blocking_issues', message: 'Fix the blocking issues first.' } });
  await assert.rejects(fin.finalizeSavedVersion(ID, { savedContent: doc(p('x')) }), (err) => err.status === 422);
});

test('finalized list exposes whether the saved document still matches', async () => {
  setStorageMode('account');
  responder = () => ({ status: 200, body: { success: true, data: { finalized: [{ id: 'f2', versionNumber: 5, matchesSaved: true, metadata: { finalizedAt: 't' } }, { id: 'f1', versionNumber: 4, matchesSaved: false, metadata: {} }] } } });
  const list = await fin.listFinalized(ID);
  assert.deepEqual(list.map((v) => [v.number, v.matchesSaved]), [[5, true], [4, false]]);
});

test('Word export: private authenticated download with layout options, errors surface', async () => {
  setStorageMode('account');
  setAccessToken('tok-2');
  calls = [];
  clicks.length = 0;
  responder = () => ({ status: 200, bytes: 'PK...', headers: { 'content-disposition': `attachment; filename="Notice.docx"`, 'x-export-unsupported': 'table' } });
  const out = await fin.downloadDocx(ID, { versionId: '65a1b2c3d4e5f6a7b8c9d0ff', options: { margins: 'binding', fontSize: '14', lineSpacing: '1.5', placeholders: 'label', pageNumbers: false } });
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].headers.Authorization, 'Bearer tok-2', 'token in the header');
  assert.ok(!calls[0].url.includes('tok-2'), 'never in the URL');
  const url = new URL(calls[0].url, 'http://x');
  assert.equal(url.pathname.endsWith(`/documents/${ID}/export/docx`), true);
  assert.deepEqual(Object.fromEntries(url.searchParams), { versionId: '65a1b2c3d4e5f6a7b8c9d0ff', margins: 'binding', fontSize: '14', lineSpacing: '1.5', placeholders: 'label', pageNumbers: 'false' });
  assert.deepEqual(clicks, [{ href: 'blob:test', download: 'Notice.docx' }]);
  assert.deepEqual(out.unsupported, ['table']);
  assert.equal(fin.exportQuery({ options: { margins: 'evil', fontSize: '99' } }), '', 'unknown options are not sent');

  responder = () => ({ status: 200, bytes: '', headers: { 'content-disposition': 'attachment; filename="a.docx"' } });
  await assert.rejects(fin.downloadDocx(ID), /empty/);
  responder = () => ({ status: 503, body: { success: false, code: 'docx_unavailable', message: 'Word export is not installed on the server.' } });
  await assert.rejects(fin.downloadDocx(ID), /not installed/);
});
