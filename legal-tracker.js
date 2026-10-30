/* ============================================================
   LEGAL LENS — LEGAL DEADLINE & CASE TRACKER

   - Events are saved to the signed-in CUSTOMER's account through the
     Legal Lens API (/api/tracker/events, MongoDB). Requires config.js
     (API_BASE_URL) and auth.js (apiRequest, getCustomerSession,
     refreshSession) to be loaded first. No auth logic lives here.
   - Events saved by the old browser-only tracker under STORAGE_KEY are
     imported ONLY when the customer chooses "Import to my account" (see
     checkLocalEvents / importLocalEvents); only items the server confirms
     are removed from this browser. "Not now" leaves them untouched.
   - Smart Case Builder cases are READ ONLY from SCB_STORAGE_KEY (the
     key used by smart-case-builder.js). Nothing is copied or written
     back; an event stores only the case id (+ its title at the time,
     used as a label if that case is later deleted).
   - Reminders are NOT sent. The option is stored as a preference for
     future notification support.
   - All user text is escaped before it is placed in the page.
   - UI: Overview (default) / Timeline / Calendar / All Events views.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'legalLens.legalTracker.v1';
  var SCB_STORAGE_KEY = 'legalLens.smartCaseBuilder.v1';   // read only
  var SOON_DAYS = 7;

  var EVENT_TYPES = [
    'Court Hearing', 'Notice Reply', 'Filing Deadline', 'Document Submission',
    'Lawyer Consultation', 'Complaint Follow-up', 'Payment / Fee',
    'Limitation / Important Date', 'General Reminder', 'Other'
  ];
  var PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
  var REMINDERS = [
    ['none', 'No Reminder'], ['same', 'Same Day'], ['1d', '1 Day Before'],
    ['3d', '3 Days Before'], ['7d', '7 Days Before'], ['custom', 'Custom']
  ];
  var STATUS_LABEL = { upcoming: 'Upcoming', completed: 'Completed' };

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() {
    var rnd = '';
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        var a = new Uint32Array(2);
        window.crypto.getRandomValues(a);
        rnd = a[0].toString(36) + a[1].toString(36);
      }
    } catch (e) { /* ignore */ }
    if (!rnd) rnd = Math.random().toString(36).slice(2, 12);
    return 'evt_' + Date.now().toString(36) + rnd;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isoFromDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return isoFromDate(new Date()); }

  function isValidISODate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var p = s.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  }
  function isValidTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }

  function parseISO(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  /** Whole calendar days from today to iso (negative = past). DST-safe. */
  function daysFromToday(iso) {
    var p = iso.split('-').map(Number);
    var t = new Date();
    var a = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    var b = Date.UTC(p[0], p[1] - 1, p[2]);
    return Math.round((b - a) / 86400000);
  }

  function fmtDate(iso, opts) {
    if (!isValidISODate(iso)) return '';
    try { return parseISO(iso).toLocaleDateString('en-IN', opts || { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function fmtWeekday(iso) { return fmtDate(iso, { weekday: 'long' }); }
  function fmtTime(t) {
    if (!isValidTime(t)) return '';
    var p = t.split(':').map(Number);
    var d = new Date(2000, 0, 1, p[0], p[1]);
    try { return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return t; }
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    if (!ts || isNaN(d.getTime())) return '';
    try { return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return d.toISOString(); }
  }
  function clean(v, max) { return String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max || 2000); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  /* ---------------- categorisation ---------------- */
  /** completed | overdue | soon | later */
  function category(ev) {
    if (ev.status === 'completed') return 'completed';
    var d = daysFromToday(ev.date);
    if (d < 0) return 'overdue';
    if (d <= SOON_DAYS) return 'soon';
    return 'later';
  }
  function daysLabel(ev) {
    if (ev.status === 'completed') return 'Completed';
    var d = daysFromToday(ev.date);
    if (d === 0) return 'Due today';
    if (d > 0) return plural(d, 'day') + ' remaining';
    return 'Overdue by ' + plural(-d, 'day');
  }
  function sortKey(ev) { return ev.date + ' ' + (ev.time || '99:99'); }

  /* ---------------- storage ---------------- */
  var storageOK = (function () {
    try { var k = '__lt_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  })();
  var memoryEvents = [];

  function sanitizeEvent(e) {
    if (!e || typeof e !== 'object' || !e.id || !isValidISODate(e.date)) return null;
    var reminder = REMINDERS.some(function (r) { return r[0] === e.reminder; }) ? e.reminder : 'none';
    return {
      id: String(e.id),
      clientId: e.clientId ? String(e.clientId) : String(e.id),
      title: clean(e.title, 120) || 'Untitled event',
      type: EVENT_TYPES.indexOf(e.type) >= 0 ? e.type : 'Other',
      caseId: e.caseId ? String(e.caseId) : '',
      caseTitle: clean(e.caseTitle, 120),
      date: e.date,
      time: isValidTime(e.time) ? e.time : '',
      priority: PRIORITIES.indexOf(e.priority) >= 0 ? e.priority : 'Medium',
      notes: clean(e.notes, 2000),
      reminder: reminder,
      reminderDate: reminder === 'custom' && isValidISODate(e.reminderDate) ? e.reminderDate : '',
      status: e.status === 'completed' ? 'completed' : 'upcoming',
      example: !!e.example,
      createdAt: Number(e.createdAt) || Date.now(),
      updatedAt: Number(e.updatedAt) || Number(e.createdAt) || Date.now(),
      completedAt: e.status === 'completed' ? (Number(e.completedAt) || null) : null
    };
  }

  /**
   * Events saved by the previous, browser-only version of the tracker.
   * Read only for the one-time move to the account; removeMigrated() deletes
   * ONLY the ids the server confirmed, so anything else stays in place.
   */
  var Store = {
    load: function () {
      if (!storageOK) return memoryEvents;
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        var data = JSON.parse(raw);
        var list = data && Array.isArray(data.events) ? data.events : [];
        return list.map(sanitizeEvent).filter(Boolean);
      } catch (err) {
        console.warn('[Legal Tracker] Could not read events saved in this browser:', err);
        return [];
      }
    },
    removeMigrated: function (confirmedIds) {
      if (!storageOK) return;
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var data = JSON.parse(raw);
        var list = data && Array.isArray(data.events) ? data.events : [];
        var remaining = list.filter(function (e) { return !(e && e.id && confirmedIds[String(e.id)]); });
        if (remaining.length) localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events: remaining }));
        else localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        // Leaving the old copy is safe: the server ignores ids it already has.
        console.warn('[Legal Tracker] Could not update browser copy after moving events:', err);
      }
    }
  };

  /* ---------------- account API (uses auth.js — no auth logic here) ---------------- */
  var loadState = 'loading';   // loading | ready | auth | role | error
  var loadError = '';
  var pendingIds = {};          // event ids with a request in flight
  var MIGRATE_BATCH = 25;

  function authReady() {
    return typeof apiRequest === 'function' && typeof getCustomerSession === 'function';
  }

  /** apiRequest with the access token; one silent token refresh on 401. */
  function authedApi(fullPath, opts) {
    opts = opts || {};
    return apiRequest(fullPath, { method: opts.method || 'GET', body: opts.body, useAuth: true })
      .catch(function (err) {
        if (err && err.statusCode === 401 && !opts.retried && typeof refreshSession === 'function') {
          return refreshSession().then(function (ok) {
            if (!ok) throw err;
            return authedApi(fullPath, { method: opts.method, body: opts.body, retried: true });
          });
        }
        throw err;
      });
  }
  function trackerApi(path, opts) { return authedApi('/tracker' + path, opts); }

  /** Server event -> the shape the rest of this file already uses. */
  function fromApi(e) {
    if (!e) return null;
    var ms = function (v) { var t = v ? Date.parse(v) : NaN; return isNaN(t) ? null : t; };
    return sanitizeEvent({
      id: e.id, clientId: e.clientId, title: e.title, type: e.type, caseId: e.caseId, caseTitle: e.caseTitle,
      date: e.date, time: e.time, priority: e.priority, notes: e.notes, reminder: e.reminder,
      reminderDate: e.reminderDate, status: e.status, example: e.example,
      createdAt: ms(e.createdAt), updatedAt: ms(e.updatedAt), completedAt: ms(e.completedAt)
    });
  }

  function upsertLocal(ev) {
    if (!ev) return;
    for (var i = 0; i < events.length; i++) if (events[i].id === ev.id) { events[i] = ev; return; }
    events.push(ev);
  }
  function removeLocal(id) { events = events.filter(function (x) { return x.id !== id; }); }

  /** Friendly text for a failed request. Also switches to the login state on 401. */
  function friendlyError(err, action) {
    var code = err && err.statusCode;
    if (!code) return 'Could not reach Legal Lens. Check your internet connection and try again.';
    if (code === 401) { setLoadState('auth', 'Your session has ended. Please log in again.'); return 'Your session has ended. Please log in again.'; }
    if (code === 403) { setLoadState('role'); return 'Legal Tracker is available for customer accounts only.'; }
    if (code === 404) return 'This event no longer exists. It may have been deleted.';
    if (code === 422 || code === 409) return err.message || 'Please check the details and try again.';
    if (code === 429) return 'Too many requests. Please wait a moment and try again.';
    return 'Something went wrong on our side, so ' + (action || 'your change') + ' was not saved. Please try again.';
  }

  /** The small notice above the overview: loading, login, wrong role, errors. */
  function setLoadState(state, message) {
    loadState = state;
    loadError = message || '';
    var box = $('ltSyncNotice');
    if (box) {
      var html = '';
      if (state === 'loading') html = '<span><strong>Loading your legal events…</strong></span>';
      else if (state === 'auth') html = '<span><strong>' + esc(loadError || 'Log in to use Legal Tracker.') + '</strong> Your legal dates and reminders are saved to your Legal Lens customer account.</span>' +
        '<span class="lt-sync-actions" style="display: inline-flex; gap: 16px;"><button type="button" class="lt-link-btn" data-action="login">Log In</button> <a class="lt-link-btn" href="signup.html">Sign Up</a></span>';
      else if (state === 'role') html = '<span><strong>Legal Tracker is available for customer accounts.</strong> You are signed in with an account that cannot use it.</span>';
      else if (state === 'error') html = '<span><strong>Could not load your legal events.</strong> ' + esc(loadError) + '</span>' +
        '<span class="lt-sync-actions" style="display: inline-flex; gap: 16px;"><button type="button" class="lt-link-btn" data-action="retry-load">Try again</button></span>';
      box.innerHTML = html;
      box.hidden = !html;
      box.setAttribute('role', state === 'error' ? 'alert' : 'status');
    }
    if (state !== 'ready') events = [];
    if (state !== 'ready') hideImportNotice();
    renderCaseFilter();
    renderAll();
  }

  /** Blocks actions until the account's events are loaded. */
  function requireReady() {
    if (loadState === 'ready') return true;
    if (loadState === 'auth') goToLogin();
    else if (loadState === 'role') toast('Legal Tracker is available for customer accounts only.', true);
    else if (loadState === 'error') toast('Your events could not be loaded. Please try again.', true);
    else toast('Still loading your legal events…');
    return false;
  }

  function goToLogin() {
    try { sessionStorage.setItem('postLoginRedirect', 'legal-tracker.html' + (window.location.hash || '')); } catch (e) { /* ignore */ }
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
      return trackerApi('/events').then(function (res) {
        var list = res && res.data && Array.isArray(res.data.events) ? res.data.events : [];
        events = list.map(fromApi).filter(Boolean);
        setLoadState('ready');
        loadAccountCases();
        checkLocalEvents();   // notice only — nothing is uploaded without the customer's choice
      });
    }).catch(function (err) {
      var msg = friendlyError(err, 'loading');
      if (loadState !== 'auth' && loadState !== 'role') setLoadState('error', msg);
    });
  }

  /** Payload for the import endpoint from an old browser-saved event. */
  function legacyPayload(e) {
    return {
      id: e.id, title: e.title, type: e.type, date: e.date, time: e.time, priority: e.priority,
      status: e.status, reminder: e.reminder, reminderDate: e.reminderDate, notes: e.notes,
      caseId: e.caseId, caseTitle: e.caseTitle, example: e.example,
      createdAt: e.createdAt, completedAt: e.completedAt
    };
  }

  /* ---------------- browser-saved events: import ONLY when the customer asks ----------------
     Events saved by the old browser-only tracker are not linked to any
     account, and this browser may have been used by someone else. So they
     are never uploaded automatically: the customer sees a notice and must
     choose "Import to my account". "Not now" only hides the notice for this
     page view and never touches the saved data. */
  var importing = false;
  var importDismissed = false;   // "Not now" — in memory only, for this page view
  var importLeftover = false;    // last import left some items unconfirmed

  function hideImportNotice() {
    var box = $('ltImportNotice');
    if (box) { box.hidden = true; box.innerHTML = ''; }
  }

  /** Shows the import notice if the old browser storage still holds events. */
  function checkLocalEvents() {
    var box = $('ltImportNotice');
    if (!box) return;
    if (loadState !== 'ready' || importDismissed || !storageOK) { hideImportNotice(); return; }
    var n = Store.load().length;
    if (!n) { hideImportNotice(); return; }
    var lead = importLeftover
      ? '<strong>' + esc(plural(n, 'tracker event')) + ' saved in this browser could not be imported.</strong> They are still kept in this browser.'
      : '<strong>We found ' + esc(plural(n, 'tracker event')) + ' previously saved in this browser.</strong> ' +
        'They are not linked to any account. Import them only if they are yours.';
    box.innerHTML = '<span>' + lead + '</span>' +
      '<span class="lt-sync-actions" style="display: inline-flex; gap: 16px;">' +
        '<button type="button" class="lt-link-btn" data-action="import-local">' + (importLeftover ? 'Try again' : 'Import to my account') + '</button>' +
        '<button type="button" class="lt-link-btn" data-action="dismiss-import">Not now</button>' +
      '</span>';
    box.hidden = false;
  }

  /**
   * Runs only after the customer clicks "Import to my account".
   * Sent in small batches; after each batch, ONLY the ids the server reports
   * as "created" or "existing" (i.e. confirmed in the database) are removed
   * from this browser. Invalid, failed or unconfirmed items stay. The legacy
   * id is sent as clientId, so repeating the import (double click, refresh
   * mid-way, second tab) cannot create duplicates.
   */
  function importLocalEvents() {
    if (importing || loadState !== 'ready' || !storageOK) return;
    var local = Store.load();
    if (!local.length) { hideImportNotice(); return; }
    importing = true;
    var box = $('ltImportNotice');
    Array.prototype.forEach.call(box ? box.querySelectorAll('button') : [], function (b) { b.disabled = true; });
    var btn = box && box.querySelector('[data-action="import-local"]');
    if (btn) btn.textContent = 'Importing…';
    var moved = 0, kept = 0, i = 0;

    function next() {
      if (i >= local.length || loadState !== 'ready') return Promise.resolve();
      var batch = local.slice(i, i + MIGRATE_BATCH);
      i += MIGRATE_BATCH;
      return trackerApi('/events/import', { method: 'POST', body: { events: batch.map(legacyPayload) } })
        .then(function (res) {
          var data = (res && res.data) || {};
          var confirmed = {};
          (data.results || []).forEach(function (r) {
            if ((r.status === 'created' || r.status === 'existing') && r.clientId) { confirmed[r.clientId] = 1; moved++; }
            else kept++;
          });
          (data.events || []).forEach(function (e) { upsertLocal(fromApi(e)); });
          Store.removeMigrated(confirmed);
          return next();
        });
    }

    return next().then(function () {
      importing = false;
      importLeftover = kept > 0;
      if (moved) { renderCaseFilter(); renderAll(); toast(plural(moved, 'event') + ' imported to your account'); }
      if (kept) toast(plural(kept, 'event') + ' could not be imported and ' + (kept === 1 ? 'is' : 'are') + ' still kept in this browser.', true);
      checkLocalEvents();
    }, function (err) {
      importing = false;
      importLeftover = true;
      if (moved) { renderCaseFilter(); renderAll(); }
      // Nothing unconfirmed was removed from this browser.
      console.warn('[Legal Tracker] Import of browser-saved events stopped:', err);
      var msg = friendlyError(err, 'the import');
      if (loadState === 'ready') toast(msg + ' Events not yet imported are still kept in this browser.', true);
      checkLocalEvents();
    });
  }

  /**
   * Smart Case Builder cases — read only, minimal fields.
   * Cases now live in the customer's account (/api/cases). They are matched
   * by clientId, which is the same id the old browser Case Builder used, so
   * events linked before the move keep their link. Cases still saved only in
   * this browser (not imported yet) are listed too.
   */
  var accountCases = null;   // null until loaded from the account

  function loadCases() {
    var list = (accountCases || []).slice();
    var seen = {};
    list.forEach(function (c) { seen[c.id] = 1; });
    browserCases().forEach(function (c) { if (!seen[c.id]) list.push(c); });
    return list;
  }

  function loadAccountCases() {
    return authedApi('/cases').then(function (res) {
      var list = res && res.data && Array.isArray(res.data.cases) ? res.data.cases : [];
      accountCases = list.map(function (c) {
        return { id: String(c.clientId || c.id), title: clean(c.title, 120) || 'Untitled case', category: clean(c.category, 60), status: clean(c.status, 60) };
      });
      cases = loadCases();
      renderCaseFilter();
      renderAll();
    }, function (err) {
      // Not fatal: the tracker still works; cases saved in this browser are still listed.
      console.warn('[Legal Tracker] Could not load Smart Case Builder cases:', err && err.message);
    });
  }

  function browserCases() {
    if (!storageOK) return [];
    try {
      var raw = localStorage.getItem(SCB_STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      var list = Array.isArray(data) ? data : (data && Array.isArray(data.cases) ? data.cases : []);
      return list.filter(function (c) { return c && c.id; }).map(function (c) {
        return { id: String(c.id), title: clean(c.title, 120) || 'Untitled case', category: clean(c.category, 60), status: clean(c.status, 60) };
      });
    } catch (err) {
      console.warn('[Legal Tracker] Could not read Smart Case Builder cases:', err);
      return [];
    }
  }

  var events = [];              // filled from the account by loadFromAccount()
  var cases = loadCases();
  function getEvent(id) { for (var i = 0; i < events.length; i++) if (events[i].id === id) return events[i]; return null; }
  function getCase(id) { for (var i = 0; i < cases.length; i++) if (cases[i].id === id) return cases[i]; return null; }

  /** Supported by smart-case-builder.js routing: #case/<encodeURIComponent(id)> */
  function caseUrl(id) { return 'smart-case-builder.html#case/' + encodeURIComponent(id); }

  function caseLabel(ev) {
    if (!ev.caseId) return '';
    var c = getCase(ev.caseId);
    if (c) return c.title;
    return (ev.caseTitle || 'Case') + ' (not found in Case Builder)';
  }

  /* ---------------- toasts ---------------- */
  function toast(msg, isError) {
    var wrap = $('ltToasts');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'lt-toast' + (isError ? ' is-error' : '');
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
  var confirmResolver = null;

  function focusables(root) {
    return Array.prototype.filter.call(
      root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null; }
    );
  }
  function openModal(modal, focusEl) {
    if (!modalStack.some(function (m) { return m.el === modal; })) modalStack.push({ el: modal, back: document.activeElement });
    modal.hidden = false;
    document.body.classList.add('lt-modal-open');
    var t = focusEl || focusables(modal.querySelector('.lt-modal-dialog'))[0];
    setTimeout(function () { if (t && t.focus) t.focus(); }, 30);
  }
  function closeModal(modal) {
    var idx = -1;
    for (var i = modalStack.length - 1; i >= 0; i--) if (modalStack[i].el === modal) { idx = i; break; }
    modal.hidden = true;
    var entry = idx >= 0 ? modalStack.splice(idx, 1)[0] : null;
    if (!modalStack.length) document.body.classList.remove('lt-modal-open');
    if (modal.id === 'confirmModal' && confirmResolver) { var r = confirmResolver; confirmResolver = null; r(false); }
    if (entry && entry.back && document.contains(entry.back) && entry.back.focus) { try { entry.back.focus(); } catch (e) { /* ignore */ } }
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]');
    if (c) { var m = c.closest('.lt-modal'); if (m) closeModal(m); }
  });
  document.addEventListener('keydown', function (e) {
    if (!modalStack.length) return;
    var top = modalStack[modalStack.length - 1].el;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(top); return; }
    if (e.key === 'Tab') {
      var f = focusables(top.querySelector('.lt-modal-dialog'));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  function confirmAction(o) {
    $('confirmTitle').textContent = o.title;
    $('confirmText').textContent = o.text;
    $('confirmOk').textContent = o.okLabel || 'Delete';
    return new Promise(function (resolve) { confirmResolver = resolve; openModal($('confirmModal'), $('confirmCancel')); });
  }
  $('confirmOk').addEventListener('click', function () {
    var r = confirmResolver; confirmResolver = null;
    closeModal($('confirmModal'));
    if (r) r(true);
  });

  function fillSelect(sel, options, placeholder) {
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    html += options.map(function (o) {
      var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '">' + esc(l) + '</option>';
    }).join('');
    sel.innerHTML = html;
  }

  /* ============================================================
     FILTERS
     ============================================================ */
  var F = { search: $('fSearch'), caseSel: $('fCase'), type: $('fType'), prio: $('fPriority'), status: $('fStatus'), from: $('fFrom'), to: $('fTo') };
  fillSelect(F.type, EVENT_TYPES, 'All types');
  fillSelect(F.prio, PRIORITIES, 'All priorities');

  function renderCaseFilter() {
    var current = F.caseSel.value;
    var opts = [['', 'All cases'], ['__none__', 'No related case']];
    cases.forEach(function (c) { opts.push([c.id, c.title]); });
    // events linked to cases that no longer exist in Case Builder
    var seen = {};
    events.forEach(function (ev) {
      if (ev.caseId && !getCase(ev.caseId) && !seen[ev.caseId]) { seen[ev.caseId] = 1; opts.push([ev.caseId, caseLabel(ev)]); }
    });
    fillSelect(F.caseSel, opts);
    F.caseSel.value = opts.some(function (o) { return o[0] === current; }) ? current : '';
  }

  function filtersActive() {
    return !!(F.search.value.trim() || F.caseSel.value || F.type.value || F.prio.value || F.status.value || F.from.value || F.to.value);
  }

  function applyFilters(list) {
    var q = F.search.value.trim().toLowerCase();
    var cs = F.caseSel.value, ty = F.type.value, pr = F.prio.value, st = F.status.value;
    var from = isValidISODate(F.from.value) ? F.from.value : '';
    var to = isValidISODate(F.to.value) ? F.to.value : '';
    return list.filter(function (ev) {
      if (q && (ev.title + ' ' + ev.notes).toLowerCase().indexOf(q) === -1) return false;
      if (cs === '__none__' && ev.caseId) return false;
      if (cs && cs !== '__none__' && ev.caseId !== cs) return false;
      if (ty && ev.type !== ty) return false;
      if (pr && ev.priority !== pr) return false;
      if (st) {
        var cat = category(ev);
        if (st === 'upcoming' && !(cat === 'soon' || cat === 'later')) return false;
        if (st !== 'upcoming' && cat !== st) return false;
      }
      if (from && ev.date < from) return false;
      if (to && ev.date > to) return false;
      return true;
    });
  }

  ['input', 'change'].forEach(function (t) { $('ltFilters').addEventListener(t, function () { renderAll(); }); });
  $('ltFilters').addEventListener('submit', function (e) { e.preventDefault(); });
  $('ltFilters').addEventListener('reset', function () { setTimeout(renderAll, 0); });
  function clearFilters() { $('ltFilters').reset(); }


  /* ============================================================
     RENDER HELPERS
     ============================================================ */
  var TONE = { soon: 'soon', later: 'upcoming', overdue: 'overdue', completed: 'completed' };
  var PRIO_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  var VIEWS = ['overview', 'timeline', 'calendar', 'events'];
  var currentView = 'overview';
  var tlRange = 'all';
  var UPCOMING_PREVIEW = 5;

  function tone(ev) { return TONE[category(ev)]; }
  function byWhen(a, b) {
    var ka = sortKey(a), kb = sortKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return (PRIO_RANK[b.priority] || 0) - (PRIO_RANK[a.priority] || 0);
  }
  function upcomingList() {
    var today = todayISO();
    return events.filter(function (ev) { return ev.status !== 'completed' && ev.date >= today; }).sort(byWhen);
  }
  function dateBox(ev) {
    var d = parseISO(ev.date);
    var mon = '';
    try { mon = d.toLocaleDateString('en-IN', { month: 'short' }).replace('.', '').slice(0, 3).toUpperCase(); } catch (e) { mon = ''; }
    return '<span class="lt-datebox" data-tone="' + tone(ev) + '" aria-hidden="true"><b>' + d.getDate() + '</b><i>' + esc(mon) + '</i></span>';
  }
  function chip(ev) { return '<span class="lt-chip" data-tone="' + tone(ev) + '">' + esc(daysLabel(ev)) + '</span>'; }
  function prio(ev) { return '<span class="lt-prio" data-prio="' + esc(ev.priority) + '">' + esc(ev.priority) + '</span>'; }
  function longDate(iso) { return fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function shortCaps(iso) { return fmtDate(iso, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); }

  /* ============================================================
     SUMMARY (existing counting logic)
     ============================================================ */
  function renderSummary() {
    var c = { upcoming: 0, soon: 0, overdue: 0, completed: 0 };
    events.forEach(function (ev) {
      var cat = category(ev);
      if (cat === 'completed') c.completed++;
      else if (cat === 'overdue') c.overdue++;
      else { c.upcoming++; if (cat === 'soon') c.soon++; }
    });
    $('ltCountUpcoming').textContent = c.upcoming;
    $('ltCountSoon').textContent = c.soon;
    $('ltCountOverdue').textContent = c.overdue;
    $('ltCountCompleted').textContent = c.completed;
    document.querySelector('.lt-stat[data-tone="overdue"]').classList.toggle('has-items', c.overdue > 0);
    Array.prototype.forEach.call(document.querySelectorAll('.lt-stat'), function (b) {
      b.setAttribute('aria-pressed', currentView === 'events' && F.status.value === b.getAttribute('data-summary') ? 'true' : 'false');
    });
    $('ltTotalCount').textContent = events.length;
    return c;
  }

  /* ============================================================
     OVERVIEW
     ============================================================ */
  function renderNext() {
    var box = $('ltNext');
    var next = upcomingList()[0];
    if (!next) {
      box.className = 'lt-next lt-next-empty';
      box.removeAttribute('data-tone');
      box.innerHTML = '<div><p class="lt-next-label" id="ltNextLabel">Next important deadline</p>' +
        '<h2>No upcoming legal events.</h2>' +
        '<p>Add a deadline, hearing or reminder to start tracking.</p>' +
        '<div class="lt-next-actions"><button type="button" class="lt-btn lt-btn-light" data-action="add-event"><span class="lt-plus" aria-hidden="true">+</span> Add Legal Event</button></div></div>';
      return null;
    }
    var d = daysFromToday(next.date);
    var c = next.caseId ? getCase(next.caseId) : null;
    var cl = caseLabel(next);
    box.className = 'lt-next';
    box.setAttribute('data-tone', tone(next));
    box.innerHTML =
      '<div class="lt-next-main" data-id="' + esc(next.id) + '">' +
        '<p class="lt-next-label" id="ltNextLabel">Next important deadline</p>' +
        '<span class="lt-next-type">' + esc(next.type) + '</span>' +
        '<h2 class="lt-next-title">' + esc(next.title) + '</h2>' +
        '<p class="lt-next-case">' + (cl ? 'Related case: <strong>' + esc(cl) + '</strong>' : 'No related case') + '</p>' +
        '<div class="lt-next-when">' +
          '<div><span>Date</span><strong>' + esc(longDate(next.date)) + '</strong></div>' +
          (next.time ? '<div><span>Time</span><strong>' + esc(fmtTime(next.time)) + '</strong></div>' : '') +
        '</div>' +
        '<div class="lt-next-actions">' +
          '<button type="button" class="lt-btn lt-btn-light" data-act="view">View Details</button>' +
          (next.caseId ? '<a class="lt-btn lt-btn-ghost-dark" href="' + esc(c ? caseUrl(c.id) : 'smart-case-builder.html') + '">' + (c ? 'Open Related Case' : 'Open Case Builder') + '</a>' : '') +
        '</div>' +
      '</div>' +
      '<div class="lt-next-side">' +
        '<div class="lt-count-box" aria-label="' + esc(daysLabel(next)) + '">' +
          (d === 0 ? '<span class="lt-count-num">Today</span><span class="lt-count-unit">Due today</span>'
                   : '<span class="lt-count-num">' + d + '</span><span class="lt-count-unit">' + (d === 1 ? 'Day remaining' : 'Days remaining') + '</span>') +
        '</div>' +
        '<span class="lt-prio-dark" data-prio="' + esc(next.priority) + '">' + esc(next.priority) + ' priority</span>' +
      '</div>' +
      '<p class="lt-next-note">Date as entered by you — not verified by Legal Lens.</p>';
    return next;
  }

  function upRowHTML(ev) {
    var meta = [ev.time ? fmtTime(ev.time) : '', caseLabel(ev) || ev.type].filter(Boolean).join(' · ');
    return '<li class="lt-up-item" data-id="' + esc(ev.id) + '">' +
      '<button type="button" class="lt-up-btn" data-act="view" aria-label="' + esc(ev.title + ', ' + longDate(ev.date) + ', ' + daysLabel(ev)) + '">' +
        dateBox(ev) +
        '<span class="lt-up-main"><span class="lt-up-title">' + esc(ev.title) + '</span><span class="lt-up-meta">' + esc(meta) + '</span></span>' +
        '<span class="lt-up-side">' + chip(ev) + prio(ev) + '</span>' +
      '</button></li>';
  }

  function renderOverview() {
    var next = renderNext();
    var counts = { overdue: events.filter(function (ev) { return category(ev) === 'overdue'; }).length };
    var nudge = $('ltOverdueNudge');
    if (counts.overdue) {
      nudge.hidden = false;
      nudge.innerHTML = '<span><strong>' + plural(counts.overdue, 'overdue event') + '</strong> — the date has passed and ' + (counts.overdue === 1 ? 'it is' : 'they are') + ' not marked completed.</span>' +
        '<button type="button" class="lt-text-btn" data-goto="events" data-status="overdue">Review overdue <span aria-hidden="true">→</span></button>';
    } else { nudge.hidden = true; nudge.innerHTML = ''; }

    var rest = upcomingList().filter(function (ev) { return !next || ev.id !== next.id; }).slice(0, UPCOMING_PREVIEW);
    $('ltUpcoming').innerHTML = rest.map(upRowHTML).join('');
    $('ltUpcoming').hidden = rest.length === 0;
    $('ltUpcomingEmpty').hidden = rest.length > 0;
    $('ltUpcomingEmpty').textContent = next ? 'Nothing else scheduled after your next deadline.' : 'No upcoming legal events.';
    renderMini();
  }

  /* ---------------- calendars (shared month model) ---------------- */
  function monthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  var miniMonth = monthStart(new Date());
  var miniSelected = '';
  var calMonth = monthStart(new Date());
  var calSelected = todayISO();

  function eventsByDate() {
    var map = {};
    events.forEach(function (ev) { (map[ev.date] = map[ev.date] || []).push(ev); });
    Object.keys(map).forEach(function (k) { map[k].sort(byWhen); });
    return map;
  }
  function monthCells(month) {
    var y = month.getFullYear(), m = month.getMonth();
    var start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (i === 35 && d.getMonth() !== m) break;
      cells.push(d);
    }
    return cells;
  }
  function monthTitle(month) { return month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
  function dotsHTML(list, max) {
    var shown = list.slice(0, max).map(function (ev) { return '<span class="lt-dot" data-tone="' + tone(ev) + '"></span>'; }).join('');
    return shown;
  }
  function cellLabel(iso, list) {
    return longDate(iso) + (list.length ? ', ' + plural(list.length, 'event') : ', no events') + (iso === todayISO() ? ', today' : '');
  }

  function dayRowHTML(ev) {
    var meta = [ev.time ? fmtTime(ev.time) : 'No time set', caseLabel(ev), daysLabel(ev)].filter(Boolean).join(' · ');
    return '<div class="lt-day-row" data-tone="' + tone(ev) + '" data-id="' + esc(ev.id) + '">' +
      '<span class="lt-day-main"><span class="lt-day-title">' + esc(ev.title) + '</span><span class="lt-day-meta">' + esc(meta) + '</span></span>' +
      '<button type="button" class="lt-act" data-act="view" aria-label="View event: ' + esc(ev.title) + '">View Event</button>' +
    '</div>';
  }

  function renderMini() {
    $('miniTitle').textContent = monthTitle(miniMonth);
    var map = eventsByDate(), today = todayISO();
    $('miniGrid').innerHTML = monthCells(miniMonth).map(function (d) {
      var iso = isoFromDate(d), list = map[iso] || [];
      return '<button type="button" class="lt-mini-cell' + (d.getMonth() !== miniMonth.getMonth() ? ' is-out' : '') + (iso === today ? ' is-today' : '') + '"' +
        ' data-date="' + iso + '" aria-pressed="' + (iso === miniSelected ? 'true' : 'false') + '" aria-label="' + esc(cellLabel(iso, list)) + '">' +
        '<span class="lt-mini-num" aria-hidden="true">' + d.getDate() + '</span>' +
        '<span class="lt-mini-dots" aria-hidden="true">' + dotsHTML(list, 3) + '</span></button>';
    }).join('');
    var sel = miniSelected ? (map[miniSelected] || []) : null;
    $('miniDay').innerHTML = sel === null ? '' :
      '<h3>' + esc(longDate(miniSelected)) + '</h3>' +
      (sel.length ? '<div class="lt-day-list">' + sel.map(dayRowHTML).join('') + '</div>' : '<p class="lt-inline-empty">No events on this date.</p>');
  }

  $('miniPrev').addEventListener('click', function () { miniMonth = new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1); renderMini(); });
  $('miniNext').addEventListener('click', function () { miniMonth = new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1); renderMini(); });
  $('miniGrid').addEventListener('click', function (e) {
    var cell = e.target.closest('[data-date]');
    if (!cell) return;
    var iso = cell.getAttribute('data-date');
    miniSelected = miniSelected === iso ? '' : iso;
    var d = parseISO(iso);
    if (d.getMonth() !== miniMonth.getMonth() || d.getFullYear() !== miniMonth.getFullYear()) miniMonth = monthStart(d);
    renderMini();
    var again = document.querySelector('.lt-mini-cell[data-date="' + iso + '"]');
    if (again) again.focus();
  });
  $('miniOpenFull').addEventListener('click', function () {
    calSelected = miniSelected || todayISO();
    calMonth = monthStart(parseISO(calSelected));
    setView('calendar'); scrollToSwitch();
  });

  /* ---------------- full calendar ---------------- */
  function renderCalendar() {
    $('calTitle').textContent = monthTitle(calMonth);
    var map = eventsByDate(), today = todayISO();
    $('calGrid').innerHTML = monthCells(calMonth).map(function (d) {
      var iso = isoFromDate(d), list = map[iso] || [];
      return '<button type="button" class="lt-cal-cell' + (d.getMonth() !== calMonth.getMonth() ? ' is-out' : '') + (iso === today ? ' is-today' : '') + '"' +
        ' data-date="' + iso + '" aria-pressed="' + (iso === calSelected ? 'true' : 'false') + '" aria-label="' + esc(cellLabel(iso, list)) + '">' +
        '<span class="lt-cal-num" aria-hidden="true">' + d.getDate() + '</span>' +
        (list.length ? '<span class="lt-cal-ind" aria-hidden="true">' + dotsHTML(list, 3) + (list.length > 3 ? '<span class="lt-cal-more">+' + (list.length - 3) + '</span>' : '') + '</span>' : '') +
        '</button>';
    }).join('');
    var sel = map[calSelected] || [];
    $('calSideTitle').textContent = longDate(calSelected);
    $('calDayList').innerHTML = sel.length ? sel.map(dayRowHTML).join('') : '<p class="lt-inline-empty">No events on this date.</p>';
  }
  $('calPrev').addEventListener('click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
  $('calNext').addEventListener('click', function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });
  $('calToday').addEventListener('click', function () { calMonth = monthStart(new Date()); calSelected = todayISO(); renderCalendar(); });
  $('calGrid').addEventListener('click', function (e) {
    var cell = e.target.closest('[data-date]');
    if (!cell) return;
    calSelected = cell.getAttribute('data-date');
    var d = parseISO(calSelected);
    if (d.getMonth() !== calMonth.getMonth() || d.getFullYear() !== calMonth.getFullYear()) calMonth = monthStart(d);
    renderCalendar();
    var again = document.querySelector('.lt-cal-cell[data-date="' + calSelected + '"]');
    if (again) again.focus();
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
      var side = $('calSide');
      if (side && side.getBoundingClientRect().top > window.innerHeight - 80) side.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  $('calAddOnDate').addEventListener('click', function () { openForm(null, calSelected); });

  /* ---------------- timeline ---------------- */
  function renderTimeline() {
    var today = todayISO();
    var items = events.filter(function (ev) {
      if (tlRange === 'upcoming') return ev.status !== 'completed' && ev.date >= today;
      if (tlRange === 'past') return ev.date < today;
      if (tlRange === 'completed') return ev.status === 'completed';
      return true;
    }).sort(byWhen);
    var emptyMsg = { all: 'No events to show.', upcoming: 'No upcoming legal events.', past: 'No past events.', completed: 'No completed events yet.' }[tlRange];
    $('ltTimelineEmpty').textContent = emptyMsg;
    $('ltTimelineEmpty').hidden = items.length > 0;
    $('ltTimeline').hidden = items.length === 0;

    var html = '', lastMonth = '', todayShown = tlRange !== 'all';
    function todayRow() { return '<li class="lt-tl-today" aria-label="Today, ' + esc(longDate(today)) + '"><span>Today</span><span></span><span></span></li>'; }
    items.forEach(function (ev, i) {
      if (!todayShown && ev.date >= today) { html += todayRow(); todayShown = true; }
      var m = fmtDate(ev.date, { month: 'long', year: 'numeric' });
      if (m !== lastMonth) { html += '<li class="lt-tl-month" aria-hidden="true">' + esc(m) + '</li>'; lastMonth = m; }
      var cl = caseLabel(ev);
      var meta = [ev.time ? fmtTime(ev.time) : '', ev.type, cl ? 'Case: ' + cl : '', ev.priority + ' priority'].filter(Boolean).join(' · ');
      html += '<li class="lt-tl-item' + (i === 0 ? ' is-first' : '') + (i === items.length - 1 ? ' is-last' : '') + '" data-tone="' + tone(ev) + '" data-id="' + esc(ev.id) + '">' +
        '<div class="lt-tl-date"><b>' + esc(shortCaps(ev.date)) + '</b>' + (ev.time ? '<i>' + esc(fmtTime(ev.time)) + '</i>' : '') + '</div>' +
        '<div class="lt-tl-rail" aria-hidden="true"></div>' +
        '<button type="button" class="lt-tl-card" data-act="view">' +
          '<span class="lt-tl-top"><span class="lt-tl-title">' + esc(ev.title) + '</span>' + chip(ev) + '</span>' +
          '<span class="lt-tl-meta">' + esc(meta) + '</span>' +
        '</button></li>';
    });
    if (!todayShown && items.length) html += todayRow();
    $('ltTimeline').innerHTML = html;
  }
  document.querySelector('.lt-seg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tl]');
    if (!b) return;
    tlRange = b.getAttribute('data-tl');
    Array.prototype.forEach.call(this.querySelectorAll('[data-tl]'), function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
    renderTimeline();
  });

  /* ---------------- all events (existing grouping + filters) ---------------- */
  function rowHTML(ev) {
    var cl = caseLabel(ev);
    return '<li class="lt-row" data-tone="' + tone(ev) + '" data-id="' + esc(ev.id) + '">' +
      dateBox(ev) +
      '<div class="lt-row-main">' +
        '<h4 class="lt-row-title"><button type="button" data-act="view">' + esc(ev.title) + '</button></h4>' +
        '<div class="lt-row-meta"><span class="lt-tag">' + esc(ev.type) + '</span>' +
          '<span>' + esc(fmtDate(ev.date) + (ev.time ? ' · ' + fmtTime(ev.time) : '')) + '</span>' +
          '<span class="lt-case">' + (cl ? 'Case: ' + esc(cl) : 'No related case') + '</span></div>' +
      '</div>' +
      '<div class="lt-row-status">' + chip(ev) + prio(ev) + '</div>' +
      '<div class="lt-row-actions">' +
        '<button type="button" class="lt-act" data-act="view" aria-label="View: ' + esc(ev.title) + '">View</button>' +
        '<button type="button" class="lt-act" data-act="edit" aria-label="Edit: ' + esc(ev.title) + '">Edit</button>' +
        '<button type="button" class="lt-act" data-act="toggle" aria-label="' + (ev.status === 'completed' ? 'Reopen: ' : 'Mark complete: ') + esc(ev.title) + '">' + (ev.status === 'completed' ? 'Reopen' : 'Mark Complete') + '</button>' +
        '<button type="button" class="lt-act lt-act-danger" data-act="delete" aria-label="Delete: ' + esc(ev.title) + '">Delete</button>' +
      '</div>' +
    '</li>';
  }

  function activeFilterCount() {
    return [F.caseSel.value, F.type.value, F.prio.value, F.status.value, F.from.value, F.to.value].filter(Boolean).length;
  }

  function renderEvents() {
    var list = applyFilters(events);
    var groups = { overdue: [], soon: [], later: [], completed: [] };
    list.forEach(function (ev) { groups[category(ev)].push(ev); });
    ['overdue', 'soon', 'later'].forEach(function (g) { groups[g].sort(byWhen); });
    groups.completed.sort(function (a, b) { return byWhen(b, a); });

    var st = F.status.value;
    var show = { overdue: !st || st === 'overdue', soon: !st || st === 'soon' || st === 'upcoming', later: !st || st === 'upcoming', completed: !st || st === 'completed' };
    var map = { overdue: ['listOverdue', 'gcOverdue', 'emptyOverdue'], soon: ['listSoon', 'gcSoon', 'emptySoon'], later: ['listLater', 'gcLater', 'emptyLater'], completed: ['listCompleted', 'gcCompleted', 'emptyCompleted'] };
    Object.keys(map).forEach(function (g) {
      var ids = map[g];
      document.querySelector('.lt-group[data-group="' + g + '"]').hidden = !show[g];
      $(ids[0]).innerHTML = groups[g].map(rowHTML).join('');
      $(ids[1]).textContent = groups[g].length;
      $(ids[2]).hidden = groups[g].length > 0;
    });
    var noRes = list.length === 0;
    $('ltNoResults').hidden = !noRes;
    $('ltGroups').hidden = noRes;
    $('ltResultLine').textContent = filtersActive() ? 'Showing ' + list.length + ' of ' + plural(events.length, 'event') : plural(events.length, 'event');
    var n = activeFilterCount();
    $('fBadge').textContent = n;
    $('fBadge').hidden = n === 0;
  }

  $('fToggle').addEventListener('click', function () {
    var tb = $('ltFilters');
    var open = !tb.classList.contains('is-open');
    tb.classList.toggle('is-open', open);
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ============================================================
     MASTER RENDER + VIEWS
     ============================================================ */
  function renderAll() {
    renderSummary();
    var has = events.length > 0;
    // Until the account's events are loaded, show only the notice — never
    // the "no events yet" state, which would be misleading.
    $('ltEmptyAll').hidden = has || loadState !== 'ready';
    $('ltSwitchWrap').hidden = !has;
    VIEWS.forEach(function (v) { $('view-' + v).hidden = !has || v !== currentView; });
    if (!has) return;
    if (currentView === 'overview') renderOverview();
    else if (currentView === 'timeline') renderTimeline();
    else if (currentView === 'calendar') renderCalendar();
    else renderEvents();
  }

  function setView(v, fromHash) {
    if (VIEWS.indexOf(v) < 0) v = 'overview';
    currentView = v;
    VIEWS.forEach(function (x) {
      var b = $('tab-' + x);
      b.setAttribute('aria-selected', x === v ? 'true' : 'false');
      b.tabIndex = x === v ? 0 : -1;
      if (x === v) keepTabVisible(b);
    });
    if (!fromHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', v === 'overview' ? window.location.pathname + window.location.search : '#' + v);
    }
    renderAll();
  }

  /* On narrow screens the switcher scrolls sideways — keep the active view in sight. */
  function keepTabVisible(btn) {
    var wrap = $('ltSwitchWrap');
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return;
    var left = btn.offsetLeft - wrap.offsetLeft, right = left + btn.offsetWidth;
    if (left < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, left - 16);
    else if (right > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = right - wrap.clientWidth + 16;
  }

  function scrollToSwitch() {
    var el = events.length ? $('ltSwitchWrap') : $('ltApp');
    if (!el) return;
    var top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) window.scrollTo(0, Math.max(0, top + window.pageYOffset - 16));
  }

  var switcher = document.querySelector('.lt-switch');
  switcher.addEventListener('click', function (e) { var b = e.target.closest('.lt-switch-btn'); if (b) setView(b.getAttribute('data-view')); });
  switcher.addEventListener('keydown', function (e) {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].indexOf(e.key) < 0) return;
    var i = VIEWS.indexOf(currentView), n = VIEWS.length;
    i = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : n - 1;
    e.preventDefault(); setView(VIEWS[i]); $('tab-' + VIEWS[i]).focus();
  });
  window.addEventListener('hashchange', function () {
    var h = (window.location.hash || '').slice(1);
    if (VIEWS.indexOf(h) >= 0) { setView(h, true); scrollToSwitch(); }
  });

  /* summary cards = quick status filters on All Events (existing behaviour) */
  document.querySelector('.lt-summary').addEventListener('click', function (e) {
    var b = e.target.closest('[data-summary]');
    if (!b) return;
    var v = b.getAttribute('data-summary');
    if (!events.length) return;
    F.status.value = (currentView === 'events' && F.status.value === v) ? '' : v;
    setView('events');
    scrollToSwitch();
  });

  /* "View All Events", "Review overdue" */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto]');
    if (!b) return;
    if (b.hasAttribute('data-status')) F.status.value = b.getAttribute('data-status');
    setView(b.getAttribute('data-goto'));
    scrollToSwitch();
  });


  /* ============================================================
     EVENT FORM
     ============================================================ */
  var form = $('eventForm');
  var editingId = null;
  fillSelect($('efType'), EVENT_TYPES, 'Select a type');
  fillSelect($('efPriority'), PRIORITIES);
  fillSelect($('efReminder'), REMINDERS);

  function setError(name, msg) {
    var p = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.elements[name];
    if (p) { p.textContent = msg || ''; p.hidden = !msg; }
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  }
  function clearErrors() { ['title', 'type', 'date', 'reminderDate'].forEach(function (n) { setError(n, ''); }); }

  function renderCaseOptions(selectedId, ev) {
    cases = loadCases();
    var opts = [['', 'No Related Case']];
    cases.forEach(function (c) { opts.push([c.id, c.title + (c.category ? ' — ' + c.category : '')]); });
    if (selectedId && !getCase(selectedId)) opts.push([selectedId, caseLabel(ev || { caseId: selectedId, caseTitle: '' })]);
    fillSelect($('efCase'), opts);
    $('efCase').value = selectedId || '';
    $('efCaseHint').textContent = cases.length
      ? 'Cases from your Smart Case Builder.'
      : 'No cases found — you can still create a standalone legal event.';
  }

  function syncReminderCustom() {
    var custom = $('efReminder').value === 'custom';
    $('efReminderCustomWrap').hidden = !custom;
    if (!custom) setError('reminderDate', '');
  }
  $('efReminder').addEventListener('change', syncReminderCustom);

  var newClientId = null;   // one id per opened "Add" form, so a retried save never duplicates
  var saving = false;

  function openForm(ev, presetDate) {
    if (!requireReady()) return;
    clearErrors();
    form.reset();
    editingId = ev ? ev.id : null;
    newClientId = ev ? null : uid();
    $('eventModalTitle').textContent = ev ? 'Edit Legal Event' : 'Add Legal Event';
    $('eventSubmitBtn').textContent = ev ? 'Save Changes' : 'Add Event';
    renderCaseOptions(ev ? ev.caseId : '', ev);
    if (ev) {
      form.elements.title.value = ev.title;
      form.elements.type.value = ev.type;
      form.elements.date.value = ev.date;
      form.elements.time.value = ev.time;
      form.elements.priority.value = ev.priority;
      form.elements.status.value = ev.status;
      form.elements.reminder.value = ev.reminder;
      form.elements.reminderDate.value = ev.reminderDate;
      form.elements.notes.value = ev.notes;
    } else {
      form.elements.priority.value = 'Medium';
      form.elements.status.value = 'upcoming';
      form.elements.reminder.value = 'none';
      if (presetDate) form.elements.date.value = presetDate;
    }
    syncReminderCustom();
    openModal($('eventModal'), $('efTitle'));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    var f = form.elements;
    var d = {
      title: clean(f.title.value, 120),
      type: f.type.value,
      caseId: f.caseId.value,
      date: f.date.value,
      time: isValidTime(f.time.value) ? f.time.value : '',
      priority: PRIORITIES.indexOf(f.priority.value) >= 0 ? f.priority.value : 'Medium',
      status: f.status.value === 'completed' ? 'completed' : 'upcoming',
      reminder: f.reminder.value,
      reminderDate: f.reminderDate.value,
      notes: clean(f.notes.value, 2000)
    };
    var bad = null;
    if (!d.title) { setError('title', 'Please enter an event title.'); bad = bad || f.title; }
    if (EVENT_TYPES.indexOf(d.type) < 0) { setError('type', 'Please choose an event type.'); bad = bad || f.type; }
    if (!isValidISODate(d.date)) { setError('date', 'Please choose a valid date.'); bad = bad || f.date; }
    if (d.reminder === 'custom') {
      if (!isValidISODate(d.reminderDate)) { setError('reminderDate', 'Please choose a reminder date.'); bad = bad || f.reminderDate; }
      else if (isValidISODate(d.date) && d.reminderDate > d.date) { setError('reminderDate', 'Reminder date should be on or before the event date.'); bad = bad || f.reminderDate; }
    } else d.reminderDate = '';
    if (bad) { bad.focus(); return; }
    if (saving) return;

    var c = d.caseId ? getCase(d.caseId) : null;
    var payload = {
      title: d.title, type: d.type, date: d.date, time: d.time, priority: d.priority, status: d.status,
      reminder: d.reminder, reminderDate: d.reminderDate, notes: d.notes, caseId: d.caseId, caseTitle: c ? c.title : ''
    };
    var request;
    if (editingId) {
      var ev = getEvent(editingId);
      if (!ev) { closeModal($('eventModal')); toast('This event no longer exists.', true); return; }
      // Same rule as before: keep the stored case title if that case is no longer in Case Builder.
      payload.caseTitle = (d.caseId !== ev.caseId || c) ? (c ? c.title : (d.caseId ? ev.caseTitle : '')) : ev.caseTitle;
      request = trackerApi('/events/' + encodeURIComponent(editingId), { method: 'PATCH', body: payload });
    } else {
      payload.clientId = newClientId || uid();
      request = trackerApi('/events', { method: 'POST', body: payload });
    }

    var btn = $('eventSubmitBtn'), label = btn.textContent, wasEdit = !!editingId, id = editingId;
    saving = true; btn.disabled = true; btn.textContent = 'Saving…';
    request.then(function (res) {
      upsertLocal(fromApi(res.data.event));
      toast(wasEdit ? 'Event updated' : 'Event added');
      closeModal($('eventModal'));
      renderCaseFilter();
      renderAll();
    }).catch(function (err) {
      if (err && err.statusCode === 422 && err.details && Array.isArray(err.details.errors)) {
        var focusEl = null;
        err.details.errors.forEach(function (x) {
          if (['title', 'type', 'date', 'reminderDate'].indexOf(x.field) >= 0) { setError(x.field, x.message); focusEl = focusEl || f[x.field]; }
        });
        if (focusEl) focusEl.focus();
      }
      if (err && err.statusCode === 404 && wasEdit) { removeLocal(id); closeModal($('eventModal')); renderCaseFilter(); renderAll(); }
      var msg = friendlyError(err, wasEdit ? 'your changes' : 'this event');
      if (loadState === 'auth' || loadState === 'role') closeModal($('eventModal'));
      toast(msg, true);
    }).then(function () {
      saving = false; btn.disabled = false; btn.textContent = label;
    });
  });


  /* ============================================================
     ACTIONS: view / edit / toggle / delete
     ============================================================ */
  var viewingId = null;

  function toggleComplete(id) {
    var ev = getEvent(id);
    if (!ev || pendingIds[id]) return;
    var reopening = ev.status === 'completed';
    pendingIds[id] = true;
    trackerApi('/events/' + encodeURIComponent(id), { method: 'PATCH', body: { status: reopening ? 'upcoming' : 'completed' } })
      .then(function (res) {
        var saved = fromApi(res.data.event);
        upsertLocal(saved);
        toast(reopening ? 'Event reopened' : 'Marked as completed');
        renderAll();
        if (!$('detailModal').hidden && viewingId === id) renderDetail(saved);
      })
      .catch(function (err) {
        if (err && err.statusCode === 404) {
          removeLocal(id);
          if (!$('detailModal').hidden && viewingId === id) closeModal($('detailModal'));
          renderCaseFilter(); renderAll();
        }
        toast(friendlyError(err, 'the status change'), true);
      })
      .then(function () { delete pendingIds[id]; });
  }

  function deleteEvent(id, after) {
    var ev = getEvent(id);
    if (!ev || pendingIds[id]) return;
    confirmAction({ title: 'Delete this event?', text: '"' + ev.title + '" on ' + fmtDate(ev.date) + ' will be permanently removed from your account.', okLabel: 'Delete Event' })
      .then(function (ok) {
        if (!ok) return;
        pendingIds[id] = true;
        return trackerApi('/events/' + encodeURIComponent(id), { method: 'DELETE' })
          .then(function () {
            removeLocal(id);
            renderCaseFilter(); renderAll(); toast('Event deleted');
            if (after) after();
          }, function (err) {
            if (err && err.statusCode === 404) {   // already gone on the server
              removeLocal(id);
              renderCaseFilter(); renderAll();
              if (after) after();
              toast('This event was already deleted.');
              return;
            }
            toast(friendlyError(err, 'the deletion'), true);
          })
          .then(function () { delete pendingIds[id]; });
      });
  }

  function reminderText(ev) {
    var r = REMINDERS.filter(function (x) { return x[0] === ev.reminder; })[0];
    var t = r ? r[1] : 'No Reminder';
    if (ev.reminder === 'custom' && ev.reminderDate) t += ' — ' + fmtDate(ev.reminderDate);
    if (ev.reminder !== 'none') t += ' (saved for future notification support; not sent yet)';
    return t;
  }

  function renderDetail(ev) {
    $('detailType').textContent = ev.type;
    $('detailTitle').textContent = ev.title;
    var c = ev.caseId ? getCase(ev.caseId) : null;
    var caseCell = ev.caseId
      ? esc(caseLabel(ev)) + (c ? '' : '<span class="lt-case-missing">This case is no longer in your Smart Case Builder.</span>')
      : '';
    var rows = [
      ['Event type', esc(ev.type)],
      ['Related case', caseCell],
      ['Priority', esc(ev.priority)],
      ['Reminder preference', esc(reminderText(ev))],
      ['Status', esc(STATUS_LABEL[ev.status] + (ev.completedAt ? ' on ' + fmtDateTime(ev.completedAt) : ''))],
      ['Created', esc(fmtDateTime(ev.createdAt))],
      ['Description / notes', ev.notes ? esc(ev.notes) : '']
    ];
    $('detailBody').innerHTML =
      '<div class="lt-detail-status">' + chip(ev) + prio(ev) + (ev.example ? '<span class="lt-tag">Example data</span>' : '') + '</div>' +
      '<div class="lt-detail-when">' +
        '<div><span>Date</span><strong>' + esc(longDate(ev.date)) + '</strong></div>' +
        '<div><span>Time</span><strong>' + esc(ev.time ? fmtTime(ev.time) : 'Not set') + '</strong></div>' +
      '</div>' +
      '<dl class="lt-dl">' + rows.map(function (r) {
        // r[1] is already escaped above
        return '<div><dt>' + esc(r[0]) + '</dt>' + (r[1] ? '<dd>' + r[1] + '</dd>' : '<dd class="lt-empty-val">' + (r[0] === 'Related case' ? 'No related case' : 'Not added') + '</dd>') + '</div>';
      }).join('') + '</dl>';

    var link = $('detailCaseLink');
    if (ev.caseId) {
      link.hidden = false;
      link.setAttribute('href', c ? caseUrl(c.id) : 'smart-case-builder.html');
      link.textContent = c ? 'Open Related Case' : 'Open Case Builder';
    } else { link.hidden = true; }
    $('detailToggle').textContent = ev.status === 'completed' ? 'Reopen' : 'Mark Completed';
  }

  function openDetail(id) {
    var ev = getEvent(id);
    if (!ev) return;
    viewingId = id;
    cases = loadCases();
    renderDetail(ev);
    openModal($('detailModal'), $('detailEdit'));
  }

  $('detailEdit').addEventListener('click', function () { var ev = getEvent(viewingId); closeModal($('detailModal')); if (ev) openForm(ev); });
  $('detailToggle').addEventListener('click', function () { toggleComplete(viewingId); });
  $('detailDelete').addEventListener('click', function () { deleteEvent(viewingId, function () { closeModal($('detailModal')); }); });

  /* delegated clicks on any event row / card */
  $('ltApp').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var holder = btn.closest('[data-id]');
    if (!holder) return;
    var id = holder.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    if (act === 'view') openDetail(id);
    else if (act === 'edit') { var ev = getEvent(id); if (ev) openForm(ev); }
    else if (act === 'toggle') toggleComplete(id);
    else if (act === 'delete') deleteEvent(id);
  });

  /* global buttons */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]');
    if (!b) return;
    var a = b.getAttribute('data-action');
    if (a === 'add-event') openForm(null, currentView === 'calendar' ? calSelected : '');
    else if (a === 'load-example') loadExample();
    else if (a === 'clear-filters') clearFilters();
    else if (a === 'login') goToLogin();
    else if (a === 'retry-load') loadFromAccount();
    else if (a === 'import-local') importLocalEvents();
    else if (a === 'dismiss-import') { importDismissed = true; hideImportNotice(); }
  });


  /* ---------------- clearly-labelled example data (user-triggered only) ---------------- */
  var loadingExample = false;
  function loadExample() {
    if (!requireReady() || loadingExample) return;
    var now = Date.now();
    var sample = [];
    function rel(n) { var d = new Date(); d.setDate(d.getDate() + n); return isoFromDate(d); }
    var list = [
      { t: 'Example: Complaint submitted', type: 'Complaint Follow-up', d: rel(-12), s: 'completed', p: 'Medium' },
      { t: 'Example: Legal notice received', type: 'General Reminder', d: rel(-5), s: 'completed', p: 'High' },
      { t: 'Example: Collect bank statement', type: 'Document Submission', d: rel(-2), s: 'upcoming', p: 'Medium' },
      { t: 'Example: Reply target for notice', type: 'Notice Reply', d: rel(3), s: 'upcoming', p: 'Critical', r: '1d' },
      { t: 'Example: Lawyer consultation', type: 'Lawyer Consultation', d: rel(14), s: 'upcoming', p: 'High', time: '11:00', r: '1d' }
    ];
    list.forEach(function (x, i) {
      sample.push(sanitizeEvent({
        id: uid(), title: x.t, type: x.type, date: x.d, time: x.time || '', priority: x.p, status: x.s,
        reminder: x.r || 'none', notes: 'Sample event to show how Legal Tracker works. The date is not a real legal deadline.',
        example: true, createdAt: now + i, updatedAt: now + i, completedAt: x.s === 'completed' ? now : null
      }));
    });
    // Saved to the account in one request (same endpoint as the browser-data move).
    loadingExample = true;
    trackerApi('/events/import', { method: 'POST', body: { events: sample.map(legacyPayload) } })
      .then(function (res) {
        var data = (res && res.data) || {};
        (data.events || []).forEach(function (e) { upsertLocal(fromApi(e)); });
        renderCaseFilter(); renderAll();
        if ((data.events || []).length) toast('Example events added');
        else toast('Example events could not be added. Please try again.', true);
      })
      .catch(function (err) { toast(friendlyError(err, 'the example events'), true); })
      .then(function () { loadingExample = false; });
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
      btn.addEventListener('click', function () { if (typeof window.changeLanguage === 'function') window.changeLanguage(btn.getAttribute('data-lang')); });
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

  /* Legal Drafting link: existing config.js value (handles Live Server dev). */
  (function () {
    var a = $('ltDraftLink');
    try { if (a && typeof LEGAL_DRAFTING_APP_URL !== 'undefined' && LEGAL_DRAFTING_APP_URL) a.href = LEGAL_DRAFTING_APP_URL; } catch (e) { /* keep default */ }
  })();


  /* ---------------- init ---------------- */
  // Events are saved to the account now, so blocked browser storage no longer
  // loses changes (ltStorageWarning stays hidden). It only affects reading
  // Smart Case Builder cases and the one-time move of browser-saved events.

  window.addEventListener('storage', function (e) {
    if (e.key === SCB_STORAGE_KEY) { cases = loadCases(); renderCaseFilter(); renderAll(); }
  });

  // Re-evaluate day-based categories if the page stays open past midnight.
  var lastDay = todayISO();
  setInterval(function () { if (todayISO() !== lastDay) { lastDay = todayISO(); renderAll(); } }, 60000);

  renderCaseFilter();
  var startHash = (window.location.hash || '').slice(1);
  setView(VIEWS.indexOf(startHash) >= 0 ? startHash : 'overview', true);
  loadFromAccount();
})();
