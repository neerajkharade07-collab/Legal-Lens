/* =====================================================================
   CASEONE Admin — API layer
   Uses the site's shared config.js (API_BASE_URL) and auth.js session
   (in-memory access token + httpOnly refresh cookie). No auth logic is
   duplicated here and nothing is stored in localStorage except the
   non-secret UI flags auth.js already manages.
   ===================================================================== */
(function () {
  'use strict';

  function httpError(status, message, details) {
    var e = new Error(message || ('Request failed (' + status + ').'));
    e.statusCode = status;
    e.details = details || null;
    return e;
  }

  function ready() {
    return typeof apiRequest === 'function' && typeof restoreSession === 'function' && typeof API_BASE_URL !== 'undefined';
  }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /** Authenticated request with one silent refresh on 401. */
  function call(path, opts) {
    opts = opts || {};
    return apiRequest(path, { method: opts.method || 'GET', body: opts.body, useAuth: true }).catch(function (err) {
      if (err && err.statusCode === 401 && !opts.retried && typeof refreshSession === 'function') {
        return refreshSession().then(function (ok) {
          if (!ok) throw err;
          var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (!u || u.role !== 'admin') throw httpError(401, 'Your admin session has ended.');
          return call(path, { method: opts.method, body: opts.body, retried: true });
        });
      }
      throw err;
    });
  }

  var api = {
    ready: ready,
    qs: qs,
    httpError: httpError,

    /** Restores the session from the refresh cookie; resolves to the user or null. */
    restore: function () {
      return restoreSession().then(function (ok) {
        return ok && typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      }, function () { return null; });
    },

    /**
     * Admin login: the existing POST /api/auth/admin/login sets the refresh
     * cookie; auth.js then picks up an access token from it (restoreSession).
     */
    login: function (email, password) {
      return apiRequest('/auth/admin/login', { method: 'POST', body: { email: email, password: password } }).then(function (res) {
        var data = (res && res.data) || {};
        return (typeof refreshSession === 'function' ? refreshSession() : restoreSession()).then(function (ok) {
          if (!ok) throw httpError(401, 'Signed in, but the session could not be started. Check that cookies are allowed for this site.');
          if (typeof setUiConvenienceFlags === 'function' && data.user) setUiConvenienceFlags('admin', data.user);
          return data;
        });
      });
    },

    /**
     * Sign out. Resolves to one of:
     *   { result: 'revoked' }      server confirmed: every session for this admin ended
     *   { result: 'still_signed_in', message }  server answered with an error and this
     *                              browser's session still works (nothing was ended)
     *   { result: 'unconfirmed', message }      this browser's session no longer works,
     *                              but the server did NOT confirm that other sessions ended
     * Rejects (statusCode 0) when the server could not be reached at all; then
     * nothing was ended and the page state is left untouched.
     */
    logout: function () {
      function clearLocal() {
        try { accessToken = null; currentUser = null; } catch (e) { /* auth.js not loaded */ }
        if (typeof clearUiConvenienceFlags === 'function') clearUiConvenienceFlags();
      }
      return apiRequest('/auth/logout', { method: 'POST' }).then(function () {
        clearLocal();
        return { result: 'revoked' };
      }, function (err) {
        if (!err || !err.statusCode) {
          throw httpError(0, 'Could not reach the server, so you have not been signed out. Check your connection and try again.');
        }
        var message = err.message;
        // The server answered but did not confirm the revocation. Ask the
        // server (not the in-memory token) whether this browser is still
        // signed in before saying anything. refreshSession() always calls
        // the backend; restoreSession() would return early on a cached token.
        var check = typeof refreshSession === 'function' ? refreshSession : function () { return Promise.resolve(false); };
        return Promise.resolve().then(check).then(function (ok) { return ok; }, function () { return null; }).then(function (stillIn) {
          var u = stillIn && typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (u && u.role === 'admin') return { result: 'still_signed_in', message: message };
          clearLocal();
          return { result: 'unconfirmed', message: message };
        });
      });
    },

    me: function () { return call('/admin/me'); },
    changePassword: function (currentPassword, newPassword) {
      return call('/admin/me/password', { method: 'POST', body: { currentPassword: currentPassword, newPassword: newPassword } }).then(function (res) {
        // The server ended the old session and set a new refresh cookie.
        return (typeof refreshSession === 'function' ? refreshSession() : Promise.resolve(true)).then(function () { return res; });
      });
    },

    get: function (path, params) { return call('/admin' + path + qs(params)); },
    patch: function (path, body) { return call('/admin' + path, { method: 'PATCH', body: body || {} }); },
    post: function (path, body) { return call('/admin' + path, { method: 'POST', body: body || {} }); },
    del: function (path, body) { return call('/admin' + path, { method: 'DELETE', body: body }); },

    /**
     * Opens a PRIVATE document (lawyer credential / eligibility document) in a
     * new tab. The file is fetched with the admin's in-memory Bearer token and
     * shown from a temporary blob: URL — it is never a public link, and the
     * server records every view in the audit log.
     */
    openFile: function (path) {
      var win = window.open('', '_blank');
      function send() {
        var token = typeof getAccessToken === 'function' ? getAccessToken() : null;
        return fetch(API_BASE_URL + '/admin' + path, { headers: token ? { Authorization: 'Bearer ' + token } : {}, credentials: 'include' });
      }
      return send().then(function (res) {
        if (res.status === 401 && typeof refreshSession === 'function') return refreshSession().then(function (ok) { return ok ? send() : res; });
        return res;
      }).then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (p) { throw httpError(res.status, (p && p.message) || 'Could not open the document.'); });
        }
        return res.blob();
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        if (win) win.location.href = url; else window.location.href = url;
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      }, function (err) {
        if (win) win.close();
        throw err;
      });
    }
  };

  window.LLAdminApi = api;
})();
