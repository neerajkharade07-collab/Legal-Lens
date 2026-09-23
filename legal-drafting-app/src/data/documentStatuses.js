export const DOCUMENT_STATUSES = {
  draft: { id: 'draft', label: 'Draft', tone: 'neutral' },
  'needs-review': { id: 'needs-review', label: 'Needs Review', tone: 'warning' },
  reviewed: { id: 'reviewed', label: 'Reviewed', tone: 'outline' },
  completed: { id: 'completed', label: 'Completed', tone: 'success' },
};

/** Statuses a user can set from My Documents. */
export const SETTABLE_STATUSES = ['draft', 'needs-review', 'reviewed', 'completed'];

export function getStatus(id) {
  return DOCUMENT_STATUSES[id] ?? DOCUMENT_STATUSES.draft;
}
