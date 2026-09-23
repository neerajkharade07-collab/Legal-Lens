/** Processing stages shown during a (demo) review / comparison. */
export const REVIEW_STAGES = [
  { id: 'read', label: 'Reading document' },
  { id: 'extract', label: 'Extracting text', ocrLabel: 'Extracting text (demo OCR)' },
  { id: 'structure', label: 'Analysing structure' },
  { id: 'completeness', label: 'Checking completeness' },
  { id: 'prepare', label: 'Preparing review' },
];

export const COMPARE_STAGES = [
  { id: 'read', label: 'Reading both documents' },
  { id: 'extract', label: 'Extracting text' },
  { id: 'align', label: 'Aligning sections' },
  { id: 'diff', label: 'Finding changes' },
];
