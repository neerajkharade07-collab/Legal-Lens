/**
 * Legal Drafting Phase 3 — review services (frontend side).
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
let calls = [];
let responder = () => ({ status: 500, body: { success: false, message: 'no responder' } });
globalThis.fetch = async (url, init = {}) => {
  const call = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(call);
  const r = responder(call);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

const { setStorageMode } = await import('../src/services/config.js');
const review = await import('../src/services/reviewService.js');
const { setAccessToken } = await import('../src/services/apiClient.js');
const { planClauseAccept } = await import('../src/utils/reviewText.js');

const ID = '65a1b2c3d4e5f6a7b8c9d0e1';

test('real review only for a signed-in account document (never Demo Mode / browser drafts)', () => {
  setStorageMode('guest');
  assert.equal(review.canUseAiReview(ID), false);
  setStorageMode('checking');
  assert.equal(review.canUseAiReview(ID), false);
  setStorageMode('account');
  assert.equal(review.canUseAiReview(ID), true);
  assert.equal(review.canUseAiReview('local-1a2b3c'), false);
  assert.equal(review.canUseAiReview(undefined), false);
});

test('runAiReview / checkCitations / askResearch call the Phase 3 endpoints with the document id and current text', async () => {
  setStorageMode('account');
  setAccessToken('tok');
  calls = [];
  responder = () => ({ status: 200, body: { success: true, data: { findings: [], meta: { source: 'ai' } } } });
  const data = await review.runAiReview('health', { documentId: ID, documentText: 'Text' });
  assert.equal(data.meta.source, 'ai');
  assert.deepEqual([calls[0].method, calls[0].url.replace(/^.*\/api/, ''), calls[0].body], ['POST', '/drafting/review', { documentId: ID, kind: 'health', documentText: 'Text' }]);
  responder = () => ({ status: 200, body: { success: true, data: { citations: [], meta: { source: 'rules' } } } });
  await review.checkCitations({ documentId: ID, documentText: 'Section 5' });
  assert.equal(calls[1].url.replace(/^.*\/api/, ''), '/drafting/citations');
  responder = () => ({ status: 200, body: { success: true, data: { answer: 'x', meta: { source: 'ai' } } } });
  await review.askResearch({ documentId: ID, question: '  What is a licence?  ', selection: 'abc', documentText: 'T' });
  assert.deepEqual(calls[2].body, { documentId: ID, question: 'What is a licence?', selection: 'abc', documentText: 'T' });
});

test('failures are reported, never replaced by sample results', async () => {
  setStorageMode('account');
  setAccessToken('tok');
  responder = () => ({ status: 502, body: { success: false, code: 'ai_ungrounded', message: 'The AI answer referred to laws … not shown.' } });
  await assert.rejects(review.runAiReview('compliance', { documentId: ID, documentText: 'x' }), /not shown/);
  responder = () => ({ status: 429, body: { success: false, code: 'rate_limited', message: 'Too many AI drafting requests.' } });
  await assert.rejects(review.askResearch({ documentId: ID, question: 'Why?', documentText: 'x' }), /Too many/);
});

test('requests are refused locally before sending when not allowed or too large', async () => {
  calls = [];
  setStorageMode('guest');
  await assert.rejects(review.runAiReview('health', { documentId: ID, documentText: 'x' }), /signed-in CASEONE customer or lawyer/);
  setStorageMode('account');
  await assert.rejects(review.runAiReview('health', { documentId: ID, documentText: 'x'.repeat(60001) }), /too long/);
  await assert.rejects(review.askResearch({ documentId: ID, question: 'a', documentText: 'x' }), /Type a question/);
  await assert.rejects(review.askResearch({ documentId: ID, question: 'x'.repeat(1001), documentText: 'x' }), /too long/);
  assert.equal(calls.length, 0);
});

test('accepting an improved clause: only when the original text is still exactly in the document', () => {
  const proposal = { original: 'The rent is Rs. 18,000.', text: 'The monthly rent is Rs. 18,000.' };
  assert.deepEqual(planClauseAccept(proposal, { from: 10, to: 33, text: 'The rent is Rs. 18,000.' }), {
    type: 'replace',
    range: { from: 10, to: 33 },
    expected: 'The rent is Rs. 18,000.',
    replacement: 'The monthly rent is Rs. 18,000.',
  });
  assert.equal(planClauseAccept(proposal, null).type, 'error', 'text gone');
  assert.equal(planClauseAccept(proposal, { from: 1, to: 24, text: 'the rent is rs. 18,000.' }).type, 'error', 'changed (case)');
  assert.equal(planClauseAccept(null, { from: 1, to: 2, text: 'x' }).type, 'error');
});
