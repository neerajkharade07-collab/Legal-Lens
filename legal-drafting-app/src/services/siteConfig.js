/**
 * The main Legal Lens / CASEONE website. Both sites share one origin and the app
 * lives in the site's "legal-drafting/" folder, so home is the folder in front
 * of it: "/" in production, "/LegalLens-Claude-For-Upload/" when a local static
 * server serves the project folder. During `vite dev` the main site usually runs
 * separately (VS Code Live Server on 127.0.0.1:5500); override with
 * VITE_MAIN_SITE_URL if needed.
 */
import { resolveMainSiteUrl } from '../utils/sitePaths';

export const MAIN_SITE_URL = resolveMainSiteUrl({
  envUrl: import.meta.env?.VITE_MAIN_SITE_URL,
  dev: Boolean(import.meta.env?.DEV),
  location: window.location,
});

/** Main-site pages used from here. */
export const MAIN_SITE_SIGNUP_URL = new URL(
  'signup.html',
  new URL(MAIN_SITE_URL, window.location.href),
).href;
