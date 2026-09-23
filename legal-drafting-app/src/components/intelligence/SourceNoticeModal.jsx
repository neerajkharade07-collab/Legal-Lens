import { useRef } from 'react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import './SourceNoticeModal.css';

/** Shown for any "Open source" / "Verify source" action in demo mode. */
export function SourceNoticeModal({ open, onClose, subject }) {
  const closeRef = useRef(null);
  return (
    <Modal
      open={open}
      size="sm"
      onClose={onClose}
      labelledBy="source-title"
      describedBy="source-desc"
      initialFocusRef={closeRef}
      className="source-modal"
    >
      <div className="source-modal__header">
        <h2 id="source-title" className="source-modal__title">
          Source not connected
        </h2>
        <ModalCloseButton onClick={onClose} />
      </div>
      <div id="source-desc" className="source-modal__body">
        {subject && <p className="source-modal__subject">{subject}</p>}
        <p>Verified source integration will be connected to the backend.</p>
        <p>
          In this demo no source is linked and nothing shown has been verified. Do not rely on it.
        </p>
      </div>
      <div className="source-modal__footer">
        <Button ref={closeRef} onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
