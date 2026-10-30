import { Check, CircleDot, CircleAlert } from 'lucide-react';
import { formatRelative } from '../../utils/date';
import { cn } from '../../utils/cn';
import { saveLocation } from '../../services/config';

// failed: the last save did not reach storage — the changes are only on this page.
const LABELS = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes', failed: 'Not saved', conflict: 'Not saved — changed elsewhere' };

export function SaveStatus({ status, lastSavedAt }) {
  return (
    <p
      className={cn('save-status', `save-status--${status}`)}
      role="status"
      aria-live="polite"
      title={
        status === 'failed'
          ? 'The last save failed. Your changes are kept on this page and will be saved again automatically, when you edit or when you press Save.'
          : status === 'conflict'
            ? 'This document was saved in another tab or on another device. Choose which text to keep.'
          : lastSavedAt
            ? `Last saved ${formatRelative(lastSavedAt)} ${saveLocation()}`
            : undefined
      }
    >
      {status === 'saved' && <Check size={14} strokeWidth={2} aria-hidden="true" />}
      {status === 'saving' && <span className="save-status__spinner" aria-hidden="true" />}
      {status === 'unsaved' && <CircleDot size={14} strokeWidth={2} aria-hidden="true" />}
      {(status === 'failed' || status === 'conflict') && <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />}
      {LABELS[status]}
    </p>
  );
}
