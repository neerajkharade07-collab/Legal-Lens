import { useCallback, useEffect, useRef, useState } from 'react';
import { exportService } from '../services';
import {
  canUseServerExport,
  downloadDocx,
  finalizeSavedVersion,
  listFinalized,
  printDocument,
} from '../services/finalizeService';
import { contentHash } from '../utils/contentHash';

const REFRESH_DELAY_MS = 700;

/**
 * Legal Drafting Phase 4 — document status, finalization and exports for one workspace.
 *
 * status.id:
 *   'draft'     — changes on this page are not saved yet (or the last save failed);
 *   'saved'     — the saved document is not a finalized snapshot;
 *   'finalized' — the saved document is exactly the latest Finalized Draft (server comparison).
 */
export function useFinalization({ document, ws, editor }) {
  const serverDoc = canUseServerExport(document.id);
  const [finalized, setFinalized] = useState([]);
  const [listStatus, setListStatus] = useState(serverDoc ? 'loading' : 'idle');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!serverDoc) return [];
    try {
      const list = await listFinalized(document.id);
      if (mounted.current) {
        setFinalized(list);
        setListStatus('ready');
      }
      return list;
    } catch {
      if (mounted.current) setListStatus('error');
      return null;
    }
  }, [serverDoc, document.id]);

  // Phase 6: ask the server once when the document opens (and after finalizing / when the dialog
  // opens) — not after every autosave, which doubled the number of requests while editing.
  useEffect(() => {
    if (!serverDoc) return undefined;
    const timer = setTimeout(refresh, REFRESH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [serverDoc, refresh, document.name]);

  // A save after the list was loaded means the saved text has changed since the snapshot, so it
  // no longer counts as the Finalized Draft (conservative: shown as "Saved Draft").
  const seenSaveRef = useRef(ws.lastSavedAt);
  useEffect(() => {
    if (ws.lastSavedAt === seenSaveRef.current) return;
    seenSaveRef.current = ws.lastSavedAt;
    setFinalized((list) => (list.some((v) => v.matchesSaved) ? list.map((v) => ({ ...v, matchesSaved: false })) : list));
  }, [ws.lastSavedAt]);

  const latest = finalized[0] ?? null;
  let status;
  if (ws.saveStatus !== 'saved') {
    status = {
      id: 'draft',
      label: 'Draft — not saved',
      detail: ws.saveStatus === 'failed' ? 'The last save failed — changes are only on this page.' : 'Changes not saved yet.',
    };
  } else if (latest?.matchesSaved) {
    status = { id: 'finalized', label: 'Finalized Draft', detail: `Version ${latest.number} — the saved document matches this finalized snapshot.` };
  } else {
    status = {
      id: 'saved',
      label: 'Saved Draft',
      detail: serverDoc ? 'Saved to your account. Not finalized.' : 'Saved in this browser only (Demo Mode).',
    };
  }

  const currentContent = useCallback(
    () => (editor && !editor.isDestroyed ? editor.getJSON() : document.workspace?.content),
    [editor, document.workspace],
  );

  /**
   * Save now, then finalize exactly the saved content. Rejects (nothing is created) when the save
   * fails, when the text changed during the save, or when the server refuses.
   */
  const finalize = useCallback(
    async ({ warningsAcknowledged = 0 } = {}) => {
      if (!serverDoc) throw new Error('Finalizing needs a document saved to a signed-in CASEONE account.');
      const before = currentContent();
      const result = await ws.save(); // rejects if the save did not reach the server
      const savedContent = result?.document?.workspace?.content ?? before;
      const [savedHash, nowHash] = await Promise.all([contentHash(savedContent), contentHash(currentContent())]);
      if (savedHash !== nowHash) {
        throw new Error('The document changed while it was being saved. Check it again, then finalize.');
      }
      const out = await finalizeSavedVersion(document.id, { savedContent, warningsAcknowledged });
      await Promise.all([refresh(), ws.reloadVersions?.()]);
      return out;
    },
    [serverDoc, currentContent, ws, document.id, refresh],
  );

  /** Word (.docx) built by the server from the saved document (or a finalized version). */
  const exportWord = useCallback(
    async (versionId) => {
      if (!versionId && ws.saveStatus !== 'saved') await ws.save();
      return downloadDocx(document.id, { versionId, options: exportService.loadPrintOptions() });
    },
    [document.id, ws],
  );

  /** Print dialog (→ "Save as PDF") of the given content, or of the current document. */
  const printPdf = useCallback(
    (content, title) =>
      printDocument(content ?? currentContent(), {
        title: title ?? document.name,
        options: exportService.loadPrintOptions(),
      }),
    [currentContent, document.name],
  );

  return { serverDoc, status, finalized, listStatus, latest, refresh, finalize, exportWord, printPdf, currentContent };
}
