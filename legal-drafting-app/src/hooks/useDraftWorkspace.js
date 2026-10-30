import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDocuments } from './useDocuments';
import { useToast } from './useToast';
import { getDocumentSchema, getFieldMap } from '../data/documentSchemas';
import { documentsService, versionService } from '../services';
import { canonicalKey } from '../utils/contentCanonical';
import {
  WORKSPACE_VERSION,
  buildWorkspaceContent,
  computeCompletion,
  computeDisplayValues,
  createInitialWorkspace,
} from '../utils/workspaceModel';

const AUTOSAVE_DELAY_MS = 1500;
// Phase 6: while someone types continuously, autosave at most every 8 s (the API allows 300
// requests per 15 minutes per IP address for the whole site). Leaving the page still saves.
const AUTOSAVE_MIN_INTERVAL_MS = 8000;
// Phase 6: a failed save (network, server busy, too many requests) is retried automatically.
const RETRY_FIRST_MS = 15000;
const RETRY_MAX_MS = 120000;
const RETRYABLE = (err) => !err?.status || err.status === 429 || err.status >= 500;

/** Backend version reasons for the UI's event names. */
const REASON_TO_API = {
  'manual-save': 'manual_save',
  'clause-added': 'clause_added',
  'ai-edit': 'ai_edit_accepted',
  'major-edit': 'major_edit',
  regenerated: 'regenerated',
};

const fingerprint = (content, fields) => JSON.stringify([content, fields]);

/**
 * State + persistence for one document in the Draft Workspace.
 * Saves go to the Legal Lens backend (PATCH /api/documents/:id), in order.
 * Versions are recorded by the backend only at meaningful events.
 * saveStatus: 'saved' | 'unsaved' | 'saving' | 'failed' (the last save did not reach storage)
 *           | 'conflict' (Phase 6: the document was saved elsewhere since this page loaded it;
 *             nothing is saved until the user chooses how to resolve it)
 */
export function useDraftWorkspace(document) {
  const { updateDocument, addDocument } = useDocuments();
  const { toast } = useToast();
  const schema = useMemo(() => getDocumentSchema(document.typeId), [document.typeId]);
  const fieldMap = useMemo(() => getFieldMap(schema), [schema]);

  // Computed once per opened document.
  const [initial] = useState(() => createInitialWorkspace(document));
  const openedRef = useRef(document);
  openedRef.current = document;
  const [fields, setFields] = useState(initial.fields);
  const [formatting, setFormatting] = useState(initial.formatting);
  const [saveStatus, setSaveStatus] = useState(initial.isNew ? 'unsaved' : 'saved');
  const [lastSavedAt, setLastSavedAt] = useState(document.workspace?.savedAt ?? null);
  const [changeCount, setChangeCount] = useState(initial.isNew ? 1 : 0);
  const [versions, setVersions] = useState([]);
  const [versionsStatus, setVersionsStatus] = useState('loading');

  const contentRef = useRef(initial.content);
  const editorRef = useRef(null);
  const editsRef = useRef(0); // increments on every edit, synchronously
  const lastVersionRef = useRef({
    fingerprint: fingerprint(initial.content, initial.fields),
    content: initial.content,
  });
  const errorShownRef = useRef(false);
  // Phase 6: revision of the saved text this page is based on (account documents).
  const revisionRef = useRef(document.revision ?? null);
  const [conflict, setConflict] = useState(null); // { document } — the newer saved document
  const retryRef = useRef({ delay: RETRY_FIRST_MS, timer: null });
  const lastErrorRef = useRef(null);
  const lastSaveStartRef = useRef(0);
  // Phase 6: what is known to be saved, ignoring meaningless differences (see contentCanonical).
  const savedKeyRef = useRef(initial.isNew ? null : canonicalKey(initial.content, initial.fields, initial.formatting));
  const latest = useRef({ fields, formatting, saveStatus });
  useLayoutEffect(() => {
    latest.current = { fields, formatting, saveStatus };
  }, [fields, formatting, saveStatus]);

  const displayValues = useMemo(() => computeDisplayValues(schema, fields), [schema, fields]);
  const completion = useMemo(() => computeCompletion(schema, fields), [schema, fields]);

  // Version history from the server.
  const loadVersions = useCallback(async () => {
    setVersionsStatus('loading');
    try {
      setVersions(await documentsService.listVersions(document.id));
      setVersionsStatus('ready');
    } catch {
      setVersionsStatus('error');
    }
  }, [document.id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const markDirty = useCallback(() => {
    editsRef.current += 1;
    // While a save conflict is open, edits stay on this page until the user resolves it.
    setSaveStatus((s) => (s === 'conflict' ? s : 'unsaved'));
    setChangeCount((n) => n + 1);
  }, []);

  const setField = useCallback(
    (key, value) => {
      setFields((current) => (current[key] === value ? current : { ...current, [key]: value }));
      markDirty();
    },
    [markDirty],
  );

  const setLineHeight = useCallback(
    (lineHeight) => {
      setFormatting((current) => ({ ...current, lineHeight }));
      markDirty();
    },
    [markDirty],
  );

  const handleContentChange = useCallback(
    (json) => {
      contentRef.current = json;
      markDirty();
    },
    [markDirty],
  );

  const currentContent = useCallback(() => {
    const content =
      editorRef.current && !editorRef.current.isDestroyed
        ? editorRef.current.getJSON()
        : contentRef.current;
    contentRef.current = content;
    return content;
  }, []);

  /** Phase 6: true when the page holds nothing that is not already saved. */
  const nothingNew = useCallback(
    () =>
      savedKeyRef.current !== null &&
      canonicalKey(currentContent(), latest.current.fields, latest.current.formatting) === savedKeyRef.current,
    [currentContent],
  );

  /**
   * Saves the current state. options.versionReason also records a version.
   * override: { fields, formatting } — for callers that set state in the same tick.
   * Resolves with { document, version }; rejects if the save failed.
   */
  const save = useCallback(
    (override, options = {}) => {
      const f = override?.fields ?? latest.current.fields;
      const fmt = override?.formatting ?? latest.current.formatting;
      const content = currentContent();
      const editsAtStart = editsRef.current;
      lastSaveStartRef.current = Date.now();
      setSaveStatus('saving');

      return updateDocument(
        document.id,
        {
          progress: computeCompletion(schema, f).percent,
          workspace: {
            version: WORKSPACE_VERSION,
            fields: f,
            content,
            formatting: fmt,
            extraction: initial.extraction,
            savedAt: new Date().toISOString(),
          },
        },
        // `current`: the opened document, used if the list was reset (e.g. the session
        // ended and the user signed in again) so the page keeps working and saving.
        { ...options, current: openedRef.current, baseRevision: () => revisionRef.current },
      ).then(
        (result) => {
          errorShownRef.current = false;
          retryRef.current.delay = RETRY_FIRST_MS;
          if (result.document?.revision) revisionRef.current = result.document.revision;
          savedKeyRef.current = canonicalKey(content, f, fmt);
          if (result.versionError && !options.keepalive) {
            toast({
              title: 'Saved — version not recorded',
              description: 'Your text is saved, but the version could not be added to the history. Press Save again to record it.',
              variant: 'default',
            });
          }
          setLastSavedAt(result.document.updatedAt);
          setSaveStatus(editsRef.current === editsAtStart ? 'saved' : 'unsaved');
          if (result.version) {
            lastVersionRef.current = { fingerprint: fingerprint(content, f), content };
            setVersions((current) => [...current, result.version]);
          }
          return result;
        },
        (err) => {
          if (documentsService.isConflictError(err)) {
            // Newer text was saved elsewhere. Nothing was written; the user decides (no toast spam).
            setSaveStatus('conflict');
            setConflict({ document: documentsService.conflictDocument(err) });
            throw err;
          }
          // Honest state: nothing was saved; the changes are only on this page.
          setSaveStatus('failed');
          lastErrorRef.current = err;
          if (!errorShownRef.current && !options.keepalive) {
            errorShownRef.current = true;
            toast({
              title: 'Not saved',
              description: `${err?.message || 'The document could not be saved.'} Your changes are kept on this page.`,
              variant: 'error',
            });
          }
          throw err;
        },
      );
    },
    [document.id, schema, initial.extraction, updateDocument, currentContent, toast],
  );

  /**
   * Save + snapshot for a meaningful event (manual save, clause, AI edit, …).
   * An unchanged document is saved without creating a duplicate version.
   */
  const recordVersion = useCallback(
    (reason, detail = null, { force = false } = {}) => {
      const content = currentContent();
      const unchanged =
        fingerprint(content, latest.current.fields) === lastVersionRef.current.fingerprint;
      const versionReason =
        force || !unchanged ? (REASON_TO_API[reason] ?? 'manual_save') : undefined;
      return save(undefined, { versionReason, detail: detail || undefined }).then(
        (result) => ({ ok: true, version: result.version, versionError: result.versionError === true }),
        (err) => ({ ok: false, error: err }),
      );
    },
    [save, currentContent],
  );

  /** Full snapshot (content) of one version, for the preview. */
  const loadVersion = useCallback(
    (versionId) => documentsService.getVersion(document.id, versionId),
    [document.id],
  );

  /** Restore: the server keeps later versions and records a "Restored from" version. */
  const restoreVersion = useCallback(
    async (versionId) => {
      const { document: restored, version } = await documentsService.restoreVersion(
        document.id,
        versionId,
      );
      const ws = restored.workspace;
      if (restored.revision) revisionRef.current = restored.revision;
      savedKeyRef.current = canonicalKey(ws.content, ws.fields, latest.current.formatting);
      setFields(ws.fields);
      editorRef.current?.commands.setContent(ws.content);
      contentRef.current = ws.content;
      lastVersionRef.current = {
        fingerprint: fingerprint(ws.content, ws.fields),
        content: ws.content,
      };
      addDocument(restored);
      setVersions((current) => [...current, version]);
      setLastSavedAt(restored.updatedAt);
      editsRef.current += 1; // anything pending from before the restore is obsolete
      setSaveStatus('saved');
      return version;
    },
    [document.id, addDocument],
  );

  // Autosave after a pause in editing. A large change also becomes a version.
  useEffect(() => {
    if (changeCount === 0) return undefined;
    const timer = setTimeout(() => {
      if (latest.current.saveStatus !== 'unsaved' && latest.current.saveStatus !== 'failed') return;
      if (nothingNew()) {
        setSaveStatus('saved');
        return;
      }
      const major = versionService.isMajorChange(lastVersionRef.current.content, currentContent());
      save(undefined, major ? { versionReason: 'major_edit' } : {}).catch(() => {});
    }, Math.max(AUTOSAVE_DELAY_MS, AUTOSAVE_MIN_INTERVAL_MS - (Date.now() - lastSaveStartRef.current)));
    return () => clearTimeout(timer);
  }, [changeCount, save, currentContent, nothingNew]);

  // Flush pending changes when leaving the page or the workspace.
  useEffect(() => {
    const pending = () => ['unsaved', 'failed'].includes(latest.current.saveStatus) && !nothingNew();
    const flushOnUnload = () => {
      if (pending()) save(undefined, { keepalive: true }).catch(() => {});
    };
    // Phase 6: the browser asks before closing the tab while something is not saved
    // (a save on close is best effort — browsers may cancel it).
    const warnBeforeUnload = (event) => {
      const s = latest.current.saveStatus;
      if (s === 'saving' || s === 'conflict' || ((s === 'unsaved' || s === 'failed') && !nothingNew())) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', flushOnUnload);
      window.removeEventListener('beforeunload', warnBeforeUnload);
      if (pending()) save().catch(() => {});
    };
  }, [save, nothingNew]);

  // Phase 6: retry a failed save after a pause (15 s, doubling to 2 min) while it stays failed.
  useEffect(() => {
    const r = retryRef.current;
    clearTimeout(r.timer);
    if (saveStatus !== 'failed' || !RETRYABLE(lastErrorRef.current)) return undefined;
    r.timer = setTimeout(() => {
      if (latest.current.saveStatus !== 'failed') return;
      r.delay = Math.min(r.delay * 2, RETRY_MAX_MS);
      save().catch(() => {});
    }, r.delay);
    return () => clearTimeout(r.timer);
  }, [saveStatus, save]);

  /**
   * Phase 6: resolve a save conflict. Both choices first record the side that is about to be
   * replaced as a version, so nothing is lost (it can be restored from Version history).
   *  'latest' — load the text saved elsewhere into this page (this page's text goes to history);
   *  'mine'   — keep this page's text and save it over the newer one (the newer one goes to history).
   */
  const resolveConflict = useCallback(
    async (choice) => {
      const server = conflict?.document;
      if (!server?.workspace) throw new Error('The newer version could not be loaded. Reload the page.');
      const opened = openedRef.current;
      if (choice === 'latest') {
        await documentsService.snapshotVersion(opened, {
          content: currentContent(),
          fields: latest.current.fields,
          detail: 'Unsaved text from another tab (save conflict)',
        });
        const ws = server.workspace;
        revisionRef.current = server.revision ?? null;
        savedKeyRef.current = canonicalKey(ws.content, ws.fields, latest.current.formatting);
        editorRef.current?.commands.setContent(ws.content);
        contentRef.current = ws.content;
        setFields(ws.fields);
        lastVersionRef.current = { fingerprint: fingerprint(ws.content, ws.fields), content: ws.content };
        addDocument(server);
        setLastSavedAt(server.updatedAt);
        editsRef.current += 1;
        setConflict(null);
        setSaveStatus('saved');
        loadVersions();
        return { ok: true };
      }
      await documentsService.snapshotVersion(opened, { detail: 'Text saved elsewhere, replaced after a save conflict' });
      revisionRef.current = server.revision ?? null;
      setConflict(null);
      const result = await save(undefined, { versionReason: 'manual_save', detail: 'Kept this tab’s text after a save conflict' });
      loadVersions();
      return { ok: true, result };
    },
    [conflict, currentContent, addDocument, save, loadVersions],
  );

  /** Rebuild the draft from the template (no AI). Field values are kept. */
  const rebuildFromTemplate = useCallback(() => {
    const content = buildWorkspaceContent(document, fieldMap, latest.current.fields);
    editorRef.current?.commands.setContent(content);
    contentRef.current = content;
    return recordVersion('regenerated', null, { force: true });
  }, [document, fieldMap, recordVersion]);

  /** Replace the whole text with an AI draft the user accepted; recorded as a new version. */
  const applyGeneratedContent = useCallback(
    (content) => {
      editorRef.current?.commands.setContent(content);
      contentRef.current = content;
      return recordVersion('regenerated', 'AI draft', { force: true });
    },
    [recordVersion],
  );

  const registerEditor = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  return {
    /** Increments on every field/content/formatting change — lets review results detect staleness. */
    revision: changeCount,
    schema,
    fieldMap,
    fields,
    setField,
    displayValues,
    completion,
    formatting,
    setLineHeight,
    extraction: initial.extraction,
    initialContent: initial.content,
    handleContentChange,
    registerEditor,
    editorRef,
    save,
    saveStatus,
    lastSavedAt,
    rebuildFromTemplate,
    applyGeneratedContent,
    versions,
    versionsStatus,
    reloadVersions: loadVersions,
    recordVersion,
    loadVersion,
    restoreVersion,
    conflict,
    resolveConflict,
  };
}
