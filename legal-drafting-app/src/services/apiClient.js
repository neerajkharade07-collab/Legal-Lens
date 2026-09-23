/**
 * HTTP client for the Legal Lens backend.
 *
 * Auth model (matches the backend):
 *  - the short-lived ACCESS token is kept in memory only and sent as
 *    `Authorization: Bearer …`;
 *  - the REFRESH token is an httpOnly cookie set by the backend, sent
 *    automatically with `credentials: 'include'`. On a 401 the client calls
 *    POST /auth/refresh once and retries the request.
 * No token is ever written to localStorage.
 */
// Same origin by default: production proxies /api to the backend (vercel
// routes) and `vite dev` proxies it too. Set VITE_API_BASE_URL only if the app
// must call a backend on another origin directly.
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

let accessToken = null;
let refreshPromise = null;
let authLostHandler = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

/** Called when the session can no longer be refreshed (AuthProvider signs out). */
export function onAuthLost(handler) {
  authLostHandler = handler;
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'error', errors = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

const NETWORK_MESSAGE =
  "Can't reach the Legal Lens server. Make sure the backend is running, then try again.";

function statusMessage(status) {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return 'You do not have access to this.';
  if (status === 404) return 'Not found.';
  if (status === 413) return 'This document is too large to save.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'Request failed.';
}

async function rawRequest(path, { method = 'GET', body, token, keepalive = false, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      keepalive,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(
      offline ? 'You appear to be offline. Check your connection and try again.' : NETWORK_MESSAGE,
      { code: offline ? 'offline' : 'network' },
    );
  }
  const json = await response.json().catch(() => null);
  return { response, json };
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = rawRequest('/auth/refresh', { method: 'POST' })
      .then(({ response, json }) => {
        if (!response.ok || !json?.data?.accessToken) {
          setAccessToken(null);
          return null;
        }
        setAccessToken(json.data.accessToken);
        return json.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * JSON request. `auth: false` for public endpoints (login, refresh).
 * Resolves with the parsed JSON body; rejects with ApiError.
 */
export async function apiRequest(
  path,
  { method = 'GET', body, auth = true, keepalive, signal } = {},
) {
  let { response, json } = await rawRequest(path, {
    method,
    body,
    keepalive,
    signal,
    token: auth ? accessToken : null,
  });

  if (response.status === 401 && auth) {
    const session = await refreshSession().catch(() => null);
    if (session) {
      ({ response, json } = await rawRequest(path, { method, body, signal, token: accessToken }));
    }
    if (response.status === 401) {
      authLostHandler?.();
      throw new ApiError('Your session has ended. Please sign in again.', {
        status: 401,
        code: 'unauthenticated',
      });
    }
  }

  if (!response.ok || json?.success === false) {
    throw new ApiError(json?.message || statusMessage(response.status), {
      status: response.status,
      code: response.status === 404 ? 'not-found' : 'http',
      errors: json?.errors ?? null,
    });
  }
  return json;
}
