/**
 * Where the app, the main CASEONE site and the backend API are, worked out from
 * the page address (Phase 1 compatibility fix). Pure functions — testable in Node.
 *
 * The app always lives in a ".../legal-drafting/" folder of the main site:
 *   production (Vercel)      https://site/legal-drafting/…                       → prefix ""
 *   local static server      http://127.0.0.1:3000/LegalLens-Claude-For-Upload/legal-drafting/…
 *                                                                               → prefix "/LegalLens-Claude-For-Upload"
 */
const APP_SEGMENT = '/legal-drafting/';

/** Path in front of "/legal-drafting/", or null when the page is not inside that folder. */
export function sitePrefix(pathname) {
  const path = String(pathname ?? '');
  const at = path.indexOf(APP_SEGMENT);
  return at >= 0 ? path.slice(0, at) : null;
}

/**
 * Main-site home page. VITE_MAIN_SITE_URL wins; `vite dev` (port 5173) keeps the
 * old default (Live Server on 5500); otherwise the folder that contains
 * legal-drafting/ on the same origin — "/" in production, ".../LegalLens-Claude-For-Upload/" locally.
 */
export function resolveMainSiteUrl({ envUrl, dev, location }) {
  if (envUrl) return envUrl;
  if (dev) return 'http://127.0.0.1:5500/';
  if (!location?.origin) return '/';
  return `${location.origin}${sitePrefix(location.pathname) ?? ''}/`;
}

/**
 * Backend API base. VITE_API_BASE_URL wins. A local static server (VS Code Live
 * Preview / Live Server, or `npm run dev:site`, on port 3000, 3100 or 5500) is
 * treated exactly like the main site's config.js does: the backend is called on
 * port 5000 of the SAME hostname, so both sites use the same backend host and
 * share its httpOnly refresh cookie (one login). Everywhere else (Vercel,
 * `npm start`, `vite dev`) /api on the same origin is proxied.
 */
export const LOCAL_STATIC_PORTS = ['3000', '3100', '5500'];

export function resolveApiBaseUrl({ envUrl, location }) {
  if (envUrl) return String(envUrl).replace(/\/+$/, '');
  if (location && LOCAL_STATIC_PORTS.includes(location.port)) {
    const host = location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
    return `http://${host}:5000/api`;
  }
  return '/api';
}
