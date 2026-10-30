import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DocumentsContext } from './contexts';
import { documentsService, documentStorageService } from '../services';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

/**
 * The current user's documents: a signed-in customer's or lawyer's documents from
 * the CASEONE backend, or — signed out — the Demo Mode drafts kept in this browser.
 * The list is reloaded whenever the session changes, so documents from the two
 * places are never mixed.
 *
 * The list holds summaries (no content). `loadDocument(id)` fetches a full
 * document (content + case details) for the workspace or a preview.
 * status: 'idle' (session still loading) | 'loading' | 'ready' | 'error'
 */
export function DocumentsProvider({ children }) {
  const { status: authStatus } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const docsRef = useRef(documents);
  docsRef.current = documents;
  // PATCHes for one document are sent strictly in order.
  const queues = useRef(new Map());

  const enqueue = useCallback((id, task) => {
    const previous = queues.current.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(task);
    queues.current.set(id, next);
    return next;
  }, []);

  const merge = useCallback((id, patch) => {
    setDocuments((current) => current.map((doc) => (doc.id === id ? { ...doc, ...patch } : doc)));
  }, []);

  const upsert = useCallback((doc) => {
    setDocuments((current) => {
      const exists = current.some((d) => d.id === doc.id);
      return exists
        ? current.map((d) => (d.id === doc.id ? { ...d, ...doc } : d))
        : [doc, ...current];
    });
  }, []);

  // Only the newest list request may fill the list (the session can change while one is in flight).
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setStatus('loading');
    setError(null);
    try {
      const list = await documentsService.listDocuments();
      if (seq !== loadSeq.current) return;
      setDocuments(list);
      setStatus('ready');
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setError(err?.message || 'Could not load your documents.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // Signed in → account documents; signed out → Demo Mode (browser-only) drafts.
    if (authStatus === 'authenticated' || authStatus === 'anonymous') {
      setDocuments([]);
      load();
    } else {
      loadSeq.current += 1;
      setDocuments([]);
      setStatus('idle');
    }
  }, [authStatus, load]);

  /** Full document (content + case details); cached in the list once loaded. */
  const loadDocument = useCallback(
    async (id) => {
      const cached = docsRef.current.find((doc) => doc.id === id);
      if (cached?.workspace) return cached;
      const full = await documentsService.getDocument(id);
      upsert(full);
      return full;
    },
    [upsert],
  );

  /** Creates the document on the server; resolves with the saved document. */
  const createDocument = useCallback(
    async (payload) => {
      const doc = await documentsService.createDocument(payload);
      upsert(doc);
      return doc;
    },
    [upsert],
  );

  /** For documents the server already created (e.g. AI generation). */
  const addDocument = useCallback((doc) => upsert(doc), [upsert]);

  /**
   * Applies changes locally at once, then saves them.
   * options.versionReason (+ detail) also records a version in the same request.
   * Resolves with { document, version } from the server.
   */
  const updateDocument = useCallback(
    (id, changes, { current: opened, ...options } = {}) => {
      // The workspace passes the document it opened, so a page whose list was reset
      // (session ended → signed in again) can still save it — to where it lives.
      const current = docsRef.current.find((doc) => doc.id === id) ?? (opened?.id === id ? opened : null);
      if (!current) return Promise.reject(new Error('Document not found.'));
      const optimistic = { ...current, ...changes, updatedAt: new Date().toISOString() };
      merge(id, optimistic);
      docsRef.current = docsRef.current.map((d) => (d.id === id ? optimistic : d));

      return enqueue(id, async () => {
        const result = await documentsService.updateDocument(current, changes, options);
        // Keep local content (the user may have typed since); take server bookkeeping.
        merge(id, {
          updatedAt: result.document.updatedAt,
          currentVersion: result.document.currentVersion,
          name: result.document.name,
          status: result.document.status,
          // Phase 6: the saved revision, so reopening this document in this tab saves against it.
          ...(result.document.revision ? { revision: result.document.revision } : {}),
        });
        return result;
      });
    },
    [enqueue, merge],
  );

  const deleteDocument = useCallback(async (id) => {
    await documentsService.deleteDocument(id);
    setDocuments((current) => current.filter((doc) => doc.id !== id));
  }, []);

  /** Rename (validated immediately, saved in the background). Returns an error message or null. */
  const renameDocument = useCallback(
    (id, name) => {
      const message = documentStorageService.validateTitle(name);
      if (message) return message;
      const previous = docsRef.current.find((doc) => doc.id === id)?.name;
      updateDocument(id, { name: name.trim() }).catch((err) => {
        merge(id, { name: previous });
        toast({ title: 'Rename not saved', description: err.message, variant: 'error' });
      });
      return null;
    },
    [updateDocument, merge, toast],
  );

  /** Independent copy with a new id; the original is untouched. */
  const duplicateDocument = useCallback(
    async (id) => {
      const source = await loadDocument(id);
      return createDocument(documentStorageService.buildDuplicatePayload(source));
    },
    [loadDocument, createDocument],
  );

  const getDocument = useCallback(
    (id) => documents.find((doc) => doc.id === id) ?? null,
    [documents],
  );

  const reload = useCallback(() => load(), [load]);

  const value = useMemo(
    () => ({
      documents,
      status,
      error,
      getDocument,
      loadDocument,
      createDocument,
      addDocument,
      updateDocument,
      deleteDocument,
      renameDocument,
      duplicateDocument,
      reload,
    }),
    [
      documents,
      status,
      error,
      getDocument,
      loadDocument,
      createDocument,
      addDocument,
      updateDocument,
      deleteDocument,
      renameDocument,
      duplicateDocument,
      reload,
    ],
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
}
