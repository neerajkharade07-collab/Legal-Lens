import { useMemo, useState } from 'react';
import { History, RotateCcw, Eye, Clock } from 'lucide-react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BlockPreview } from '../intelligence/BlockPreview';
import { formatDate, formatRelative } from '../../utils/date';
import '../intelligence/IntelShared.css';
import './VersionHistory.css';
import { SAVE_LOCATION } from '../../services/config';

const timeOf = (value) =>
  new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/**
 * Version history for one document. Versions are recorded at meaningful events
 * (manual save, clause added, AI edit accepted, major edit, regenerate,
 * restore) — not on every keystroke.
 */
export function VersionHistoryDrawer({
  open,
  versions,
  status = 'ready',
  currentNumber,
  onClose,
  onRestore,
  onRetry,
  loadVersion,
}) {
  const [previewing, setPreviewing] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  /** Version lists come without content; the preview fetches it. */
  async function openPreview(version) {
    setPreviewError(null);
    setPreviewing({ ...version, loading: !version.content });
    if (version.content || !loadVersion) return;
    try {
      const full = await loadVersion(version.id);
      setPreviewing((current) =>
        current?.id === version.id ? { ...full, loading: false } : current,
      );
    } catch (err) {
      setPreviewError(err?.message || 'This version could not be loaded.');
      setPreviewing((current) => (current ? { ...current, loading: false } : current));
    }
  }
  const [restoring, setRestoring] = useState(null);
  const ordered = useMemo(() => [...versions].reverse(), [versions]);

  if (!open) return null;

  return (
    <>
      <Modal
        open
        size="md"
        onClose={onClose}
        labelledBy="version-history-title"
        className="version-drawer"
      >
        <header className="version-drawer__header">
          <div>
            <p className="eyebrow">
              <History size={13} strokeWidth={1.75} aria-hidden="true" /> Version history
            </p>
            <h2 id="version-history-title" className="version-drawer__title">
              {versions.length} version{versions.length === 1 ? '' : 's'}
            </h2>
          </div>
          <ModalCloseButton onClick={onClose} label="Close version history" />
        </header>

        <p className="version-drawer__note">
          Saved {SAVE_LOCATION} at meaningful events — manual saves, inserted clauses, accepted
          assistant edits, large edits, regeneration and restores.
        </p>

        <div className="version-drawer__body">
          {status === 'loading' && ordered.length === 0 ? (
            <p className="version-drawer__state" role="status">
              Loading version history…
            </p>
          ) : status === 'error' && ordered.length === 0 ? (
            <div className="version-drawer__state" role="alert">
              <p>Version history could not be loaded.</p>
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : ordered.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No versions yet"
              description="Save the draft or use a review tool to create the first version."
              compact
            />
          ) : (
            <ol className="version-list">
              {ordered.map((version) => (
                <li key={version.id} className="version-item">
                  <div className="version-item__head">
                    <span className="version-item__number">Version {version.number}</span>
                    {version.number === currentNumber && <Badge tone="outline">Latest</Badge>}
                  </div>
                  <p className="version-item__reason">{version.label}</p>
                  <p className="version-item__time">
                    <time dateTime={version.createdAt}>
                      {formatDate(version.createdAt)}, {timeOf(version.createdAt)}
                    </time>
                    <span aria-hidden="true">·</span>
                    {formatRelative(version.createdAt)}
                  </p>
                  <div className="version-item__actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => openPreview(version)}
                      aria-label={`Preview version ${version.number}`}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={RotateCcw}
                      onClick={() => setRestoring(version)}
                      aria-label={`Restore version ${version.number}`}
                    >
                      Restore
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Modal>

      {previewing && (
        <Modal
          open
          size="lg"
          onClose={() => setPreviewing(null)}
          labelledBy="version-preview-title"
          className="version-preview"
        >
          <header className="version-preview__header">
            <div>
              <p className="eyebrow">Read-only</p>
              <h2 id="version-preview-title" className="version-preview__title">
                Version {previewing.number} — {previewing.label}
              </h2>
              <p className="version-preview__time">
                {formatDate(previewing.createdAt)}, {timeOf(previewing.createdAt)}
              </p>
            </div>
            <ModalCloseButton onClick={() => setPreviewing(null)} />
          </header>
          <div className="version-preview__body">
            {previewing.loading ? (
              <p className="version-drawer__state" role="status">
                Loading version…
              </p>
            ) : previewError ? (
              <p className="version-drawer__state" role="alert">
                {previewError}
              </p>
            ) : (
              <BlockPreview
                blocks={previewing.content?.content ?? []}
                label={`Version ${previewing.number} contents`}
              />
            )}
          </div>
          <footer className="version-preview__footer">
            <Button variant="secondary" onClick={() => setPreviewing(null)}>
              Close
            </Button>
            <Button
              icon={RotateCcw}
              onClick={() => {
                setPreviewing(null);
                setRestoring(previewing);
              }}
            >
              Restore this version
            </Button>
          </footer>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(restoring)}
        title={`Restore Version ${restoring?.number ?? ''}?`}
        description={
          <>
            <p>
              The document and case details go back to this version. Later versions are kept, and
              this restore is added to the history as a new version.
            </p>
            <p>{restoring?.label}</p>
          </>
        }
        confirmLabel="Restore version"
        onCancel={() => setRestoring(null)}
        onConfirm={() => {
          const version = restoring;
          setRestoring(null);
          onRestore(version);
        }}
      />
    </>
  );
}
