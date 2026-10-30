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
import { resolveApiBaseUrl } from '../utils/sitePaths';

// Same origin by default: production proxies /api to the backend (vercel
// routes) and `vite dev` proxies it too. A plain local static server (port 3000
// or 5500) has no proxy, so the backend on port 5000 is called directly, like
// the main site's config.js. Set VITE_API_BASE_URL only if the app must call a
// backend on another origin directly (it always wins).
export const API_BASE_URL = resolveApiBaseUrl({
  envUrl: import.meta.env?.VITE_API_BASE_URL,
  location: typeof window !== 'undefined' ? window.location : undefined,
});

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
  constructor(message, { status = 0, code = 'error', errors = null, serverCode = null, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    /** Phase 6: the server's own error code (e.g. 'document_conflict') and data, when sent. */
    this.serverCode = serverCode;
    this.data = data;
  }
}

const NETWORK_MESSAGE =
  "Can't reach the CASEONE server. Make sure the backend is running and allows this site's address, then try again.";

function statusMessage(status) {
  if (status === 401) return 'Please sign in again.';
  if (status === 403) return 'You do not have access to this.';
  if (status === 404) return 'Not found.';
  if (status === 413) return 'This document is too large to save.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return 'Request failed.';
}

// Browsers refuse keepalive requests with bodies over about 64 KB (the request then fails
// outright). Larger bodies are sent as normal requests, which can still complete.
const KEEPALIVE_MAX_BODY = 60000;

async function rawRequest(path, { method = 'GET', body, token, keepalive = false, signal } = {}) {
  let response;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      keepalive: Boolean(keepalive) && (payload?.length ?? 0) <= KEEPALIVE_MAX_BODY,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: payload,
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

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request.
 * Resolves the session, or null when there is no valid session (signed out / expired).
 * Rejects (ApiError code 'network' / 'offline' / 'unavailable') when the server could not
 * answer — that is NOT a sign-out, and callers must not treat it as one.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = rawRequest('/auth/refresh', { method: 'POST' })
      .then(({ response, json }) => {
        if (response.status >= 500) {
          throw new ApiError(json?.message || "Can't reach the CASEONE server right now. Please try again.", {
            status: response.status,
            code: 'unavailable',
          });
        }
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
    // A server/network failure here rejects with that error (it is not a sign-out).
    const session = await refreshSession();
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
      serverCode: json?.code ?? null,
      data: json?.data ?? null,
    });
  }
  return json;
}

/** Filename from Content-Disposition (RFC 5987 `filename*` first). */
export function filenameFromDisposition(header, fallback = 'document') {
  const value = String(header || '');
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(value);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(value);
  return plain ? plain[1].trim() : fallback;
}

/**
 * Authenticated file download (Phase 4 exports). Same auth rules as apiRequest: the access
 * token goes in the Authorization header (never in the URL), one silent refresh on 401, and an
 * honest ApiError with the server's message on failure. Nothing is cached or made public.
 * @returns {Promise<{ blob: Blob, filename: string, headers: Headers }>}
 */
export async function apiDownload(path, { signal } = {}) {
  const attempt = async () => {
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new ApiError(NETWORK_MESSAGE, { code: 'network' });
    }
  };
  let response = await attempt();
  if (response.status === 401) {
    const session = await refreshSession();
    if (session) response = await attempt();
    if (response.status === 401) {
      authLostHandler?.();
      throw new ApiError('Your session has ended. Please sign in again.', { status: 401, code: 'unauthenticated' });
    }
  }
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new ApiError(json?.message || statusMessage(response.status), { status: response.status, code: json?.code || 'http' });
  }
  const blob = await response.blob();
  return { blob, filename: filenameFromDisposition(response.headers.get('content-disposition')), headers: response.headers };
}
