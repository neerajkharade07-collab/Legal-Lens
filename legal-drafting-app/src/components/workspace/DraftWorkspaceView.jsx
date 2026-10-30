import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelLeftOpen, Info } from 'lucide-react';
import { getDocumentType } from '../../data/documentTypes';
import { getStatus } from '../../data/documentStatuses';
import { getLanguage } from '../../data/draftLanguages';
import { useDraftWorkspace } from '../../hooks/useDraftWorkspace';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useToast } from '../../hooks/useToast';
import { useDocuments } from '../../hooks/useDocuments';
import { useWorkspaceIntelligence } from '../../hooks/useWorkspaceIntelligence';
import { exportService } from '../../services';
import { DocumentEditor } from '../editor/DocumentEditor';
import { EditorToolbar } from '../editor/EditorToolbar';
import { SelectionActions } from '../editor/SelectionActions';
import { createEditorBridge } from '../editor/editorBridge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { DemoBadge } from '../common/Badge';
import { RenameDialog } from '../documents/RenameDialog';
import { CourtPreview } from '../export/CourtPreview';
import { FinalizeDialog } from '../export/FinalizeDialog';
import { useFinalization } from '../../hooks/useFinalization';
import { VersionHistoryDrawer } from './VersionHistoryDrawer';
import { SaveConflictDialog } from './SaveConflictDialog';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceMobileNav } from './WorkspaceMobileNav';
import { CaseDetailsPanel } from './CaseDetailsPanel';
import { IntelligencePanel, IntelligenceRail } from './IntelligencePanel';
import { cn } from '../../utils/cn';
import './DraftWorkspaceView.css';
import { saveLocation } from '../../services/config';
import { draftNotice, draftLanguageNote } from '../../utils/draftLabels';

const MOBILE_QUERY = '(max-width: 767px)';
const COMPACT_QUERY = '(max-width: 1279px)';

/**
 * Three-panel drafting workspace for one document.
 * Desktop: details | document | intelligence (both sides collapsible to rails).
 * Tablet: rails; an opened side panel overlays the document.
 * Phone: one view at a time (Details / Document / Assistant).
 */
export function DraftWorkspaceView({ document }) {
  const ws = useDraftWorkspace(document);
  const { toast } = useToast();
  const { renameDocument } = useDocuments();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const isCompact = useMediaQuery(COMPACT_QUERY);

  const [editor, setEditor] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null);
  const [presentKeys, setPresentKeys] = useState(null);
  const [activeTool, setActiveTool] = useState('overview');
  const [leftOpen, setLeftOpen] = useState(() => !window.matchMedia?.(COMPACT_QUERY).matches);
  const [rightOpen, setRightOpen] = useState(() => !window.matchMedia?.(COMPACT_QUERY).matches);
  const [mobileView, setMobileView] = useState('document');
  const [courtPreview, setCourtPreview] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [languageNoteDismissed, setLanguageNoteDismissed] = useState(false);

  const type = getDocumentType(document.typeId);
  const status = getStatus(document.status);
  const language = getLanguage(document.setup?.language);
  const overlayMode = isCompact && !isMobile;

  // Reset panel layout when crossing the desktop/tablet boundary.
  useEffect(() => {
    setLeftOpen(!isCompact);
    setRightOpen(!isCompact);
  }, [isCompact]);

  const bridge = useMemo(() => (editor ? createEditorBridge(editor) : null), [editor]);
  const { recordVersion } = ws;
  /** Clause inserts and accepted assistant edits each become a version. */
  const handleDocumentEvent = useCallback(
    (kind, detail) => recordVersion(kind, detail),
    [recordVersion],
  );
  const intel = useWorkspaceIntelligence({
    document,
    workspace: ws,
    bridge,
    onDocumentEvent: handleDocumentEvent,
  });

  const { registerEditor, save } = ws;
  const handleReady = useCallback(
    (instance) => {
      registerEditor(instance);
      setEditor(instance);
    },
    [registerEditor],
  );

  const handleSave = useCallback(() => {
    recordVersion('manual-save').then((result) => {
      if (!result.ok) return; // the save hook already reported the error (or shows the conflict)
      if (result.versionError) return; // the save hook already said the version was not recorded
      toast({
        title: 'Draft saved',
        description: result.version
          ? `Saved ${saveLocation()} as Version ${result.version.number}.`
          : `Saved ${saveLocation()}. No changes since the last version.`,
        variant: 'success',
        duration: 2500,
      });
    });
  }, [recordVersion, toast]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const openTool = useCallback(
    (toolId) => {
      setActiveTool(toolId);
      if (isMobile) setMobileView('assistant');
      else {
        setRightOpen(true);
        if (overlayMode) setLeftOpen(false);
      }
    },
    [isMobile, overlayMode],
  );

  /** Open the case-details panel on a field and focus it. */
  const focusField = useCallback(
    (key) => {
      if (isMobile) setMobileView('details');
      else if (!leftOpen) {
        setLeftOpen(true);
        if (overlayMode) setRightOpen(false);
      }
      setFocusRequest({ key, n: Date.now() });
    },
    [isMobile, leftOpen, overlayMode],
  );

  const handleTokenClick = useCallback((key) => focusField(key), [focusField]);

  /** Navigation used by the review tools: fields, tokens and text in the document. */
  const nav = useMemo(() => {
    const showDocumentThen = (locate, notFound) => {
      setCourtPreview(null);
      if (isMobile) setMobileView('document');
      if (overlayMode) setRightOpen(false);
      // Let the document become visible / editable before selecting inside it.
      setTimeout(() => {
        if (!locate())
          toast({ title: notFound, description: 'It may have been edited or removed.' });
      }, 60);
    };
    return {
      goToField: focusField,
      goToToken: (key) =>
        showDocumentThen(() => bridge?.locateToken(key), 'Placeholder not found in the document'),
      goToText: (text) =>
        showDocumentThen(() => bridge?.locateText(text), 'Text not found in the document'),
    };
  }, [bridge, focusField, isMobile, overlayMode, toast]);

  const handleSelectionAction = useCallback(
    (actionId) => {
      openTool('assistant');
      intel.runAssistant(actionId);
    },
    [openTool, intel],
  );

  const handleExportWord = useCallback(() => {
    if (!editor) return;
    exportService.exportWordCompatible({
      title: document.name,
      html: editor.getHTML(),
      lineHeight: ws.formatting.lineHeight,
    });
    toast({
      title: 'Download started',
      description: exportService.EXPORT_CAPABILITIES.wordHtml.note,
    });
  }, [editor, document.name, ws.formatting.lineHeight, toast]);

  const fin = useFinalization({ document, ws, editor });

  /** Real .docx from the server (account documents). Errors are shown, never a false success. */
  const handleExportDocx = useCallback(
    async (versionId) => {
      try {
        const { filename, unsupported } = await fin.exportWord(versionId);
        toast({
          title: 'Word document downloaded',
          description: unsupported.length
            ? `${filename} — some elements were exported as plain text (${unsupported.join(', ')}).`
            : filename,
          variant: 'success',
        });
      } catch (err) {
        toast({
          title: 'Word export failed',
          description: err?.message || 'The Word file could not be created.',
          variant: 'error',
        });
      }
    },
    [fin, toast],
  );

  const handleExportPdf = useCallback(() => {
    fin.printPdf().then(
      () =>
        toast({
          title: 'Print dialog opened',
          description: 'Choose “Save as PDF” as the destination to save a PDF.',
        }),
      (err) =>
        toast({
          title: 'Could not open the print dialog',
          description: err?.message || 'Try again, or open Preview and print from there.',
          variant: 'error',
        }),
    );
  }, [fin, toast]);

  /** The court-ready preview renders the saved JSON, so pending edits are saved first. */
  const openCourtPreview = useCallback(
    (autoPrint = false) => {
      save();
      const content =
        editor && !editor.isDestroyed ? editor.getJSON() : document.workspace?.content;
      setCourtPreview({ content, autoPrint });
    },
    [editor, save, document.workspace],
  );

  const currentVersion = ws.versions.at(-1);

  const showDetails = isMobile ? mobileView === 'details' : leftOpen;
  const showIntel = isMobile ? mobileView === 'assistant' : rightOpen;
  const showDocument = !isMobile || mobileView === 'document';

  return (
    <div className="ws" data-mobile-view={isMobile ? mobileView : undefined}>
      <WorkspaceHeader
        document={document}
        type={type}
        status={status}
        language={language}
        saveStatus={ws.saveStatus}
        lastSavedAt={ws.lastSavedAt}
        compact={isCompact}
        versionCount={ws.versions.length}
        onRegenerate={document.source ? undefined : () => setConfirmRegenerate(true)}
        onModifyWithAi={() => {
          openTool('assistant');
          toast({
            title: 'Select text, then choose an action',
            description: 'Demo assistant — rule-based samples, no AI model is used.',
          });
        }}
        onCheckCompliance={() => {
          openTool('compliance');
          intel.run('compliance');
        }}
        onSave={handleSave}
        onRename={() => setRenaming(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onPreview={() => openCourtPreview(false)}
        onPrint={() => openCourtPreview(true)}
        onExportPdf={handleExportPdf}
        onExportWord={handleExportWord}
        docxAvailable={fin.serverDoc}
        onExportDocx={() =>
          fin.serverDoc
            ? handleExportDocx()
            : toast({
                title: 'DOCX export needs a CASEONE account',
                description: exportService.EXPORT_CAPABILITIES.docx.reason,
              })
        }
        docStatus={fin.status}
        onFinalize={() => setFinalizeOpen(true)}
      />

      <WorkspaceMobileNav
        value={mobileView}
        onChange={setMobileView}
        detailsCount={`${ws.completion.filled}/${ws.completion.total}`}
      />

      <div className={cn('ws__body', leftOpen && 'left-open', rightOpen && 'right-open')}>
        {/* LEFT — case details */}
        <aside
          className={cn('ws-side ws-side--left', showDetails && 'is-open')}
          aria-label="Case details"
        >
          {showDetails ? (
            <div className="ws-side__panel">
              <CaseDetailsPanel
                schema={ws.schema}
                fields={ws.fields}
                onFieldChange={ws.setField}
                activeKey={activeKey}
                onActiveKeyChange={setActiveKey}
                completion={ws.completion}
                extraction={ws.extraction}
                presentKeys={presentKeys}
                setup={document.setup}
                source={
                  document.source
                    ? {
                        kind: document.source,
                        file: document.sourceFile,
                        files: document.sourceFiles,
                      }
                    : null
                }
                focusRequest={focusRequest}
                onCollapse={isMobile ? undefined : () => setLeftOpen(false)}
              />
            </div>
          ) : (
            !isMobile && (
              <div className="ws-side__rail">
                <button
                  type="button"
                  className="ws-rail-btn"
                  onClick={() => {
                    setLeftOpen(true);
                    if (overlayMode) setRightOpen(false);
                  }}
                  aria-label="Open case details"
                  title="Case details"
                >
                  <PanelLeftOpen size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span className="ws-rail-btn__label">Details</span>
                  <span className="ws-rail-btn__count">
                    {ws.completion.filled}/{ws.completion.total}
                  </span>
                </button>
              </div>
            )
          )}
        </aside>

        {/* CENTER — document */}
        <section className={cn('ws-center', !showDocument && 'is-hidden')} aria-label="Document">
          <EditorToolbar
            editor={editor}
            lineHeight={ws.formatting.lineHeight}
            onLineHeightChange={ws.setLineHeight}
          />
          <div className="ws-canvas">
            <div className="ws-canvas__notes">
              <DemoBadge>{draftNotice(document)}</DemoBadge>
              {language.id !== 'en' && !languageNoteDismissed && (
                <p className="ws-canvas__lang">
                  <Info size={14} strokeWidth={1.75} aria-hidden="true" />
                  Draft language: {language.label} ({language.nativeLabel}).{' '}
                  {draftLanguageNote(document)}
                  <button type="button" onClick={() => setLanguageNoteDismissed(true)}>
                    Dismiss
                  </button>
                </p>
              )}
            </div>
            <DocumentEditor
              initialContent={ws.initialContent}
              displayValues={ws.displayValues}
              activeFieldKey={activeKey}
              lineHeight={ws.formatting.lineHeight}
              onReady={handleReady}
              onChange={ws.handleContentChange}
              onTokenClick={handleTokenClick}
              onPresentKeysChange={setPresentKeys}
            />
            <SelectionActions
              editor={editor}
              onAction={handleSelectionAction}
              actions={intel.selectionActions}
              disabled={intel.assistant.status === 'loading'}
            />
            <p className="ws-canvas__disclaimer">
              Legal Lens provides AI-assisted drafting tools and informational assistance. Drafts
              and legal information should be reviewed by a qualified legal professional where
              appropriate.
            </p>
          </div>
        </section>

        {/* RIGHT — legal intelligence */}
        <aside
          className={cn('ws-side ws-side--right', showIntel && 'is-open')}
          aria-label="Legal intelligence"
        >
          {showIntel ? (
            <div className="ws-side__panel">
              <IntelligencePanel
                activeTool={activeTool}
                onToolChange={setActiveTool}
                onCollapse={isMobile ? undefined : () => setRightOpen(false)}
                documentTypeName={type?.name}
                intel={intel}
                nav={nav}
              />
            </div>
          ) : (
            !isMobile && (
              <div className="ws-side__rail">
                <IntelligenceRail
                  activeTool={activeTool}
                  onSelect={(toolId) => {
                    setActiveTool(toolId);
                    setRightOpen(true);
                    if (overlayMode) setLeftOpen(false);
                  }}
                />
              </div>
            )
          )}
        </aside>

        {overlayMode && (leftOpen || rightOpen) && (
          <div
            className="ws-scrim"
            aria-hidden="true"
            onClick={() => {
              setLeftOpen(false);
              setRightOpen(false);
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Regenerate the draft?"
        description={
          <>
            <p>
              This rebuilds the document from the {type?.name ?? 'document'} template. Your
              case-detail values are kept, but manual edits to the document text will be replaced.
            </p>
            <p>Demo: this uses the built-in template only — no AI is involved.</p>
          </>
        }
        confirmLabel="Regenerate"
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={() => {
          setConfirmRegenerate(false);
          ws.rebuildFromTemplate().then((result) => {
            if (result.ok) {
              toast({
                title: 'Draft rebuilt from template',
                description: 'Field values were kept.',
              });
            }
          });
        }}
      />

      <RenameDialog
        document={renaming ? document : null}
        onRename={(name) => {
          const error = renameDocument(document.id, name);
          if (!error)
            toast({ title: 'Document renamed', description: name.trim(), duration: 2500 });
          return error;
        }}
        onClose={() => setRenaming(false)}
      />

      <VersionHistoryDrawer
        open={historyOpen}
        versions={ws.versions}
        status={ws.versionsStatus}
        onRetry={ws.reloadVersions}
        loadVersion={ws.loadVersion}
        currentNumber={currentVersion?.number}
        onClose={() => setHistoryOpen(false)}
        onRestore={async (version) => {
          setHistoryOpen(false);
          try {
            const created = await ws.restoreVersion(version.id);
            toast({
              title: `Restored Version ${version.number}`,
              description: `Saved as Version ${created.number} — later versions are kept.`,
              variant: 'success',
            });
          } catch (err) {
            toast({
              title: 'Restore failed',
              description: err?.message || 'The version could not be restored.',
              variant: 'error',
            });
          }
        }}
      />

      {courtPreview && (
        <CourtPreview
          title={courtPreview.title ?? document.name}
          draftLabel={courtPreview.label ?? draftNotice(document)}
          content={courtPreview.content}
          autoPrint={courtPreview.autoPrint}
          onClose={() => setCourtPreview(null)}
          onDownloadWord={courtPreview.versionId ? undefined : handleExportWord}
          onDownloadDocx={fin.serverDoc ? () => handleExportDocx(courtPreview.versionId) : undefined}
          docxNote="A real Word (.docx) file needs a document saved to a signed-in CASEONE account."
        />
      )}

      <SaveConflictDialog
        conflict={ws.conflict}
        onResolve={async (choice) => {
          await ws.resolveConflict(choice);
          toast({
            title: choice === 'latest' ? 'Latest version loaded' : 'Your version is saved',
            description: 'The other text was kept in Version history.',
            variant: 'success',
          });
        }}
      />

      <FinalizeDialog
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        document={document}
        fin={fin}
        nav={nav}
        toast={toast}
        loadVersion={ws.loadVersion}
        onExportWordHtml={handleExportWord}
        onPreview={(snapshot) =>
          snapshot
            ? setCourtPreview({ content: snapshot.content, title: snapshot.title, label: snapshot.label, versionId: snapshot.versionId })
            : openCourtPreview(false)
        }
      />
    </div>
  );
}
