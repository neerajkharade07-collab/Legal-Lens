/**
 * config.js
 *
 * Single place that knows where the Legal Lens backend API and the Legal
 * Drafting Assistant live.
 *
 * PRODUCTION (Vercel) and `npm start`: the whole site is served from one
 * origin — the main pages at "/", the Legal Drafting Assistant V2 at
 * "/legal-drafting/", and the backend API proxied at "/api" (see
 * scripts/build-vercel.mjs). Nothing here needs editing for deployment.
 *
 * LOCAL DEVELOPMENT with VS Code Live Server (port 5500) or opening files
 * directly: the backend runs on http://localhost:5000 and the drafting app's
 * dev server (`npm run dev` in legal-drafting-app/) on http://localhost:5173.
 */
const LEGAL_LENS_IS_STATIC_DEV =
  window.location.protocol === 'file:' ||
  window.location.port === '5500' ||
  window.location.port === '3000';
const API_BASE_URL = LEGAL_LENS_IS_STATIC_DEV ? 'http://localhost:5000/api' : '/api';

/** Legal Drafting Assistant V2 (React app in legal-drafting-app/). */
const LEGAL_DRAFTING_APP_URL = LEGAL_LENS_IS_STATIC_DEV
  ? 'http://localhost:5173/legal-drafting/'
  : '/legal-drafting/';
