/**
 * Service configuration.
 *
 * While USE_MOCKS is true every service resolves from local demo data /
 * localStorage. When the backend exists, set VITE_USE_MOCKS=false and fill in
 * the `fetch` branches inside each service — components do not change.
 */
export const USE_MOCKS = import.meta.env?.VITE_USE_MOCKS !== 'false';

export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '/api';

/** Simulated latency so loading states are exercised in demo mode. */
export const MOCK_LATENCY_MS = 350;

export function simulateLatency(value, ms = MOCK_LATENCY_MS) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

/** Metadata attached to every mock response so the UI can label it honestly. */
export const DEMO_META = Object.freeze({
  source: 'demo',
  verificationStatus: 'unverified',
});

/** Metadata for demo analysis results (Step 5 intelligence services). */
export function demoAnalysisMeta() {
  return {
    source: 'demo',
    verificationStatus: 'requires_verification',
    generatedAt: new Date().toISOString(),
  };
}

export function notConnected(name) {
  return new Error(`${name} is not connected yet.`);
}

/**
 * Where documents live is decided at RUN TIME by the session (Phase 1):
 *  - 'account'  — signed in as a CASEONE customer or lawyer: every document,
 *                 autosave, version and AI draft goes to the backend (MongoDB);
 *  - 'guest'    — signed out: a clearly labelled Demo Mode, documents only in
 *                 this browser (localStorage), no AI;
 *  - 'checking' — the session is still being restored (nothing is saved yet).
 * AuthProvider sets the mode; nothing else changes it. There is no silent
 * fallback: a document is always saved where it came from, and a failed account
 * save is reported as failed — never "saved in this browser" instead.
 */
let storageMode = 'checking';

export function setStorageMode(mode) {
  storageMode = mode === 'account' || mode === 'guest' ? mode : 'checking';
}

export function getStorageMode() {
  return storageMode;
}

export function isGuestMode() {
  return storageMode === 'guest';
}

/** Ids of drafts kept only in this browser (Demo Mode) — see guestDocumentStore. */
export function isGuestId(id) {
  return /^local-/.test(String(id ?? ''));
}

/** Where documents are saved, for user-facing messages ("Saved …"). */
export function saveLocation() {
  if (storageMode === 'account') return 'to your account';
  if (storageMode === 'guest') return 'in this browser (Demo Mode)';
  return 'once your session is ready';
}

export const AI_DRAFT_UNAVAILABLE_MESSAGE =
  'AI drafting needs a signed-in CASEONE customer or lawyer account. Sign in, or untick “Write the full draft with AI” to create the structured template draft.';
