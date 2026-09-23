import { Check, CircleDot } from 'lucide-react';
import { formatRelative } from '../../utils/date';
import { cn } from '../../utils/cn';
import { SAVE_LOCATION } from '../../services/config';

const LABELS = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved changes' };

export function SaveStatus({ status, lastSavedAt }) {
  return (
    <p
      className={cn('save-status', `save-status--${status}`)}
      role="status"
      aria-live="polite"
      title={lastSavedAt ? `Last saved ${formatRelative(lastSavedAt)} ${SAVE_LOCATION}` : undefined}
    >
      {status === 'saved' && <Check size={14} strokeWidth={2} aria-hidden="true" />}
      {status === 'saving' && <span className="save-status__spinner" aria-hidden="true" />}
      {status === 'unsaved' && <CircleDot size={14} strokeWidth={2} aria-hidden="true" />}
      {LABELS[status]}
    </p>
  );
}
