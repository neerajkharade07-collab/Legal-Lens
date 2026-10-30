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
  window.location.port === '3000' ||
  window.location.port === '3100';
// Local dev: call the backend on the SAME hostname as the page (127.0.0.1 or
// localhost). Browsers treat those two as different sites, so mixing them
// would stop the login refresh cookie from being sent (no session restore).
const LEGAL_LENS_DEV_API_HOST =
  window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
const API_BASE_URL = LEGAL_LENS_IS_STATIC_DEV ? 'http://' + LEGAL_LENS_DEV_API_HOST + ':5000/api' : '/api';

/**
 * Legal Drafting Assistant V2 (React app in legal-drafting-app/).
 * Port 3000 / 3100 (VS Code Live Preview, or `npm run dev:site`): the built copy in the
 * site's own legal-drafting/ folder, next to this config.js — e.g.
 * http://127.0.0.1:3000/LegalLens-Claude-For-Upload/legal-drafting/.
 * Port 5500 / file: — the drafting dev server (`npm run dev:drafting`) as before.
 */
const LEGAL_DRAFTING_APP_URL = (function () {
  if (!LEGAL_LENS_IS_STATIC_DEV) return '/legal-drafting/';
  if (window.location.port === '3000' || window.location.port === '3100') {
    try {
      return new URL('legal-drafting/', document.currentScript.src).href;
    } catch (e) {
      return new URL('legal-drafting/', window.location.href).href;
    }
  }
  return 'http://localhost:5173/legal-drafting/';
})();