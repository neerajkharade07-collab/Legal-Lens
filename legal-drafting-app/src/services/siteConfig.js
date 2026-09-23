/**
 * The main Legal Lens website. In production both sites are served from the
 * same origin (main site at "/", this app at "/legal-drafting/"), so home is
 * "/". During `vite dev` the main site usually runs separately (VS Code Live
 * Server on 127.0.0.1:5500); override with VITE_MAIN_SITE_URL if needed.
 */
export const MAIN_SITE_URL =
  import.meta.env?.VITE_MAIN_SITE_URL || (import.meta.env?.DEV ? 'http://127.0.0.1:5500/' : '/');

/** Main-site pages used from here. */
export const MAIN_SITE_SIGNUP_URL = new URL(
  'signup.html',
  new URL(MAIN_SITE_URL, window.location.href),
).href;
