export const DRAFT_LANGUAGES = [
  { id: 'en', label: 'English', nativeLabel: 'English', script: 'Latin' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', script: 'Devanagari' },
  { id: 'mr', label: 'Marathi', nativeLabel: 'मराठी', script: 'Devanagari' },
];

export const DEFAULT_LANGUAGE = 'en';

export function getLanguage(id) {
  return DRAFT_LANGUAGES.find((lang) => lang.id === id) ?? DRAFT_LANGUAGES[0];
}
