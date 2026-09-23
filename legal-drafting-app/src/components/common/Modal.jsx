import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { cn } from '../../utils/cn';
import './Modal.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog: portal, focus trap, Escape to close, focus restore.
 * `onClose` is a *request* — callers may intercept it (e.g. unsaved changes).
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  size = 'md',
  initialFocusRef,
  closeOnBackdrop = true,
  className,
  children,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const target =
      initialFocusRef?.current ?? dialogRef.current?.querySelector(FOCUSABLE) ?? dialogRef.current;
    target?.focus({ preventScroll: true });
    return () => {
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocusRef]);

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter(
      (node) => node.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="modal-root">
      <div
        className="modal__backdrop"
        aria-hidden="true"
        onMouseDown={closeOnBackdrop ? () => onCloseRef.current?.() : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn('modal', `modal--${size}`, className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalCloseButton({ onClick, label = 'Close dialog', disabled }) {
  return (
    <button
      type="button"
      className="modal__close"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <X size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
