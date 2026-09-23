import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  RotateCcw,
  Wand2,
  ShieldCheck,
  Save,
  Eye,
  Download,
  History,
  PencilLine,
  Printer,
  FileDown,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge, DemoBadge } from '../common/Badge';
import { DropdownMenu } from '../common/DropdownMenu';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { SaveStatus } from './SaveStatus';
import './WorkspaceHeader.css';

export function WorkspaceHeader({
  document,
  type,
  status,
  language,
  saveStatus,
  lastSavedAt,
  compact,
  versionCount = 0,
  onRegenerate,
  onModifyWithAi,
  onCheckCompliance,
  onSave,
  onRename,
  onOpenHistory,
  onPreview,
  onPrint,
  onExportPdf,
  onExportWord,
  onExportDocx,
}) {
  // Regenerate rebuilds from a template, so it is offered only for generated drafts.
  const secondary = [
    ...(onRegenerate
      ? [{ id: 'regenerate', label: 'Regenerate', icon: RotateCcw, onSelect: onRegenerate }]
      : []),
    { id: 'modify', label: 'Modify with AI', icon: Wand2, onSelect: onModifyWithAi },
    { id: 'compliance', label: 'Check Compliance', icon: ShieldCheck, onSelect: onCheckCompliance },
  ];
  const exportItems = [
    { id: 'print', label: 'Print…', icon: Printer, onSelect: onPrint },
    { id: 'pdf', label: 'Export PDF (print dialog)', icon: FileDown, onSelect: onExportPdf },
    {
      id: 'docx',
      label: 'Export DOCX — not available',
      icon: FileText,
      onSelect: onExportDocx,
      disabled: true,
    },
    { id: 'doc', label: 'Word-compatible (.doc)', icon: Download, onSelect: onExportWord },
  ];

  return (
    <header className="ws-header">
      <Link
        to="/documents"
        className="ws-header__back"
        aria-label="Back to My Documents"
        title="My Documents"
      >
        <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </Link>

      <div className="ws-header__identity">
        <span className="ws-header__icon" aria-hidden="true">
          <DocumentTypeIcon name={type?.icon} size={18} />
        </span>
        <div className="ws-header__text">
          <div className="ws-header__title-row">
            <h1 className="ws-header__name" title={document.name}>
              {document.name}
            </h1>
            <button
              type="button"
              className="ws-header__rename"
              onClick={onRename}
              aria-label={`Rename ${document.name}`}
              title="Rename document"
            >
              <PencilLine size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div className="ws-header__meta">
            <span>{type?.name ?? 'Document'}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="ws-header__lang">
              {language.label}
              {language.nativeLabel !== language.label && (
                <span lang={language.id}> · {language.nativeLabel}</span>
              )}
            </span>
            {document.source === 'reviewed-document' && (
              <Badge tone="outline">Reviewed document</Badge>
            )}
            {document.source === 'compared-document' && (
              <Badge tone="outline">From comparison</Badge>
            )}
            {document.generation?.source === 'demo' && (
              <DemoBadge className="ws-header__demo">Preliminary template draft</DemoBadge>
            )}
            {document.generation?.source === 'ai' && (
              <DemoBadge className="ws-header__demo">AI draft — review every detail</DemoBadge>
            )}
          </div>
        </div>
      </div>

      <div className="ws-header__actions">
        <SaveStatus status={saveStatus} lastSavedAt={lastSavedAt} />
        {!compact && (
          <div className="ws-header__group">
            {secondary.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="sm"
                icon={action.icon}
                onClick={action.onSelect}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
        <div className="ws-header__group">
          {!compact && (
            <>
              <Button variant="secondary" size="sm" icon={History} onClick={onOpenHistory}>
                History
                {versionCount > 0 && <span className="ws-header__count">{versionCount}</span>}
              </Button>
              <DropdownMenu
                label="Export"
                icon={Download}
                items={exportItems}
                buttonLabel="Export and print options"
              />
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={onPreview}
            className="ws-header__preview"
          >
            Preview
          </Button>
          <Button size="sm" icon={Save} onClick={onSave} disabled={saveStatus === 'saving'}>
            Save
          </Button>
          {compact && (
            <DropdownMenu
              icon={MoreHorizontal}
              buttonLabel="More actions"
              items={[
                ...secondary,
                { id: 'history', label: 'Version history', icon: History, onSelect: onOpenHistory },
                { id: 'rename', label: 'Rename document', icon: PencilLine, onSelect: onRename },
                ...exportItems,
              ]}
            />
          )}
        </div>
      </div>
    </header>
  );
}
