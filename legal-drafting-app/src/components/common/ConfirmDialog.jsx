import { useRef } from 'react';
import { Modal, ModalCloseButton } from './Modal';
import { Button } from './Button';
import './ConfirmDialog.css';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  return (
    <Modal
      open={open}
      size="sm"
      onClose={onCancel}
      labelledBy="confirm-title"
      describedBy="confirm-desc"
      initialFocusRef={cancelRef}
      className="confirm"
    >
      <div className="confirm__header">
        <h2 id="confirm-title" className="confirm__title">
          {title}
        </h2>
        <ModalCloseButton onClick={onCancel} />
      </div>
      <div id="confirm-desc" className="confirm__body">
        {description}
      </div>
      <div className="confirm__footer">
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button className={tone === 'danger' ? 'confirm__danger' : undefined} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
