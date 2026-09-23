/**
 * Safe localStorage helpers. Storage can be unavailable (private mode,
 * blocked site data) — every call is wrapped so the UI never crashes.
 */
const PREFIX = 'legal-lens:';

export const STORAGE_KEYS = {
  documents: 'documents:v1',
  favoriteTemplates: 'favorite-templates:v1',
  recentTemplates: 'recent-templates:v1',
  /** Per document: `versions:v1:<docId>` (see services/versionService). */
  versionsPrefix: 'versions:v1:',
  printOptions: 'print-options:v1',
};

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}
