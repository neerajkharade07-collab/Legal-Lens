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
 * SIH demo: the Legal Drafting Assistant runs in Guest / Demo Mode — no sign-in
 * gate, documents are kept only in this browser (localStorage). No account,
 * token or session is created or faked. Build with
 * VITE_DRAFTING_REQUIRE_AUTH=true to restore the signed-in, backend-saved flow
 * (AuthGate / SignInPanel are kept in the source for that).
 */
export const DRAFTING_GUEST_MODE = import.meta.env?.VITE_DRAFTING_REQUIRE_AUTH !== 'true';

/** Where documents are saved, for user-facing messages ("Saved …"). */
export const SAVE_LOCATION = DRAFTING_GUEST_MODE
  ? 'in this browser (Demo Mode)'
  : 'to your account';

export const AI_DRAFT_UNAVAILABLE_MESSAGE =
  'AI drafting is not connected in Demo Mode. Untick “Write the full draft with AI” to create the structured template draft.';
