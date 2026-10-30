import { useId, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatRelative } from '../../utils/date';
import './SaveConflictDialog.css';

/**
 * Phase 6 — shown when a save was refused because the document was saved in another tab or on
 * another device after this page loaded it. Nothing has been overwritten. Whichever text the user
 * keeps, the other one is first recorded in Version history, so neither is lost.
 * The dialog cannot be dismissed without a choice (editing stays possible, nothing is saved).
 */
export function SaveConflictDialog({ conflict, onResolve }) {
  const titleId = useId();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const server = conflict?.document;

  const choose = async (choice) => {
    setBusy(choice);
    setError(null);
    try {
      await onResolve(choice);
    } catch (err) {
      setError(err?.message || 'That did not work. Nothing was overwritten. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={Boolean(conflict)} onClose={() => {}} closeOnBackdrop={false} labelledBy={titleId} size="sm" className="save-conflict">
      <div className="save-conflict__body">
        <h2 id={titleId}>This document was changed somewhere else</h2>
        <p>
          It was saved in another tab or on another device after you opened it here
          {server?.updatedAt ? ` (saved: ${formatRelative(server.updatedAt)})` : ''}. Your latest changes on this page have{' '}
          <strong>not</strong> been saved, and nothing has been overwritten.
        </p>
        <p className="save-conflict__note">Whichever you choose, the other text is kept in Version history.</p>
        {error && (
          <p className="save-conflict__error" role="alert">
            {error}
          </p>
        )}
        <div className="save-conflict__actions">
          <Button variant="secondary" icon={Download} disabled={Boolean(busy) || !server?.workspace} onClick={() => choose('latest')}>
            {busy === 'latest' ? 'Loading…' : 'Load the latest version'}
          </Button>
          <Button icon={Upload} disabled={Boolean(busy) || !server?.workspace} onClick={() => choose('mine')}>
            {busy === 'mine' ? 'Saving…' : 'Keep my version'}
          </Button>
        </div>
        {!server?.workspace && <p className="save-conflict__error">The newer version could not be loaded. Reload the page.</p>}
      </div>
    </Modal>
  );
}
