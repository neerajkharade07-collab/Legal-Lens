/**
 * Legal Drafting Phase 4 — finalize, Word export and print/PDF.
 *
 *  - finalizeSavedVersion: records the CURRENT SAVED content as an immutable "Finalized Draft"
 *    version on the server. The server refuses if the saved content differs from what the user
 *    just saved (hash check), so an unsaved or failed draft is never finalized.
 *  - downloadDocx: a real .docx built by the CASEONE server for the owner (signed-in account
 *    documents only), downloaded with the Authorization header — never a public link.
 *  - printDocument: the browser's print dialog for the document only (A4, native pagination);
 *    "Save as PDF" there writes the PDF.
 * Every failure rejects with an honest message; nothing reports success that did not happen.
 */
import { apiRequest, apiDownload } from './apiClient';
import { getStorageMode, isGuestId } from './config';
import { contentHash } from '../utils/contentHash';
import { buildPrintHtml, printHtmlDocument } from '../utils/printHtml';

/** Finalize and Word export need a signed-in account document (saved on the server). */
export function canUseServerExport(documentId) {
  return getStorageMode() === 'account' && Boolean(documentId) && !isGuestId(documentId);
}

function requireAccount(documentId) {
  if (!canUseServerExport(documentId)) {
    throw new Error('This needs a signed-in CASEONE customer or lawyer account and a document saved to it.');
  }
}

const enc = encodeURIComponent;

/** Server summary of a finalized version → UI shape. */
export function finalizedFromApi(v) {
  return {
    id: v.id,
    number: v.versionNumber,
    finalizedAt: v.metadata?.finalizedAt ?? v.createdAt,
    title: v.metadata?.title ?? '',
    warningsAcknowledged: v.metadata?.warningsAcknowledged ?? 0,
    previousVersion: v.metadata?.previousVersion ?? null,
    /** The saved document is still exactly this snapshot (list endpoint only). */
    matchesSaved: v.matchesSaved === true,
  };
}

/**
 * @param {string} documentId
 * @param {{ savedContent: object, warningsAcknowledged?: number }} input — savedContent is the
 *   content returned by the save that has just succeeded.
 * @returns {Promise<{ finalized, created: boolean, document: { updatedAt, currentVersion } }>}
 */
export async function finalizeSavedVersion(documentId, { savedContent, warningsAcknowledged = 0 }) {
  requireAccount(documentId);
  const expectedContentHash = await contentHash(savedContent);
  const json = await apiRequest(`/documents/${enc(documentId)}/finalize`, {
    method: 'POST',
    body: { expectedContentHash, warningsAcknowledged },
  });
  return { ...json.data, finalized: finalizedFromApi(json.data.finalized), message: json.message };
}

export async function listFinalized(documentId) {
  if (!canUseServerExport(documentId)) return [];
  const json = await apiRequest(`/documents/${enc(documentId)}/finalized`);
  return json.data.finalized.map(finalizedFromApi);
}

/** Print options (court-preview preferences) → Word export query. */
export function exportQuery({ versionId, options = {} } = {}) {
  const q = new URLSearchParams();
  if (versionId) q.set('versionId', versionId);
  if (['standard', 'narrow', 'binding'].includes(options.margins)) q.set('margins', options.margins);
  if (['12', '13', '14'].includes(String(options.fontSize))) q.set('fontSize', String(options.fontSize));
  if (['1', '1.15', '1.5', '2'].includes(String(options.lineSpacing))) q.set('lineSpacing', String(options.lineSpacing));
  if (['blank', 'label'].includes(options.placeholders)) q.set('placeholders', options.placeholders);
  if (options.pageNumbers === false) q.set('pageNumbers', 'false');
  const s = q.toString();
  return s ? `?${s}` : '';
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Downloads the Word file built by the server from the SAVED document (or a version).
 * @returns {Promise<{ filename: string, unsupported: string[] }>}
 */
export async function downloadDocx(documentId, { versionId, options } = {}) {
  requireAccount(documentId);
  const { blob, filename, headers } = await apiDownload(`/documents/${enc(documentId)}/export/docx${exportQuery({ versionId, options })}`);
  if (!blob.size) throw new Error('The Word file was empty. Please try again.');
  saveBlob(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
  const unsupported = (headers.get('x-export-unsupported') || '').split(',').filter(Boolean);
  return { filename, unsupported };
}

/** Print dialog with the document only ("Save as PDF" writes the PDF). */
export function printDocument(content, { title, options } = {}) {
  return printHtmlDocument(buildPrintHtml(content, { title, options }));
}
