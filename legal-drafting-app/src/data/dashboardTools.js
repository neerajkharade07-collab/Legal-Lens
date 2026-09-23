/** Secondary tools promoted on the dashboard. */
export const DASHBOARD_TOOLS = [
  {
    id: 'review',
    title: 'Review an existing document',
    description: 'Upload a PDF, DOCX or scanned image and run a structured review.',
    to: '/review',
    icon: 'review',
    cta: 'Start review',
  },
  {
    id: 'compare',
    title: 'Compare two versions',
    description: 'See additions, deletions and modifications in a redline view.',
    to: '/compare',
    icon: 'compare',
    cta: 'Compare documents',
  },
  {
    id: 'limitation',
    title: 'Limitation calculator',
    description: 'Work out an indicative deadline from a relevant event date.',
    to: '/limitation',
    icon: 'limitation',
    cta: 'Open calculator',
  },
];

export const DRAFTING_STEPS = [
  { id: 'describe', title: 'Describe', text: 'Explain the matter in your own words.' },
  { id: 'draft', title: 'Draft', text: 'Get a structured preliminary draft.' },
  { id: 'refine', title: 'Refine', text: 'Fill details and edit the live document.' },
  { id: 'review', title: 'Review', text: 'Check health, clauses and references.' },
  { id: 'export', title: 'Export', text: 'Format, preview and download.' },
];
