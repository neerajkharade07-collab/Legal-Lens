/** Toolbar options for the document editor. */
export const FONT_FAMILIES = [
  { id: 'default', label: 'Default (Times New Roman)', value: null },
  { id: 'times', label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { id: 'georgia', label: 'Georgia', value: 'Georgia, serif' },
  { id: 'source-serif', label: 'Source Serif', value: '"Source Serif 4", Georgia, serif' },
  { id: 'arial', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  {
    id: 'devanagari',
    label: 'Noto Sans Devanagari',
    value: '"Noto Sans Devanagari", Mangal, sans-serif',
  },
];

export const FONT_SIZES = [
  { id: 'default', label: 'Default (12)', value: null },
  ...[10, 11, 12, 13, 14, 16, 18].map((pt) => ({
    id: String(pt),
    label: String(pt),
    value: `${pt}pt`,
  })),
];

export const LINE_SPACINGS = [
  { id: '1', label: 'Single (1.0)', value: 1 },
  { id: '1.15', label: '1.15', value: 1.15 },
  { id: '1.5', label: '1.5', value: 1.5 },
  { id: '2', label: 'Double (2.0)', value: 2 },
];

export const DEFAULT_FORMATTING = { lineHeight: 1.5 };
