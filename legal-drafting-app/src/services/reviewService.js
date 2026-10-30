/**
 * Legal Drafting Phase 3 — document review for ACCOUNT documents (signed-in customer or lawyer).
 *
 *  - runAiReview: Document Health, Clause Review, Compliance Review (AI on the CASEONE server)
 *  - askResearch: contextual explanation of a question about the document (AI, not sourced)
 *  - checkCitations: rule-based extraction and checks of legal references (no AI)
 *
 * Every call is read-only on the server: nothing is saved and the document is never changed.
 * Failures reject with the server's honest message — there is never a demo or sample result
 * in place of a failed request. Demo Mode (signed out, browser-only drafts) keeps the
 * existing clearly-labelled demo tools.
 */
import { apiRequest } from './apiClient';
import { getStorageMode, isGuestId } from './config';

export const MAX_QUESTION_LENGTH = 1000;
export const MAX_SELECTION_LENGTH = 8000;
export const MAX_DOCUMENT_TEXT_LENGTH = 60000;

/** Real review is available for a signed-in account document. */
export function canUseAiReview(documentId) {
  return getStorageMode() === 'account' && Boolean(documentId) && !isGuestId(documentId);
}

function guard(documentId, documentText) {
  if (!canUseAiReview(documentId)) {
    throw new Error('Document review needs a signed-in CASEONE customer or lawyer account and a document saved to it.');
  }
  if (documentText.length > MAX_DOCUMENT_TEXT_LENGTH) {
    throw new Error('This document is too long to review in one request.');
  }
}

/** kind: 'health' | 'clauses' | 'compliance' */
export async function runAiReview(kind, { documentId, documentText = '' }) {
  guard(documentId, documentText);
  const json = await apiRequest('/drafting/review', { method: 'POST', body: { documentId, kind, documentText } });
  return json.data;
}

export async function checkCitations({ documentId, documentText = '' }) {
  guard(documentId, documentText);
  const json = await apiRequest('/drafting/citations', { method: 'POST', body: { documentId, documentText } });
  return json.data;
}

export async function askResearch({ documentId, question, selection = '', documentText = '' }) {
  guard(documentId, documentText);
  const q = String(question ?? '').trim();
  if (q.length < 3) throw new Error('Type a question first.');
  if (q.length > MAX_QUESTION_LENGTH) throw new Error(`The question is too long (limit ${MAX_QUESTION_LENGTH} characters).`);
  const json = await apiRequest('/drafting/research', {
    method: 'POST',
    body: { documentId, question: q, selection: selection.slice(0, MAX_SELECTION_LENGTH), documentText },
  });
  return json.data;
}
