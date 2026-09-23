import { useRef, useState } from 'react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import { documentStorageService } from '../../services';
import './Documents.css';
import { SAVE_LOCATION } from '../../services/config';

/**
 * Rename dialog shared by My Documents and the Draft Workspace.
 * `onRename(name)` returns an error message or null.
 */
export function RenameDialog({ document: doc, onRename, onClose }) {
  if (!doc) return null;
  return <RenameForm key={doc.id} doc={doc} onRename={onRename} onClose={onClose} />;
}

function RenameForm({ doc, onRename, onClose }) {
  const inputRef = useRef(null);
  const [value, setValue] = useState(doc.name);
  const [error, setError] = useState(null);

  function handleSubmit(event) {
    event.preventDefault();
    const message = onRename(value);
    if (message) {
      setError(message);
      inputRef.current?.focus();
    } else {
      onClose();
    }
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      labelledBy="rename-title"
      initialFocusRef={inputRef}
      className="rename-dialog"
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="rename-dialog__header">
          <h2 id="rename-title" className="rename-dialog__title">
            Rename document
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>
        <div className="rename-dialog__body form-field">
          <label htmlFor="rename-input" className="form-label">
            Title
          </label>
          <input
            ref={inputRef}
            id="rename-input"
            className="form-input"
            value={value}
            maxLength={documentStorageService.TITLE_MAX + 20}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={(e) => e.target.select()}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'rename-error' : 'rename-hint'}
            autoComplete="off"
          />
          {error ? (
            <p id="rename-error" className="form-error" role="alert">
              {error}
            </p>
          ) : (
            <p id="rename-hint" className="form-hint">
              Up to {documentStorageService.TITLE_MAX} characters. Saved {SAVE_LOCATION}.
            </p>
          )}
        </div>
        <div className="rename-dialog__footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save title</Button>
        </div>
      </form>
    </Modal>
  );
}
