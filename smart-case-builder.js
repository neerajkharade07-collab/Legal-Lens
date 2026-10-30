/* ============================================================
   LEGAL LENS — SMART CASE BUILDER + EVIDENCE VAULT

   - Cases, timeline, checklist and evidence are saved to the signed-in
     CUSTOMER's account through the Legal Lens API (/api/cases, MongoDB).
     Requires config.js (API_BASE_URL) and auth.js (apiRequest,
     getCustomerSession, getAccessToken, refreshSession) first. No auth
     logic lives here.
   - Evidence files are uploaded to the private Evidence Vault and are
     only returned to their owner by an authenticated request. Image
     previews are fetched with the access token and shown from memory.
   - Cases saved by the old browser-only version (STORAGE_KEY) are imported
     ONLY when the customer clicks "Import to my account". Those old cases
     never contained the files themselves, so imported evidence is marked
     "re-select the file to store it".
   - Nothing here is AI. Summary / brief only re-arrange what the
     user typed.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- constants ---------------- */
  var STORAGE_KEY = 'legalLens.smartCaseBuilder.v1';

  var CASE_CATEGORIES = [
    'Consumer', 'Cyber Crime', 'Property', 'Family', 'Employment',
    'Criminal', 'Civil', 'Banking / Finance', 'Rental / Tenancy', 'Other'
  ];

  var CASE_STATUSES = [
    'Preparing Case', 'Collecting Evidence', 'Ready for Review',
    'Complaint / Notice Filed', 'In Progress', 'Resolved', 'Closed'
  ];

  var EVIDENCE_CATEGORIES = [
    'Payment Proof', 'Screenshot', 'Communication', 'Agreement / Contract',
    'Notice', 'Police / Cyber Complaint', 'Bank Document',
    'Identity / Party Details', 'Photograph', 'Court Document', 'Other'
  ];

  var ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
  var IMAGE_EXT = ['jpg', 'jpeg', 'png'];
  var EXT_MIME = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  // Matches the backend default (EVIDENCE_MAX_FILE_MB). The server always enforces its own limit.
  var MAX_FILE_MB = 10;

  var QUICK_CHECKLIST = [
    'Payment receipt', 'Bank / transaction statement', 'Chat or message screenshots',
    'Email correspondence', 'Agreement / contract', 'Invoice or bill',
    'Identity proof', 'Other party details', 'Complaint acknowledgement', 'Photographs'
  ];

  /* ---------------- tiny helpers ---------------- */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    var rnd = '';
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var arr = new Uint32Array(2);
        window.crypto.getRandomValues(arr);
        rnd = arr[0].toString(36) + arr[1].toString(36);
      }
    } catch (e) { /* ignore */ }
    if (!rnd) rnd = Math.random().toString(36).slice(2, 12);
    return (prefix || 'id') + '_' + Date.now().toString(36) + rnd;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function isValidISODate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }

  /** "2026-09-12" -> "12 Sep 2026" (parsed as a local date, no timezone shift) */
  function fmtDate(iso) {
    if (!isValidISODate(iso)) return '';
    var p = iso.split('-').map(Number);
    try {
      return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function fmtDateTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return d.toISOString(); }
  }

  function fmtShortTs(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function fmtSize(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function fileExt(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  function clean(v, max) {
    return String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max || 5000);
  }

  function byDateAsc(a, b) {
    var da = a.date || '', db = b.date || '';
    if (da !== db) return da < db ? -1 : 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  /* ---------------- storage (swap for API later) ---------------- */
  var storageOK = (function () {
    try {
      var k = '__scb_test__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var memoryCases = [];

  function sanitizeCase(c) {
    if (!c || typeof c !== 'object' || !c.id) return null;
    return {
      id: String(c.id),
      clientId: c.clientId ? String(c.clientId) : String(c.id),
      importedFromBrowser: !!c.importedFromBrowser,
      title: clean(c.title, 120) || 'Untitled case',
      category: CASE_CATEGORIES.indexOf(c.category) >= 0 ? c.category : 'Other',
      status: CASE_STATUSES.indexOf(c.status) >= 0 ? c.status : CASE_STATUSES[0],
      description: clean(c.description, 1500),
      incidentDate: isValidISODate(c.incidentDate) ? c.incidentDate : '',
      location: clean(c.location, 120),
      yourName: clean(c.yourName, 100),
      opposingParty: clean(c.opposingParty, 120),
      notes: clean(c.notes, 3000),
      createdAt: Number(c.createdAt) || Date.now(),
      updatedAt: Number(c.updatedAt) || Number(c.createdAt) || Date.now(),
      timeline: Array.isArray(c.timeline) ? c.timeline.filter(function (e) { return e && e.id; }).map(function (e) {
        return {
          id: String(e.id),
          date: isValidISODate(e.date) ? e.date : '',
          title: clean(e.title, 120),
          description: clean(e.description, 1000),
          createdAt: Number(e.createdAt) || 0
        };
      }) : [],
      evidence: Array.isArray(c.evidence) ? c.evidence.filter(function (e) { return e && e.id; }).map(function (e) {
        var f = e.file && typeof e.file === 'object' ? {
          name: clean(e.file.name, 255),
          type: clean(e.file.type, 120),
          size: Number(e.file.size) || 0,
          ext: clean(e.file.ext, 10).toLowerCase(),
          stored: !!e.file.stored,                       // true = file is in the Evidence Vault
          uploadedAt: e.file.uploadedAt || null
        } : null;
        var lf = e.legacyFile && typeof e.legacyFile === 'object' && e.legacyFile.name ? {
          name: clean(e.legacyFile.name, 255),
          type: clean(e.legacyFile.type, 120),
          size: Number(e.legacyFile.size) || 0,
          ext: clean(e.legacyFile.ext, 10).toLowerCase()
        } : null;
        return {
          id: String(e.id),
          clientId: e.clientId ? String(e.clientId) : String(e.id),
          legacyFile: lf,                                  // imported details only — file NOT stored
          title: clean(e.title, 120),
          category: EVIDENCE_CATEGORIES.indexOf(e.category) >= 0 ? e.category : 'Other',
          date: isValidISODate(e.date) ? e.date : '',
          notes: clean(e.notes, 1500),
          file: f && f.name ? f : null,
          createdAt: Number(e.createdAt) || Date.now(),
          updatedAt: Number(e.updatedAt) || Number(e.createdAt) || Date.now()
        };
      }) : [],
      checklist: Array.isArray(c.checklist) ? c.checklist.filter(function (i) { return i && i.id; }).map(function (i) {
        return {
          id: String(i.id),
          text: clean(i.text, 120),
          status: i.status === 'available' ? 'available' : 'missing',
          createdAt: Number(i.createdAt) || 0
        };
      }) : []
    };
  }

  var Store = {
    load: function () {
      if (!storageOK) return memoryCases;
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        var data = JSON.parse(raw);
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.cases) ? data.cases : []);
        return list.map(sanitizeCase).filter(Boolean);
      } catch (e) {
        console.warn('[Smart Case Builder] Could not read saved cases:', e);
        return [];
      }
    },
    /** After an import, removes ONLY the case ids the server confirmed. */
    removeMigrated: function (confirmedIds) {
      if (!storageOK) return;
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var data = JSON.parse(raw);
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.cases) ? data.cases : []);
        var remaining = list.filter(function (c) { return !(c && c.id && confirmedIds[String(c.id)]); });
        if (remaining.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cases: remaining }));
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // Leaving the old copy is safe: the server reports already-imported cases as "existing".
        console.warn('[Smart Case Builder] Could not update the browser copy after import:', e);
      }
    }
  };

  var cases = [];                // loaded from the account by loadFromAccount()
  var currentCaseId = null;
  var currentTab = 'overview';
  var previewUrls = {};          // evidenceId -> object URL of the fetched image (memory only)
  var previewStamp = {};         // evidenceId -> uploadedAt of the previewed file

  /** By server id, or by clientId (the Legal Tracker links cases by clientId). */
  function getCase(id) {
    for (var i = 0; i < cases.length; i++) if (cases[i].id === id || cases[i].clientId === id) return cases[i];
    return null;
  }

  /* ---------------- account API (uses auth.js — no auth logic here) ---------------- */
  var loadState = 'loading';    // loading | ready | auth | role | error
  var busy = false;              // one change at a time keeps the UI and server in step

  function authReady() {
    return typeof apiRequest === 'function' && typeof getCustomerSession === 'function';
  }

  /** JSON API call with the access token; one silent token refresh on 401. */
  function scbApi(path, opts) {
    opts = opts || {};
    return apiRequest('/cases' + path, { method: opts.method || 'GET', body: opts.body, useAuth: true })
      .catch(function (err) {
        if (err && err.statusCode === 401 && !opts.retried && typeof refreshSession === 'function') {
          return refreshSession().then(function (ok) {
            if (!ok) throw err;
            return scbApi(path, { method: opts.method, body: opts.body, retried: true });
          });
        }
        throw err;
      });
  }

  /**
   * Raw fetch for evidence FILES (upload body / binary download), which
   * apiRequest (JSON only) cannot do. Uses the same access token from
   * auth.js and the same one-time refresh on 401.
   */
  function fileRequest(path, init, retried) {
    var headers = {};
    Object.keys(init.headers || {}).forEach(function (k) { headers[k] = init.headers[k]; });
    var token = typeof getAccessToken === 'function' ? getAccessToken() : null;
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(API_BASE_URL + '/cases' + path, { method: init.method || 'GET', headers: headers, body: init.body, credentials: 'include' })
      .then(function (res) {
        if (res.status === 401 && !retried && typeof refreshSession === 'function') {
          return refreshSession().then(function (ok) { return ok ? fileRequest(path, init, true) : res; });
        }
        return res;
      });
  }

  /** Turns a non-OK fetch Response into an Error shaped like apiRequest's. */
  function responseError(res) {
    return res.json().catch(function () { return null; }).then(function (payload) {
      var err = new Error((payload && payload.message) || ('Request failed (' + res.status + ').'));
      err.statusCode = res.status;
      err.details = payload;
      throw err;
    });
  }

  function uploadEvidenceFile(caseId, evidenceId, file) {
    var ext = fileExt(file.name);
    return fileRequest('/' + encodeURIComponent(caseId) + '/evidence/' + encodeURIComponent(evidenceId) + '/file', {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || EXT_MIME[ext] || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }
    }).then(function (res) { return res.ok ? res.json() : responseError(res); });
  }

  function fetchEvidenceBlob(c, ev, download) {
    return fileRequest('/' + encodeURIComponent(c.id) + '/evidence/' + encodeURIComponent(ev.id) + '/file' + (download ? '?download=1' : ''), {})
      .then(function (res) { return res.ok ? res.blob() : responseError(res); });
  }

  /** Server case -> the shape the rest of this file already uses (ms timestamps). */
  function fromApi(c) {
    if (!c) return null;
    var ms = function (v) { var t = v ? Date.parse(v) : NaN; return isNaN(t) ? 0 : t; };
    return sanitizeCase({
      id: c.id, clientId: c.clientId, importedFromBrowser: c.importedFromBrowser,
      title: c.title, category: c.category, status: c.status, description: c.description,
      incidentDate: c.incidentDate, location: c.location, yourName: c.yourName,
      opposingParty: c.opposingParty, notes: c.notes,
      createdAt: ms(c.createdAt), updatedAt: ms(c.updatedAt),
      timeline: (c.timeline || []).map(function (e) { return { id: e.id, date: e.date, title: e.title, description: e.description, createdAt: ms(e.createdAt) }; }),
      checklist: (c.checklist || []).map(function (i) { return { id: i.id, text: i.text, status: i.status, createdAt: ms(i.createdAt) }; }),
      evidence: (c.evidence || []).map(function (e) {
        return {
          id: e.id, clientId: e.clientId, title: e.title, category: e.category, date: e.date, notes: e.notes,
          file: e.file, legacyFile: e.legacyFile, createdAt: ms(e.createdAt), updatedAt: ms(e.updatedAt)
        };
      })
    });
  }

  /** Puts the server's version of a case into the list (insert or replace). */
  function storeCase(apiCase) {
    var c = fromApi(apiCase);
    if (!c) return null;
    for (var i = 0; i < cases.length; i++) if (cases[i].id === c.id) { cases[i] = c; return c; }
    cases.push(c);
    return c;
  }
  function removeCaseLocal(id) { cases = cases.filter(function (x) { return x.id !== id; }); }

  /** Friendly text for a failed request; switches to the login state on 401. */
  function friendlyError(err, action) {
    var code = err && err.statusCode;
    if (!code) return 'Could not reach Legal Lens. Check your internet connection and try again.';
    if (code === 401) { setLoadState('auth', 'Your session has ended. Please log in again.'); return 'Your session has ended. Please log in again.'; }
    if (code === 403) { setLoadState('role'); return 'Smart Case Builder is available for customer accounts only.'; }
    if (code === 404) return 'This item no longer exists. It may have been deleted.';
    if (code === 409 || code === 413 || code === 415 || code === 422) return err.message || 'Please check the details and try again.';
    if (code === 429) return 'Too many requests. Please wait a moment and try again.';
    return 'Something went wrong on our side, so ' + (action || 'your change') + ' was not saved. Please try again.';
  }

  function setLoadState(state, message) {
    loadState = state;
    var box = $('scbSyncNotice');
    if (box) {
      var html = '';
      if (state === 'loading') html = '<p><strong>Loading your cases…</strong></p>';
      else if (state === 'auth') html = '<p><strong>' + esc(message || 'Log in to use Smart Case Builder.') + '</strong> Your cases and evidence files are saved to your Legal Lens customer account.</p>' +
        '<span class="scb-notice-actions" style="display: inline-flex; gap: 8px; flex-wrap: wrap;"><button type="button" class="scb-btn scb-btn-dark scb-btn-sm" data-action="login">Log In</button><a class="scb-btn scb-btn-outline scb-btn-sm" href="signup.html">Sign Up</a></span>';
      else if (state === 'role') html = '<p><strong>Smart Case Builder is available for customer accounts.</strong> You are signed in with an account that cannot use it.</p>';
      else if (state === 'error') html = '<p><strong>Could not load your cases.</strong> ' + esc(message || '') + '</p>' +
        '<span class="scb-notice-actions" style="display: inline-flex; gap: 8px; flex-wrap: wrap;"><button type="button" class="scb-btn scb-btn-outline scb-btn-sm" data-action="retry-load">Try again</button></span>';
      box.innerHTML = html;
      box.hidden = !html;
      box.setAttribute('role', state === 'error' ? 'alert' : 'status');
    }
    if (state !== 'ready') {
      cases = [];
      hideImportNotice();
      Object.keys(previewUrls).forEach(revokePreview);
    }
    route();
  }

  /** Blocks changes until the account's cases are loaded. */
  function requireReady() {
    if (loadState === 'ready') return true;
    if (loadState === 'auth') goToLogin();
    else if (loadState === 'role') toast('Smart Case Builder is available for customer accounts only.', true);
    else if (loadState === 'error') toast('Your cases could not be loaded. Please try again.', true);
    else toast('Still loading your cases…');
    return false;
  }

  function goToLogin() {
    try { sessionStorage.setItem('postLoginRedirect', 'smart-case-builder.html' + (window.location.hash || '')); } catch (e) { /* ignore */ }
    window.location.href = 'login.html';
  }

  function loadFromAccount() {
    if (!authReady()) { setLoadState('error', 'The sign-in script did not load. Please refresh the page.'); return; }
    setLoadState('loading');
    getCustomerSession().then(function (user) {
      if (!user) {
        if (typeof getCurrentUser === 'function' && getCurrentUser()) { setLoadState('role'); return; }
        // Not signed in — or the server is unreachable. Tell the two apart.
        return apiRequest('/health').then(
          function () { setLoadState('auth'); },
          function (err) { setLoadState('error', friendlyError(err)); }
        );
      }
      return scbApi('').then(function (res) {
        var list = res && res.data && Array.isArray(res.data.cases) ? res.data.cases : [];
        cases = list.map(fromApi).filter(Boolean);
        setLoadState('ready');
        checkLegacyCases();   // notice only — nothing is uploaded without the customer's choice
      });
    }).catch(function (err) {
      var msg = friendlyError(err, 'loading');
      if (loadState !== 'auth' && loadState !== 'role') setLoadState('error', msg);
    });
  }

  /** Disables a submit button while a request runs; returns a restore function. */
  function busyButton(btn, label) {
    var old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label || 'Saving…';
    return function () { btn.disabled = false; btn.textContent = old; };
  }

  /** Runs one change at a time; shows a friendly error if it fails. */
  function runChange(promiseFactory, action) {
    if (busy) { toast('Please wait — saving your previous change…'); return Promise.resolve(false); }
    busy = true;
    return promiseFactory().then(function (r) { busy = false; return r === undefined ? true : r; }, function (err) {
      busy = false;
      if (err && err.statusCode === 404) reloadQuietly();
      toast(friendlyError(err, action), true);
      return false;
    });
  }

  /** After a 404 (deleted elsewhere), refresh the list from the account. */
  function reloadQuietly() {
    scbApi('').then(function (res) {
      cases = ((res && res.data && res.data.cases) || []).map(fromApi).filter(Boolean);
      route();
    }, function () { /* keep what is shown */ });
  }

  /* ---------------- toasts ---------------- */
  function toast(msg, isError) {
    var wrap = $('scbToasts');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'scb-toast' + (isError ? ' is-error' : '');
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, isError ? 4200 : 2600);
  }

  /* ---------------- modals ---------------- */
  var modalStack = [];

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
  }

  function openModal(modal, focusEl) {
    if (!modal) return;
    var already = modalStack.some(function (m) { return m.el === modal; });
    if (!already) {
      modalStack.push({ el: modal, returnFocus: document.activeElement });
    }
    modal.hidden = false;
    document.body.classList.add('scb-modal-open');
    var target = focusEl || focusables(modal.querySelector('.scb-modal-dialog'))[0];
    setTimeout(function () { if (target && target.focus) target.focus(); }, 30);
  }

  function closeModal(modal) {
    var idx = -1;
    for (var i = modalStack.length - 1; i >= 0; i--) if (modalStack[i].el === modal) { idx = i; break; }
    if (modal) modal.hidden = true;
    var entry = idx >= 0 ? modalStack.splice(idx, 1)[0] : null;
    if (!modalStack.length) document.body.classList.remove('scb-modal-open');
    if (modal && modal.id === 'confirmModal' && confirmResolver) { var r = confirmResolver; confirmResolver = null; r(false); }
    if (entry && entry.returnFocus && document.contains(entry.returnFocus) && entry.returnFocus.focus) {
      try { entry.returnFocus.focus(); } catch (e) { /* ignore */ }
    }
  }

  document.addEventListener('click', function (e) {
    var closer = e.target.closest('[data-close]');
    if (closer) {
      var modal = closer.closest('.scb-modal');
      if (modal) closeModal(modal);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!modalStack.length) return;
    var top = modalStack[modalStack.length - 1].el;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(top); return; }
    if (e.key === 'Tab') {
      var f = focusables(top.querySelector('.scb-modal-dialog'));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* confirm dialog -> Promise<boolean> */
  var confirmResolver = null;
  function confirmAction(opts) {
    $('confirmTitle').textContent = opts.title || 'Are you sure?';
    $('confirmText').textContent = opts.text || '';
    $('confirmOk').textContent = opts.okLabel || 'Delete';
    return new Promise(function (resolve) {
      confirmResolver = resolve;
      openModal($('confirmModal'), $('confirmCancel'));
    });
  }
  $('confirmOk').addEventListener('click', function () {
    var r = confirmResolver;
    confirmResolver = null;
    closeModal($('confirmModal'));
    if (r) r(true);
  });

  /* ---------------- form error helpers ---------------- */
  function setError(form, name, msg) {
    var p = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.elements[name];
    if (p) { p.textContent = msg || ''; p.hidden = !msg; }
    if (input && input.setAttribute) {
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }
  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('[data-error-for]'), function (p) {
      p.hidden = true; p.textContent = '';
      var input = form.elements[p.getAttribute('data-error-for')];
      if (input && input.removeAttribute) input.removeAttribute('aria-invalid');
    });
  }

  function fillSelect(sel, options, placeholder) {
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    html += options.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o) + '</option>'; }).join('');
    sel.innerHTML = html;
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  var searchInput = $('scbSearch');
  var filterStatus = $('scbFilterStatus');
  fillSelect(filterStatus, CASE_STATUSES, 'All statuses');

  function renderDashboard() {
    var grid = $('scbCaseGrid');
    var q = (searchInput.value || '').trim().toLowerCase();
    var st = filterStatus.value;

    var ready = loadState === 'ready';
    $('scbCaseCount').textContent = ready ? plural(cases.length, 'case') + ' in your account' : (loadState === 'loading' ? 'Loading…' : '');

    var hasCases = cases.length > 0;
    // Until the account's cases are loaded, never show the "No cases yet" state.
    $('scbEmptyCases').hidden = hasCases || !ready;
    $('scbToolbar').hidden = !hasCases;

    var list = cases.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).filter(function (c) {
      if (st && c.status !== st) return false;
      if (!q) return true;
      return [c.title, c.category, c.location, c.opposingParty, c.description, c.status]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    });

    $('scbNoResults').hidden = !hasCases || list.length > 0;

    grid.innerHTML = list.map(function (c, i) {
      return '' +
        '<article class="scb-case-card" style="animation-delay:' + Math.min(i * 40, 320) + 'ms" data-case-id="' + esc(c.id) + '">' +
          '<div class="scb-case-card-top">' +
            '<span class="scb-badge">' + esc(c.category) + '</span>' +
            '<span class="scb-badge scb-badge-status" data-status="' + esc(c.status) + '">' + esc(c.status) + '</span>' +
          '</div>' +
          '<h3 class="scb-case-title"><button type="button" data-action="open-case">' + esc(c.title) + '</button></h3>' +
          '<p class="scb-case-desc">' + esc(c.description || 'No description added.') + '</p>' +
          '<dl class="scb-case-meta">' +
            '<div><dt>Created</dt><dd>' + esc(fmtShortTs(c.createdAt)) + '</dd></div>' +
            '<div><dt>Evidence items</dt><dd>' + c.evidence.length + '</dd></div>' +
            '<div><dt>Timeline events</dt><dd>' + c.timeline.length + '</dd></div>' +
            '<div><dt>Last updated</dt><dd>' + esc(fmtDateTime(c.updatedAt)) + '</dd></div>' +
          '</dl>' +
          '<div class="scb-case-actions">' +
            '<button type="button" class="scb-btn scb-btn-dark scb-btn-sm" data-action="open-case">Open Case</button>' +
            '<button type="button" class="scb-btn scb-btn-outline scb-btn-sm" data-action="edit-case-card">Edit</button>' +
            '<button type="button" class="scb-btn scb-btn-outline scb-btn-sm scb-btn-danger" data-action="delete-case-card">Delete</button>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  searchInput.addEventListener('input', renderDashboard);
  filterStatus.addEventListener('change', renderDashboard);

  $('scbCaseGrid').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var card = btn.closest('[data-case-id]');
    if (!card) return;
    var id = card.getAttribute('data-case-id');
    var action = btn.getAttribute('data-action');
    if (action === 'open-case') goToCase(id);
    else if (action === 'edit-case-card') openCaseForm(getCase(id));
    else if (action === 'delete-case-card') deleteCase(id);
  });

  /* ============================================================
     CASE FORM (create / edit)
     ============================================================ */
  var caseForm = $('caseForm');
  var editingCaseId = null;
  fillSelect($('cfCategory'), CASE_CATEGORIES, 'Select a category');
  fillSelect($('cfStatus'), CASE_STATUSES);

  var newCaseClientId = null;   // one id per opened "Create" form: a retried save never duplicates

  function openCaseForm(c) {
    if (!requireReady()) return;
    clearErrors(caseForm);
    caseForm.reset();
    editingCaseId = c ? c.id : null;
    newCaseClientId = c ? null : uid('case');
    $('caseModalTitle').textContent = c ? 'Edit Case' : 'Create New Case';
    $('caseSubmitBtn').textContent = c ? 'Save Changes' : 'Create Case';
    $('cfIncidentDate').max = todayISO();
    if (c) {
      caseForm.elements.title.value = c.title;
      caseForm.elements.category.value = c.category;
      caseForm.elements.status.value = c.status;
      caseForm.elements.description.value = c.description;
      caseForm.elements.incidentDate.value = c.incidentDate;
      caseForm.elements.location.value = c.location;
      caseForm.elements.yourName.value = c.yourName;
      caseForm.elements.opposingParty.value = c.opposingParty;
      caseForm.elements.notes.value = c.notes;
    } else {
      caseForm.elements.status.value = CASE_STATUSES[0];
    }
    openModal($('caseModal'), $('cfTitle'));
  }

  caseForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors(caseForm);
    var f = caseForm.elements;
    var data = {
      title: clean(f.title.value, 120),
      category: f.category.value,
      status: CASE_STATUSES.indexOf(f.status.value) >= 0 ? f.status.value : CASE_STATUSES[0],
      description: clean(f.description.value, 1500),
      incidentDate: f.incidentDate.value,
      location: clean(f.location.value, 120),
      yourName: clean(f.yourName.value, 100),
      opposingParty: clean(f.opposingParty.value, 120),
      notes: clean(f.notes.value, 3000)
    };
    var firstBad = null;
    if (!data.title) { setError(caseForm, 'title', 'Please enter a case title.'); firstBad = firstBad || f.title; }
    if (CASE_CATEGORIES.indexOf(data.category) < 0) { setError(caseForm, 'category', 'Please choose a category.'); firstBad = firstBad || f.category; }
    if (!data.description) { setError(caseForm, 'description', 'Please add a short description.'); firstBad = firstBad || f.description; }
    if (data.incidentDate) {
      if (!isValidISODate(data.incidentDate)) { setError(caseForm, 'incidentDate', 'Please enter a valid date.'); firstBad = firstBad || f.incidentDate; }
      else if (data.incidentDate > todayISO()) { setError(caseForm, 'incidentDate', 'Incident date cannot be in the future.'); firstBad = firstBad || f.incidentDate; }
    }
    if (firstBad) { firstBad.focus(); return; }

    var editId = editingCaseId;
    if (editId && !getCase(editId)) { closeModal($('caseModal')); toast('This case no longer exists.', true); return; }
    if (!editId) data.clientId = newCaseClientId || uid('case');
    var restore = busyButton($('caseSubmitBtn'));
    runChange(function () {
      var req = editId
        ? scbApi('/' + encodeURIComponent(editId), { method: 'PATCH', body: data })
        : scbApi('', { method: 'POST', body: data });
      return req.then(function (res) {
        var c = storeCase(res.data.case);
        closeModal($('caseModal'));
        if (editId) { toast('Case updated'); refresh(); }
        else { toast('Case created'); goToCase(c.id); }
      }, function (err) {
        showServerFieldErrors(caseForm, err, ['title', 'category', 'description', 'incidentDate']);
        throw err;
      });
    }, editId ? 'your changes' : 'the new case').then(restore);
  });

  /** Puts a 422 response's field messages under the matching form fields. */
  function showServerFieldErrors(form, err, fields) {
    if (!err || err.statusCode !== 422 || !err.details || !Array.isArray(err.details.errors)) return;
    var first = null;
    err.details.errors.forEach(function (x) {
      if (fields.indexOf(x.field) >= 0) { setError(form, x.field, x.message); first = first || form.elements[x.field]; }
    });
    if (first && first.focus) first.focus();
  }

  function deleteCase(id) {
    var c = getCase(id);
    if (!c) return;
    confirmAction({
      title: 'Delete this case?',
      text: '"' + c.title + '" and its timeline, evidence (including uploaded files) and checklist will be permanently removed from your account. This cannot be undone.',
      okLabel: 'Delete Case'
    }).then(function (ok) {
      if (!ok) return;
      var caseId = c.id;
      runChange(function () {
        return scbApi('/' + encodeURIComponent(caseId), { method: 'DELETE' }).then(function () {
          c.evidence.forEach(function (ev) { revokePreview(ev.id); });
          removeCaseLocal(caseId);
          toast('Case deleted');
          if (currentCaseId === caseId) goToDashboard();
          else refresh();
        });
      }, 'the deletion');
    });
  }

  /* ============================================================
     ROUTING  (#case/<id>[/<tab>])
     ============================================================ */
  var TABS = ['overview', 'timeline', 'evidence', 'checklist', 'summary'];

  function parseHash() {
    var m = /^#case\/([^/]+)(?:\/([a-z]+))?$/.exec(window.location.hash || '');
    if (!m) return null;
    return { id: decodeURIComponent(m[1]), tab: TABS.indexOf(m[2]) >= 0 ? m[2] : 'overview' };
  }

  function goToCase(id, tab) {
    var h = '#case/' + encodeURIComponent(id) + (tab && tab !== 'overview' ? '/' + tab : '');
    if (window.location.hash === h) route(); else window.location.hash = h;
  }

  function goToDashboard() {
    if (window.location.hash === '#scbApp') route();
    else window.location.hash = '#scbApp';
  }

  function scrollToApp() {
    var app = $('scbApp');
    if (!app) return;
    // The shared navbar only overlaps content if it is sticky/fixed and pinned at the top.
    var nav = document.querySelector('.navbar');
    var navH = 0;
    if (nav) {
      var pos = window.getComputedStyle(nav).position;
      if ((pos === 'fixed' || pos === 'sticky') && nav.getBoundingClientRect().top >= 0) navH = nav.offsetHeight;
    }
    var y = app.getBoundingClientRect().top + window.pageYOffset - navH;
    window.scrollTo(0, Math.max(0, y));
  }

  function route() {
    var r = parseHash();
    if (r && loadState !== 'ready') r = null;   // open the case once the account has loaded
    var found = r ? getCase(r.id) : null;
    if (found) {
      var switching = currentCaseId !== found.id;
      currentCaseId = found.id;
      currentTab = r.tab;
      $('scbDashboard').hidden = true;
      $('scbWorkspace').hidden = false;
      renderWorkspace();
      if (switching) scrollToApp();
    } else {
      if (r) toast('That case could not be found in your account.', true);
      var wasInCase = currentCaseId !== null;
      currentCaseId = null;
      $('scbWorkspace').hidden = true;
      $('scbDashboard').hidden = false;
      renderDashboard();
      document.title = 'Smart Case Builder — Legal Lens';
      if (wasInCase || r) scrollToApp();
    }
  }

  function refresh() {
    if (currentCaseId && getCase(currentCaseId)) renderWorkspace();
    else renderDashboard();
  }

  window.addEventListener('hashchange', route);

  /* ============================================================
     WORKSPACE
     ============================================================ */
  function renderWorkspace() {
    var c = getCase(currentCaseId);
    if (!c) return;

    $('wsBadges').innerHTML =
      '<span class="scb-badge">' + esc(c.category) + '</span>' +
      '<span class="scb-badge scb-badge-status" data-status="' + esc(c.status) + '">' + esc(c.status) + '</span>';
    $('wsTitle').textContent = c.title;
    document.title = c.title + ' — Smart Case Builder — Legal Lens';
    $('wsMeta').textContent = 'Created ' + fmtShortTs(c.createdAt) + ' · Last updated ' + fmtDateTime(c.updatedAt);

    var avail = c.checklist.filter(function (i) { return i.status === 'available'; }).length;
    $('wsStats').innerHTML = [
      [c.timeline.length, 'Timeline events'],
      [c.evidence.length, 'Evidence items'],
      [avail + ' / ' + c.checklist.length, 'Checklist available'],
      [c.incidentDate ? fmtDate(c.incidentDate) : '—', 'Incident date']
    ].map(function (s) {
      return '<div class="scb-stat"><span class="scb-stat-num">' + esc(s[0]) + '</span><span class="scb-stat-label">' + esc(s[1]) + '</span></div>';
    }).join('');

    // tab counts
    setTabCount('timeline', c.timeline.length);
    setTabCount('evidence', c.evidence.length);
    setTabCount('checklist', c.checklist.length);

    selectTab(currentTab, false);
    renderOverview(c);
    renderTimeline(c);
    renderEvidence(c);
    renderChecklist(c);
    renderSummary(c);
  }

  function setTabCount(tab, n) {
    var btn = $('tab-' + tab);
    var badge = btn.querySelector('.scb-tab-count');
    if (!badge) { badge = document.createElement('span'); badge.className = 'scb-tab-count'; btn.appendChild(badge); }
    badge.textContent = n;
  }

  function selectTab(tab, updateHash) {
    if (TABS.indexOf(tab) < 0) tab = 'overview';
    currentTab = tab;
    TABS.forEach(function (t) {
      var b = $('tab-' + t), p = $('panel-' + t);
      var on = t === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      p.hidden = !on;
      if (on) keepTabVisible(b);
    });
    if (updateHash && currentCaseId) {
      var h = '#case/' + encodeURIComponent(currentCaseId) + (tab !== 'overview' ? '/' + tab : '');
      if (window.history && window.history.replaceState) window.history.replaceState(null, '', h);
      else window.location.hash = h;
    }
  }

  var tabList = document.querySelector('.scb-tabs');

  /* On narrow screens the tab strip scrolls sideways — keep the active tab in view. */
  function keepTabVisible(btn) {
    if (!tabList || tabList.scrollWidth <= tabList.clientWidth) return;
    var left = btn.offsetLeft - tabList.offsetLeft;
    var right = left + btn.offsetWidth;
    if (left < tabList.scrollLeft) tabList.scrollLeft = Math.max(0, left - 16);
    else if (right > tabList.scrollLeft + tabList.clientWidth) tabList.scrollLeft = right - tabList.clientWidth + 16;
  }
  tabList.addEventListener('click', function (e) {
    var b = e.target.closest('.scb-tab');
    if (b) selectTab(b.getAttribute('data-tab'), true);
  });
  tabList.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    var i = TABS.indexOf(currentTab);
    if (e.key === 'ArrowRight') i = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') i = 0;
    else i = TABS.length - 1;
    e.preventDefault();
    selectTab(TABS[i], true);
    $('tab-' + TABS[i]).focus();
  });

  /* ---------- overview ---------- */
  function renderOverview(c) {
    var rows = [
      ['Case title', c.title, true],
      ['Description', c.description, true],
      ['Category', c.category],
      ['Status', c.status],
      ['Incident date', fmtDate(c.incidentDate)],
      ['Location', c.location],
      ['Your name', c.yourName],
      ['Opposing party', c.opposingParty],
      ['Notes', c.notes, true]
    ];
    $('wsOverview').innerHTML = rows.map(function (r) {
      var v = r[1];
      return '<div' + (r[2] ? ' class="scb-dl-full"' : '') + '><dt>' + esc(r[0]) + '</dt>' +
        (v ? '<dd>' + esc(v) + '</dd>' : '<dd class="scb-empty-val">Not added</dd>') + '</div>';
    }).join('');
  }

  /* ---------- timeline ---------- */
  var eventForm = $('eventForm');
  var editingEventId = null;

  function renderTimeline(c) {
    var events = c.timeline.slice().sort(byDateAsc);
    $('wsTimelineEmpty').hidden = events.length > 0;
    $('wsTimeline').hidden = events.length === 0;
    $('wsTimeline').innerHTML = events.map(function (ev) {
      return '<li class="scb-tl-item" data-event-id="' + esc(ev.id) + '">' +
        '<div class="scb-tl-date">' + esc(fmtDate(ev.date) || 'No date') + '</div>' +
        '<div class="scb-tl-body">' +
          '<div class="scb-tl-head">' +
            '<h4 class="scb-tl-title">' + esc(ev.title) + '</h4>' +
            '<div class="scb-row-actions">' +
              '<button type="button" class="scb-mini-btn" data-action="edit-event" aria-label="Edit event: ' + esc(ev.title) + '">Edit</button>' +
              '<button type="button" class="scb-mini-btn scb-danger-text" data-action="delete-event" aria-label="Delete event: ' + esc(ev.title) + '">Delete</button>' +
            '</div>' +
          '</div>' +
          (ev.description ? '<p class="scb-tl-desc">' + esc(ev.description) + '</p>' : '') +
        '</div>' +
      '</li>';
    }).join('');
  }

  function openEventForm(ev) {
    if (!requireReady()) return;
    clearErrors(eventForm);
    eventForm.reset();
    editingEventId = ev ? ev.id : null;
    $('eventModalTitle').textContent = ev ? 'Edit Event' : 'Add Event';
    $('eventSubmitBtn').textContent = ev ? 'Save Changes' : 'Add Event';
    if (ev) {
      eventForm.elements.date.value = ev.date;
      eventForm.elements.title.value = ev.title;
      eventForm.elements.description.value = ev.description;
    }
    openModal($('eventModal'), $('efDate'));
  }

  eventForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors(eventForm);
    var c = getCase(currentCaseId);
    if (!c) return;
    var f = eventForm.elements;
    var data = { date: f.date.value, title: clean(f.title.value, 120), description: clean(f.description.value, 1000) };
    var bad = null;
    if (!isValidISODate(data.date)) { setError(eventForm, 'date', 'Please choose the event date.'); bad = bad || f.date; }
    if (!data.title) { setError(eventForm, 'title', 'Please enter an event title.'); bad = bad || f.title; }
    if (bad) { bad.focus(); return; }

    var editId = editingEventId;
    var base = '/' + encodeURIComponent(c.id) + '/timeline';
    var restore = busyButton($('eventSubmitBtn'));
    runChange(function () {
      var req = editId
        ? scbApi(base + '/' + encodeURIComponent(editId), { method: 'PATCH', body: data })
        : scbApi(base, { method: 'POST', body: data });
      return req.then(function (res) {
        storeCase(res.data.case);
        toast(editId ? 'Event updated' : 'Event added');
        closeModal($('eventModal'));
        renderWorkspace();
      }, function (err) {
        showServerFieldErrors(eventForm, err, ['date', 'title']);
        throw err;
      });
    }, editId ? 'your changes' : 'the event').then(restore);
  });

  $('wsTimeline').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var li = btn.closest('[data-event-id]');
    var c = getCase(currentCaseId);
    if (!li || !c) return;
    var id = li.getAttribute('data-event-id');
    var ev = c.timeline.filter(function (x) { return x.id === id; })[0];
    if (!ev) return;
    if (btn.getAttribute('data-action') === 'edit-event') openEventForm(ev);
    else {
      confirmAction({ title: 'Delete this event?', text: '"' + ev.title + '" will be removed from the timeline.', okLabel: 'Delete Event' })
        .then(function (ok) {
          if (!ok) return;
          runChange(function () {
            return scbApi('/' + encodeURIComponent(c.id) + '/timeline/' + encodeURIComponent(id), { method: 'DELETE' })
              .then(function (res) { storeCase(res.data.case); renderWorkspace(); toast('Event deleted'); });
          }, 'the deletion');
        });
    }
  });

  /* ---------- evidence ---------- */
  var evidenceForm = $('evidenceForm');
  var evFileInput = $('evFile');
  var editingEvidenceId = null;
  var pendingFile = null;          // File chosen in the form (uploaded on save)
  var pendingFileCleared = false;  // user removed an existing file while editing
  var viewingEvidenceId = null;
  var newEvidenceClientId = null;  // one id per opened "Add" form: a retried save never duplicates

  fillSelect($('evCategory'), EVIDENCE_CATEGORIES);
  fillSelect($('wsEvidenceFilter'), EVIDENCE_CATEGORIES, 'All categories');
  $('wsEvidenceFilter').addEventListener('change', function () { var c = getCase(currentCaseId); if (c) renderEvidence(c); });

  function revokePreview(id) {
    if (previewUrls[id]) {
      try { URL.revokeObjectURL(previewUrls[id]); } catch (e) { /* ignore */ }
      delete previewUrls[id];
    }
    delete previewStamp[id];
  }

  var isStoredImage = function (ev) { return !!(ev.file && ev.file.stored && IMAGE_EXT.indexOf(ev.file.ext) >= 0); };
  var previewLoading = {};

  /**
   * Fetches a stored image with the access token and keeps it as an object
   * URL in memory, so previews keep working after a refresh. Re-fetches when
   * the file is replaced (uploadedAt changes).
   */
  function ensurePreview(c, ev) {
    if (!isStoredImage(ev) || !window.URL || !URL.createObjectURL) return Promise.resolve(null);
    var stamp = String(ev.file.uploadedAt || '');
    if (previewUrls[ev.id] && previewStamp[ev.id] === stamp) return Promise.resolve(previewUrls[ev.id]);
    if (previewLoading[ev.id]) return previewLoading[ev.id];
    previewLoading[ev.id] = fetchEvidenceBlob(c, ev, false).then(function (blob) {
      revokePreview(ev.id);
      previewUrls[ev.id] = URL.createObjectURL(blob);
      previewStamp[ev.id] = stamp;
      delete previewLoading[ev.id];
      return previewUrls[ev.id];
    }, function (err) {
      delete previewLoading[ev.id];
      console.warn('[Smart Case Builder] Could not load an evidence preview:', err && err.message);
      return null;
    });
    return previewLoading[ev.id];
  }

  /** Loads thumbnails for stored images on the visible cards. */
  function loadCardPreviews(c) {
    c.evidence.forEach(function (ev) {
      if (!isStoredImage(ev) || (previewUrls[ev.id] && previewStamp[ev.id] === String(ev.file.uploadedAt || ''))) return;
      ensurePreview(c, ev).then(function (url) {
        if (!url || currentCaseId !== c.id) return;
        var card = document.querySelector('.scb-ev-card[data-evidence-id="' + ev.id + '"] .scb-ev-icon');
        if (card) { card.className = 'scb-ev-icon'; card.removeAttribute('aria-hidden'); card.innerHTML = '<img src="' + esc(url) + '" alt="" />'; }
      });
    });
  }

  /** Downloads the stored file through the authenticated endpoint. */
  function downloadEvidence(c, ev) {
    if (!ev.file || !ev.file.stored) return;
    toast('Preparing download…');
    fetchEvidenceBlob(c, ev, true).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = ev.file.name || 'evidence';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ } }, 30000);
    }, function (err) { toast(friendlyError(err, 'the download'), true); });
  }

  function typeLabel(ext) {
    if (!ext) return '';
    if (ext === 'jpeg') return 'JPG';
    if (ext === 'docx') return 'DOCX';
    return ext.toUpperCase();
  }

  var NO_FILE_ICON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  function iconHTML(ev) {
    if (isStoredImage(ev) && previewUrls[ev.id]) {
      return '<span class="scb-ev-icon"><img src="' + esc(previewUrls[ev.id]) + '" alt="" /></span>';
    }
    if (ev.file) return '<span class="scb-ev-icon" aria-hidden="true">' + esc(typeLabel(ev.file.ext) || 'FILE') + '</span>';
    if (ev.legacyFile) return '<span class="scb-ev-icon" aria-hidden="true">' + esc(typeLabel(ev.legacyFile.ext) || 'FILE') + '</span>';
    return '<span class="scb-ev-icon scb-ev-icon-none" aria-hidden="true">' + NO_FILE_ICON + '</span>';
  }

  function renderEvidence(c) {
    var filter = $('wsEvidenceFilter').value;
    var all = c.evidence.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var list = filter ? all.filter(function (e) { return e.category === filter; }) : all;

    $('wsEvidenceFilterWrap').hidden = all.length < 2;
    $('wsEvidenceEmpty').hidden = all.length > 0;

    if (all.length && !list.length) {
      $('wsEvidence').innerHTML = '<div class="scb-empty scb-empty-sm" style="grid-column:1/-1"><h4>No evidence in this category</h4><p>Choose "All categories" to see everything.</p></div>';
      return;
    }

    $('wsEvidence').innerHTML = list.map(function (ev) {
      var fileLine = ev.file
        ? esc(typeLabel(ev.file.ext)) + ' · ' + esc(ev.file.name) + (ev.file.size ? ' · ' + esc(fmtSize(ev.file.size)) : '')
        : ev.legacyFile
          ? 'File not uploaded: ' + esc(ev.legacyFile.name) + ' — re-select it to store it'
          : 'No file attached';
      return '<article class="scb-ev-card" data-evidence-id="' + esc(ev.id) + '">' +
        '<div class="scb-ev-top">' + iconHTML(ev) +
          '<div class="scb-ev-headtext">' +
            '<h4 class="scb-ev-title">' + esc(ev.title) + '</h4>' +
            '<span class="scb-badge">' + esc(ev.category) + '</span>' +
          '</div>' +
        '</div>' +
        (ev.notes ? '<p class="scb-ev-notes">' + esc(ev.notes) + '</p>' : '<p class="scb-ev-notes scb-empty-val">No notes</p>') +
        '<p class="scb-ev-meta">' + (ev.date ? 'Dated ' + esc(fmtDate(ev.date)) + ' · ' : '') + 'Added ' + esc(fmtShortTs(ev.createdAt)) + '<br />' + fileLine + '</p>' +
        '<div class="scb-ev-actions">' +
          '<button type="button" class="scb-mini-btn" data-action="view-evidence">View details</button>' +
          '<button type="button" class="scb-mini-btn" data-action="edit-evidence">Edit</button>' +
          '<button type="button" class="scb-mini-btn scb-danger-text" data-action="delete-evidence">Delete</button>' +
        '</div>' +
      '</article>';
    }).join('');
    loadCardPreviews(c);
  }

  /** state: 'new' (chosen, uploads on save) | 'stored' | 'legacy' (details only, not uploaded) */
  function renderChosenFile(meta, state) {
    var box = $('evFileChosen');
    if (!meta) { box.hidden = true; box.innerHTML = ''; return; }
    var sub = state === 'new' ? ' · selected — uploads when you save'
      : state === 'legacy' ? ' · not uploaded — choose the file again to store it'
      : ' · stored in your Evidence Vault';
    box.hidden = false;
    box.innerHTML =
      '<span class="scb-ev-icon" aria-hidden="true">' + esc(typeLabel(meta.ext) || 'FILE') + '</span>' +
      '<span class="scb-file-chosen-text"><span class="scb-file-chosen-name">' + esc(meta.name) + '</span>' +
      '<span class="scb-file-chosen-sub">' + esc((meta.size ? fmtSize(meta.size) : '') + sub) + '</span></span>' +
      '<button type="button" class="scb-mini-btn scb-danger-text" id="evFileRemove">Remove</button>';
  }

  function openEvidenceForm(ev) {
    if (!requireReady()) return;
    clearErrors(evidenceForm);
    evidenceForm.reset();
    pendingFile = null;
    pendingFileCleared = false;
    editingEvidenceId = ev ? ev.id : null;
    newEvidenceClientId = ev ? null : uid('ev');
    $('evidenceModalTitle').textContent = ev ? 'Edit Evidence' : 'Add Evidence';
    $('evidenceSubmitBtn').textContent = ev ? 'Save Changes' : 'Add Evidence';
    if (ev) {
      evidenceForm.elements.title.value = ev.title;
      evidenceForm.elements.category.value = ev.category;
      evidenceForm.elements.date.value = ev.date;
      evidenceForm.elements.notes.value = ev.notes;
      if (ev.file) renderChosenFile(ev.file, 'stored');
      else renderChosenFile(ev.legacyFile, 'legacy');
    } else {
      evidenceForm.elements.category.value = EVIDENCE_CATEGORIES[0];
      renderChosenFile(null);
    }
    openModal($('evidenceModal'), $('evTitle'));
  }

  function acceptFile(file) {
    setError(evidenceForm, 'file', '');
    if (!file) return;
    var ext = fileExt(file.name);
    if (ALLOWED_EXT.indexOf(ext) < 0) {
      evFileInput.value = '';
      setError(evidenceForm, 'file', 'Unsupported file type. Please choose a PDF, JPG, JPEG, PNG, DOC or DOCX file.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      evFileInput.value = '';
      setError(evidenceForm, 'file', 'This file is too large. The maximum size is ' + MAX_FILE_MB + ' MB.');
      return;
    }
    if (!file.size) {
      evFileInput.value = '';
      setError(evidenceForm, 'file', 'This file is empty.');
      return;
    }
    pendingFile = file;
    pendingFileCleared = false;
    renderChosenFile({ name: file.name, size: file.size, ext: ext }, 'new');
    var titleInput = evidenceForm.elements.title;
    if (!titleInput.value.trim()) titleInput.value = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
  }

  evFileInput.addEventListener('change', function () {
    acceptFile(evFileInput.files && evFileInput.files[0]);
  });

  var drop = $('evDrop');
  // Real drag-and-drop: stop the browser from opening the file, read it from
  // dataTransfer.files and send it through the same acceptFile() as the picker.
  function hasFiles(e) {
    var types = e.dataTransfer && e.dataTransfer.types;
    if (!types) return false;
    for (var i = 0; i < types.length; i++) if (types[i] === 'Files') return true;
    return false;
  }
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      drop.classList.add('is-over');
    });
  });
  drop.addEventListener('dragleave', function (e) {
    // moving onto a child element (the overlaid input) is not leaving the zone
    if (e.relatedTarget && drop.contains(e.relatedTarget)) return;
    drop.classList.remove('is-over');
  });
  drop.addEventListener('dragend', function () { drop.classList.remove('is-over'); });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    drop.classList.remove('is-over');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) acceptFile(files[0]);
  });

  $('evFileChosen').addEventListener('click', function (e) {
    if (e.target.id !== 'evFileRemove') return;
    pendingFile = null;
    pendingFileCleared = true;
    evFileInput.value = '';
    renderChosenFile(null);
  });

  evidenceForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors(evidenceForm);
    var c = getCase(currentCaseId);
    if (!c) return;
    var f = evidenceForm.elements;
    var data = {
      title: clean(f.title.value, 120),
      category: EVIDENCE_CATEGORIES.indexOf(f.category.value) >= 0 ? f.category.value : 'Other',
      date: isValidISODate(f.date.value) ? f.date.value : '',
      notes: clean(f.notes.value, 1500)
    };
    if (!data.title) { setError(evidenceForm, 'title', 'Please enter an evidence title.'); f.title.focus(); return; }

    var editId = editingEvidenceId;
    var existing = editId ? findEvidence(editId) : null;
    if (editId && !existing) { closeModal($('evidenceModal')); toast('This evidence no longer exists.', true); return; }
    var file = pendingFile;
    var clearFile = !file && pendingFileCleared && existing && (existing.file || existing.legacyFile);
    var caseId = c.id;
    var base = '/' + encodeURIComponent(caseId) + '/evidence';
    var restore = busyButton($('evidenceSubmitBtn'), file ? 'Uploading…' : 'Saving…');

    runChange(function () {
      // 1) save the details
      var step = editId
        ? scbApi(base + '/' + encodeURIComponent(editId), { method: 'PATCH', body: data })
        : scbApi(base, { method: 'POST', body: Object.assign({ clientId: newEvidenceClientId || uid('ev') }, data) });
      return step.then(function (res) {
        storeCase(res.data.case);
        var evId = res.data.evidence.id;
        // From here on this form edits the saved record (so a failed upload can be retried).
        editingEvidenceId = evId;
        $('evidenceModalTitle').textContent = 'Edit Evidence';
        $('evidenceSubmitBtn').textContent = 'Save Changes';
        // 2) upload / replace or remove the file
        var fileStep = file
          ? uploadEvidenceFile(caseId, evId, file)
          : clearFile ? scbApi(base + '/' + encodeURIComponent(evId) + '/file', { method: 'DELETE' }) : null;
        if (!fileStep) return { evId: evId, uploaded: false };
        return fileStep.then(function (r2) {
          storeCase(r2.data.case);
          revokePreview(evId);
          return { evId: evId, uploaded: !!file };
        }, function (err) {
          renderWorkspace();
          err.partial = true;   // details are saved; only the file step failed
          throw err;
        });
      }).then(function (out) {
        pendingFile = null;
        pendingFileCleared = false;
        toast(out.uploaded ? 'Evidence saved and file uploaded' : (editId ? 'Evidence updated' : 'Evidence details saved'));
        closeModal($('evidenceModal'));
        renderWorkspace();
      }).catch(function (err) {
        if (err && err.partial) {
          setError(evidenceForm, 'file', friendlyError(err, 'the file') + ' The evidence details were saved — choose the file again to retry.');
          pendingFile = null;
          evFileInput.value = '';
          var saved = findEvidence(editingEvidenceId);
          if (saved) { if (saved.file) renderChosenFile(saved.file, 'stored'); else renderChosenFile(saved.legacyFile, 'legacy'); }
          return false;
        }
        showServerFieldErrors(evidenceForm, err, ['title']);
        throw err;
      });
    }, 'the evidence').then(restore);
  });

  $('wsEvidence').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var card = btn.closest('[data-evidence-id]');
    if (!card) return;
    var id = card.getAttribute('data-evidence-id');
    var action = btn.getAttribute('data-action');
    if (action === 'view-evidence') openEvidenceView(id);
    else if (action === 'edit-evidence') openEvidenceForm(findEvidence(id));
    else if (action === 'delete-evidence') deleteEvidence(id);
  });

  function findEvidence(id) {
    var c = getCase(currentCaseId);
    if (!c) return null;
    return c.evidence.filter(function (x) { return x.id === id; })[0] || null;
  }

  function deleteEvidence(id, afterDelete) {
    var c = getCase(currentCaseId);
    var ev = findEvidence(id);
    if (!c || !ev) return;
    confirmAction({ title: 'Delete this evidence?', text: '"' + ev.title + '" will be removed from the Evidence Vault' + (ev.file ? ', including its uploaded file' : '') + '. Any copy on your own device is not affected.', okLabel: 'Delete Evidence' })
      .then(function (ok) {
        if (!ok) return;
        runChange(function () {
          return scbApi('/' + encodeURIComponent(c.id) + '/evidence/' + encodeURIComponent(id), { method: 'DELETE' }).then(function (res) {
            revokePreview(id);
            storeCase(res.data.case);
            renderWorkspace(); toast('Evidence deleted');
            if (afterDelete) afterDelete();
          });
        }, 'the deletion');
      });
  }

  function openEvidenceView(id) {
    var ev = findEvidence(id);
    if (!ev) return;
    viewingEvidenceId = id;
    $('evidenceViewTitle').textContent = ev.title;
    var c = getCase(currentCaseId);
    var preview = '';
    var dl = ev.file && ev.file.stored
      ? '<p class="scb-ev-preview-note" style="margin-top:10px"><button type="button" class="scb-btn scb-btn-outline scb-btn-sm" data-action="download-evidence">Download ' + esc(typeLabel(ev.file.ext) || 'file') + '</button></p>'
      : '';
    if (isStoredImage(ev)) {
      preview = previewUrls[id] && previewStamp[id] === String(ev.file.uploadedAt || '')
        ? '<div class="scb-ev-preview"><img src="' + esc(previewUrls[id]) + '" alt="Preview of ' + esc(ev.title) + '" />' + dl + '</div>'
        : '<div class="scb-ev-preview" id="evViewPreview"><p class="scb-ev-preview-note">Loading preview…</p>' + dl + '</div>';
    } else if (ev.file) {
      preview = '<div class="scb-ev-preview"><p class="scb-ev-preview-note">In-page preview is available for images only. Download the ' + esc(typeLabel(ev.file.ext)) + ' file to open it.</p>' + dl + '</div>';
    } else if (ev.legacyFile) {
      preview = '<div class="scb-ev-preview"><p class="scb-ev-preview-note">This file was not uploaded. Only its details were imported from this browser. Use <strong>Edit</strong> and choose <strong>' + esc(ev.legacyFile.name) + '</strong> again to store it in your Evidence Vault.</p></div>';
    }
    var meta = ev.file || ev.legacyFile;
    var rows = [
      ['Category', ev.category],
      ['Document date', fmtDate(ev.date)],
      ['Date added', fmtDateTime(ev.createdAt)],
      ['Last edited', ev.updatedAt && ev.updatedAt !== ev.createdAt ? fmtDateTime(ev.updatedAt) : ''],
      ['File name', meta ? meta.name : ''],
      ['File type', meta ? typeLabel(meta.ext) + (meta.type ? ' (' + meta.type + ')' : '') : ''],
      ['File size', meta && meta.size ? fmtSize(meta.size) : ''],
      ['Storage', ev.file
        ? 'Uploaded to your private Evidence Vault' + (ev.file.uploadedAt ? ' on ' + fmtDateTime(ev.file.uploadedAt) : '') + '.'
        : ev.legacyFile ? 'Not uploaded — re-select the file to store it.' : 'No file attached.'],
      ['Description / notes', ev.notes, true]
    ];
    $('evidenceViewBody').innerHTML = preview + '<dl class="scb-dl">' + rows.map(function (r) {
      return '<div' + (r[2] ? ' class="scb-dl-full"' : '') + '><dt>' + esc(r[0]) + '</dt>' +
        (r[1] ? '<dd>' + esc(r[1]) + '</dd>' : '<dd class="scb-empty-val">—</dd>') + '</div>';
    }).join('') + '</dl>';
    openModal($('evidenceViewModal'), $('evidenceViewEdit'));
    if (c && isStoredImage(ev) && $('evViewPreview')) {
      ensurePreview(c, ev).then(function (url) {
        var box = $('evViewPreview');
        if (!box || viewingEvidenceId !== id) return;
        if (url) {
          var img = document.createElement('img');
          img.src = url; img.alt = 'Preview of ' + ev.title;
          box.replaceChild(img, box.firstChild);
        } else {
          box.firstChild.textContent = 'The preview could not be loaded. You can still download the file.';
        }
      });
    }
  }

  $('evidenceViewBody').addEventListener('click', function (e) {
    if (!e.target.closest('[data-action="download-evidence"]')) return;
    var c = getCase(currentCaseId), ev = findEvidence(viewingEvidenceId);
    if (c && ev) downloadEvidence(c, ev);
  });

  $('evidenceViewEdit').addEventListener('click', function () {
    var ev = findEvidence(viewingEvidenceId);
    closeModal($('evidenceViewModal'));
    if (ev) openEvidenceForm(ev);
  });
  $('evidenceViewDelete').addEventListener('click', function () {
    var id = viewingEvidenceId;
    deleteEvidence(id, function () { closeModal($('evidenceViewModal')); });
  });

  /* ---------- checklist ---------- */
  var checklistForm = $('checklistForm');
  var CHECK_SVG = '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6.2L4.8 9 10 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function addChecklistItem(text, status) {
    var c = getCase(currentCaseId);
    if (!c) return false;
    var t = clean(text, 120);
    var err = $('checklistError');
    err.hidden = true;
    if (!t) { err.textContent = 'Please type an item to add.'; err.hidden = false; return false; }
    var dup = c.checklist.some(function (i) { return i.text.toLowerCase() === t.toLowerCase(); });
    if (dup) { err.textContent = '"' + t + '" is already on your checklist.'; err.hidden = false; return Promise.resolve(false); }
    return runChange(function () {
      return scbApi('/' + encodeURIComponent(c.id) + '/checklist', { method: 'POST', body: { text: t, status: status === 'available' ? 'available' : 'missing' } })
        .then(function (res) { storeCase(res.data.case); renderWorkspace(); }, function (e2) {
          if (e2 && e2.statusCode === 409) { err.textContent = e2.message; err.hidden = false; }
          throw e2;
        });
    }, 'the checklist item');
  }

  checklistForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = addChecklistItem($('checklistInput').value, $('checklistStatus').value);
    if (r && r.then) r.then(function (ok) {
      if (!ok) return;
      $('checklistInput').value = '';
      $('checklistInput').focus();
      toast('Checklist item added');
    });
  });

  $('checklistQuick').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-quick]');
    if (!chip) return;
    var r = addChecklistItem(chip.getAttribute('data-quick'), 'missing');
    if (r && r.then) r.then(function (ok) { if (ok) toast('Added to "To collect"'); });
  });

  function renderChecklist(c) {
    var items = c.checklist.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
    var avail = items.filter(function (i) { return i.status === 'available'; });
    var missing = items.filter(function (i) { return i.status !== 'available'; });
    var pct = items.length ? Math.round((avail.length / items.length) * 100) : 0;

    $('wsChecklistProgressLabel').textContent = items.length ? avail.length + ' of ' + items.length + ' available' : '';
    $('wsChecklistBar').style.width = pct + '%';
    $('wsChecklistEmpty').hidden = items.length > 0;
    document.querySelector('.scb-checklist-cols').hidden = items.length === 0;
    document.querySelector('.scb-progress').hidden = items.length === 0;

    function itemHTML(i) {
      var isAvail = i.status === 'available';
      return '<li class="scb-ck-item" data-status="' + (isAvail ? 'available' : 'missing') + '" data-item-id="' + esc(i.id) + '">' +
        '<span class="scb-ck-mark" aria-hidden="true">' + CHECK_SVG + '</span>' +
        '<span class="scb-ck-text">' + esc(i.text) + '<span class="scb-sr"> — ' + (isAvail ? 'available' : 'to collect') + '</span></span>' +
        '<span class="scb-ck-actions">' +
          (isAvail
            ? '<button type="button" class="scb-mini-btn" data-action="mark-missing">Mark as To collect</button>'
            : '<button type="button" class="scb-mini-btn" data-action="mark-available">Mark as Available</button>') +
          '<button type="button" class="scb-mini-btn scb-danger-text" data-action="delete-item" aria-label="Delete checklist item: ' + esc(i.text) + '">Delete</button>' +
        '</span>' +
      '</li>';
    }
    $('wsChecklistAvailable').innerHTML = avail.map(itemHTML).join('');
    $('wsChecklistMissing').innerHTML = missing.map(itemHTML).join('');

    var existing = items.map(function (i) { return i.text.toLowerCase(); });
    var chips = QUICK_CHECKLIST.filter(function (q) { return existing.indexOf(q.toLowerCase()) < 0; });
    $('checklistQuick').innerHTML = chips.length
      ? chips.map(function (q) { return '<button type="button" class="scb-chip" data-quick="' + esc(q) + '">+ ' + esc(q) + '</button>'; }).join('')
      : '<span class="scb-muted scb-small" style="margin:0">All common items added.</span>';
  }

  document.querySelector('.scb-checklist-cols').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var li = btn.closest('[data-item-id]');
    var c = getCase(currentCaseId);
    if (!li || !c) return;
    var id = li.getAttribute('data-item-id');
    var item = c.checklist.filter(function (x) { return x.id === id; })[0];
    if (!item) return;
    var action = btn.getAttribute('data-action');
    var url = '/' + encodeURIComponent(c.id) + '/checklist/' + encodeURIComponent(id);
    if (action === 'mark-available' || action === 'mark-missing') {
      runChange(function () {
        return scbApi(url, { method: 'PATCH', body: { status: action === 'mark-available' ? 'available' : 'missing' } })
          .then(function (res) { storeCase(res.data.case); renderWorkspace(); });
      }, 'the checklist change');
    } else if (action === 'delete-item') {
      runChange(function () {
        return scbApi(url, { method: 'DELETE' })
          .then(function (res) { storeCase(res.data.case); renderWorkspace(); toast('Checklist item deleted'); });
      }, 'the deletion');
    }
  });

  /* ---------- summary ---------- */
  function evidenceByCategory(c) {
    var counts = {};
    c.evidence.forEach(function (e) { counts[e.category] = (counts[e.category] || 0) + 1; });
    return EVIDENCE_CATEGORIES.filter(function (k) { return counts[k]; }).map(function (k) { return [k, counts[k]]; });
  }

  function renderSummary(c) {
    var events = c.timeline.slice().sort(byDateAsc);
    var dated = events.filter(function (e) { return e.date; });
    var avail = c.checklist.filter(function (i) { return i.status === 'available'; });
    var missing = c.checklist.filter(function (i) { return i.status !== 'available'; });
    var withFile = c.evidence.filter(function (e) { return e.file && e.file.stored; }).length;
    var needFile = c.evidence.filter(function (e) { return !e.file && e.legacyFile; }).length;
    var none = '<p class="scb-sum-none">Not added</p>';

    var html = '';
    html += '<div class="scb-sum-block scb-sum-full"><h4>Case overview</h4>' +
      '<p><strong>' + esc(c.title) + '</strong></p>' +
      '<p>' + esc(c.category) + ' · ' + esc(c.status) +
        (c.incidentDate ? ' · Incident on ' + esc(fmtDate(c.incidentDate)) : '') +
        (c.location ? ' · ' + esc(c.location) : '') + '</p>' +
      (c.description ? '<p>' + esc(c.description) + '</p>' : '') + '</div>';

    html += '<div class="scb-sum-block"><h4>Important parties</h4><ul>' +
      '<li class="scb-sum-kv"><span>You</span><span>' + (c.yourName ? esc(c.yourName) : '<span class="scb-sum-none">Not added</span>') + '</span></li>' +
      '<li class="scb-sum-kv"><span>Opposing / other party</span><span>' + (c.opposingParty ? esc(c.opposingParty) : '<span class="scb-sum-none">Not added</span>') + '</span></li>' +
      '</ul></div>';

    html += '<div class="scb-sum-block"><h4>Evidence count</h4>' +
      (c.evidence.length
        ? '<ul><li class="scb-sum-kv"><span>Total items</span><span>' + c.evidence.length + '</span></li>' +
          '<li class="scb-sum-kv"><span>With uploaded file</span><span>' + withFile + '</span></li>' +
          (needFile ? '<li class="scb-sum-kv"><span>File not uploaded yet</span><span>' + needFile + '</span></li>' : '') +
          evidenceByCategory(c).map(function (p) { return '<li class="scb-sum-kv"><span>' + esc(p[0]) + '</span><span>' + p[1] + '</span></li>'; }).join('') + '</ul>'
        : '<p class="scb-sum-none">No evidence added yet</p>') + '</div>';

    html += '<div class="scb-sum-block scb-sum-full"><h4>Timeline summary</h4>' +
      (events.length
        ? '<p>' + plural(events.length, 'event') +
            (dated.length > 1 ? ', from ' + esc(fmtDate(dated[0].date)) + ' to ' + esc(fmtDate(dated[dated.length - 1].date)) : '') + '.</p>' +
          '<ul>' + events.map(function (e) {
            return '<li><span class="scb-sum-date">' + esc(fmtDate(e.date) || 'No date') + '</span>' + esc(e.title) + '</li>';
          }).join('') + '</ul>'
        : '<p class="scb-sum-none">No timeline events added yet</p>') + '</div>';

    html += '<div class="scb-sum-block"><h4>Checklist status</h4>' +
      (c.checklist.length
        ? '<ul><li class="scb-sum-kv"><span>Available</span><span>' + avail.length + '</span></li>' +
          '<li class="scb-sum-kv"><span>Missing / to collect</span><span>' + missing.length + '</span></li>' +
          (missing.length ? '<li><span class="scb-muted scb-small" style="margin:0">Still to collect: ' + esc(missing.map(function (m) { return m.text; }).join(', ')) + '</span></li>' : '') +
          '</ul>'
        : '<p class="scb-sum-none">No checklist items yet</p>') + '</div>';

    html += '<div class="scb-sum-block"><h4>Notes</h4>' + (c.notes ? '<p>' + esc(c.notes) + '</p>' : none) + '</div>';

    $('wsSummary').innerHTML = html;
  }

  /* plain-text summary for clipboard */
  function summaryText(c) {
    var L = [];
    var events = c.timeline.slice().sort(byDateAsc);
    L.push('CASE SUMMARY — ' + c.title);
    L.push('Category: ' + c.category + ' | Status: ' + c.status);
    if (c.incidentDate) L.push('Incident date: ' + fmtDate(c.incidentDate));
    if (c.location) L.push('Location: ' + c.location);
    if (c.yourName) L.push('My name: ' + c.yourName);
    if (c.opposingParty) L.push('Opposing / other party: ' + c.opposingParty);
    if (c.description) { L.push(''); L.push('Description: ' + c.description); }
    if (events.length) {
      L.push(''); L.push('Timeline:');
      events.forEach(function (e) { L.push('- ' + (fmtDate(e.date) || 'No date') + ': ' + e.title + (e.description ? ' — ' + e.description : '')); });
    }
    if (c.evidence.length) {
      L.push(''); L.push('Evidence I have (' + c.evidence.length + '):');
      c.evidence.forEach(function (e) { L.push('- ' + e.title + ' [' + e.category + ']' + (e.date ? ' dated ' + fmtDate(e.date) : '')); });
    }
    var missing = c.checklist.filter(function (i) { return i.status !== 'available'; });
    if (missing.length) {
      L.push(''); L.push('Still to collect:');
      missing.forEach(function (m) { L.push('- ' + m.text); });
    }
    if (c.notes) { L.push(''); L.push('Notes: ' + c.notes); }
    return L.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  /* ---------- case brief ---------- */
  function briefHTML(c) {
    var events = c.timeline.slice().sort(byDateAsc);
    var avail = c.checklist.filter(function (i) { return i.status === 'available'; });
    var missing = c.checklist.filter(function (i) { return i.status !== 'available'; });
    var ev = c.evidence.slice().sort(function (a, b) { return (a.date || '9999') < (b.date || '9999') ? -1 : 1; });

    function kv(label, value) {
      return '<tr><th scope="row">' + esc(label) + '</th><td>' + (value ? esc(value) : '—') + '</td></tr>';
    }

    var h = '<article class="scb-brief">';
    h += '<header class="scb-brief-head">' +
      '<p class="scb-brief-kicker">Legal Lens · Case Brief</p>' +
      '<h2 class="scb-brief-title">' + esc(c.title) + '</h2>' +
      '<p class="scb-brief-sub">Prepared on ' + esc(fmtDateTime(Date.now())) + ' · Last updated ' + esc(fmtDateTime(c.updatedAt)) + '</p>' +
      '</header>';

    h += '<section class="scb-brief-section"><h3>1. Case overview</h3><table class="scb-brief-table scb-brief-kv"><tbody>' +
      kv('Category', c.category) + kv('Status', c.status) + kv('Incident date', fmtDate(c.incidentDate)) + kv('Location', c.location) +
      '</tbody></table>' +
      (c.description ? '<p style="margin-top:10px"><strong>Description:</strong> ' + esc(c.description) + '</p>' : '') + '</section>';

    h += '<section class="scb-brief-section"><h3>2. Parties</h3><table class="scb-brief-table scb-brief-kv"><tbody>' +
      kv('Prepared by / applicant', c.yourName) + kv('Opposing / other party', c.opposingParty) + '</tbody></table></section>';

    h += '<section class="scb-brief-section"><h3>3. Timeline of events</h3>' +
      (events.length
        ? '<table class="scb-brief-table"><thead><tr><th style="width:22%">Date</th><th style="width:30%">Event</th><th>Details</th></tr></thead><tbody>' +
          events.map(function (e) { return '<tr><td>' + esc(fmtDate(e.date) || '—') + '</td><td>' + esc(e.title) + '</td><td>' + esc(e.description || '—') + '</td></tr>'; }).join('') +
          '</tbody></table>'
        : '<p>No timeline events recorded.</p>') + '</section>';

    h += '<section class="scb-brief-section"><h3>4. Evidence list (' + c.evidence.length + ')</h3>' +
      (ev.length
        ? '<table class="scb-brief-table"><thead><tr><th style="width:6%">#</th><th style="width:28%">Evidence</th><th style="width:20%">Category</th><th style="width:16%">Date</th><th>Notes / file</th></tr></thead><tbody>' +
          ev.map(function (e, i) {
            var extra = [e.notes, e.file ? 'File: ' + e.file.name : (e.legacyFile ? 'File not uploaded: ' + e.legacyFile.name : '')].filter(Boolean).join(' — ');
            return '<tr><td>' + (i + 1) + '</td><td>' + esc(e.title) + '</td><td>' + esc(e.category) + '</td><td>' + esc(fmtDate(e.date) || '—') + '</td><td>' + esc(extra || '—') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p>No evidence recorded.</p>') + '</section>';

    h += '<section class="scb-brief-section"><h3>5. Evidence checklist</h3>' +
      (c.checklist.length
        ? '<p><strong>Available (' + avail.length + '):</strong></p>' +
          (avail.length ? '<ul class="scb-brief-list">' + avail.map(function (i) { return '<li>✓ ' + esc(i.text) + '</li>'; }).join('') + '</ul>' : '<p>None</p>') +
          '<p style="margin-top:8px"><strong>Missing / to collect (' + missing.length + '):</strong></p>' +
          (missing.length ? '<ul class="scb-brief-list">' + missing.map(function (i) { return '<li>○ ' + esc(i.text) + '</li>'; }).join('') + '</ul>' : '<p>None</p>')
        : '<p>No checklist items recorded.</p>') + '</section>';

    h += '<section class="scb-brief-section"><h3>6. Notes</h3><p>' + (c.notes ? esc(c.notes) : 'No notes recorded.') + '</p></section>';

    h += '<footer class="scb-brief-foot">This brief was assembled automatically from information entered by the user in Legal Lens Smart Case Builder. ' +
      'It is not AI-generated, has not been reviewed by Legal Lens or a lawyer, and does not verify any evidence or determine its legal validity. ' +
      'Case Builder helps you organize information and documents. It does not determine legal validity or replace advice from a qualified legal professional.</footer>';
    h += '</article>';
    return h;
  }

  function openBrief() {
    var c = getCase(currentCaseId);
    if (!c) return;
    $('briefContent').innerHTML = briefHTML(c);
    openModal($('briefModal'), $('briefPrintBtn'));
  }

  var printCleanupTimer = null;
  function endPrint() {
    document.body.classList.remove('scb-printing');
    $('scbPrintArea').innerHTML = '';
    if (printCleanupTimer) { clearTimeout(printCleanupTimer); printCleanupTimer = null; }
  }
  window.addEventListener('afterprint', endPrint);

  $('briefPrintBtn').addEventListener('click', function () {
    var c = getCase(currentCaseId);
    if (!c) return;
    if (typeof window.print !== 'function') {
      toast('Printing is not available in this browser. Use "Copy Summary" instead.', true);
      return;
    }
    $('scbPrintArea').innerHTML = briefHTML(c);
    document.body.classList.add('scb-printing');
    try {
      window.print();
    } catch (err) {
      toast('Could not open the print dialog. Use "Copy Summary" instead.', true);
      endPrint();
      return;
    }
    // Some mobile browsers never fire afterprint — clean up anyway.
    printCleanupTimer = setTimeout(endPrint, 60000);
  });

  /* ============================================================
     GLOBAL ACTION BUTTONS (data-action outside lists)
     ============================================================ */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.closest('#scbCaseGrid, #wsTimeline, #wsEvidence, .scb-checklist-cols')) return; // handled above
    var action = btn.getAttribute('data-action');
    var c = getCase(currentCaseId);
    switch (action) {
      case 'new-case': openCaseForm(null); break;
      case 'load-example': loadExample(); break;
      case 'back': goToDashboard(); break;
      case 'edit-case': if (c) openCaseForm(c); break;
      case 'delete-case': if (c) deleteCase(c.id); break;
      case 'add-event': if (c) openEventForm(null); break;
      case 'add-evidence': if (c) openEvidenceForm(null); break;
      case 'open-brief': openBrief(); break;
      case 'login': goToLogin(); break;
      case 'retry-load': loadFromAccount(); break;
      case 'import-local': importLegacyCases(); break;
      case 'dismiss-import': importDismissed = true; hideImportNotice(); break;
      case 'copy-summary':
        if (!c) break;
        copyText(summaryText(c)).then(function (ok) {
          toast(ok ? 'Case summary copied to clipboard' : 'Could not copy — please select and copy the summary manually.', !ok);
        });
        break;
      default: break;
    }
  });

  /* ---------------- example case (sample data, user-triggered) ---------------- */
  function loadExample() {
    var now = Date.now();
    // keep example dates in the past relative to today
    var base = new Date(); base.setDate(base.getDate() - 18);
    function rel(offset) {
      var t = new Date(base.getTime()); t.setDate(t.getDate() + offset);
      return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    }
    if (!requireReady()) return;
    var c = sanitizeCase({
      id: uid('case'),
      title: 'Example: Online Shopping Fraud',
      category: 'Cyber Crime',
      status: 'Preparing Case',
      description: 'I paid ₹45,000 to a seller for a laptop, but the seller stopped responding and the item was never delivered.',
      incidentDate: rel(0),
      location: 'Pune, Maharashtra',
      yourName: '',
      opposingParty: 'ABC Seller',
      notes: 'This is sample data to show how Smart Case Builder works. Edit or delete it at any time.',
      createdAt: now,
      updatedAt: now,
      timeline: [
        { id: uid('evt'), date: rel(0), title: 'Payment made', description: 'Paid ₹45,000 through UPI to the seller.', createdAt: now },
        { id: uid('evt'), date: rel(1), title: 'Seller stopped responding', description: 'Calls and messages unanswered.', createdAt: now + 1 },
        { id: uid('evt'), date: rel(2), title: 'Bank complaint filed', description: 'Raised a complaint with my bank.', createdAt: now + 2 }
      ],
      evidence: [
        { id: uid('ev'), title: 'UPI payment receipt', category: 'Payment Proof', date: rel(0), notes: 'Example entry — no file attached.', file: null, createdAt: now, updatedAt: now },
        { id: uid('ev'), title: 'WhatsApp chat with seller', category: 'Communication', date: rel(1), notes: 'Example entry — no file attached.', file: null, createdAt: now + 1, updatedAt: now + 1 }
      ],
      checklist: [
        { id: uid('ck'), text: 'Payment receipt', status: 'available', createdAt: now },
        { id: uid('ck'), text: 'WhatsApp screenshots', status: 'available', createdAt: now + 1 },
        { id: uid('ck'), text: 'Bank complaint', status: 'available', createdAt: now + 2 },
        { id: uid('ck'), text: 'Seller details', status: 'missing', createdAt: now + 3 },
        { id: uid('ck'), text: 'Transaction statement', status: 'missing', createdAt: now + 4 },
        { id: uid('ck'), text: 'Complaint acknowledgement', status: 'missing', createdAt: now + 5 }
      ]
    });
    // Saved to the account in one request (same endpoint as the browser-data import).
    runChange(function () {
      return scbApi('/import', { method: 'POST', body: { cases: [legacyPayload(c)] } }).then(function (res) {
        var saved = res.data.cases && res.data.cases[0];
        if (!saved) throw Object.assign(new Error('The example case could not be added.'), { statusCode: 422 });
        var sc = storeCase(saved);
        toast('Example case added');
        goToCase(sc.id);
      });
    }, 'the example case');
  }

  /* ============================================================
     CASES SAVED BY THE OLD BROWSER-ONLY VERSION
     Imported ONLY when the customer clicks "Import to my account":
     this browser may have been used by someone else, so old data is
     never attached to an account automatically. "Not now" only hides the
     notice for this page view and never touches the saved data.
     ============================================================ */
  var importing = false;
  var importDismissed = false;
  var importLeftover = false;
  var IMPORT_BATCH = 3;

  /** Payload for the import endpoint (old browser case shape). */
  function legacyPayload(c) {
    return {
      id: c.id, title: c.title, category: c.category, status: c.status, description: c.description,
      incidentDate: c.incidentDate, location: c.location, yourName: c.yourName, opposingParty: c.opposingParty,
      notes: c.notes, createdAt: c.createdAt,
      timeline: c.timeline.map(function (e) { return { id: e.id, date: e.date, title: e.title, description: e.description, createdAt: e.createdAt }; }),
      checklist: c.checklist.map(function (i) { return { id: i.id, text: i.text, status: i.status, createdAt: i.createdAt }; }),
      evidence: c.evidence.map(function (e) {
        return { id: e.id, title: e.title, category: e.category, date: e.date, notes: e.notes, file: e.file ? { name: e.file.name, type: e.file.type, size: e.file.size, ext: e.file.ext } : null, createdAt: e.createdAt };
      })
    };
  }

  function hideImportNotice() {
    var box = $('scbImportNotice');
    if (box) { box.hidden = true; box.innerHTML = ''; }
  }

  function checkLegacyCases() {
    var box = $('scbImportNotice');
    if (!box) return;
    if (loadState !== 'ready' || importDismissed || !storageOK) { hideImportNotice(); return; }
    var n = Store.load().length;
    if (!n) { hideImportNotice(); return; }
    var lead = importLeftover
      ? '<strong>' + esc(plural(n, 'case')) + ' saved in this browser could not be imported.</strong> ' + (n === 1 ? 'It is' : 'They are') + ' still kept in this browser.'
      : '<strong>We found ' + esc(plural(n, 'case')) + ' previously saved in this browser.</strong> ' +
        (n === 1 ? 'It is' : 'They are') + ' not linked to any account — import only if ' + (n === 1 ? 'it is' : 'they are') + ' yours. ' +
        'Only file details were saved in this browser, so evidence files will need to be selected again to be stored.';
    box.innerHTML = '<p>' + lead + '</p>' +
      '<span class="scb-notice-actions" style="display: inline-flex; gap: 8px; flex-wrap: wrap;">' +
        '<button type="button" class="scb-btn scb-btn-dark scb-btn-sm" data-action="import-local">' + (importLeftover ? 'Try again' : 'Import to my account') + '</button>' +
        '<button type="button" class="scb-btn scb-btn-outline scb-btn-sm" data-action="dismiss-import">Not now</button>' +
      '</span>';
    box.hidden = false;
  }

  /**
   * Sends the old cases a few at a time. After each request, ONLY the ids
   * the server reports as "created" or "existing" (confirmed in the
   * database) are removed from this browser; invalid or failed ones stay.
   * The old id is sent as clientId, so repeating the import cannot create
   * duplicates.
   */
  function importLegacyCases() {
    if (importing || loadState !== 'ready' || !storageOK) return;
    var local = Store.load();
    if (!local.length) { hideImportNotice(); return; }
    importing = true;
    var box = $('scbImportNotice');
    Array.prototype.forEach.call(box ? box.querySelectorAll('button') : [], function (b) { b.disabled = true; });
    var btn = box && box.querySelector('[data-action="import-local"]');
    if (btn) btn.textContent = 'Importing…';
    var moved = 0, kept = 0, filesToReselect = 0, i = 0;

    function next() {
      if (i >= local.length || loadState !== 'ready') return Promise.resolve();
      var batch = local.slice(i, i + IMPORT_BATCH);
      i += IMPORT_BATCH;
      return scbApi('/import', { method: 'POST', body: { cases: batch.map(legacyPayload) } }).then(function (res) {
        var data = (res && res.data) || {};
        var confirmed = {};
        (data.results || []).forEach(function (r) {
          if ((r.status === 'created' || r.status === 'existing') && r.clientId) {
            confirmed[r.clientId] = 1; moved++;
            filesToReselect += r.legacyFilesNeedingReupload || 0;
          } else kept++;
        });
        (data.cases || []).forEach(storeCase);
        Store.removeMigrated(confirmed);
        return next();
      });
    }

    return next().then(function () {
      importing = false;
      importLeftover = kept > 0;
      if (moved) {
        route();
        toast(plural(moved, 'case') + ' imported to your account' + (filesToReselect ? ' — ' + plural(filesToReselect, 'evidence file') + ' must be selected again to be stored' : ''));
      }
      if (kept) toast(plural(kept, 'case') + ' could not be imported and ' + (kept === 1 ? 'is' : 'are') + ' still kept in this browser.', true);
      checkLegacyCases();
    }, function (err) {
      importing = false;
      importLeftover = true;
      if (moved) route();
      console.warn('[Smart Case Builder] Import of browser-saved cases stopped:', err);
      var msg = friendlyError(err, 'the import');
      if (loadState === 'ready') toast(msg + ' Cases not yet imported are still kept in this browser.', true);
      checkLegacyCases();
    });
  }

  /* ============================================================
     NAVBAR (same behaviour as the Home page)
     ============================================================ */
  (function initNavbar() {
    var langWrap = $('langWrap'), langTrigger = $('langTrigger'), langMenu = $('langMenu');
    if (langWrap && langTrigger && langMenu) {
      var closeLang = function () { langWrap.classList.remove('open'); langTrigger.setAttribute('aria-expanded', 'false'); };
      langTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = langWrap.classList.toggle('open');
        langTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) { if (!langWrap.contains(e.target)) closeLang(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLang(); });
      Array.prototype.forEach.call(langMenu.querySelectorAll('.lang-option'), function (opt) {
        opt.addEventListener('click', function () {
          if (typeof window.changeLanguage === 'function') window.changeLanguage(opt.getAttribute('data-lang'));
          closeLang();
        });
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.mobile-lang-option'), function (btn) {
      btn.addEventListener('click', function () {
        if (typeof window.changeLanguage === 'function') window.changeLanguage(btn.getAttribute('data-lang'));
      });
    });
    var hb = $('hamburgerBtn'), mm = $('mobileMenu');
    if (hb && mm) {
      hb.addEventListener('click', function () {
        var open = mm.classList.toggle('open');
        hb.classList.toggle('open', open);
        hb.setAttribute('aria-expanded', open ? 'true' : 'false');
        hb.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      });
    }
  })();

  /* Legal Drafting link: use the existing config.js value (handles Live Server dev). */
  (function wireDraftLink() {
    var a = $('scbDraftLink');
    try {
      if (a && typeof LEGAL_DRAFTING_APP_URL !== 'undefined' && LEGAL_DRAFTING_APP_URL) a.href = LEGAL_DRAFTING_APP_URL;
    } catch (e) { /* keep default /legal-drafting/ */ }
  })();

  /* ---------------- init ---------------- */
  // Cases are saved to the account now, so blocked browser storage no longer
  // loses work (scbStorageWarning stays hidden). It only affects the one-time
  // import of cases saved by the old browser-only version.

  route();
  loadFromAccount();
})();
