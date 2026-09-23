import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDocuments } from './useDocuments';
import { useToast } from './useToast';
import { getDocumentSchema, getFieldMap } from '../data/documentSchemas';
import { documentsService, versionService } from '../services';
import {
  WORKSPACE_VERSION,
  buildWorkspaceContent,
  computeCompletion,
  computeDisplayValues,
  createInitialWorkspace,
} from '../utils/workspaceModel';

const AUTOSAVE_DELAY_MS = 1500;

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
 * saveStatus: 'saved' | 'unsaved' | 'saving'
 */
export function useDraftWorkspace(document) {
  const { updateDocument, addDocument } = useDocuments();
  const { toast } = useToast();
  const schema = useMemo(() => getDocumentSchema(document.typeId), [document.typeId]);
  const fieldMap = useMemo(() => getFieldMap(schema), [schema]);

  // Computed once per opened document.
  const [initial] = useState(() => createInitialWorkspace(document));
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
    setSaveStatus('unsaved');
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
        options,
      ).then(
        (result) => {
          errorShownRef.current = false;
          setLastSavedAt(result.document.updatedAt);
          setSaveStatus(editsRef.current === editsAtStart ? 'saved' : 'unsaved');
          if (result.version) {
            lastVersionRef.current = { fingerprint: fingerprint(content, f), content };
            setVersions((current) => [...current, result.version]);
          }
          return result;
        },
        (err) => {
          setSaveStatus('unsaved');
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
        (result) => ({ ok: true, version: result.version }),
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
      if (latest.current.saveStatus !== 'unsaved') return;
      const major = versionService.isMajorChange(lastVersionRef.current.content, currentContent());
      save(undefined, major ? { versionReason: 'major_edit' } : {}).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changeCount, save, currentContent]);

  // Flush pending changes when leaving the page or the workspace.
  useEffect(() => {
    const flushOnUnload = () => {
      if (latest.current.saveStatus === 'unsaved')
        save(undefined, { keepalive: true }).catch(() => {});
    };
    window.addEventListener('pagehide', flushOnUnload);
    return () => {
      window.removeEventListener('pagehide', flushOnUnload);
      if (latest.current.saveStatus === 'unsaved') save().catch(() => {});
    };
  }, [save]);

  /** Rebuild the draft from the template (no AI). Field values are kept. */
  const rebuildFromTemplate = useCallback(() => {
    const content = buildWorkspaceContent(document, fieldMap, latest.current.fields);
    editorRef.current?.commands.setContent(content);
    contentRef.current = content;
    return recordVersion('regenerated', null, { force: true });
  }, [document, fieldMap, recordVersion]);

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
    versions,
    versionsStatus,
    reloadVersions: loadVersions,
    recordVersion,
    loadVersion,
    restoreVersion,
  };
}
