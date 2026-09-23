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

async function apiRequest(path, { method = 'GET', body, useAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
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
  // userName/userEmail are left in place intentionally: if the visitor
  // logs back in as the same person, forms can still prefill nicely.
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
  const endpoint = role === 'lawyer' ? '/auth/lawyer/login' : '/auth/customer/login';

  const res = await apiRequest(endpoint, { method: 'POST', body: { email, password } });

  accessToken = res.data.accessToken;
  currentUser = res.data.user;
  setUiConvenienceFlags(role, res.data.user, res.data.lawyerId);

  if (role === 'lawyer') {
    window.location.href = 'lawyer-dashboard.html';
    return res.data;
  }

  const redirect = sessionStorage.getItem('postLoginRedirect');
  if (redirect) {
    sessionStorage.removeItem('postLoginRedirect');
    window.location.href = redirect;
    return res.data;
  }

  window.location.href = 'index.html';
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

  const redirect = sessionStorage.getItem('postLoginRedirect');
  if (redirect) {
    sessionStorage.removeItem('postLoginRedirect');
    window.location.href = redirect;
    return res.data;
  }

  window.location.href = 'index.html';
  return res.data;
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
    window.location.href = role === 'lawyer' ? 'lawyer-login.html' : 'login.html';
    return false;
  }
  return true;
}

async function logoutUser() {
  const wasLawyer = localStorage.getItem('userRole') === 'lawyer';

  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (err) {
    // Even if the network call fails, still clear local state and leave
    // the page -- there's nothing useful to retry here.
  }

  accessToken = null;
  currentUser = null;
  clearUiConvenienceFlags();

  window.location.href = wasLawyer ? 'lawyer-login.html' : 'login.html';
}
