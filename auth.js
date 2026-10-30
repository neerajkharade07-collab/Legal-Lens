/**
 * auth.js
 *
 * Real authentication for both the customer flow and the Lawyer Connect
 * lawyer flow, backed by the Legal Lens API (see /backend). Requires
 * config.js (API_BASE_URL) to be loaded first.
 *
 * The access token lives only in memory (a module-level variable) --
 * never in localStorage -- per the project's security requirements. The
 * refresh token is an httpOnly cookie the browser sends automatically
 * and this file never touches directly. On every page load, restoreSession()
 * silently exchanges that cookie for a fresh access token so the visitor
 * doesn't need to log in again on every page.
 *
 * localStorage still holds a few NON-secret convenience flags
 * (loggedIn, userRole, userName, userEmail, currentLawyerId) purely so
 * existing UI code elsewhere (nav bar greeting, etc.) can render
 * synchronously without an API call. These flags are never used to make
 * an authorization decision -- the backend enforces that independently
 * on every request via the access token.
 */

let accessToken = null;
let currentUser = null; // { id, name, email, role }

function getAccessToken() {
  return accessToken;
}

function getCurrentUser() {
  return currentUser;
}

async function apiRequest(path, { method = 'GET', body, useAuth = false, extraHeaders } = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {});
  if (useAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include', // sends/receives the httpOnly refresh cookie
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try { payload = await res.json(); } catch (e) { /* empty body */ }

  if (!res.ok) {
    const message = (payload && payload.message) || `Request failed (${res.status}).`;
    const error = new Error(message);
    error.statusCode = res.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

/** Where a customer lands after logging in / signing up with no pending page. */
const CUSTOMER_HOME_PAGE = 'index.html';

/**
 * Accepts a postLoginRedirect only if it is a page of THIS site given as a
 * relative path (e.g. "legal-tracker.html", "smart-case-builder.html#case/x",
 * "legal-help-dashboard/index.html"). Anything else -- another site, a
 * "javascript:" URL, "//host", a path with ".." -- is ignored, so the value can
 * never send the customer somewhere unexpected.
 */
function safePostLoginRedirect(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  // A page of the Legal Drafting app (it has no ".html" in its addresses), e.g.
  // "legal-drafting/draft/65a1…" — set by the app when it sends someone to log in.
  if (isDraftingRedirect(v)) return v;
  const pathPart = v.split(/[?#]/)[0];
  if (!/^[A-Za-z0-9][A-Za-z0-9_\-./]*\.html$/.test(pathPart)) return null;
  if (pathPart.indexOf('..') !== -1 || pathPart.indexOf('//') !== -1) return null;
  if (/[\s\\<>"']/.test(v)) return null;
  return v;
}

/** "legal-drafting/…" made only of path characters (no "..", no "//", no query). */
function isDraftingRedirect(v) {
  return typeof v === 'string' &&
    /^legal-drafting\/[A-Za-z0-9_\-./]*$/.test(v) &&
    v.indexOf('..') === -1 && v.indexOf('//') === -1;
}

/**
 * For LAWYER logins: only a Legal Drafting page is honoured (lawyers otherwise always
 * land on their dashboard, as before). Reads and clears the stored value either way.
 */
function takeDraftingRedirect() {
  const value = takePostLoginRedirect();
  return isDraftingRedirect(value) ? value : null;
}

/** Reads (and clears) the page a customer was trying to open before login. */
function takePostLoginRedirect() {
  let value = null;
  try {
    value = sessionStorage.getItem('postLoginRedirect');
    sessionStorage.removeItem('postLoginRedirect');
  } catch (e) { /* storage blocked */ }
  return safePostLoginRedirect(value);
}

function setUiConvenienceFlags(role, user, lawyerId) {
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('userRole', role);
  if (user && user.name) localStorage.setItem('userName', user.name);
  if (user && user.email) localStorage.setItem('userEmail', user.email);
  if (lawyerId) localStorage.setItem('currentLawyerId', lawyerId);
}

function clearUiConvenienceFlags() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('userRole');
  localStorage.removeItem('currentLawyerId');
  // Name/email are personal details: never keep them after logout or an
  // invalid/expired session.
  localStorage.removeItem('userName');
  localStorage.removeItem('userEmail');
}

/**
 * Logs in against the real API. `role` selects which endpoint to call;
 * email/password come from the calling page's form fields.
 * Returns the API response's `data` object on success (user, accessToken,
 * and lawyerId when role === 'lawyer'), and performs the same
 * post-login redirect behavior the prototype had.
 */
async function loginUser(role, email, password) {
  role = role || 'customer';
  const endpoint = role === 'lawyer' ? '/auth/lawyer/login'
    : role === 'admin' ? '/auth/admin/login'
      : '/auth/customer/login';

  const res = await apiRequest(endpoint, { method: 'POST', body: { email, password } });

  accessToken = res.data.accessToken;
  currentUser = res.data.user;
  setUiConvenienceFlags(role, res.data.user, res.data.lawyerId);

  if (role === 'lawyer') {
    // Back to Legal Drafting if it sent the lawyer here, otherwise the dashboard.
    window.location.href = takeDraftingRedirect() || 'lawyer-dashboard.html';
    return res.data;
  }
  if (role === 'admin') {
    // Admin review page (lawyer verification / publication).
    window.location.href = 'admin-lawyers.html';
    return res.data;
  }

  // Back to the protected page that sent the customer to log in, otherwise
  // to the customer's private dashboard.
  window.location.href = takePostLoginRedirect() || CUSTOMER_HOME_PAGE;
  return res.data;
}

/**
 * Signs up against the real API. `role` selects the endpoint.
 * `details` is { name, email, password, phone?, barRegistrationNumber? }.
 */
async function signupUser(role, details) {
  role = role || 'customer';
  const endpoint = role === 'lawyer' ? '/auth/lawyer/signup' : '/auth/customer/signup';

  const res = await apiRequest(endpoint, { method: 'POST', body: details });

  accessToken = res.data.accessToken;
  currentUser = res.data.user;
  setUiConvenienceFlags(role, res.data.user, res.data.lawyerId);

  if (role === 'lawyer') {
    window.location.href = 'lawyer-dashboard.html';
    return res.data;
  }

  // Back to the protected page that sent the customer to log in, otherwise
  // to the customer's private dashboard.
  window.location.href = takePostLoginRedirect() || CUSTOMER_HOME_PAGE;
  return res.data;
}

/**
 * Where a signed-in account goes next: lawyers to their dashboard, customers
 * back to the protected page that sent them to log in, else their dashboard.
 */
function redirectAfterSignIn(role) {
  if (role === 'lawyer') {
    window.location.href = takeDraftingRedirect() || 'lawyer-dashboard.html';
    return;
  }
  window.location.href = takePostLoginRedirect() || CUSTOMER_HOME_PAGE;
}

// ---------------------------------------------------------------------------
// Continue with Google (Google Identity Services, popup + authorization code)
// ---------------------------------------------------------------------------

/** { enabled, clientId } from the backend (the client id is public; there is no secret in the browser). */
async function getGoogleSignInConfig() {
  const res = await apiRequest('/auth/google/config');
  return res.data || { enabled: false, clientId: null };
}

/**
 * Sends the one-time code from Google's own popup to the backend, which
 * exchanges and VERIFIES it with Google, then signs the account in exactly
 * like a password login (access token in memory + httpOnly refresh cookie).
 */
async function signInWithGoogleCode(code) {
  const res = await apiRequest('/auth/google', {
    method: 'POST',
    body: { code },
    // Required by the backend (Google's recommended CSRF check for this flow).
    extraHeaders: { 'X-Requested-With': 'XMLHttpRequest' }
  });
  accessToken = res.data.accessToken;
  currentUser = res.data.user;
  setUiConvenienceFlags(res.data.user.role, res.data.user, res.data.lawyerId);
  if (res.data.linked) {
    // Google was just linked to an existing account and its old password was
    // switched off: leave a few seconds to read the notice the page shows.
    setTimeout(() => redirectAfterSignIn(res.data.user.role), 6000);
  } else {
    redirectAfterSignIn(res.data.user.role);
  }
  return Object.assign({}, res.data, { message: res.message });
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

/** Always resolves with the same message whether or not the email is registered. */
async function requestPasswordReset(email) {
  const res = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email } });
  return res.message;
}

/** Resolves true when a reset link is still valid; throws (statusCode 400) when it is not. */
async function checkPasswordResetToken(token) {
  await apiRequest('/auth/reset-password/check', { method: 'POST', body: { token } });
  return true;
}

/** Sets the new password. Resolves { role } so the page can link to the right login. */
async function resetPasswordWithToken(token, password, confirmPassword) {
  const res = await apiRequest('/auth/reset-password', { method: 'POST', body: { token, password, confirmPassword } });
  // Every session of the account was ended on the server; forget this tab's too.
  accessToken = null;
  currentUser = null;
  clearUiConvenienceFlags();
  return res.data || {};
}

/**
 * Silently exchanges the httpOnly refresh cookie for a fresh access
 * token. Safe to call on every page load; resolves to true/false instead
 * of throwing, since "not logged in" is an expected, common outcome.
 */
async function restoreSession() {
  if (accessToken) return true;

  try {
    const res = await apiRequest('/auth/refresh', { method: 'POST' });
    accessToken = res.data.accessToken;
    currentUser = res.data.user;
    return true;
  } catch (err) {
    accessToken = null;
    currentUser = null;
    clearUiConvenienceFlags();
    return false;
  }
}

/**
 * Drops the in-memory access token and asks the backend for a new one with
 * the httpOnly refresh cookie. For pages that stay open longer than the
 * access token's lifetime (e.g. the Legal Tracker) and receive a 401.
 * Resolves to true/false like restoreSession(); never throws.
 */
async function refreshSession() {
  accessToken = null;
  return restoreSession();
}

/**
 * Redirects to login.html unless the visitor has a valid session.
 * Async now (a real check requires asking the backend) -- existing
 * call sites that don't await this still work, since the redirect just
 * happens a moment later instead of synchronously.
 */
async function checkAuth() {
  const ok = await restoreSession();
  if (!ok) {
    window.location.href = 'login.html';
  }
  return ok;
}

/**
 * Restricts a page to one role. Returns a Promise<boolean> -- callers
 * MUST await it (see lawyer-dashboard.html) since a real check requires
 * asking the backend for the current session.
 */
async function requireRole(role) {
  const ok = await restoreSession();

  if (!ok || !currentUser || currentUser.role !== role) {
    window.location.href = role === 'lawyer' ? 'lawyer-login.html' : role === 'admin' ? 'admin-lawyers.html' : 'login.html';
    return false;
  }
  return true;
}

async function logoutUser() {
  const wasLawyer = localStorage.getItem('userRole') === 'lawyer';
  const wasAdmin = localStorage.getItem('userRole') === 'admin';

  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    // Even if the network call fails, still clear local state and leave
    // the page -- there's nothing useful to retry here.
  }

  accessToken = null;
  currentUser = null;
  clearUiConvenienceFlags();

  // Customers return to the homepage after logout; lawyers keep the
  // original behaviour (lawyer login page).
  window.location.href = wasLawyer ? 'lawyer-login.html' : wasAdmin ? 'admin-lawyers.html' : 'index.html';
}

/**
 * Customer-only helper for pages that show a customer account state
 * (homepage navbar, login/signup "already logged in" redirect).
 * Resolves to the signed-in CUSTOMER ({ id, name, email, role }) or null.
 * A lawyer/admin session resolves to null, so customer UI never treats a
 * lawyer as a logged-in customer. Never throws.
 */
async function getCustomerSession() {
  try {
    const ok = await restoreSession();
    if (ok && currentUser && currentUser.role === 'customer') return currentUser;
  } catch (err) {
    /* treated as logged out */
  }
  return null;
}
