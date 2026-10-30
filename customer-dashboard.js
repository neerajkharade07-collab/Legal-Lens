/* ============================================================
   LEGAL LENS — CUSTOMER DASHBOARD
   A private, read-only overview built ONLY from the customer's real data:

     Cases      GET /api/cases            (Smart Case Builder)
     Deadlines  GET /api/tracker/events   (Legal Deadline & Case Tracker)
     Documents  GET /api/documents?limit=5&sort=updated_desc  (Legal Drafting)

   - Requires config.js (API_BASE_URL, LEGAL_DRAFTING_APP_URL) and auth.js
     (getCustomerSession, getCurrentUser, apiRequest, refreshSession,
     logoutUser). Session handling lives in auth.js; this file only calls it.
   - Every endpoint above is scoped on the server to the logged-in user
     (owner = req.user.id). Nothing here sends a user id.
   - Nothing is requested until a CUSTOMER session is confirmed. Anonymous
     visitors go to login (and come back here afterwards); lawyer sessions
     go to the lawyer dashboard and never see customer data.
   - The three sections load in parallel and fail independently.
   - No numbers, items or activity are invented: zero means zero.
   ============================================================ */
(function () {
  'use strict';

  var DASHBOARD_PAGE = 'customer-dashboard.html';
  var LIST_LIMIT = { cases: 4, deadlines: 5, docs: 4, activity: 6 };
  var CLOSED_CASE_STATUSES = ['Resolved', 'Closed'];
  var SOON_DAYS = 7;

  var DRAFT_URL = (function () {
    try { if (typeof LEGAL_DRAFTING_APP_URL !== 'undefined' && LEGAL_DRAFTING_APP_URL) return LEGAL_DRAFTING_APP_URL; } catch (e) { /* default */ }
    return './legal-drafting/';
  })();
  var LINK = {
    cases: 'smart-case-builder.html',
    caseView: function (id) { return 'smart-case-builder.html#case/' + encodeURIComponent(id); },
    tracker: 'legal-tracker.html',
    trackerEvents: 'legal-tracker.html#events',
    draft: function (path) { return DRAFT_URL + path; },
    doc: function (id) { return DRAFT_URL + 'draft/' + encodeURIComponent(id); }
  };

  // Labels for the Legal Drafting values returned by /api/documents.
  var DOC_TYPE = { fir: 'FIR', rental_agreement: 'Rental Agreement', divorce_petition: 'Divorce Petition', affidavit: 'Affidavit', general_document: 'Document' };
  var DOC_STATUS = { draft: 'Draft', needs_review: 'Needs review', reviewed: 'Reviewed', completed: 'Completed' };

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
  function parseISO(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function daysFromToday(iso) {
    var p = iso.split('-').map(Number), t = new Date();
    return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000);
  }
  function fmtDate(iso) {
    if (!isISODate(iso)) return '';
    try { return parseISO(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; }
  }
  function fmtTime(t) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t || '')) return '';
    var p = t.split(':').map(Number);
    try { return new Date(2000, 0, 1, p[0], p[1]).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return t; }
  }
  function ts(v) { var n = v ? Date.parse(v) : NaN; return isNaN(n) ? 0 : n; }
  function fmtWhen(v) {
    var t = ts(v);
    if (!t) return '';
    var diff = Date.now() - t;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return plural(Math.floor(diff / 60000), 'minute') + ' ago';
    if (diff < 86400000) return plural(Math.floor(diff / 3600000), 'hour') + ' ago';
    if (diff < 7 * 86400000) return plural(Math.floor(diff / 86400000), 'day') + ' ago';
    try { return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
  }
  function firstName(name) {
    var n = String(name || '').trim().split(/\s+/)[0] || '';
    return n.length > 24 ? n.slice(0, 23) + '…' : n;
  }

  /* ---------------- API (auth.js does the session work) ---------------- */
  function authReady() {
    return typeof apiRequest === 'function' && typeof getCustomerSession === 'function';
  }

  /** Authenticated GET. On 401, asks auth.js to refresh the session once. */
  function api(path) {
    return apiRequest(path, { useAuth: true }).catch(function (err) {
      if (err && err.statusCode === 401 && typeof refreshSession === 'function') {
        return refreshSession().then(function (ok) {
          if (!ok) throw err;
          return apiRequest(path, { useAuth: true });
        });
      }
      throw err;
    });
  }

  /** Sends the visitor to the existing login page and back here afterwards. */
  function goToLogin() {
    try { sessionStorage.setItem('postLoginRedirect', DASHBOARD_PAGE); } catch (e) { /* ignore */ }
    window.location.replace('login.html');
  }

  /** A safe, user-friendly message. Server text and stack traces are never shown. */
  function friendlyError(err, what) {
    var code = err && err.statusCode;
    if (!code) return 'Could not reach Legal Lens. Check your internet connection and try again.';
    if (code === 429) return 'Too many requests right now. Please wait a moment and try again.';
    return 'Your ' + what + ' could not be loaded right now. Please try again.';
  }

  /** Session problems while loading a section end the page, not just the section. */
  function handleAuthError(err) {
    if (err && err.statusCode === 401) { goToLogin(); return true; }
    if (err && err.statusCode === 403) { showGate('role'); return true; }
    return false;
  }

  /* ---------------- session gate ---------------- */
  function showGate(kind) {
    $('cdApp').hidden = true;
    $('cdGate').hidden = false;
    var box = $('cdGateBox');
    if (kind === 'offline') {
      box.setAttribute('role', 'alert');
      box.innerHTML = '<h2>Could not open your dashboard</h2>' +
        '<p class="cd-gate-text">Legal Lens could not be reached. Check your internet connection and try again.</p>' +
        '<div class="cd-gate-actions"><button type="button" class="cd-btn cd-btn-dark" id="cdGateRetry">Try again</button>' +
        '<a class="cd-btn cd-btn-outline" href="index.html">Go to Home</a></div>';
      $('cdGateRetry').addEventListener('click', function () { window.location.reload(); });
    } else if (kind === 'role') {
      box.setAttribute('role', 'alert');
      box.innerHTML = '<h2>This dashboard is for customer accounts</h2>' +
        '<p class="cd-gate-text">You are signed in with an account that cannot use the customer dashboard.</p>' +
        '<div class="cd-gate-actions"><a class="cd-btn cd-btn-outline" href="index.html">Go to Home</a></div>';
    } else if (kind === 'script') {
      box.setAttribute('role', 'alert');
      box.innerHTML = '<h2>Could not open your dashboard</h2>' +
        '<p class="cd-gate-text">A required script did not load. Please refresh the page.</p>';
    }
  }

  function boot() {
    if (!authReady()) { showGate('script'); return; }
    getCustomerSession().then(function (user) {
      if (user) { start(user); return; }
      // No customer session. A lawyer (or other role) never sees customer data.
      var current = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (current && current.role === 'lawyer') { window.location.replace('lawyer-dashboard.html'); return; }
      if (current) { showGate('role'); return; }
      // Not signed in — or the server is unreachable. Tell the two apart so a
      // network problem never looks like "please log in".
      return apiRequest('/health').then(goToLogin, function () { showGate('offline'); });
    }).catch(function () { showGate('offline'); });
  }

  /* ---------------- section rendering helpers ---------------- */
  function skeleton(rows) {
    var s = '';
    for (var i = 0; i < rows; i++) s += '<span></span>';
    return '<div class="cd-skeleton" aria-label="Loading">' + s + '</div>';
  }
  function emptyState(title, text, btnLabel, href) {
    return '<div class="cd-state"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      (btnLabel ? '<a class="cd-btn cd-btn-dark cd-btn-sm" href="' + esc(href) + '">' + esc(btnLabel) + '</a>' : '') + '</div>';
  }
  function errorState(message, section) {
    return '<div class="cd-state cd-state-error" role="alert"><h3>Could not load this section</h3><p>' + esc(message) + '</p>' +
      '<button type="button" class="cd-btn cd-btn-outline cd-btn-sm" data-retry="' + esc(section) + '">Try again</button></div>';
  }
  function setStat(id, num, hint, isError) {
    var card = $(id);
    card.classList.toggle('is-error', !!isError);
    card.querySelector('[data-stat="num"]').textContent = num;
    card.querySelector('[data-stat="hint"]').textContent = hint;
  }

  /* ---------------- state ---------------- */
  var data = { cases: null, events: null, docs: null };      // null = not loaded / failed
  var docsTotal = 0;

  /* ---------------- cases ---------------- */
  function loadCases() {
    $('cdCasesBody').innerHTML = skeleton(3);
    setStat('cdStatCases', '—', 'Loading…');
    return api('/cases').then(function (res) {
      var list = res && res.data && Array.isArray(res.data.cases) ? res.data.cases : [];
      data.cases = list.slice().sort(function (a, b) { return ts(b.updatedAt) - ts(a.updatedAt); });
      renderCases();
    }, function (err) {
      data.cases = null;
      if (handleAuthError(err)) return;
      setStat('cdStatCases', '—', 'Could not load', true);
      $('cdCasesBody').innerHTML = errorState(friendlyError(err, 'cases'), 'cases');
    });
  }

  function renderCases() {
    var list = data.cases || [];
    var active = list.filter(function (c) { return CLOSED_CASE_STATUSES.indexOf(c.status) < 0; });
    setStat('cdStatCases', String(active.length),
      list.length ? plural(list.length, 'case') + ' in total' + (list.length > active.length ? ' · ' + (list.length - active.length) + ' resolved or closed' : '') : 'No cases yet');

    if (!list.length) {
      $('cdCasesBody').innerHTML = emptyState('No cases yet', 'Start your first case to organise the facts, timeline, evidence and checklist of a legal matter.', 'Start your first case', LINK.cases);
      return;
    }
    var rows = list.slice(0, LIST_LIMIT.cases).map(function (c) {
      var meta = [c.category, c.incidentDate ? 'Incident ' + fmtDate(c.incidentDate) : '', c.updatedAt ? 'Updated ' + fmtWhen(c.updatedAt) : ''].filter(Boolean).join(' · ');
      return '<li class="cd-row cd-row-plain">' +
        '<span class="cd-row-main">' +
          '<a class="cd-row-title" href="' + esc(LINK.caseView(c.id)) + '">' + esc(c.title) + '</a>' +
          '<span class="cd-row-meta">' + esc(meta) + '</span>' +
        '</span>' +
        '<span class="cd-row-side">' +
          '<span class="cd-badge' + (CLOSED_CASE_STATUSES.indexOf(c.status) < 0 ? ' cd-badge-dark' : '') + '">' + esc(c.status) + '</span>' +
          '<a class="cd-btn cd-btn-outline cd-btn-sm" href="' + esc(LINK.caseView(c.id)) + '" aria-label="View case: ' + esc(c.title) + '">View Case</a>' +
        '</span>' +
      '</li>';
    }).join('');
    $('cdCasesBody').innerHTML = '<ul class="cd-list">' + rows + '</ul>' +
      '<div class="cd-card-foot"><a class="cd-btn cd-btn-dark cd-btn-sm" href="' + LINK.cases + '"><span class="cd-plus" aria-hidden="true">+</span> Create New Case</a>' +
      (list.length > LIST_LIMIT.cases ? '<a class="cd-btn cd-btn-outline cd-btn-sm" href="' + LINK.cases + '">View all ' + list.length + ' cases</a>' : '') + '</div>';
  }

  /* ---------------- deadlines (tracker) ---------------- */
  function loadDeadlines() {
    $('cdDeadlinesBody').innerHTML = skeleton(3);
    setStat('cdStatDeadlines', '—', 'Loading…');
    return api('/tracker/events').then(function (res) {
      data.events = res && res.data && Array.isArray(res.data.events) ? res.data.events : [];
      renderDeadlines();
    }, function (err) {
      data.events = null;
      if (handleAuthError(err)) return;
      setStat('cdStatDeadlines', '—', 'Could not load', true);
      $('cdDeadlinesBody').innerHTML = errorState(friendlyError(err, 'deadlines'), 'deadlines');
      $('cdAlert').hidden = true;
    });
  }

  function sortKey(ev) { return ev.date + ' ' + (ev.time || '99:99'); }

  /** Case title for an event, linking to the case when it is in the account. */
  function caseLink(ev) {
    if (!ev.caseId) return '';
    var match = (data.cases || []).filter(function (c) { return c.clientId === ev.caseId || c.id === ev.caseId; })[0];
    var title = match ? match.title : ev.caseTitle;
    if (!title) return '';
    return match ? '<a href="' + esc(LINK.caseView(match.id)) + '">' + esc(title) + '</a>' : esc(title);
  }

  function renderDeadlines() {
    var events = data.events || [];
    var today = todayISO();
    var open = events.filter(function (e) { return e.status !== 'completed' && isISODate(e.date); });
    var upcoming = open.filter(function (e) { return e.date >= today; }).sort(function (a, b) { return sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0; });
    var overdue = open.filter(function (e) { return e.date < today; });
    var soon = upcoming.filter(function (e) { return daysFromToday(e.date) <= SOON_DAYS; });

    setStat('cdStatDeadlines', String(upcoming.length),
      upcoming.length ? (soon.length ? soon.length + ' in the next ' + SOON_DAYS + ' days' : 'Next on ' + fmtDate(upcoming[0].date)) : (overdue.length ? 'None upcoming · ' + overdue.length + ' overdue' : 'Nothing scheduled'));

    var alert = $('cdAlert');
    if (overdue.length) {
      alert.hidden = false;
      alert.innerHTML = '<span><strong>' + esc(plural(overdue.length, 'overdue deadline')) + '</strong> — the date has passed and ' + (overdue.length === 1 ? 'it is' : 'they are') + ' not marked completed.</span>' +
        '<a href="' + LINK.trackerEvents + '">Review in Tracker <span aria-hidden="true">→</span></a>';
    } else { alert.hidden = true; alert.innerHTML = ''; }

    if (!upcoming.length) {
      $('cdDeadlinesBody').innerHTML = emptyState('No upcoming deadlines',
        events.length ? 'Nothing is scheduled from today onwards. Add your next hearing, reply date or filing deadline.' : 'Add a legal deadline, hearing or reminder to keep track of important dates.',
        'Add a legal deadline', LINK.tracker);
      return;
    }
    var rows = upcoming.slice(0, LIST_LIMIT.deadlines).map(function (ev) {
      var d = daysFromToday(ev.date);
      var tone = d <= SOON_DAYS ? 'soon' : 'upcoming';
      var when = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + ' days';
      var dt = parseISO(ev.date), mon = '';
      try { mon = dt.toLocaleDateString('en-IN', { month: 'short' }).replace('.', '').slice(0, 3).toUpperCase(); } catch (e) { mon = ''; }
      var cl = caseLink(ev);
      var meta = [esc(fmtDate(ev.date) + (ev.time ? ' · ' + fmtTime(ev.time) : '')), esc(ev.type), cl ? 'Case: ' + cl : ''].filter(Boolean).join(' · ');
      return '<li class="cd-row">' +
        '<span class="cd-datebox" data-tone="' + tone + '" aria-hidden="true"><b>' + dt.getDate() + '</b><i>' + esc(mon) + '</i></span>' +
        '<span class="cd-row-main">' +
          '<span class="cd-row-title">' + esc(ev.title) + '</span>' +
          '<span class="cd-row-meta">' + meta + (ev.example ? ' · <span class="cd-badge">Example data</span>' : '') + '</span>' +
        '</span>' +
        '<span class="cd-row-side"><span class="cd-chip" data-tone="' + tone + '">' + esc(when) + '</span>' +
          '<span class="cd-prio" data-prio="' + esc(ev.priority) + '">' + esc(ev.priority) + '</span></span>' +
      '</li>';
    }).join('');
    $('cdDeadlinesBody').innerHTML = '<ul class="cd-list">' + rows + '</ul>' +
      '<div class="cd-card-foot"><a class="cd-btn cd-btn-dark cd-btn-sm" href="' + LINK.tracker + '"><span class="cd-plus" aria-hidden="true">+</span> Add Deadline</a>' +
      (upcoming.length > LIST_LIMIT.deadlines ? '<a class="cd-btn cd-btn-outline cd-btn-sm" href="' + LINK.trackerEvents + '">View all ' + upcoming.length + ' upcoming</a>' : '') + '</div>';
  }

  /* ---------------- documents (legal drafting) ---------------- */
  function loadDocs() {
    $('cdDocsBody').innerHTML = skeleton(3);
    setStat('cdStatDocs', '—', 'Loading…');
    return api('/documents?limit=' + (LIST_LIMIT.docs + 1) + '&sort=updated_desc').then(function (res) {
      var d = (res && res.data) || {};
      data.docs = Array.isArray(d.documents) ? d.documents : [];
      docsTotal = d.pagination && typeof d.pagination.total === 'number' ? d.pagination.total : data.docs.length;
      renderDocs();
    }, function (err) {
      data.docs = null;
      if (handleAuthError(err)) return;
      setStat('cdStatDocs', '—', 'Could not load', true);
      $('cdDocsBody').innerHTML = errorState(friendlyError(err, 'documents'), 'docs');
    });
  }

  function renderDocs() {
    var list = data.docs || [];
    setStat('cdStatDocs', String(docsTotal), docsTotal ? 'Saved in Legal Drafting' : 'No documents yet');
    if (!list.length) {
      $('cdDocsBody').innerHTML = emptyState('No documents yet', 'Create your first legal draft — notices, complaints, applications and more.', 'Create your first draft', LINK.draft('draft/new'));
      return;
    }
    var rows = list.slice(0, LIST_LIMIT.docs).map(function (doc) {
      var meta = [DOC_TYPE[doc.documentType] || 'Document', doc.updatedAt ? 'Updated ' + fmtWhen(doc.updatedAt) : ''].filter(Boolean).join(' · ');
      return '<li class="cd-row cd-row-plain">' +
        '<span class="cd-row-main">' +
          '<a class="cd-row-title" href="' + esc(LINK.doc(doc.id)) + '">' + esc(doc.title || 'Untitled document') + '</a>' +
          '<span class="cd-row-meta">' + esc(meta) + '</span>' +
        '</span>' +
        '<span class="cd-row-side"><span class="cd-badge">' + esc(DOC_STATUS[doc.status] || 'Draft') + '</span></span>' +
      '</li>';
    }).join('');
    $('cdDocsBody').innerHTML = '<ul class="cd-list">' + rows + '</ul>' +
      '<div class="cd-card-foot"><a class="cd-btn cd-btn-dark cd-btn-sm" href="' + esc(LINK.draft('draft/new')) + '"><span class="cd-plus" aria-hidden="true">+</span> Create Draft</a>' +
      (docsTotal > LIST_LIMIT.docs ? '<a class="cd-btn cd-btn-outline cd-btn-sm" href="' + esc(LINK.draft('documents')) + '">View all ' + docsTotal + ' documents</a>' : '') + '</div>';
  }

  /* ---------------- recent activity (derived, never invented) ---------------- */
  /** created vs updated: treat as "created" when the two timestamps are within 2 seconds. */
  function verb(createdAt, updatedAt, created, updated) {
    var c = ts(createdAt), u = ts(updatedAt);
    return (!u || Math.abs(u - c) < 2000) ? { label: created, at: c || u } : { label: updated, at: u };
  }

  function renderActivity() {
    var items = [];
    (data.cases || []).forEach(function (c) {
      var v = verb(c.createdAt, c.updatedAt, 'Case created', 'Case updated');
      items.push({ at: v.at, tag: 'CASE', label: v.label, title: c.title, href: LINK.caseView(c.id) });
    });
    (data.events || []).forEach(function (e) {
      var v = verb(e.createdAt, e.updatedAt, 'Deadline added', 'Deadline updated');
      items.push({ at: v.at, tag: 'DATE', label: v.label, title: e.title, href: LINK.tracker });
    });
    (data.docs || []).forEach(function (d) {
      var v = verb(d.createdAt, d.updatedAt, 'Document created', 'Document updated');
      items.push({ at: v.at, tag: 'DOC', label: v.label, title: d.title || 'Untitled document', href: LINK.doc(d.id) });
    });
    items = items.filter(function (i) { return i.at; }).sort(function (a, b) { return b.at - a.at; }).slice(0, LIST_LIMIT.activity);

    var missing = [];
    if (data.cases === null) missing.push('cases');
    if (data.events === null) missing.push('deadlines');
    if (data.docs === null) missing.push('documents');
    var note = missing.length ? '<p class="cd-card-sub" style="margin-top:10px">Activity from ' + esc(missing.join(' and ')) + ' is not shown because that section could not load.</p>' : '';

    if (!items.length) {
      $('cdActivityBody').innerHTML = emptyState('No activity yet', 'When you create or update a case, deadline or document, it will appear here.', '', '') + note;
      return;
    }
    $('cdActivityBody').innerHTML = '<ul class="cd-list">' + items.map(function (i) {
      return '<li class="cd-row cd-row-plain">' +
        '<span class="cd-act-icon" aria-hidden="true">' + i.tag + '</span>' +
        '<span class="cd-row-main"><span class="cd-row-meta" style="margin:0">' + esc(i.label) + '</span>' +
          '<a class="cd-row-title" href="' + esc(i.href) + '">' + esc(i.title) + '</a></span>' +
        '<span class="cd-act-time"><time datetime="' + esc(new Date(i.at).toISOString()) + '">' + esc(fmtWhen(new Date(i.at).toISOString())) + '</time></span>' +
      '</li>';
    }).join('') + '</ul>' + note;
  }

  /* ---------------- account menu in the navbar ---------------- */
  function buildAccountMenu(user, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'll-acct';
    wrap.innerHTML =
      '<button type="button" class="ll-acct-btn" aria-haspopup="true" aria-expanded="false" aria-controls="cdAcctMenu' + idx + '" aria-label="Account menu for ' + esc(user.name || 'customer') + '">' +
        '<svg class="ll-acct-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"></path></svg>' +
        '<span class="ll-acct-name">' + esc(firstName(user.name) || 'Account') + '</span>' +
        '<svg class="ll-acct-caret" viewBox="0 0 10 6" fill="none" aria-hidden="true" focusable="false"><path d="M1 1L5 5L9 1" stroke="#D4D4D4" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
      '<div class="ll-acct-menu" id="cdAcctMenu' + idx + '">' +
        '<div class="ll-acct-who"><span class="ll-acct-fullname">' + esc(user.name || '') + '</span><span class="ll-acct-email">' + esc(user.email || '') + '</span></div>' +
        '<a class="ll-acct-item" href="' + DASHBOARD_PAGE + '" aria-current="page">Dashboard</a>' +
        '<button type="button" class="ll-acct-item ll-acct-logout">Logout</button>' +
      '</div>';
    var btn = wrap.querySelector('.ll-acct-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !wrap.classList.contains('open');
      closeMenus(wrap);
      wrap.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var out = wrap.querySelector('.ll-acct-logout');
    out.addEventListener('click', function () {
      out.disabled = true;
      out.textContent = 'Logging out…';
      logoutUser(); // auth.js: revokes the session on the server, clears local state, goes Home
    });
    return wrap;
  }
  function closeMenus(except) {
    Array.prototype.forEach.call(document.querySelectorAll('.ll-acct.open'), function (w) {
      if (w === except) return;
      w.classList.remove('open');
      var b = w.querySelector('.ll-acct-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.ll-acct')) closeMenus(null); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.ll-acct.open');
    if (open) { closeMenus(null); var b = open.querySelector('.ll-acct-btn'); if (b) b.focus(); }
  });

  /* ---------------- start (customer confirmed) ---------------- */
  function start(user) {
    var fn = firstName(user.name);
    $('cdGreeting').textContent = fn ? 'Welcome back, ' + fn : 'Welcome back';
    document.title = 'My Dashboard — Legal Lens';
    ['cdNavAuth', 'cdMobileAuth'].forEach(function (id, i) {
      var slot = $(id);
      if (slot) { slot.textContent = ''; slot.appendChild(buildAccountMenu(user, i)); }
    });
    // Point Legal Drafting links at the configured app URL (handles local dev).
    Array.prototype.forEach.call(document.querySelectorAll('[data-draft-link]'), function (a) {
      a.setAttribute('href', LINK.draft(a.getAttribute('data-draft-link')));
    });
    $('cdGate').hidden = true;
    $('cdApp').hidden = false;
    $('cdActivityBody').innerHTML = skeleton(3);

    // Independent, parallel loads. Activity is drawn once all three settle.
    Promise.all([loadCases(), loadDeadlines(), loadDocs()]).then(function () {
      if (data.cases && data.events) renderDeadlines(); // link events to cases once both are known
      renderActivity();
    });
  }

  // Retry a single section without reloading the page.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-retry]');
    if (!b) return;
    var section = b.getAttribute('data-retry');
    var job = section === 'cases' ? loadCases() : section === 'deadlines' ? loadDeadlines() : section === 'docs' ? loadDocs() : null;
    if (job) job.then(function () {
      if (section === 'cases' && data.events) renderDeadlines();
      renderActivity();
    });
  });

  /* ---------------- navbar (same behaviour as the other pages) ---------------- */
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

  boot();
})();
