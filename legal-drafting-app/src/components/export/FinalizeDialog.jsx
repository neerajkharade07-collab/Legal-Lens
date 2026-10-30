import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileDown,
  FileText,
  Info,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { runFinalizeChecklist } from '../../utils/finalizeChecklist';
import './FinalizeDialog.css';

const LEVELS = [
  { id: 'blocking', label: 'Must fix', icon: AlertOctagon },
  { id: 'warning', label: 'Check', icon: AlertTriangle },
  { id: 'info', label: 'Suggestions', icon: Info },
];

const STATUS_TONE = { draft: 'warning', saved: 'outline', finalized: 'inverse' };

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
};

/**
 * Legal Drafting Phase 4 — readiness check, exports and "Finalize Draft".
 *
 * The checklist is deterministic (finalizeChecklist.js) and never edits the document. Finalizing
 * saves first and records an unchangeable copy of exactly the saved content; editing continues
 * normally afterwards (a later change is a new revision, and may be finalized again).
 */
export function FinalizeDialog({
  open,
  onClose,
  document,
  fin,
  nav,
  onPreview,
  onExportWordHtml,
  loadVersion,
  toast,
}) {
  const titleId = useId();
  const [report, setReport] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [step, setStep] = useState('check'); // check | confirm
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(null); // 'finalize' | 'docx' | `v:${id}:…`
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const runCheck = useCallback(() => {
    setReport(
      runFinalizeChecklist({ content: fin.currentContent(), title: document.name, typeId: document.typeId }),
    );
    setCheckedAt(new Date());
  }, [fin, document.name, document.typeId]);

  // Fresh check every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    runCheck();
    fin.refresh();
    setStep('check');
    setAck(false);
    setError(null);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open]);

  const grouped = useMemo(() => {
    const out = { blocking: [], warning: [], info: [] };
    (report?.findings ?? []).forEach((f) => out[f.level].push(f));
    return out;
  }, [report]);

  const goTo = (location) => {
    onClose();
    if (location.kind === 'token') nav.goToToken(location.key);
    else nav.goToText(location.text);
  };

  const run = async (key, fn, failTitle) => {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError({ title: failTitle, message: err?.message || 'Something went wrong. Nothing was changed.' });
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const exportWord = (versionId) =>
    run(versionId ? `v:${versionId}:docx` : 'docx', async () => {
      const { filename, unsupported } = await fin.exportWord(versionId);
      toast({
        title: 'Word document downloaded',
        description: unsupported.length
          ? `${filename} — some elements were exported as plain text (${unsupported.join(', ')}).`
          : filename,
        variant: 'success',
      });
    }, 'Word export failed');

  const printPdf = (content, title, key = 'pdf') =>
    run(key, async () => {
      await fin.printPdf(content, title);
    }, 'Could not open the print dialog');

  const snapshot = async (version, action) => {
    const key = `v:${version.id}:${action}`;
    await run(key, async () => {
      const full = await loadVersion(version.id);
      if (!full?.content) throw new Error('The finalized version could not be loaded.');
      const title = `${version.title || document.name} (Finalized Draft v${version.number})`;
      if (action === 'preview') {
        onClose();
        onPreview({ content: full.content, versionId: version.id, title, label: `Finalized Draft — version ${version.number}. Not approved, signed or legally validated.` });
      } else {
        await fin.printPdf(full.content, title);
      }
    }, 'Could not open the finalized version');
  };

  const doFinalize = () =>
    run('finalize', async () => {
      const out = await fin.finalize({ warningsAcknowledged: report?.counts.warning ?? 0 });
      setSuccess(
        out.created
          ? `Saved as Finalized Draft — version ${out.finalized.number}.`
          : `This exact content is already Finalized Draft version ${out.finalized.number}. Nothing new was created.`,
      );
      setStep('check');
      setAck(false);
      runCheck();
    }, 'Not finalized');

  const counts = report?.counts ?? { blocking: 0, warning: 0, info: 0 };
  const canFinalize = fin.serverDoc && report?.canFinalize && !busy;
  const needsAck = counts.warning > 0;
  const status = fin.status;

  return (
    <Modal open={open} onClose={busy === 'finalize' ? undefined : onClose} labelledBy={titleId} size="lg" className="fz">
      <header className="fz__head">
        <div className="fz__head-text">
          <h2 id={titleId}>Finalize and export</h2>
          <p className="fz__status">
            <Badge tone={STATUS_TONE[status.id]} icon={status.id === 'finalized' ? Lock : undefined}>
              {status.label}
            </Badge>
            <span>{status.detail}</span>
          </p>
        </div>
        <ModalCloseButton onClick={onClose} disabled={busy === 'finalize'} />
      </header>

      <div className="fz__body">
        {error && (
          <div className="fz__alert fz__alert--error" role="alert">
            <AlertOctagon size={16} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <strong>{error.title}</strong>
              <p>{error.message}</p>
            </div>
          </div>
        )}
        {success && (
          <div className="fz__alert fz__alert--success" role="status">
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <strong>{success}</strong>
              <p>You can keep editing — later changes are saved as new revisions and never alter this copy.</p>
            </div>
          </div>
        )}

        {step === 'check' ? (
          <>
            <section className="fz__section" aria-labelledby={`${titleId}-check`}>
              <div className="fz__section-head">
                <h3 id={`${titleId}-check`}>Readiness check</h3>
                <Button variant="ghost" size="sm" icon={RefreshCw} onClick={runCheck}>
                  Check again
                </Button>
              </div>
              <p className="fz__summary" aria-live="polite">
                {counts.blocking === 0 && counts.warning === 0
                  ? 'No problems found by the automatic checks.'
                  : `${counts.blocking} must fix · ${counts.warning} to check · ${counts.info} suggestion${counts.info === 1 ? '' : 's'}`}
                {checkedAt && <span className="fz__muted"> · checked {checkedAt.toLocaleTimeString()}</span>}
              </p>
              {LEVELS.map(({ id, label, icon }) => {
                const Icon = icon;
                return grouped[id].length ? (
                  <div key={id} className={`fz__group fz__group--${id}`}>
                    <h4>
                      <Icon size={14} strokeWidth={1.9} aria-hidden="true" /> {label}
                    </h4>
                    <ul>
                      {grouped[id].map((f) => (
                        <li key={f.id} className="fz__finding">
                          <div className="fz__finding-text">
                            <strong>{f.title}</strong>
                            <span>{f.detail}</span>
                          </div>
                          {f.location && (
                            <Button variant="secondary" size="sm" iconRight={ArrowRight} onClick={() => goTo(f.location)}>
                              Go to
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })}
              <p className="fz__note">
                Automatic checks of the text only (placeholders, empty fields, structure). They are not a legal review and cannot
                confirm that the document is correct, complete or valid.
              </p>
            </section>

            <section className="fz__section" aria-labelledby={`${titleId}-export`}>
              <h3 id={`${titleId}-export`}>Preview and export</h3>
              <div className="fz__actions">
                <Button variant="secondary" size="sm" icon={Eye} onClick={() => { onClose(); onPreview(); }}>
                  Preview
                </Button>
                <Button variant="secondary" size="sm" icon={FileDown} onClick={() => printPdf()} disabled={Boolean(busy)}>
                  Export PDF
                </Button>
                {fin.serverDoc ? (
                  <Button variant="secondary" size="sm" icon={FileText} onClick={() => exportWord()} disabled={Boolean(busy)}>
                    {busy === 'docx' ? 'Preparing…' : 'Export Word (.docx)'}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={FileText} onClick={onExportWordHtml}>
                    Word-compatible (.doc)
                  </Button>
                )}
              </div>
              <p className="fz__note">
                Export PDF opens your browser’s print dialog for the document only — choose “Save as PDF”. A4 pages, with page
                numbers in Chrome and Edge.{' '}
                {fin.serverDoc
                  ? 'The Word file is created by CASEONE from your saved document and downloaded privately.'
                  : 'A real .docx and Finalize need a signed-in CASEONE account; this Demo Mode document is saved only in this browser.'}
              </p>
            </section>

            <section className="fz__section" aria-labelledby={`${titleId}-final`}>
              <h3 id={`${titleId}-final`}>Finalize Draft</h3>
              <p className="fz__text">
                Saves the document, then keeps an unchangeable copy of exactly this saved version, linked to the document with
                the date and your account. You can still edit the document afterwards.
              </p>
              {!fin.serverDoc && (
                <p className="fz__note">Sign in with a CASEONE customer or lawyer account to finalize documents.</p>
              )}
              {fin.serverDoc && counts.blocking > 0 && (
                <p className="fz__note fz__note--block">Fix the items under “Must fix” first.</p>
              )}
              <div className="fz__actions">
                <Button
                  icon={Lock}
                  disabled={!canFinalize}
                  onClick={() => {
                    runCheck();
                    setStep('confirm');
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Finalize Draft…
                </Button>
              </div>
            </section>

            {fin.serverDoc && (
              <section className="fz__section" aria-labelledby={`${titleId}-list`}>
                <h3 id={`${titleId}-list`}>Finalized drafts</h3>
                {fin.listStatus === 'loading' && <p className="fz__muted">Loading…</p>}
                {fin.listStatus === 'error' && (
                  <p className="fz__muted">
                    Could not load finalized drafts.{' '}
                    <button type="button" className="fz__link" onClick={fin.refresh}>
                      Try again
                    </button>
                  </p>
                )}
                {fin.listStatus === 'ready' && fin.finalized.length === 0 && (
                  <p className="fz__muted">None yet.</p>
                )}
                {fin.finalized.length > 0 && (
                  <ul className="fz__versions">
                    {fin.finalized.map((v) => (
                      <li key={v.id} className="fz__version">
                        <div className="fz__version-text">
                          <strong>
                            Finalized Draft · version {v.number}
                            {v.matchesSaved && (
                              <Badge tone="outline" className="fz__current">
                                Current
                              </Badge>
                            )}
                          </strong>
                          <span>
                            {formatDate(v.finalizedAt)}
                            {v.warningsAcknowledged > 0 &&
                              ` · ${v.warningsAcknowledged} warning${v.warningsAcknowledged === 1 ? '' : 's'} acknowledged`}
                          </span>
                        </div>
                        <div className="fz__version-actions">
                          <Button variant="ghost" size="sm" icon={Eye} disabled={Boolean(busy)} onClick={() => snapshot(v, 'preview')}>
                            Preview
                          </Button>
                          <Button variant="ghost" size="sm" icon={FileDown} disabled={Boolean(busy)} onClick={() => snapshot(v, 'pdf')}>
                            PDF
                          </Button>
                          <Button variant="ghost" size="sm" icon={FileText} disabled={Boolean(busy)} onClick={() => exportWord(v.id)}>
                            Word
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="fz__section fz__confirm" aria-labelledby={`${titleId}-confirm`}>
            <h3 id={`${titleId}-confirm`}>Finalize this draft?</h3>
            <ul className="fz__bullets">
              <li>The document is saved now, and an unchangeable copy of the saved version is kept as a “Finalized Draft”.</li>
              <li>The copy cannot be edited or overwritten. Earlier versions are kept. You can continue editing the document.</li>
              <li>
                <strong>A Finalized Draft is not approved, signed, notarised, registered or legally validated.</strong> Have it
                checked by a qualified advocate before you rely on it or file it.
              </li>
            </ul>
            {report && !report.canFinalize && (
              <p className="fz__note fz__note--block">Something must be fixed first — go back to see it.</p>
            )}
            {needsAck && (
              <label className="fz__ack">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>
                  I have reviewed the {counts.warning} item{counts.warning === 1 ? '' : 's'} to check and want to finalize anyway.
                </span>
              </label>
            )}
            <div className="fz__actions fz__actions--end">
              <Button variant="secondary" size="sm" onClick={() => setStep('check')} disabled={busy === 'finalize'}>
                Back
              </Button>
              <Button
                size="sm"
                icon={Lock}
                onClick={doFinalize}
                disabled={!canFinalize || (needsAck && !ack) || busy === 'finalize'}
              >
                {busy === 'finalize' ? 'Finalizing…' : 'Finalize Draft'}
              </Button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
