/**
 * The CASEONE account as Legal Drafting shows it — links into the EXISTING main-site
 * login / dashboard pages and the "come back here after login" path. Pure functions.
 *
 * There is no second login: signing in always happens on the main site (login.html /
 * lawyer-login.html, auth.js). Both sites share the backend's httpOnly refresh cookie,
 * so after that login this app picks up the same session on load.
 */
import { sitePrefix } from './sitePaths';

const DRAFTING_ROLES = ['customer', 'lawyer'];

export function canUseDrafting(user) {
  return Boolean(user) && DRAFTING_ROLES.includes(user.role);
}

export function roleLabel(role) {
  if (role === 'lawyer') return 'Lawyer account';
  if (role === 'customer') return 'Customer account';
  if (role === 'admin') return 'Admin account';
  return 'Account';
}

/** Existing main-site login page for a role (lawyers have their own). */
export function loginPageFor(role) {
  return role === 'lawyer' ? 'lawyer-login.html' : 'login.html';
}

/** Existing main-site dashboard for a role. */
export function dashboardPageFor(role) {
  return role === 'lawyer' ? 'lawyer-dashboard.html' : 'customer-dashboard.html';
}

/** Absolute URL of a main-site page, from the main-site base URL. */
export function mainSitePage(page, mainSiteUrl) {
  return new URL(page, mainSiteUrl).href;
}

/**
 * The page to come back to after logging in, as the main site's auth.js expects it in
 * sessionStorage "postLoginRedirect": a path relative to the site root, e.g.
 * "legal-drafting/draft/65a1…". Only path characters are kept (no query or hash), so it
 * always passes auth.js's safePostLoginRedirect().
 */
export function draftingReturnPath(pathname) {
  const path = String(pathname ?? '');
  const prefix = sitePrefix(path);
  if (prefix === null) return 'legal-drafting/';
  const rest = path.slice(prefix.length + 1); // "legal-drafting/…"
  const clean = rest.replace(/[^A-Za-z0-9_\-./]/g, '');
  if (!clean.startsWith('legal-drafting/') || clean.includes('..') || clean.includes('//')) {
    return 'legal-drafting/';
  }
  return clean;
}

/**
 * Sends the browser to the existing CASEONE login page and asks it to return here.
 * `role` picks the customer or lawyer login (default customer).
 */
export function goToCaseoneLogin({ role, mainSiteUrl, location = window.location, storage = window.sessionStorage }) {
  try {
    storage.setItem('postLoginRedirect', draftingReturnPath(location.pathname));
  } catch {
    // storage blocked: the login still works, it just lands on the default page
  }
  location.assign(mainSitePage(loginPageFor(role), mainSiteUrl));
}

/** True when a request failed because the CASEONE server could not answer (not a sign-out). */
export function isServerUnavailable(error) {
  return ['network', 'offline', 'unavailable'].includes(error?.code);
}

/**
 * What the app does with the result of restoring the CASEONE session on load.
 * @param {{ user?: object|null, error?: any }} result
 * @returns {{ status: 'authenticated'|'anonymous'|'unavailable', storage: 'account'|'guest'|'checking',
 *             user: object|null, otherAccount: object|null }}
 */
export function sessionFromRestore({ user = null, error = null } = {}) {
  if (error) {
    return isServerUnavailable(error)
      ? { status: 'unavailable', storage: 'checking', user: null, otherAccount: null }
      : { status: 'anonymous', storage: 'guest', user: null, otherAccount: null };
  }
  if (user && !canUseDrafting(user)) return { status: 'anonymous', storage: 'guest', user: null, otherAccount: user };
  if (user) return { status: 'authenticated', storage: 'account', user, otherAccount: null };
  return { status: 'anonymous', storage: 'guest', user: null, otherAccount: null };
}
