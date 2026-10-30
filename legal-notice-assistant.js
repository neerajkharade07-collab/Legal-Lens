/* =====================================================================
   Legal Lens — Legal Notice Assistant
   ---------------------------------------------------------------------
   - The 7-step wizard is unchanged. Notices are now saved to the
     customer's Legal Lens account (/api/notices) and drafted by the
     backend AI (Gemini, server-side — no key or AI call in the browser).
   - Uses the site's existing session (config.js + auth.js): the access
     token stays in memory, apiRequest() sends it, one silent refresh on 401.
   - PRIVACY: notice facts, sender/recipient details and notice text are
     NOT stored in localStorage (or any other browser storage). The
     customer's MongoDB-backed account is the only storage. Unsaved edits
     live only in this page's memory: they survive failed requests (and
     are retried), and the browser warns before the page is closed with
     unsaved changes. The only thing kept in localStorage is the id of
     the notice that is open (per account) — no content.
   - Drafts left in localStorage by the earlier version of this page are
     never deleted silently: the customer moves them to the account or
     deletes them (drafts with nothing unsaved are removed automatically).
   - Logout / account switching (in any tab) closes the open notice and
     clears it from memory; requests never continue as another account.
   - Selected files are NEVER read or uploaded. Only name / type / size /
     last modified date are kept (as metadata) so the user can list them.
   - All user and AI text is rendered with textContent / form values —
     never with innerHTML.
   ===================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'legalLens.legalNoticeAssistant.v1';
  var TOTAL_STEPS = 7;
  var MAX_FILES = 10;
  var MAX_DATES = 10;
  var AUTOSAVE_MS = 2500;

  var STEP_NAMES = ['Explain Your Problem', 'Notice Details', 'Supporting Information', 'Review Facts', 'Generate Notice', 'Review & Edit', 'Final Notice'];

  var CATEGORIES = [
    ['unpaid-salary', 'Unpaid salary / payment'],
    ['refund', 'Refund not received'],
    ['landlord-tenant', 'Landlord / tenant issue'],
    ['service-dispute', 'Service dispute'],
    ['business-payment', 'Business payment dispute'],
    ['loan-recovery', 'Loan / payment recovery'],
    ['property', 'Property-related dispute'],
    ['other', 'Other civil / legal dispute']
  ];

  var DOC_TYPES = [
    ['agreement', 'Agreement / contract'],
    ['invoice', 'Invoice / bill'],
    ['payment-proof', 'Payment proof'],
    ['email', 'Emails / messages'],
    ['screenshot', 'Screenshots'],
    ['letter', 'Letters / earlier notices'],
    ['other', 'Other document']
  ];

  var LANGS = ['en', 'hi', 'mr'];
  var LANG_NAMES = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };
  var STATUS_LABELS = { draft: 'Draft', generated: 'Generated', finalized: 'Final' };

  // Labels printed around the notice (same as the backend Word file).
  var NOTICE_LABELS = {
    en: {
      caption: 'AI-Assisted Legal Notice', date: 'Date: ', from: 'From', to: 'To', subject: 'Subject: ', enclosures: 'Enclosures',
      footer: 'AI-assisted draft prepared with Legal Lens from information provided by the sender. Not reviewed by a lawyer; not legal advice.'
    },
    hi: {
      caption: 'एआई-सहायता प्राप्त कानूनी नोटिस', date: 'दिनांक: ', from: 'प्रेषक', to: 'प्राप्तकर्ता', subject: 'विषय: ', enclosures: 'संलग्नक',
      footer: 'यह मसौदा Legal Lens की एआई सहायता से, प्रेषक द्वारा दी गई जानकारी के आधार पर तैयार किया गया है। इसकी किसी वकील ने समीक्षा नहीं की है; यह कानूनी सलाह नहीं है।'
    },
    mr: {
      caption: 'एआय-सहाय्यित कायदेशीर नोटीस', date: 'दिनांक: ', from: 'प्रेषक', to: 'प्रति', subject: 'विषय: ', enclosures: 'सोबत जोडलेली कागदपत्रे',
      footer: 'हा मसुदा Legal Lens च्या एआय सहाय्याने, प्रेषकाने दिलेल्या माहितीच्या आधारे तयार केला आहे. याचे कोणत्याही वकिलाने पुनरावलोकन केलेले नाही; हा कायदेशीर सल्ला नाही.'
    }
  };

  var FACT_SOURCE_LABELS = {
    problem: 'your problem (Step 1)', facts: 'key facts', dates: 'important dates', amount: 'amount', remedy: 'action requested',
    period: 'response period', additional: 'additional information', category: 'type of dispute', parties: 'sender / recipient',
    enclosures: 'the list of documents you named (not read)', 'change-request': 'your change request'
  };

  /* ------------------------------------------------------------------
     HELPERS
     ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function str(v) { return typeof v === 'string' ? v : (v === undefined || v === null ? '' : String(v)); }
  function trim(v) { return str(v).trim(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function newClientId() { return 'lna_' + uid() + Math.random().toString(36).slice(2, 6); }
  function labelOf(list, key) { for (var i = 0; i < list.length; i++) if (list[i][0] === key) return list[i][1]; return ''; }
  function noop() {}

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    return parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }
  function isValidISODate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] >= 1900 && +m[1] <= 2100;
  }
  function formatINR(v) {
    var n = Number(v);
    if (!isFinite(n)) return '';
    try { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); } catch (e) { return '₹' + n; }
  }
  function formatBytes(b) {
    var n = Number(b) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function shortDateTime(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    try { return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
  }
  function timeShort(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    try { return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  var EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

  function live(msg) { $('lnaLive').textContent = msg; }

  /* ------------------------------------------------------------------
     STATE + LOCAL WORKING COPY (own key only, scoped per account)
     ------------------------------------------------------------------ */
  function blankState() {
    return {
      version: 1,
      step: 1,
      maxStep: 1,
      problem: '',
      topic: '',
      sender: { name: '', address: '', email: '', phone: '' },
      recipient: { name: '', address: '', email: '' },
      matter: { category: '', categoryOther: '', amount: '', dates: [], facts: '', remedy: '', period: '', periodCustom: '', additional: '' },
      evidence: { types: [], files: [], listInNotice: true },
      confirmedHash: '',
      notice: null,      // { generated:{...}, current:{...}, factsHash, generatedAt, edited, language, meta }
      // account fields
      serverId: '',      // MongoDB id of the saved notice ('' = not saved yet)
      clientId: newClientId(),
      status: 'draft',
      language: '',      // '' = not chosen yet (defaults to the site language)
      versions: [],      // [{ id, source, label, savedAt, language }]
      dirty: false,      // true = changes not yet saved to the account
      savedAt: 0,
      updatedAt: 0
    };
  }


  var NOTICE_KEYS = ['date', 'from', 'to', 'subject', 'body', 'signature', 'enclosures'];

  function sanitizeMeta(m) {
    if (!m || typeof m !== 'object') return null;
    var list = function (a, max) { return (Array.isArray(a) ? a : []).map(function (x) { return str(x).slice(0, 400); }).filter(Boolean).slice(0, max); };
    return {
      source: str(m.source).slice(0, 20),
      factStatements: (Array.isArray(m.factStatements) ? m.factStatements : []).map(function (f) {
        return { statement: str(f && f.statement).slice(0, 400), source: str(f && f.source).slice(0, 40) };
      }).filter(function (f) { return f.statement; }).slice(0, 12),
      missingInformation: list(m.missingInformation, 6),
      notes: list(m.notes, 4)
    };
  }

  // Rebuild a clean state object from whatever is stored or received (never trust it blindly).
  function sanitizeState(raw) {
    var s = blankState();
    if (!raw || typeof raw !== 'object') return s;
    s.step = Math.min(TOTAL_STEPS, Math.max(1, parseInt(raw.step, 10) || 1));
    s.maxStep = Math.min(TOTAL_STEPS, Math.max(s.step, parseInt(raw.maxStep, 10) || 1));
    s.problem = str(raw.problem).slice(0, 5000);
    s.topic = CATEGORIES.some(function (c) { return c[0] === raw.topic; }) ? raw.topic : '';
    ['name', 'address', 'email', 'phone'].forEach(function (k) { s.sender[k] = str(raw.sender && raw.sender[k]).slice(0, 300); });
    ['name', 'address', 'email'].forEach(function (k) { s.recipient[k] = str(raw.recipient && raw.recipient[k]).slice(0, 300); });
    var m = raw.matter || {};
    ['category', 'categoryOther', 'amount', 'facts', 'remedy', 'period', 'periodCustom', 'additional'].forEach(function (k) { s.matter[k] = str(m[k]).slice(0, 5000); });
    if (!CATEGORIES.some(function (c) { return c[0] === s.matter.category; })) s.matter.category = '';
    if (['', '7', '15', '30', 'custom'].indexOf(s.matter.period) < 0) s.matter.period = '';
    s.matter.dates = (Array.isArray(m.dates) ? m.dates : []).slice(0, MAX_DATES).map(function (d) {
      return { id: str(d && d.id) || uid(), date: str(d && d.date).slice(0, 10), label: str(d && d.label).slice(0, 150) };
    });
    var ev = raw.evidence || {};
    s.evidence.types = (Array.isArray(ev.types) ? ev.types : []).filter(function (t) { return DOC_TYPES.some(function (d) { return d[0] === t; }); });
    s.evidence.files = (Array.isArray(ev.files) ? ev.files : []).slice(0, MAX_FILES).map(function (f) {
      return {
        id: str(f && f.id) || uid(),
        name: str(f && f.name).slice(0, 255),
        type: str(f && f.type).slice(0, 100),
        size: Math.max(0, Number(f && f.size) || 0),
        lastModified: Number(f && f.lastModified) || 0,
        docType: DOC_TYPES.some(function (d) { return d[0] === (f && f.docType); }) ? f.docType : ''
      };
    }).filter(function (f) { return f.name; });
    s.evidence.listInNotice = ev.listInNotice !== false;
    s.confirmedHash = str(raw.confirmedHash).slice(0, 64);
    if (raw.notice && raw.notice.current && raw.notice.generated) {
      var pick = function (o) { var r = {}; NOTICE_KEYS.forEach(function (k) { r[k] = str(o && o[k]).slice(0, 20000); }); return r; };
      s.notice = {
        generated: pick(raw.notice.generated),
        current: pick(raw.notice.current),
        factsHash: str(raw.notice.factsHash).slice(0, 64),
        generatedAt: Number(raw.notice.generatedAt) || 0,
        edited: !!raw.notice.edited,
        language: LANGS.indexOf(raw.notice.language) >= 0 ? raw.notice.language : '',
        meta: sanitizeMeta(raw.notice.meta)
      };
    }
    s.serverId = /^[a-f0-9]{24}$/.test(str(raw.serverId)) ? raw.serverId : '';
    s.clientId = /^[A-Za-z0-9_-]{1,64}$/.test(str(raw.clientId)) ? raw.clientId : newClientId();
    s.status = STATUS_LABELS[raw.status] ? raw.status : (s.notice ? 'generated' : 'draft');
    s.language = LANGS.indexOf(raw.language) >= 0 ? raw.language : '';
    s.versions = (Array.isArray(raw.versions) ? raw.versions : []).slice(0, 10).map(function (v) {
      return {
        id: /^[a-f0-9]{24}$/.test(str(v && v.id)) ? v.id : '',
        source: str(v && v.source).slice(0, 20),
        label: str(v && v.label).slice(0, 120),
        savedAt: Date.parse(v && v.savedAt) || Number(v && v.savedAt) || 0,
        language: LANGS.indexOf(v && v.language) >= 0 ? v.language : 'en'
      };
    }).filter(function (v) { return v.id; });
    s.dirty = !!raw.dirty;
    s.savedAt = Number(raw.savedAt) || 0;
    return s;
  }

  /* ----- account state ----- */
  // loading | ready | auth (not logged in) | role (not a customer) | offline
  // | switched (session ended / another account / logged out elsewhere —
  //   the open notice is closed and cleared from the page)
  var account = { state: 'loading', user: null, message: '', started: false };
  var view = 'wizard';      // wizard | saved

  function canSync() { return account.state === 'ready'; }
  // States where the wizard cannot be used (nothing to show or save yet).
  function isLocked(st) { return st === 'loading' || st === 'auth' || st === 'role' || st === 'switched' || (st === 'offline' && !account.started); }

  // Only an id is stored (never content): which notice was open, per account.
  var POINTER_PREFIX = 'legalLens.legalNoticeAssistant.open.';
  function pointerKey() { return account.user ? POINTER_PREFIX + account.user.id : ''; }
  function readPointer() {
    try {
      var raw = JSON.parse(localStorage.getItem(pointerKey()) || 'null');
      if (!raw || !/^[a-f0-9]{24}$/.test(str(raw.id))) return null;
      return { id: raw.id, step: Math.min(TOTAL_STEPS, Math.max(1, parseInt(raw.step, 10) || 1)) };
    } catch (e) { return null; }
  }
  function writePointer() {
    if (!account.user) return;
    try {
      if (state.serverId) localStorage.setItem(pointerKey(), JSON.stringify({ id: state.serverId, step: state.step }));
      else localStorage.removeItem(pointerKey());
    } catch (e) { /* storage blocked: the page still works, it just opens a new notice next time */ }
  }

  var state = blankState();

  /** A change to the notice: queued for the account (nothing is written to browser storage). */
  function persist(immediate, opts) {
    state.updatedAt = Date.now();
    if (!(opts && opts.noSync)) markDirty();
    writePointer();
  }
  function writeLocal() { writePointer(); }

  function hasUnsaved() { return state.dirty && !(isBlank() && !state.serverId); }
  // Closing / reloading the page with unsaved edits: the browser asks first.
  window.addEventListener('beforeunload', function (e) {
    if (canSync() || account.state === 'offline') {
      if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; return ''; }
    }
  });
  // Switching tabs / minimising: save what is pending right away.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && canSync() && hasUnsaved()) saveNow().catch(noop);
  });

  function getPath(path) { var p = path.split('.'); var o = state; for (var i = 0; i < p.length; i++) { if (o == null) return ''; o = o[p[i]]; } return o; }
  function setPath(path, value) { var p = path.split('.'); var o = state; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = value; }

  /* Hash of every fact that feeds the notice — used to detect changes after confirm/generate. */
  function factsHash() {
    var f = {
      p: trim(state.problem), s: state.sender, r: state.recipient, m: state.matter,
      e: { t: state.evidence.types, f: state.evidence.files.map(function (x) { return [x.name, x.docType]; }), l: state.evidence.listInNotice }
    };
    var json = JSON.stringify(f), h = 5381;
    for (var i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(36) + json.length;
  }

  function isBlank(s) {
    s = s || state;
    var m = s.matter, se = s.sender, r = s.recipient;
    return !trim(s.problem) && !trim(se.name) && !trim(se.address) && !trim(se.email) && !trim(se.phone) &&
      !trim(r.name) && !trim(r.address) && !trim(r.email) && !m.category && !trim(m.facts) && !trim(m.remedy) &&
      !trim(m.amount) && !trim(m.additional) && !m.dates.length && !s.evidence.files.length && !s.evidence.types.length && !s.notice;
  }

  function defaultLanguage() {
    try {
      var l = typeof LEGAL_LENS_LANGUAGE_KEY !== 'undefined' ? localStorage.getItem(LEGAL_LENS_LANGUAGE_KEY) : '';
      return LANGS.indexOf(l) >= 0 ? l : 'en';
    } catch (e) { return 'en'; }
  }
  function chosenLanguage() { return state.language || defaultLanguage(); }
  function noticeLanguage() { return (state.notice && state.notice.language) || chosenLanguage(); }

  /* ------------------------------------------------------------------
     ACCOUNT API (uses auth.js — no auth logic here)
     ------------------------------------------------------------------ */
  function authReady() {
    return typeof apiRequest === 'function' && typeof getCustomerSession === 'function' && typeof API_BASE_URL !== 'undefined';
  }

  function identityError() {
    var e = new Error('You are now signed in with a different account, so this notice was closed.');
    e.statusCode = 401;
    e.identity = true;
    return e;
  }
  function sessionUserId() {
    var u = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return u && u.role === 'customer' ? str(u.id) : '';
  }

  /**
   * apiRequest with the access token; one silent token refresh on 401.
   * After a refresh the account must still be the SAME customer — otherwise
   * (logged in as someone else in another tab) the open notice is closed
   * and the request is never sent as the other account.
   */
  function authedApi(fullPath, opts) {
    opts = opts || {};
    if (account.user && sessionUserId() && sessionUserId() !== account.user.id) {
      closeForOtherAccount();
      return Promise.reject(identityError());
    }
    return apiRequest(fullPath, { method: opts.method || 'GET', body: opts.body, useAuth: true })
      .catch(function (err) {
        if (err && err.statusCode === 401 && !opts.retried && typeof refreshSession === 'function') {
          return refreshSession().then(function (ok) {
            if (!ok) return sessionEnded(err);
            if (account.user && sessionUserId() !== account.user.id) {
              closeForOtherAccount();
              throw identityError();
            }
            return authedApi(fullPath, { method: opts.method, body: opts.body, retried: true });
          });
        }
        throw err;
      });
  }
  function noticeApi(path, opts) { return authedApi('/notices' + path, opts); }

  var SESSION_ENDED_MSG = 'Your session ended (you logged out, here or in another tab, or the session expired), so this notice was closed. Everything saved before that is in your account.';
  /**
   * The refresh failed. If the server is reachable the session really ended
   * (logout / revocation): close the notice so nothing stays visible on a
   * shared computer. If the server is NOT reachable, it is an ordinary
   * connection problem: keep the unsaved content on the page.
   */
  function sessionEnded(original) {
    if (!account.user) throw original;
    return apiRequest('/health').then(function () {
      closeForOtherAccount(SESSION_ENDED_MSG);
      var e = new Error(SESSION_ENDED_MSG);
      e.statusCode = 401;
      e.identity = true;
      throw e;
    }, function () {
      throw httpError(0, 'Could not reach Legal Lens.');
    });
  }

  function httpError(status, message) {
    var e = new Error(message || ('Request failed (' + status + ').'));
    e.statusCode = status;
    return e;
  }

  /** Friendly text for a failed request. Also updates the account state on 401 / 403. */
  function friendlyError(err, action) {
    var code = err && err.statusCode;
    if (!code) return 'Could not reach Legal Lens. Check your internet connection and try again.';
    if (code === 401) {
      if (err.identity) return err.message;
      setAccount('auth');
      return 'Your session has ended. Please log in again.';
    }
    if (code === 403) { setAccount('role'); return 'Saving and AI drafting are available for customer accounts only.'; }
    if (code === 404) return 'This notice no longer exists in your account. It may have been deleted.';
    if (code === 413) return 'This notice is too large to save. Please shorten some of the longer fields.';
    if (code === 409 || code === 422 || code === 429 || code === 502 || code === 503) return (err && err.message) || 'Please try again.';
    return 'Something went wrong on our side, so ' + (action || 'your change') + ' did not complete. Please try again.';
  }

  function goToLogin(page) {
    try { sessionStorage.setItem('postLoginRedirect', 'legal-notice-assistant.html'); } catch (e) { /* ignore */ }
    window.location.href = page || 'login.html';
  }

  /* ----- account banner ----- */
  function setAccount(st, message) {
    account.state = st;
    account.message = message || '';
    renderAccount();
    renderSaveStatus();
    var layout = document.querySelector('.lna-layout');
    if (layout) {
      var locked = isLocked(st);
      layout.inert = locked;
      layout.classList.toggle('is-locked', locked);
      layout.setAttribute('aria-busy', st === 'loading' ? 'true' : 'false');
    }
    renderLegacy();
  }

  function renderAccount() {
    var box = $('lnaAccount');
    clear(box);
    box.className = 'lna-account';
    var st = account.state;
    if (st === 'ready') { box.hidden = true; return; }
    var main = '', sub = '', actions = [];
    if (st === 'loading') { main = 'Checking your Legal Lens account…'; }
    else if (st === 'auth') {
      main = 'Log in to create a legal notice.';
      sub = 'Notices contain personal details, so they are saved only in your Legal Lens account — not in this browser.';
      actions = [['Log In', function () { goToLogin(); }], ['Sign Up', function () { goToLogin('signup.html'); }]];
      box.classList.add('is-warn');
    } else if (st === 'role') {
      main = 'Legal Notice Assistant is available for customer accounts.';
      sub = 'You are signed in with an account that cannot use it.';
      box.classList.add('is-warn');
    } else if (st === 'offline') {
      main = 'Legal Lens cannot be reached right now.';
      sub = account.started
        ? 'Your unsaved changes stay on this page — do not close it. Saving will work again when the connection is back.'
        : 'Your notices are saved in your account, so they will open when the connection is back.';
      actions = [['Try again', initAccount]];
      box.classList.add('is-error');
    } else if (st === 'switched') {
      main = account.message || 'You are now signed in with a different account, so the open notice was closed.';
      sub = 'Nothing from the previous session is shown. Reload the page (or log in) to continue.';
      actions = [['Reload page', function () { window.location.reload(); }]];
      box.classList.add('is-warn');
    }
    var text = el('span');
    text.appendChild(el('strong', null, main));
    if (sub) text.appendChild(document.createTextNode(' ' + sub));
    box.appendChild(text);
    if (actions.length) {
      var wrap = el('span', 'lna-account-actions');
      actions.forEach(function (a) {
        var b = el('button', 'lna-link-btn', a[0]);
        b.type = 'button';
        b.addEventListener('click', a[1]);
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    }
    box.setAttribute('role', st === 'offline' ? 'alert' : 'status');
    box.hidden = false;
  }

  /** Shows why an account action cannot run; returns true when it can. */
  function requireAccount(errId) {
    if (account.state === 'ready') return true;
    var msg, action = null;
    if (account.state === 'auth') { msg = 'Log in to save notices and use AI drafting.'; action = ['Log in', function () { goToLogin(); }]; }
    else if (account.state === 'role') msg = 'Saving and AI drafting are available for customer accounts only.';
    else if (account.state === 'loading') msg = 'Still checking your account — please try again in a moment.';
    else if (account.state === 'switched') msg = 'This notice was closed because the account changed. Reload the page.';
    else { msg = 'Legal Lens cannot be reached right now. Please check your connection and try again.'; action = ['Try again', initAccount]; }
    showMsg(errId, msg, action);
    return false;
  }

  function showMsg(id, text, action) {
    var p = $(id);
    if (!p) return;
    clear(p);
    p.appendChild(document.createTextNode(text));
    if (action) {
      var b = el('button', 'lna-link-btn', action[0]);
      b.type = 'button';
      b.addEventListener('click', action[1]);
      p.appendChild(b);
    }
    p.hidden = false;
  }
  function hideMsg(id) { var p = $(id); if (p) { p.hidden = true; clear(p); } }
  function hideAiErrors() { ['lnaGenError', 'lnaGenError6', 'lnaRefineErr', 'lnaVersionErr', 'lnaFinalErr'].forEach(hideMsg); }

  /* ----- saving (serialised: one request at a time) ----- */
  var queue = Promise.resolve();
  function enqueue(fn) {
    var p = queue.then(fn);
    queue = p.catch(noop);
    return p;
  }

  var changeSeq = 0;
  var autosaveTimer = null;
  var saveUi = { kind: '', msg: '' };

  function markDirty() {
    changeSeq++;
    state.dirty = true;
    if (canSync()) {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(function () { saveNow().catch(noop); }, AUTOSAVE_MS);
    }
    if (saveUi.kind !== 'error') saveUi = { kind: '', msg: '' };
    renderSaveStatus();
  }

  function setSaveStatus(kind, msg) { saveUi = { kind: kind, msg: msg || '' }; renderSaveStatus(); }

  function renderSaveStatus() {
    var p = $('lnaSaveStatus'), btn = $('lnaSaveDraft'), note = $('lnaSaved');
    if (!p) return;
    p.className = 'lna-save-status';
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    var st = account.state;
    var noteText = '';
    if (st === 'loading') { p.textContent = 'Checking your account…'; btn.textContent = 'Save draft'; btn.disabled = true; }
    else if (st === 'auth') { p.textContent = 'Log in to save notices to your account.'; btn.textContent = 'Log in to save'; }
    else if (st === 'role' || st === 'switched') { p.textContent = st === 'role' ? 'Customer accounts only.' : 'Notice closed (account changed).'; btn.textContent = 'Save draft'; btn.disabled = true; }
    else if (st === 'offline') {
      p.textContent = hasUnsaved() ? 'Offline — unsaved changes are kept on this page only. Do not close it.' : 'Offline.';
      if (hasUnsaved()) p.classList.add('is-error');
      btn.textContent = 'Try again';
      noteText = hasUnsaved() ? 'Not saved yet.' : '';
    }
    else {
      btn.textContent = 'Save draft';
      if (saveUi.kind === 'saving') { p.textContent = 'Saving…'; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); noteText = 'Saving…'; }
      else if (saveUi.kind === 'error') { p.textContent = 'Not saved: ' + saveUi.msg + ' Your answers stay on this page — do not close it.'; p.classList.add('is-error'); btn.textContent = 'Try saving again'; noteText = 'Not saved yet — see the message on the left.'; }
      else if (hasUnsaved()) { p.textContent = 'Unsaved changes'; noteText = 'Saving shortly…'; }
      else if (state.serverId) { p.textContent = 'Saved to your account' + (state.savedAt ? ' · ' + timeShort(state.savedAt) : ''); p.classList.add('is-ok'); noteText = state.notice && state.notice.edited ? 'Your edits are saved to your account.' : ''; }
      else { p.textContent = 'Nothing to save yet.'; }
    }
    if (note) note.textContent = noteText;
  }

  function toServerPayload() {
    var p = {
      problem: state.problem,
      topic: state.topic,
      sender: { name: state.sender.name, address: state.sender.address, email: state.sender.email, phone: state.sender.phone },
      recipient: { name: state.recipient.name, address: state.recipient.address, email: state.recipient.email },
      matter: {
        category: state.matter.category, categoryOther: state.matter.categoryOther, amount: state.matter.amount,
        dates: state.matter.dates.map(function (d) { return { id: d.id, date: d.date, label: d.label }; }),
        facts: state.matter.facts, remedy: state.matter.remedy, period: state.matter.period,
        periodCustom: state.matter.periodCustom, additional: state.matter.additional
      },
      evidence: {
        types: state.evidence.types.slice(),
        files: state.evidence.files.map(function (f) { return { id: f.id, name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, docType: f.docType || 'other' }; }),
        listInNotice: state.evidence.listInNotice
      },
      confirmedHash: state.confirmedHash,
      step: state.step,
      maxStep: state.maxStep
    };
    if (state.language) p.language = state.language;
    if (state.notice) p.content = state.notice.current;
    return p;
  }

  function mapVersions(list) {
    return sanitizeState({ versions: list }).versions;
  }

  /** Account fields from a save response (facts typed meanwhile are kept). */
  function afterSave(n, reopened) {
    state.serverId = n.id;
    state.clientId = n.clientId || state.clientId;
    state.status = STATUS_LABELS[n.status] ? n.status : state.status;
    state.versions = mapVersions(n.versions);
    if (reopened) live('This notice is no longer marked as final because it was changed.');
    renderStatusBits();
  }

  function doSave() {
    if (!canSync()) return Promise.resolve(null);
    if (state.serverId && !state.dirty) return Promise.resolve(null);
    if (!state.serverId && isBlank()) { state.dirty = false; renderSaveStatus(); return Promise.resolve(null); }
    var seq = changeSeq;
    var creating = !state.serverId;
    var payload = toServerPayload();
    if (creating) payload.clientId = state.clientId;
    setSaveStatus('saving');
    return noticeApi(creating ? '' : '/' + state.serverId, { method: creating ? 'POST' : 'PATCH', body: payload }).then(function (res) {
      var n = res && res.data && res.data.notice;
      if (n) afterSave(n, res.data.reopened);
      if (changeSeq === seq) state.dirty = false;
      state.savedAt = Date.now();
      writeLocal();
      setSaveStatus('saved');
      if (state.dirty) markDirty(); // typed while saving → save again shortly
      return n;
    }, function (err) {
      if (err && err.identity) throw err;
      if (!creating && err && err.statusCode === 404) {
        state.serverId = '';
        state.clientId = newClientId();
        state.versions = [];
        state.status = state.notice ? 'generated' : 'draft';
        writeLocal();
        setSaveStatus('error', 'This notice was deleted from your account. Click “Try saving again” to save it as a new notice.');
      } else {
        setSaveStatus('error', friendlyError(err, 'saving'));
      }
      throw err;
    });
  }

  function saveNow() {
    clearTimeout(autosaveTimer);
    return enqueue(doSave);
  }

  $('lnaSaveDraft').addEventListener('click', function () {
    if (account.state === 'auth') { goToLogin(); return; }
    if (account.state === 'offline') { initAccount(); return; }
    if (!canSync()) return;
    if (!state.serverId && isBlank()) { live('Nothing to save yet — start by describing your problem.'); setSaveStatus(''); return; }
    state.dirty = true; changeSeq++;
    saveNow().then(function () { live('Draft saved to your account.'); }, noop);
  });

  /* ------------------------------------------------------------------
     VALIDATION (per step)
     ------------------------------------------------------------------ */
  function validateStep(step) {
    var errs = [];
    function add(id, msg) { errs.push({ id: id, msg: msg }); }
    if (step === 1) {
      var p = trim(state.problem);
      if (!p) add('lnaProblem', 'Please describe what happened.');
      else if (p.length < 20) add('lnaProblem', 'Please add a little more detail (at least 20 characters).');
    }
    if (step === 2) {
      var s = state.sender, r = state.recipient, m = state.matter;
      if (!trim(s.name)) add('lnaSenderName', 'Enter your full name.');
      if (!trim(s.email)) add('lnaSenderEmail', 'Enter your email address.');
      else if (!EMAIL_RE.test(trim(s.email))) add('lnaSenderEmail', 'Enter a valid email address, e.g. name@example.com.');
      if (!trim(s.address)) add('lnaSenderAddress', 'Enter your address.');
      if (trim(s.phone) && !/^\+?[0-9][0-9\s-]{6,18}$/.test(trim(s.phone))) add('lnaSenderPhone', 'Enter a valid phone number (digits, spaces, “+” or “-”).');
      if (!trim(r.name)) add('lnaRecipientName', 'Enter the person or company name.');
      if (trim(r.email) && !EMAIL_RE.test(trim(r.email))) add('lnaRecipientEmail', 'Enter a valid email address or leave it blank.');
      if (!trim(r.address)) add('lnaRecipientAddress', 'Enter the recipient’s address.');
      if (!m.category) add('lnaCategory', 'Choose the type of dispute.');
      if (m.category === 'other' && !trim(m.categoryOther)) add('lnaCategoryOther', 'Briefly describe the type of dispute.');
      var amt = trim(m.amount).replace(/,/g, '');
      if (amt && !(/^\d{1,13}(\.\d{1,2})?$/.test(amt) && Number(amt) > 0)) add('lnaAmount', 'Enter an amount in numbers only, e.g. 45000 or 45000.50.');
      var badDate = false;
      m.dates.forEach(function (d) {
        var hasLabel = !!trim(d.label), hasDate = !!d.date;
        if ((hasLabel && !hasDate) || (hasDate && !hasLabel) || (hasDate && !isValidISODate(d.date))) badDate = true;
      });
      if (badDate) add('lnaDatesErr', 'Each important date needs both a valid date and a short description (or remove the row).');
      var f = trim(m.facts);
      if (!f) add('lnaFacts', 'Describe the key facts.');
      else if (f.length < 20) add('lnaFacts', 'Please add a little more detail to the facts (at least 20 characters).');
      var rem = trim(m.remedy);
      if (!rem) add('lnaRemedy', 'Say what you want the recipient to do.');
      else if (rem.length < 5) add('lnaRemedy', 'Please describe the action you want in a few more words.');
      if (m.period === 'custom') {
        var n = parseInt(m.periodCustom, 10);
        if (!/^\d{1,3}$/.test(trim(m.periodCustom)) || n < 1 || n > 365) add('lnaPeriodCustom', 'Enter a number of days between 1 and 365.');
      }
    }
    if (step === 4) {
      if (state.confirmedHash !== factsHash()) add('lnaConfirm', 'Please confirm that the information is correct.');
      // earlier steps must still be valid (e.g. data edited elsewhere)
      if (validateStep(1).length || validateStep(2).length) add('lnaConfirm', 'Some required details are missing — use the Edit links above to complete them.');
    }
    return errs;
  }

  function clearErrors() {
    qsa('.lna-error').forEach(function (p) {
      if (p.id === 'lnaFilesErr' || p.classList.contains('lna-ai-error') || p.id === 'lnaVersionErr' || p.id === 'lnaFinalErr') return;
      p.hidden = true; p.textContent = '';
    });
    qsa('[aria-invalid="true"]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    $('lnaErrorSummary').hidden = true;
    clear($('lnaErrorList'));
  }

  function errId(fieldId) { return fieldId.slice(-3) === 'Err' ? fieldId : fieldId + 'Err'; }

  function showErrors(errs) {
    clearErrors();
    if (!errs.length) return;
    var list = $('lnaErrorList');
    errs.forEach(function (e) {
      var p = $(errId(e.id));
      if (p) { p.textContent = e.msg; p.hidden = false; }
      var input = $(e.id);
      if (input && /INPUT|TEXTAREA|SELECT/.test(input.tagName)) input.setAttribute('aria-invalid', 'true');
      var li = el('li'); var a = el('a', null, e.msg);
      a.href = '#' + e.id;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var target = $(e.id);
        if (target && target.id.slice(-3) === 'Err') target = $('lnaAddDate');
        if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
      });
      li.appendChild(a); list.appendChild(li);
    });
    var sum = $('lnaErrorSummary');
    sum.hidden = false;
    sum.focus();
    sum.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  /* ------------------------------------------------------------------
     NAVIGATION
     ------------------------------------------------------------------ */
  function canOpen(step) {
    if (step <= 4) return step <= state.maxStep;
    if (state.confirmedHash !== factsHash()) return false;
    if (step === 5) return state.maxStep >= 5;
    return !!state.notice && step <= state.maxStep;
  }

  function goTo(step, opts) {
    opts = opts || {};
    step = Math.min(TOTAL_STEPS, Math.max(1, step));
    clearErrors();
    hideInlineConfirms();
    hideAiErrors();
    view = 'wizard';
    var changed = state.step !== step || step > state.maxStep;
    state.step = step;
    if (step > state.maxStep) state.maxStep = step;
    if (changed) persist(true); else writeLocal();
    render();
    var h = $('lnaH' + step);
    if (h && !opts.noFocus) h.focus({ preventScroll: true });
    if (!opts.noScroll) {
      var top = $('lnaApp').getBoundingClientRect().top + window.pageYOffset - 90;
      if (window.pageYOffset > top) window.scrollTo(0, Math.max(0, top));
    }
    live('Step ' + step + ' of ' + TOTAL_STEPS + ': ' + STEP_NAMES[step - 1]);
  }

  function next() {
    var step = state.step;
    var errs = validateStep(step);
    if (errs.length) { showErrors(errs); return; }
    if (step === 5 && !state.notice) return;
    goTo(step + 1);
  }
  function back() { if (state.step > 1) goTo(state.step - 1); }

  document.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) { if (nav.getAttribute('data-nav') === 'next') next(); else back(); return; }
    var g = e.target.closest('[data-goto]');
    if (g) { var s = parseInt(g.getAttribute('data-goto'), 10); if (canOpen(s)) goTo(s); }
  });

  $('lnaSteps').addEventListener('click', function (e) {
    var b = e.target.closest('.lna-step');
    if (!b || b.disabled) return;
    var s = parseInt(b.getAttribute('data-step'), 10);
    if (canOpen(s)) goTo(s);
  });

  /* ------------------------------------------------------------------
     STATIC UI BUILDING (chips, selects, checkboxes)
     ------------------------------------------------------------------ */
  (function buildStatic() {
    var chips = $('lnaTopicChips');
    CATEGORIES.forEach(function (c) {
      var b = el('button', 'lna-chip', c[1]);
      b.type = 'button';
      b.setAttribute('data-topic', c[0]);
      b.setAttribute('aria-pressed', 'false');
      chips.appendChild(b);
    });
    var sel = $('lnaCategory');
    var o0 = el('option', null, 'Select a type'); o0.value = ''; sel.appendChild(o0);
    CATEGORIES.forEach(function (c) { var o = el('option', null, c[1]); o.value = c[0]; sel.appendChild(o); });
    var box = $('lnaDocTypes');
    DOC_TYPES.forEach(function (d) {
      var lab = el('label', 'lna-check lna-check-tile');
      var inp = el('input'); inp.type = 'checkbox'; inp.value = d[0]; inp.setAttribute('data-doctype', d[0]);
      lab.appendChild(inp);
      lab.appendChild(el('span', 'lna-check-box'));
      lab.lastChild.setAttribute('aria-hidden', 'true');
      lab.appendChild(el('span', null, d[1]));
      box.appendChild(lab);
    });
  })();

  /* ------------------------------------------------------------------
     FORM BINDING
     ------------------------------------------------------------------ */
  function fillForm() {
    qsa('[data-field]').forEach(function (n) {
      var v = getPath(n.getAttribute('data-field'));
      if (n.type === 'checkbox') n.checked = !!v; else n.value = str(v);
    });
    qsa('[data-topic]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-topic') === state.topic ? 'true' : 'false'); });
    qsa('[data-doctype]').forEach(function (c) { c.checked = state.evidence.types.indexOf(c.value) >= 0; });
    qsa('[data-notice]').forEach(function (n) { n.value = state.notice ? state.notice.current[n.getAttribute('data-notice')] : ''; });
    qsa('[data-lang-select]').forEach(function (s) { s.value = chosenLanguage(); });
    updateConditional();
    updateCount();
    renderDates();
    renderFiles();
  }

  function updateConditional() {
    $('lnaCategoryOtherWrap').hidden = state.matter.category !== 'other';
    $('lnaPeriodCustomWrap').hidden = state.matter.period !== 'custom';
  }
  function updateCount() { $('lnaProblemCount').textContent = state.problem.length + ' / 5000'; }

  document.addEventListener('input', function (e) {
    var n = e.target;
    var path = n.getAttribute && n.getAttribute('data-field');
    if (path) {
      setPath(path, n.type === 'checkbox' ? n.checked : n.value);
      if (path === 'problem') updateCount();
      clearFieldError(n);
      persist();
      renderStepper(); // facts changed -> later steps may need re-confirmation
      return;
    }
    var nk = n.getAttribute && n.getAttribute('data-notice');
    if (nk && state.notice) {
      state.notice.current[nk] = n.value;
      state.notice.edited = NOTICE_KEYS.some(function (k) { return state.notice.current[k] !== state.notice.generated[k]; });
      persist();
      renderNoticeInto($('lnaPreview6'), state.notice.current, noticeLanguage());
    }
  });
  document.addEventListener('change', function (e) {
    var n = e.target;
    var path = n.getAttribute && n.getAttribute('data-field');
    if (path) {
      setPath(path, n.type === 'checkbox' ? n.checked : n.value);
      if (path === 'matter.category' || path === 'matter.period') updateConditional();
      clearFieldError(n);
      persist();
      renderStepper();
    }
    if (n.hasAttribute && n.hasAttribute('data-doctype')) {
      var t = state.evidence.types.filter(function (x) { return x !== n.value; });
      if (n.checked) t.push(n.value);
      state.evidence.types = DOC_TYPES.map(function (d) { return d[0]; }).filter(function (k) { return t.indexOf(k) >= 0; });
      persist();
      renderStepper();
    }
    if (n.hasAttribute && n.hasAttribute('data-lang-select')) {
      state.language = LANGS.indexOf(n.value) >= 0 ? n.value : 'en';
      qsa('[data-lang-select]').forEach(function (s) { s.value = state.language; });
      persist();
      if (state.notice && state.notice.language && state.notice.language !== state.language) {
        live('Notice language set to ' + LANG_NAMES[state.language] + '. Click Regenerate to create the notice in this language.');
      }
    }
  });

  function clearFieldError(n) {
    if (n.getAttribute('aria-invalid') === 'true') {
      n.removeAttribute('aria-invalid');
      var p = $(n.id + 'Err'); if (p) { p.hidden = true; p.textContent = ''; }
    }
  }

  $('lnaTopicChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-topic]');
    if (!b) return;
    var t = b.getAttribute('data-topic');
    state.topic = state.topic === t ? '' : t;
    // Pre-select the dispute type in Step 2 only if the user has not chosen one yet.
    if (state.topic && !state.matter.category) state.matter.category = state.topic;
    fillForm(); persist();
  });

  $('lnaCopyProblem').addEventListener('click', function () {
    var f = $('lnaFacts');
    if (trim(state.matter.facts) && trim(state.matter.facts) !== trim(state.problem)) {
      state.matter.facts = trim(state.matter.facts) + '\n\n' + trim(state.problem);
    } else {
      state.matter.facts = trim(state.problem);
    }
    f.value = state.matter.facts;
    clearFieldError(f);
    persist();
    f.focus();
  });

  /* ----- important dates (repeatable rows) ----- */
  function renderDates() {
    var box = $('lnaDates');
    clear(box);
    if (!state.matter.dates.length) {
      box.appendChild(el('p', 'lna-dates-empty', 'No dates added. Add dates such as when an agreement was signed, a payment was due, or an earlier reminder was sent.'));
    }
    state.matter.dates.forEach(function (d, i) {
      var row = el('div', 'lna-date-row');
      var di = el('input', 'lna-input lna-date-input');
      di.type = 'date'; di.value = d.date; di.id = 'lnaDate_' + d.id;
      di.setAttribute('aria-label', 'Date ' + (i + 1));
      di.min = '1900-01-01'; di.max = '2100-12-31';
      var li = el('input', 'lna-input');
      li.value = d.label; li.maxLength = 150; li.placeholder = 'What happened on this date?';
      li.setAttribute('aria-label', 'Description for date ' + (i + 1));
      var rm = el('button', 'lna-icon-btn');
      rm.type = 'button'; rm.setAttribute('aria-label', 'Remove date ' + (i + 1));
      rm.appendChild(xIcon());
      di.addEventListener('input', function () { d.date = di.value; persist(); hideDatesErr(); });
      li.addEventListener('input', function () { d.label = li.value; persist(); hideDatesErr(); });
      rm.addEventListener('click', function () {
        state.matter.dates = state.matter.dates.filter(function (x) { return x !== d; });
        persist(); renderDates(); hideDatesErr();
        $('lnaAddDate').focus();
      });
      row.appendChild(di); row.appendChild(li); row.appendChild(rm);
      box.appendChild(row);
    });
    $('lnaAddDate').hidden = state.matter.dates.length >= MAX_DATES;
  }
  function hideDatesErr() { var p = $('lnaDatesErr'); p.hidden = true; p.textContent = ''; }
  $('lnaAddDate').addEventListener('click', function () {
    if (state.matter.dates.length >= MAX_DATES) return;
    var d = { id: uid(), date: '', label: '' };
    state.matter.dates.push(d);
    persist(); renderDates();
    var inp = $('lnaDate_' + d.id); if (inp) inp.focus();
  });

  function xIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M6 6l12 12M18 6L6 18'); svg.appendChild(p);
    return svg;
  }

  /* ----- files: metadata only, contents never read ----- */
  var fileInput = $('lnaFiles');
  // Must match the accept="" list on #lnaFiles. Checked here too, because
  // drag-and-drop (and some file dialogs) ignore the accept attribute.
  var ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'txt', 'rtf', 'odt'];
  function hasAllowedExt(name) {
    var n = str(name), dot = n.lastIndexOf('.');
    if (dot <= 0 || dot === n.length - 1) return false;
    return ALLOWED_EXT.indexOf(n.slice(dot + 1).toLowerCase()) >= 0;
  }

  function addFiles(list) {
    var errP = $('lnaFilesErr');
    errP.hidden = true; errP.textContent = '';
    var files = Array.prototype.slice.call(list || []);
    var skipped = 0;
    var unsupported = [];
    files.forEach(function (f) {
      if (!hasAllowedExt(f.name)) { unsupported.push(str(f.name) || 'Unnamed file'); return; }
      if (state.evidence.files.length >= MAX_FILES) { skipped++; return; }
      var dup = state.evidence.files.some(function (x) { return x.name === f.name && x.size === f.size && x.lastModified === f.lastModified; });
      if (dup) return;
      state.evidence.files.push({
        id: uid(), name: str(f.name).slice(0, 255), type: str(f.type).slice(0, 100),
        size: Number(f.size) || 0, lastModified: Number(f.lastModified) || 0, docType: guessDocType(f)
      });
    });
    var msgs = [];
    if (unsupported.length) {
      var shown = unsupported.slice(0, 3).map(function (n) { return n.length > 60 ? n.slice(0, 57) + '…' : n; }).join(', ');
      var more = unsupported.length > 3 ? ' and ' + (unsupported.length - 3) + ' more' : '';
      msgs.push(unsupported.length + ' unsupported file' + (unsupported.length > 1 ? 's were' : ' was') + ' not added (' + shown + more + '). Allowed types: PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX, TXT, RTF, ODT.');
    }
    if (skipped) msgs.push('You can list up to ' + MAX_FILES + ' files. ' + skipped + ' file' + (skipped > 1 ? 's were' : ' was') + ' not added.');
    if (msgs.length) { errP.textContent = msgs.join(' '); errP.hidden = false; }
    persist(); renderFiles();
    fileInput.value = ''; // the File objects themselves are not kept
  }
  function guessDocType(f) {
    var n = str(f.name).toLowerCase(), t = str(f.type);
    if (/invoice|bill/.test(n)) return 'invoice';
    if (/agreement|contract|lease|rent/.test(n)) return 'agreement';
    if (/receipt|payment|upi|transaction|statement/.test(n)) return 'payment-proof';
    if (/screenshot|screen shot/.test(n)) return 'screenshot';
    if (/mail|chat|whatsapp/.test(n)) return 'email';
    if (/notice|letter/.test(n)) return 'letter';
    if (/^image\//.test(t)) return 'screenshot';
    return 'other';
  }
  fileInput.addEventListener('change', function () { addFiles(fileInput.files); });

  var drop = $('lnaDrop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  // Prevent the browser from opening a file dropped outside the drop zone.
  ['dragover', 'drop'].forEach(function (ev) { window.addEventListener(ev, function (e) { if (!drop.contains(e.target)) e.preventDefault(); }); });

  function renderFiles() {
    var box = $('lnaFileList');
    clear(box);
    if (!state.evidence.files.length) {
      box.appendChild(el('p', 'lna-files-empty', 'No files listed yet.'));
      return;
    }
    var head = el('p', 'lna-files-head', state.evidence.files.length + ' of ' + MAX_FILES + ' files listed');
    box.appendChild(head);
    state.evidence.files.forEach(function (f, i) {
      var row = el('div', 'lna-file');
      var ic = el('span', 'lna-file-ic', (f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase());
      ic.setAttribute('aria-hidden', 'true');
      var meta = el('div', 'lna-file-meta');
      meta.appendChild(el('span', 'lna-file-name', f.name));
      var bits = [formatBytes(f.size)];
      if (f.type) bits.push(f.type);
      if (f.lastModified) { var d = new Date(f.lastModified); bits.push('modified ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear()); }
      meta.appendChild(el('span', 'lna-file-sub', bits.join(' · ')));
      var sel = el('select', 'lna-select lna-select-sm');
      sel.setAttribute('aria-label', 'Document type for ' + f.name);
      DOC_TYPES.forEach(function (d) { var o = el('option', null, d[1]); o.value = d[0]; sel.appendChild(o); });
      sel.value = f.docType || 'other';
      sel.addEventListener('change', function () { f.docType = sel.value; persist(); });
      var rm = el('button', 'lna-icon-btn');
      rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + f.name);
      rm.appendChild(xIcon());
      rm.addEventListener('click', function () {
        state.evidence.files = state.evidence.files.filter(function (x) { return x !== f; });
        persist(); renderFiles();
        var next = qsa('#lnaFileList .lna-icon-btn')[Math.min(i, state.evidence.files.length - 1)];
        (next || fileInput).focus();
      });
      row.appendChild(ic); row.appendChild(meta); row.appendChild(sel); row.appendChild(rm);
      box.appendChild(row);
    });
  }

  /* ------------------------------------------------------------------
     STEP 4 — REVIEW
     ------------------------------------------------------------------ */
  function categoryText() {
    if (state.matter.category === 'other') return trim(state.matter.categoryOther) || 'Other civil / legal dispute';
    return labelOf(CATEGORIES, state.matter.category);
  }
  function periodDays() {
    if (state.matter.period === 'custom') { var n = parseInt(state.matter.periodCustom, 10); return n >= 1 && n <= 365 ? n : 0; }
    return parseInt(state.matter.period, 10) || 0;
  }
  function validDates() {
    return state.matter.dates.filter(function (d) { return isValidISODate(d.date) && trim(d.label); })
      .slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function enclosureList() {
    var out = [];
    state.evidence.files.forEach(function (f) { out.push(labelOf(DOC_TYPES, f.docType || 'other') + ' — ' + f.name); });
    state.evidence.types.forEach(function (t) {
      if (!state.evidence.files.some(function (f) { return f.docType === t; })) out.push(labelOf(DOC_TYPES, t));
    });
    return out;
  }

  function renderReview() {
    var box = $('lnaReview');
    clear(box);
    function section(title, step, rows) {
      var sec = el('section', 'lna-review-card');
      var head = el('div', 'lna-review-head');
      head.appendChild(el('h3', 'lna-review-title', title));
      var b = el('button', 'lna-link-btn', 'Edit');
      b.type = 'button'; b.setAttribute('aria-label', 'Edit ' + title);
      b.addEventListener('click', function () { goTo(step); });
      head.appendChild(b);
      sec.appendChild(head);
      var dl = el('dl', 'lna-review-dl');
      rows.forEach(function (r) {
        var wrap = el('div', 'lna-review-row' + (r[2] ? ' lna-review-row-full' : ''));
        wrap.appendChild(el('dt', null, r[0]));
        var v = r[1];
        var dd = el('dd', v ? 'lna-pre' : 'lna-missing', v || 'Not provided');
        wrap.appendChild(dd);
        dl.appendChild(wrap);
      });
      sec.appendChild(dl);
      box.appendChild(sec);
    }
    var s = state.sender, r = state.recipient, m = state.matter;
    section('Your problem', 1, [['Summary in your words', trim(state.problem), true]]);
    section('Sender', 2, [['Full name', trim(s.name)], ['Email', trim(s.email)], ['Phone', trim(s.phone)], ['Address', trim(s.address), true]]);
    section('Recipient', 2, [['Person / company', trim(r.name)], ['Email', trim(r.email)], ['Address', trim(r.address), true]]);
    var dates = validDates().map(function (d) { return longDate(d.date) + ' — ' + trim(d.label); }).join('\n');
    var amt = trim(m.amount).replace(/,/g, '');
    section('Matter', 2, [
      ['Type of dispute', categoryText()],
      ['Amount involved', amt ? formatINR(amt) : ''],
      ['Response period', periodDays() ? periodDays() + ' days' : ''],
      ['Important dates', dates, true],
      ['Key facts', trim(m.facts), true],
      ['Action requested', trim(m.remedy), true],
      ['Additional information', trim(m.additional), true]
    ]);
    var enc = enclosureList();
    section('Supporting information', 3, [
      ['Documents (listed only — not opened or read by Legal Lens or the AI)', enc.join('\n'), true],
      ['List as enclosures in notice', enc.length ? (state.evidence.listInNotice ? 'Yes' : 'No') : '']
    ]);
    var c = $('lnaConfirm');
    c.checked = state.confirmedHash === factsHash();
  }
  $('lnaConfirm').addEventListener('change', function (e) {
    state.confirmedHash = e.target.checked ? factsHash() : '';
    if (e.target.checked) { var p = $('lnaConfirmErr'); p.hidden = true; p.textContent = ''; e.target.removeAttribute('aria-invalid'); }
    persist(true);
    renderStepper();
  });

  /* ------------------------------------------------------------------
     NOTICE TEXT FROM THE SERVER
     ------------------------------------------------------------------ */
  function pickContent(o) { var r = {}; NOTICE_KEYS.forEach(function (k) { r[k] = str(o && o[k]); }); return r; }

  /** A full server record → page state (used when opening a saved notice). */
  function fromServer(n) {
    var raw = {
      step: n.step, maxStep: n.maxStep, problem: n.problem, topic: n.topic, sender: n.sender, recipient: n.recipient,
      matter: n.matter, evidence: n.evidence, confirmedHash: n.confirmedHash, serverId: n.id, clientId: n.clientId,
      status: n.status, language: n.language, versions: n.versions, dirty: false,
      savedAt: Date.parse(n.updatedAt) || Date.now()
    };
    if (n.content) {
      raw.notice = {
        generated: n.generated || n.content, current: n.content,
        factsHash: (n.generation && n.generation.factsHash) || '',
        generatedAt: Date.parse((n.generation && n.generation.generatedAt) || n.updatedAt) || 0,
        language: n.language, meta: n.generation || null
      };
    }
    var s = sanitizeState(raw);
    if (s.notice) s.notice.edited = NOTICE_KEYS.some(function (k) { return s.notice.current[k] !== s.notice.generated[k]; });
    return s;
  }

  /** Notice text + account fields from an AI / restore response (facts typed meanwhile are kept). */
  function applyServerNotice(n) {
    afterSave(n, false);
    state.language = LANGS.indexOf(n.language) >= 0 ? n.language : state.language;
    if (n.content) {
      var prevHash = state.notice ? state.notice.factsHash : '';
      state.notice = {
        generated: pickContent(n.generated || n.content),
        current: pickContent(n.content),
        factsHash: (n.generation && n.generation.factsHash) || prevHash || factsHash(),
        generatedAt: Date.parse(n.generation && n.generation.generatedAt) || Date.now(),
        edited: false,
        language: state.language,
        meta: sanitizeMeta(n.generation)
      };
      state.notice.edited = NOTICE_KEYS.some(function (k) { return state.notice.current[k] !== state.notice.generated[k]; });
    }
    state.savedAt = Date.now();
    qsa('[data-notice]').forEach(function (inp) { inp.value = state.notice ? state.notice.current[inp.getAttribute('data-notice')] : ''; });
    qsa('[data-lang-select]').forEach(function (s) { s.value = chosenLanguage(); });
  }

  /* Render a notice object into a container using DOM text nodes only. */
  function renderNoticeInto(box, n, lang) {
    var L = NOTICE_LABELS[lang] || NOTICE_LABELS.en;
    clear(box);
    box.setAttribute('lang', lang === 'hi' || lang === 'mr' ? lang : 'en');
    var cap = el('p', 'lna-n-caption', L.caption);
    box.appendChild(cap);
    var date = el('p', 'lna-n-date'); date.appendChild(el('span', 'lna-n-k', L.date)); date.appendChild(document.createTextNode(trim(n.date)));
    box.appendChild(date);
    var parties = el('div', 'lna-n-parties');
    [[L.from, n.from], [L.to, n.to]].forEach(function (p) {
      var b = el('div', 'lna-n-party');
      b.appendChild(el('p', 'lna-n-label', p[0]));
      b.appendChild(el('p', 'lna-n-pre', trim(p[1]) || '—'));
      parties.appendChild(b);
    });
    box.appendChild(parties);
    var sub = el('p', 'lna-n-subject'); sub.appendChild(el('span', 'lna-n-k', L.subject)); sub.appendChild(document.createTextNode(trim(n.subject)));
    box.appendChild(sub);
    var body = el('div', 'lna-n-body');
    var para = null;
    str(n.body).replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
      if (!trim(line)) { para = null; return; }
      if (/^\s*\d{1,2}\.\s+\S/.test(line) && line.length <= 90) { body.appendChild(el('h4', 'lna-n-h', trim(line))); para = null; return; }
      if (/^\s*[•\-]\s+/.test(line)) { body.appendChild(el('p', 'lna-n-li', trim(line).replace(/^[•\-]\s+/, ''))); para = null; return; }
      if (!para) { para = el('p', 'lna-n-p'); body.appendChild(para); para.textContent = line; }
      else { para.appendChild(document.createElement('br')); para.appendChild(document.createTextNode(line)); }
    });
    box.appendChild(body);
    box.appendChild(el('p', 'lna-n-pre lna-n-sign', trim(n.signature)));
    if (trim(n.enclosures)) {
      var enc = el('div', 'lna-n-enc');
      enc.appendChild(el('p', 'lna-n-label', L.enclosures));
      enc.appendChild(el('p', 'lna-n-pre', trim(n.enclosures)));
      box.appendChild(enc);
    }
    box.appendChild(el('p', 'lna-n-foot', L.footer));
  }

  /** "What came from you / what the AI wrote" panel under the preview. */
  function renderAiCheck(box) {
    var n = state.notice;
    clear(box);
    if (!n) { box.hidden = true; return; }
    box.appendChild(el('p', 'lna-ai-check-title', 'Check this AI-assisted draft before sending'));
    box.appendChild(el('p', null, 'Taken exactly from your answers: the date line, sender and recipient details, signature and enclosures. Written by the AI from your confirmed facts: the subject and the body wording — read every sentence and correct anything that is not accurate. The AI is instructed not to add laws, case references, dates or amounts you did not give.'));
    if (state.evidence.files.length || state.evidence.types.length) {
      box.appendChild(el('p', 'lna-ai-check-docs', 'Your documents were not read or analysed. The AI was only told which kinds of documents you have, and they appear as enclosures by name. Make sure every statement matches what your documents actually say.'));
    }
    var meta = n.meta;
    if (meta && meta.factStatements.length) {
      box.appendChild(el('p', 'lna-ai-check-sub', 'Facts the AI stated — check each one'));
      var ul = el('ul');
      meta.factStatements.forEach(function (f) {
        var li = el('li', null, f.statement);
        li.appendChild(el('span', 'lna-ai-src', ' — from ' + (FACT_SOURCE_LABELS[f.source] || 'your facts')));
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    if (meta && meta.missingInformation.length) {
      box.appendChild(el('p', 'lna-ai-check-sub', 'Details you may want to add'));
      var ul2 = el('ul');
      meta.missingInformation.forEach(function (m) { ul2.appendChild(el('li', null, m)); });
      box.appendChild(ul2);
      var p = el('p', null, 'These were not provided, so they were left out — nothing was made up. If you have them, add them in ');
      var b = el('button', 'lna-link-btn', 'Notice details');
      b.type = 'button';
      b.addEventListener('click', function () { goTo(2); });
      p.appendChild(b);
      p.appendChild(document.createTextNode(' and regenerate.'));
      box.appendChild(p);
    }
    if (meta && meta.notes.length) {
      box.appendChild(el('p', 'lna-ai-check-sub', 'Notes from the AI'));
      var ul3 = el('ul');
      meta.notes.forEach(function (m) { ul3.appendChild(el('li', null, m)); });
      box.appendChild(ul3);
    }
    box.hidden = false;
  }

  function noticeIsStale() { return !!state.notice && state.notice.factsHash !== factsHash(); }

  function renderStep5() {
    var has = !!state.notice;
    $('lnaGenEmpty').hidden = has;
    $('lnaGenResult').hidden = !has;
    $('lnaRegenerate5').hidden = !has;
    $('lnaLanguage5').hidden = !has;
    $('lnaNext5').hidden = !has;
    $('lnaStaleBanner5').hidden = !noticeIsStale();
    qsa('[data-lang-select]').forEach(function (s) { s.value = chosenLanguage(); });
    if (has) {
      renderNoticeInto($('lnaPreview5'), state.notice.current, noticeLanguage());
      $('lnaGenTime').textContent = (state.notice.generatedAt ? 'Created ' + shortDateTime(state.notice.generatedAt) : '') +
        (state.notice.language ? ' · ' + LANG_NAMES[state.notice.language] : '') + (state.notice.edited ? ' · edited' : '');
      renderAiCheck($('lnaAiCheck5'));
    } else {
      $('lnaAiCheck5').hidden = true;
    }
  }

  function renderStep6() {
    if (!state.notice) return;
    qsa('[data-notice]').forEach(function (n) { if (document.activeElement !== n) n.value = state.notice.current[n.getAttribute('data-notice')]; });
    renderNoticeInto($('lnaPreview6'), state.notice.current, noticeLanguage());
    $('lnaStaleBanner6').hidden = !noticeIsStale();
    $('lnaFinalBanner6').hidden = state.status !== 'finalized';
    renderVersions();
    renderAiCheck($('lnaAiCheck6'));
    renderSaveStatus();
  }

  function renderVersions() {
    var box = $('lnaVersionsBox'), sel = $('lnaVersionSelect');
    clear(sel);
    if (!state.versions.length) { box.hidden = true; return; }
    state.versions.forEach(function (v) {
      var o = el('option', null, (v.label || 'Earlier version') + (v.savedAt ? ' · ' + shortDateTime(v.savedAt) : '') + (v.language && v.language !== 'en' ? ' · ' + LANG_NAMES[v.language] : ''));
      o.value = v.id;
      sel.appendChild(o);
    });
    box.hidden = false;
  }

  function renderStep7() {
    if (state.notice) renderNoticeInto($('lnaFinal'), state.notice.current, noticeLanguage());
    renderStatusBits();
  }

  function renderStatusBits() {
    var tag = $('lnaStatusTag');
    if (!tag) return;
    var st = state.status;
    tag.textContent = STATUS_LABELS[st] || 'Draft';
    tag.className = 'lna-tag' + (st === 'finalized' ? ' lna-tag-final' : '');
    $('lnaStatusNote').textContent = !state.serverId ? 'Not saved to an account yet' : (st === 'finalized' ? 'Marked as final by you' : 'Not marked as final');
    $('lnaFinalize').textContent = st === 'finalized' ? 'Reopen for editing' : 'Mark as final';
    $('lnaFinalBanner6').hidden = st !== 'finalized';
  }

  /* ------------------------------------------------------------------
     AI ACTIONS (backend: /api/notices/:id/generate | refine)
     ------------------------------------------------------------------ */
  var aiBusy = false;
  var AI_BUTTONS = ['lnaGenerate', 'lnaRegenerate5', 'lnaRegenerate6', 'lnaRefineBtn', 'lnaRestoreBtn'];
  var AI_BUSY_TEXT = { lnaGenerate: 'Generating your draft…', lnaRegenerate5: 'Regenerating…', lnaRegenerate6: 'Regenerating…', lnaRefineBtn: 'Refining…', lnaRestoreBtn: 'Restoring…' };
  var aiButtonText = {};

  function setAiBusy(on, activeId) {
    aiBusy = on;
    AI_BUTTONS.forEach(function (id) {
      var b = $(id);
      if (!b) return;
      if (on) {
        aiButtonText[id] = b.textContent;
        b.disabled = true;
        if (id === activeId) { b.setAttribute('aria-busy', 'true'); b.textContent = AI_BUSY_TEXT[id]; }
      } else {
        b.disabled = false;
        b.removeAttribute('aria-busy');
        if (aiButtonText[id] !== undefined) b.textContent = aiButtonText[id];
      }
    });
    // The text is being replaced: no typing into it meanwhile.
    qsa('[data-notice]').forEach(function (n) { n.readOnly = on; });
    $('lnaRefineText').readOnly = on;
    qsa('[data-lang-select]').forEach(function (s) { s.disabled = on; });
  }

  function aiErrorTarget() { return state.step === 6 ? 'lnaGenError6' : 'lnaGenError'; }

  function showAiError(err, target, action) {
    var msg = (err && err.local) ? err.message : friendlyError(err, action || 'the AI request');
    var link = null;
    if (err && err.statusCode === 422 && err.details && Array.isArray(err.details.missing)) {
      link = ['Edit notice details', function () { goTo(2); }];
    } else if (err && err.statusCode === 401) {
      link = ['Log in', function () { goToLogin(); }];
    }
    showMsg(target, msg + (/changed|kept/.test(msg) ? '' : ' Your notice has not been changed.'), link);
  }

  /** Saves pending edits first (so the AI works on what is on screen). */
  function saveThen(fn) {
    return saveNow().then(function () {
      if (!state.serverId) {
        var e = new Error('Your notice could not be saved, so it was not sent to the AI. Please try again.');
        e.local = true;
        throw e;
      }
      return enqueue(fn);
    });
  }

  function aiGenerate(target) {
    hideAiErrors();
    target = target || aiErrorTarget();
    if (state.confirmedHash !== factsHash()) { goTo(4); return; }
    if (!requireAccount(target)) return;
    if (aiBusy) return;
    var lang = chosenLanguage();
    var activeId = state.step === 6 ? 'lnaRegenerate6' : (state.notice ? 'lnaRegenerate5' : 'lnaGenerate');
    setAiBusy(true, activeId);
    live('Generating your notice with AI. This can take up to a minute.');
    saveThen(function () {
      return noticeApi('/' + state.serverId + '/generate', { method: 'POST', body: { language: lang, factsHash: factsHash() } });
    }).then(function (res) {
      setAiBusy(false);
      applyServerNotice(res.data.notice);
      if (state.maxStep < 6) state.maxStep = 6;
      writeLocal();
      render();
      live('Notice draft generated. ' + (state.versions.length ? 'The previous text is kept under Earlier versions.' : ''));
      if (state.step === 5) $('lnaPreview5').scrollIntoView({ block: 'start' });
    }).catch(function (err) {
      setAiBusy(false);
      showAiError(err, target, 'generating the notice');
    });
  }

  $('lnaGenerate').addEventListener('click', function () { aiGenerate('lnaGenError'); });

  function regenerate(confirmBox, target) {
    if (state.notice && state.notice.edited) { $(confirmBox).hidden = false; $(confirmBox).querySelector('[data-regen="cancel"]').focus(); return; }
    aiGenerate(target);
  }
  $('lnaRegenerate5').addEventListener('click', function () { regenerate('lnaRegenConfirm5', 'lnaGenError'); });
  $('lnaRegenerate6').addEventListener('click', function () {
    if (state.confirmedHash !== factsHash()) { goTo(4); return; }
    regenerate('lnaRegenConfirm6', 'lnaGenError6');
  });
  ['lnaRegenConfirm5', 'lnaRegenConfirm6'].forEach(function (id) {
    $(id).addEventListener('click', function (e) {
      var b = e.target.closest('[data-regen]'); if (!b) return;
      $(id).hidden = true;
      if (b.getAttribute('data-regen') === 'confirm') aiGenerate(id === 'lnaRegenConfirm5' ? 'lnaGenError' : 'lnaGenError6');
      else live('Your edits were kept.');
    });
  });

  $('lnaRefineBtn').addEventListener('click', function () {
    hideAiErrors();
    var text = trim($('lnaRefineText').value);
    if (text.length < 3) { showMsg('lnaRefineErr', 'Describe the change you want, for example “make the tone more formal”.'); $('lnaRefineText').focus(); return; }
    if (!state.notice) return;
    if (!requireAccount('lnaRefineErr')) return;
    if (aiBusy) return;
    setAiBusy(true, 'lnaRefineBtn');
    live('Asking the AI to update your draft.');
    saveThen(function () {
      return noticeApi('/' + state.serverId + '/refine', { method: 'POST', body: { instruction: text } });
    }).then(function (res) {
      setAiBusy(false);
      applyServerNotice(res.data.notice);
      $('lnaRefineText').value = '';
      writeLocal();
      render();
      live('Draft updated with your requested change. The previous text is kept under Earlier versions.');
    }).catch(function (err) {
      setAiBusy(false);
      showAiError(err, 'lnaRefineErr', 'the change');
    });
  });

  $('lnaRestoreBtn').addEventListener('click', function () {
    hideAiErrors();
    var vid = $('lnaVersionSelect').value;
    if (!vid) return;
    if (!requireAccount('lnaVersionErr')) return;
    if (aiBusy) return;
    setAiBusy(true, 'lnaRestoreBtn');
    saveThen(function () {
      return noticeApi('/' + state.serverId + '/versions/' + encodeURIComponent(vid) + '/restore', { method: 'POST' });
    }).then(function (res) {
      setAiBusy(false);
      var n = res.data.notice;
      afterSave(n, false);
      if (n.content && state.notice) {
        state.notice.current = pickContent(n.content);
        state.notice.language = LANGS.indexOf(n.language) >= 0 ? n.language : state.notice.language;
        state.notice.edited = NOTICE_KEYS.some(function (k) { return state.notice.current[k] !== state.notice.generated[k]; });
      }
      state.language = state.notice ? state.notice.language : state.language;
      qsa('[data-notice]').forEach(function (inp) { inp.value = state.notice.current[inp.getAttribute('data-notice')]; });
      writeLocal();
      render();
      live('Earlier version restored. The text it replaced is kept under Earlier versions.');
    }).catch(function (err) {
      setAiBusy(false);
      showAiError(err, 'lnaVersionErr', 'restoring');
    });
  });

  function hideInlineConfirms() { ['lnaRegenConfirm5', 'lnaRegenConfirm6', 'lnaResetConfirm'].forEach(function (id) { $(id).hidden = true; }); }

  /* Step 6 edit / preview tabs (small screens) */
  function setTab(preview) {
    $('lnaEditorLayout').classList.toggle('show-preview', preview);
    $('lnaTabEdit').classList.toggle('is-active', !preview);
    $('lnaTabPreview').classList.toggle('is-active', preview);
    $('lnaTabEdit').setAttribute('aria-selected', preview ? 'false' : 'true');
    $('lnaTabPreview').setAttribute('aria-selected', preview ? 'true' : 'false');
  }
  $('lnaTabEdit').addEventListener('click', function () { setTab(false); });
  $('lnaTabPreview').addEventListener('click', function () { setTab(true); });

  /* ------------------------------------------------------------------
     STEP 7 — PRINT / PDF, WORD DOWNLOAD, FINAL STATUS
     ------------------------------------------------------------------ */
  function fileSlug() {
    var base = categoryText() + ' ' + trim(state.recipient.name);
    if (base.normalize) base = base.normalize('NFKD');
    base = base.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60);
    return 'legal-notice' + (base ? '-' + base : '');
  }

  /* Print (the browser's "Save as PDF" makes the PDF) */
  $('lnaPrint').addEventListener('click', function () {
    renderStep7();
    var prev = document.title;
    document.title = fileSlug();
    var restore = function () { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
    setTimeout(restore, 1500);
  });

  function fetchDocx(retried) {
    var token = typeof getAccessToken === 'function' ? getAccessToken() : null;
    return fetch(API_BASE_URL + '/notices/' + encodeURIComponent(state.serverId) + '/download?format=docx', {
      method: 'GET',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      credentials: 'include'
    }).then(function (res) {
      if (res.status === 401 && !retried && typeof refreshSession === 'function') {
        return refreshSession().then(function (ok) {
          if (!ok) throw httpError(401, 'Your session has ended.');
          return fetchDocx(true);
        });
      }
      if (!res.ok) {
        return res.json().catch(function () { return null; }).then(function (p) { throw httpError(res.status, p && p.message); });
      }
      return res.blob();
    }, function () { throw httpError(0); });
  }

  $('lnaDownloadDocx').addEventListener('click', function () {
    var btn = $('lnaDownloadDocx');
    hideMsg('lnaFinalErr');
    if (!state.notice) return;
    if (!requireAccount('lnaFinalErr')) return;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    saveThen(function () { return fetchDocx(false); }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileSlug() + '.docx';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      live('Word file downloaded.');
    }).catch(function (err) {
      showMsg('lnaFinalErr', (err && err.local) ? err.message : friendlyError(err, 'the download'));
    }).then(function () { btn.disabled = false; btn.removeAttribute('aria-busy'); });
  });

  $('lnaFinalize').addEventListener('click', function () {
    var btn = $('lnaFinalize');
    hideMsg('lnaFinalErr');
    if (!state.notice) return;
    if (!requireAccount('lnaFinalErr')) return;
    var target = state.status === 'finalized' ? 'generated' : 'finalized';
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    saveThen(function () {
      return noticeApi('/' + state.serverId, { method: 'PATCH', body: { status: target } });
    }).then(function (res) {
      afterSave(res.data.notice, false);
      writeLocal();
      renderStatusBits();
      live(target === 'finalized' ? 'Notice marked as final. You can still reopen it for editing.' : 'Notice reopened for editing.');
    }).catch(function (err) {
      showMsg('lnaFinalErr', (err && err.local) ? err.message : friendlyError(err, 'the status change'));
    }).then(function () { btn.disabled = false; btn.removeAttribute('aria-busy'); });
  });

  /* ------------------------------------------------------------------
     SAVED NOTICES (list, open, delete)
     ------------------------------------------------------------------ */
  var saved = { loading: false, error: '', items: null, confirmId: '', busyId: '', itemErr: {} };

  function openSavedView() {
    if (account.state !== 'ready') {
      view = 'saved';
      render();
      saved.items = null;
      saved.error = '';
      renderSaved();
      return;
    }
    view = 'saved';
    hideInlineConfirms();
    render();
    $('lnaHSaved').focus({ preventScroll: true });
    var top = $('lnaApp').getBoundingClientRect().top + window.pageYOffset - 90;
    if (window.pageYOffset > top) window.scrollTo(0, Math.max(0, top));
    loadSaved();
  }

  function loadSaved() {
    saved.loading = true; saved.error = ''; saved.confirmId = ''; saved.itemErr = {};
    renderSaved();
    // Save the current notice first so it appears in the list.
    saveNow().catch(noop).then(function () {
      return noticeApi('');
    }).then(function (res) {
      saved.items = (res && res.data && Array.isArray(res.data.notices)) ? res.data.notices : [];
    }, function (err) {
      saved.error = friendlyError(err, 'loading your notices');
    }).then(function () { saved.loading = false; renderSaved(); });
  }

  function renderSaved() {
    var stBox = $('lnaSavedState'), list = $('lnaSavedList');
    clear(stBox); clear(list);
    stBox.className = 'lna-saved-state';
    if (account.state !== 'ready') {
      var msg = account.state === 'auth' ? 'Log in to see the notices saved to your account.' :
        account.state === 'role' ? 'Saved notices are available for customer accounts.' :
        account.state === 'loading' ? 'Checking your account…' : 'Legal Lens cannot be reached right now.';
      stBox.appendChild(document.createTextNode(msg + ' '));
      if (account.state === 'auth') {
        var lb = el('button', 'lna-link-btn', 'Log in'); lb.type = 'button';
        lb.addEventListener('click', function () { goToLogin(); });
        stBox.appendChild(lb);
      }
      return;
    }
    if (saved.loading) { stBox.textContent = 'Loading your saved notices…'; return; }
    if (saved.error) {
      stBox.classList.add('is-error');
      stBox.appendChild(document.createTextNode(saved.error + ' '));
      var rb = el('button', 'lna-link-btn', 'Try again'); rb.type = 'button';
      rb.addEventListener('click', loadSaved);
      stBox.appendChild(rb);
      return;
    }
    var items = saved.items || [];
    if (!items.length) {
      stBox.appendChild(el('p', 'lna-saved-empty', 'You have no saved notices yet. Notices are saved to your account automatically as you work.'));
      return;
    }
    stBox.textContent = items.length + (items.length === 1 ? ' saved notice' : ' saved notices');
    items.forEach(function (it) {
      var li = el('li', 'lna-saved-item' + (it.id === state.serverId ? ' is-current' : ''));
      var row = el('div', 'lna-saved-row');
      var info = el('div');
      info.appendChild(el('p', 'lna-saved-title', it.title || 'Untitled legal notice'));
      var meta = [STATUS_LABELS[it.status] || 'Draft', LANG_NAMES[it.language] || 'English'];
      if (it.updatedAt) meta.push('Updated ' + shortDateTime(Date.parse(it.updatedAt)));
      if (it.id === state.serverId) meta.push('Open now');
      info.appendChild(el('p', 'lna-saved-meta', meta.join(' · ')));
      row.appendChild(info);
      var acts = el('div', 'lna-saved-actions');
      var open = el('button', 'lna-btn lna-btn-outline lna-btn-sm', it.id === state.serverId ? 'Continue' : 'Open');
      open.type = 'button';
      open.setAttribute('aria-label', (it.id === state.serverId ? 'Continue ' : 'Open ') + (it.title || 'notice'));
      open.disabled = !!saved.busyId;
      if (saved.busyId === it.id) open.setAttribute('aria-busy', 'true');
      open.addEventListener('click', function () { openNotice(it); });
      var del = el('button', 'lna-btn lna-btn-ghost lna-btn-sm', 'Delete');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete ' + (it.title || 'notice'));
      del.disabled = !!saved.busyId;
      del.addEventListener('click', function () { saved.confirmId = it.id; saved.itemErr = {}; renderSaved(); var c = $('lnaDelCancel'); if (c) c.focus(); });
      acts.appendChild(open); acts.appendChild(del);
      row.appendChild(acts);
      li.appendChild(row);
      if (saved.confirmId === it.id) {
        var box = el('div', 'lna-confirm-inline');
        box.setAttribute('role', 'alertdialog');
        var q = el('p');
        q.appendChild(el('strong', null, 'Delete this notice permanently?'));
        q.appendChild(document.createTextNode(' “' + (it.title || 'Untitled legal notice') + '” and its earlier versions will be removed from your account. This cannot be undone.'));
        box.appendChild(q);
        var ca = el('div', 'lna-confirm-actions');
        var cancel = el('button', 'lna-btn lna-btn-outline lna-btn-sm', 'Cancel'); cancel.type = 'button'; cancel.id = 'lnaDelCancel';
        cancel.addEventListener('click', function () { saved.confirmId = ''; renderSaved(); });
        var ok = el('button', 'lna-btn lna-btn-dark lna-btn-sm', 'Delete permanently'); ok.type = 'button'; ok.id = 'lnaDelConfirm';
        if (saved.busyId === it.id) { ok.disabled = true; ok.setAttribute('aria-busy', 'true'); }
        ok.addEventListener('click', function () { deleteNotice(it); });
        ca.appendChild(cancel); ca.appendChild(ok);
        box.appendChild(ca);
        li.appendChild(box);
      }
      if (saved.itemErr[it.id]) {
        var er = el('p', 'lna-error', saved.itemErr[it.id]);
        er.setAttribute('role', 'alert');
        li.appendChild(er);
      }
      list.appendChild(li);
    });
  }

  function openNotice(it) {
    if (it.id === state.serverId) { goTo(state.step); return; }
    saved.busyId = it.id; saved.itemErr = {};
    renderSaved();
    saveNow().catch(function (err) { err.duringSave = true; throw err; }).then(function () {
      return noticeApi('/' + it.id);
    }).then(function (res) {
      saved.busyId = '';
      state = fromServer(res.data.notice);
      writeLocal();
      hideAiErrors();
      setTab(false);
      fillForm();
      var s = state.step;
      while (s > 1 && !canOpen(s)) s--;
      goTo(s);
      setSaveStatus('saved');
      live('Opened “' + (it.title || 'notice') + '”.');
    }).catch(function (err) {
      saved.busyId = '';
      saved.itemErr[it.id] = err && err.duringSave
        ? 'Your current notice could not be saved, so it was not replaced. ' + friendlyError(err, 'saving')
        : friendlyError(err, 'opening the notice');
      if (err && err.statusCode === 404 && !err.duringSave) saved.items = (saved.items || []).filter(function (x) { return x.id !== it.id; });
      renderSaved();
    });
  }

  function deleteNotice(it) {
    saved.busyId = it.id;
    renderSaved();
    var wasCurrent = it.id === state.serverId;
    if (wasCurrent) clearTimeout(autosaveTimer);
    enqueue(function () { return noticeApi('/' + it.id, { method: 'DELETE' }); }).then(function () {
      return true;
    }, function (err) {
      if (err && err.statusCode === 404) return true; // already gone
      throw err;
    }).then(function () {
      saved.items = (saved.items || []).filter(function (x) { return x.id !== it.id; });
      saved.confirmId = ''; saved.busyId = '';
      if (wasCurrent) {
        state = blankState();
        state.dirty = false;
        writeLocal();
        fillForm();
        setSaveStatus('');
      }
      renderSaved();
      live('Notice deleted.');
      var first = qsa('#lnaSavedList .lna-btn')[0];
      (first || $('lnaSavedNew')).focus();
    }).catch(function (err) {
      saved.busyId = '';
      saved.itemErr[it.id] = friendlyError(err, 'deleting the notice');
      renderSaved();
    });
  }

  $('lnaOpenSaved').addEventListener('click', openSavedView);
  $('lnaSavedBack').addEventListener('click', function () { goTo(state.step); });
  $('lnaSavedNew').addEventListener('click', askReset);

  /* ------------------------------------------------------------------
     START NEW (with confirmation)
     ------------------------------------------------------------------ */
  function askReset() {
    hideInlineConfirms();
    var box = $('lnaResetConfirm');
    $('lnaResetText').textContent = canSync() && (state.serverId || !isBlank())
      ? 'Your current notice stays in “My saved notices” (any unsaved changes are saved first).'
      : 'This clears your current answers from this page.';
    // Show the confirmation inside whichever panel is currently open
    var panel = qsa('.lna-panel').filter(function (p) { return !p.hidden; })[0];
    if (panel && box.parentNode !== panel) panel.insertBefore(box, panel.querySelector('.lna-actions'));
    box.hidden = false;
    box.querySelector('[data-reset="cancel"]').focus();
  }
  function doReset() {
    state = blankState();
    writeLocal();
    hideAiErrors();
    fillForm();
    setTab(false);
    goTo(1);
    setSaveStatus('');
    state.dirty = false;
    renderSaveStatus();
    live(canSync() ? 'Started a new notice. Your previous notice is in My saved notices.' : 'Started a new notice.');
  }
  $('lnaStartOver').addEventListener('click', askReset);
  $('lnaStartOverSide').addEventListener('click', askReset);
  $('lnaResetConfirm').addEventListener('click', function (e) {
    var b = e.target.closest('[data-reset]'); if (!b) return;
    $('lnaResetConfirm').hidden = true;
    if (b.getAttribute('data-reset') !== 'confirm') return;
    if (canSync() && !isBlank()) {
      saveNow().then(doReset, function () {
        live('Your current notice could not be saved, so a new notice was not started. Please try again.');
      });
    } else {
      doReset();
    }
  });

  /* ------------------------------------------------------------------
     RENDER
     ------------------------------------------------------------------ */
  function renderStepper() {
    var step = state.step;
    qsa('.lna-step').forEach(function (b) {
      var s = parseInt(b.getAttribute('data-step'), 10);
      var open = canOpen(s);
      var done = s < step && open;
      var current = s === step && view === 'wizard';
      b.classList.toggle('is-current', current);
      b.classList.toggle('is-done', done || (s < state.maxStep && s !== step && open));
      b.disabled = !open && s !== step;
      if (current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      var num = b.querySelector('.lna-step-num');
      num.textContent = (b.classList.contains('is-done') && s !== step) ? '✓' : String(s);
    });
    $('lnaProgressCount').textContent = 'Step ' + step + ' of ' + TOTAL_STEPS;
    $('lnaProgressName').textContent = STEP_NAMES[step - 1];
    $('lnaProgressFill').style.width = (step / TOTAL_STEPS * 100) + '%';
  }

  function render() {
    // Guard: never show a step whose prerequisites are not met.
    if (!canOpen(state.step) && state.step > 1) {
      var s = state.step;
      while (s > 1 && !canOpen(s)) s--;
      state.step = s;
    }
    var showSaved = view === 'saved';
    $('lnaSavedPanel').hidden = !showSaved;
    qsa('.lna-panel[data-panel]').forEach(function (p) { p.hidden = showSaved || parseInt(p.getAttribute('data-panel'), 10) !== state.step; });
    document.querySelector('.lna-layout').classList.toggle('is-wide', !showSaved && state.step >= 6);
    renderStepper();
    if (showSaved) renderSaved();
    else {
      if (state.step === 4) renderReview();
      if (state.step === 5) renderStep5();
      if (state.step === 6) renderStep6();
      if (state.step === 7) renderStep7();
    }
    renderSaveStatus();
    // Reset confirm lives in step 7 by default
    var box = $('lnaResetConfirm'), p7 = document.querySelector('[data-panel="7"]');
    if (box.hidden && box.parentNode !== p7) p7.insertBefore(box, p7.querySelector('.lna-actions'));
  }

  /* ------------------------------------------------------------------
     NAVBAR (same behaviour as other Legal Lens pages)
     ------------------------------------------------------------------ */
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
      qsa('.lang-option', langMenu).forEach(function (opt) {
        opt.addEventListener('click', function () {
          if (typeof window.changeLanguage === 'function') window.changeLanguage(opt.getAttribute('data-lang'));
          closeLang();
        });
      });
    }
    qsa('.mobile-lang-option').forEach(function (btn) {
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

  /* ------------------------------------------------------------------
     LOGOUT / ACCOUNT SWITCH IN ANOTHER TAB
     auth.js keeps non-secret UI flags (loggedIn, userEmail) in
     localStorage; a change to them in another tab means this tab may now
     belong to a different person. They are only a signal: the server
     check (refresh + id comparison) decides.
     ------------------------------------------------------------------ */
  /** Clears everything from the previous account out of this page. */
  function closeForOtherAccount(message) {
    clearTimeout(autosaveTimer);
    state = blankState();
    state.dirty = false;
    view = 'wizard';
    saved.items = null;
    hideAiErrors();
    fillForm();
    setTab(false);
    account.user = null;
    account.started = false;
    setAccount('switched', message);
    render();
  }

  /**
   * Asks the server who is signed in now: 'same' | 'other' | 'loggedout' |
   * 'offline'. A failed refresh while the server is reachable means the
   * session really ended; a failed refresh while offline proves nothing.
   */
  function verifySession() {
    var who = account.user && account.user.id;
    if (typeof refreshSession !== 'function') return Promise.resolve('offline');
    return refreshSession().then(function (ok) {
      if (ok) return sessionUserId() === who ? 'same' : 'other';
      return apiRequest('/health').then(function () { return 'loggedout'; }, function () { return 'offline'; });
    }, function () { return 'offline'; });
  }

  function onSessionCheck(result) {
    if (result === 'same') { if (account.state !== 'ready') setAccount('ready'); return; }
    if (result === 'offline') { if (account.state === 'ready') setAccount('offline'); return; }
    closeForOtherAccount(result === 'loggedout' ? SESSION_ENDED_MSG : undefined);
  }

  var checkingSession = false;
  window.addEventListener('storage', function (e) {
    if (!account.user) { if (e.key === 'loggedIn' && account.state === 'auth') initAccount(); return; }
    if (e.key !== null && e.key !== 'loggedIn' && e.key !== 'userEmail' && e.key !== 'userRole') return;
    if (checkingSession) return;
    checkingSession = true;
    // Hide the content until the server confirms the same customer.
    var layout = document.querySelector('.lna-layout');
    if (layout) { layout.inert = true; layout.classList.add('is-locked'); }
    verifySession().then(function (r) {
      checkingSession = false;
      if (layout && r !== 'loggedout' && r !== 'other') { layout.inert = isLocked(account.state); layout.classList.toggle('is-locked', isLocked(account.state)); }
      onSessionCheck(r);
    });
  });

  // Coming back to this tab (or every minute while visible): confirm with
  // the server that the same customer is still signed in. This catches a
  // logout or an account switch done in another tab or window.
  var lastSessionCheck = 0;
  function periodicCheck(force) {
    if (!account.user || checkingSession || aiBusy) return;
    if (account.state !== 'ready' && account.state !== 'offline') return;
    if (!force && Date.now() - lastSessionCheck < 15000) return;
    lastSessionCheck = Date.now();
    checkingSession = true;
    verifySession().then(function (r) {
      checkingSession = false;
      onSessionCheck(r);
      if (r === 'same' && hasUnsaved()) saveNow().catch(noop);
    });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') periodicCheck(false); });
  window.addEventListener('focus', function () { periodicCheck(false); });
  setInterval(function () { if (document.visibilityState === 'visible') periodicCheck(true); }, 60000);

  // Back/forward cache: the page can come back after a logout with old
  // content in memory. Hide it and re-check the session first.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted || !account.user) return;
    var layout = document.querySelector('.lna-layout');
    if (layout) { layout.inert = true; layout.classList.add('is-locked'); }
    verifySession().then(function (r) {
      // Offline after bfcache restore: keep it hidden until a real check succeeds.
      if (r === 'offline') { closeForOtherAccount('Legal Lens could not confirm your session, so the notice was closed for privacy. Reload the page to open it again.'); return; }
      onSessionCheck(r);
      if (r === 'same') setAccount('ready');
    });
  });

  /* ------------------------------------------------------------------
     DRAFTS LEFT IN localStorage BY THE EARLIER VERSION OF THIS PAGE
     Keys: legalLens.legalNoticeAssistant.v1 (anonymous working copy) and
     legalLens.legalNoticeAssistant.v1.u.<id> (pre-release per-account
     copy). Nothing with unsaved work is deleted without the customer
     choosing to; nothing from them is displayed except the save date.
     ------------------------------------------------------------------ */
  var legacy = { key: '', data: null, confirm: false, busy: false, error: '' };

  function legacyKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k === STORAGE_KEY || (k && k.indexOf(STORAGE_KEY + '.u.') === 0)) out.push(k);
      }
    } catch (e) { /* storage blocked */ }
    return out;
  }
  function readLegacy(k) {
    try { var raw = JSON.parse(localStorage.getItem(k) || 'null'); return raw ? sanitizeState(raw) : null; } catch (e) { return null; }
  }
  function removeKey(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  /** Removes legacy copies that hold no unsaved work; picks one to offer. */
  function scanLegacy() {
    legacy.key = ''; legacy.data = null;
    legacyKeys().forEach(function (k) {
      var d = readLegacy(k);
      var ownerId = k === STORAGE_KEY ? '' : k.slice((STORAGE_KEY + '.u.').length);
      // Nothing to lose: blank, unreadable, or already saved in the account.
      if (!d || isBlank(d) || (d.serverId && !d.dirty)) { removeKey(k); return; }
      // Another account's unsaved copy: never shown here.
      if (ownerId && (!account.user || ownerId !== account.user.id)) return;
      if (!legacy.key) { legacy.key = k; legacy.data = d; }
    });
    renderLegacy();
  }

  function renderLegacy() {
    var box = $('lnaLegacy');
    if (!box) return;
    clear(box);
    if (!legacy.key || account.state === 'loading' || account.state === 'switched') { box.hidden = true; return; }
    var when = legacy.data && legacy.data.updatedAt ? ' (last changed ' + shortDateTime(legacy.data.updatedAt) + ')' : '';
    var p = el('p');
    p.appendChild(el('strong', null, 'A notice draft from an earlier version of this page is stored in this browser' + when + '.'));
    p.appendChild(document.createTextNode(canSync()
      ? ' For your privacy, notices are now kept only in your account. Move it to your account (it is then removed from this browser), or delete it.'
      : ' For your privacy, notices are now kept only in customer accounts. Log in to move it to your account, or delete it from this browser.'));
    box.appendChild(p);
    var acts = el('div', 'lna-confirm-actions');
    if (legacy.confirm) {
      p.appendChild(el('span', 'lna-legacy-warn', ' Delete it permanently? Its contents have not been saved anywhere else.'));
      var no = el('button', 'lna-btn lna-btn-outline lna-btn-sm', 'Keep it'); no.type = 'button'; no.id = 'lnaLegacyKeep';
      no.addEventListener('click', function () { legacy.confirm = false; renderLegacy(); });
      var yes = el('button', 'lna-btn lna-btn-dark lna-btn-sm', 'Delete permanently'); yes.type = 'button'; yes.id = 'lnaLegacyDeleteConfirm';
      yes.addEventListener('click', function () {
        removeKey(legacy.key); legacy.confirm = false;
        scanLegacy();
        live('The old draft was deleted from this browser.');
      });
      acts.appendChild(no); acts.appendChild(yes);
    } else {
      if (canSync()) {
        var mv = el('button', 'lna-btn lna-btn-dark lna-btn-sm', 'Move to my account'); mv.type = 'button'; mv.id = 'lnaLegacyMove';
        if (legacy.busy) { mv.disabled = true; mv.setAttribute('aria-busy', 'true'); }
        mv.addEventListener('click', moveLegacy);
        acts.appendChild(mv);
      } else if (account.state === 'auth') {
        var li = el('button', 'lna-btn lna-btn-dark lna-btn-sm', 'Log in'); li.type = 'button';
        li.addEventListener('click', function () { goToLogin(); });
        acts.appendChild(li);
      }
      var del = el('button', 'lna-btn lna-btn-outline lna-btn-sm', 'Delete it'); del.type = 'button'; del.id = 'lnaLegacyDelete';
      del.addEventListener('click', function () { legacy.confirm = true; renderLegacy(); var k = $('lnaLegacyKeep'); if (k) k.focus(); });
      acts.appendChild(del);
    }
    box.appendChild(acts);
    if (legacy.error) { var er = el('p', 'lna-error', legacy.error); er.setAttribute('role', 'alert'); box.appendChild(er); }
    box.hidden = false;
  }

  /** Saves the old browser draft as a NEW notice in the account, then removes it locally. */
  function moveLegacy() {
    if (!canSync() || !legacy.key) return;
    var d = legacy.data, key = legacy.key;
    legacy.busy = true; legacy.error = ''; renderLegacy();
    var keep = state;
    state = d;                      // build the payload from the old draft
    var payload = toServerPayload();
    state = keep;
    payload.clientId = newClientId();
    enqueue(function () { return noticeApi('', { method: 'POST', body: payload }); }).then(function (res) {
      removeKey(key);
      legacy.busy = false;
      var n = res && res.data && res.data.notice;
      if (n && !state.serverId && isBlank()) {
        // Nothing open: show the moved draft.
        state = fromServer(n);
        writeLocal(); fillForm();
        var s = state.step; while (s > 1 && !canOpen(s)) s--;
        state.step = s;
        render();
        setSaveStatus('saved');
      }
      scanLegacy();
      live('The old draft was saved to your account and removed from this browser. It is listed in My saved notices.');
    }, function (err) {
      legacy.busy = false;
      legacy.error = 'It was not moved: ' + friendlyError(err, 'moving the draft') + ' It is still stored in this browser.';
      renderLegacy();
    });
  }

  /* ------------------------------------------------------------------
     INIT — the account first; content comes only from the server
     ------------------------------------------------------------------ */
  /** Opens the notice that was open last time (only its id is remembered). */
  function syncOnStart() {
    var ptr = readPointer();
    if (!ptr) { render(); return Promise.resolve(); }
    return noticeApi('/' + ptr.id).then(function (res) {
      if (!isBlank()) return; // the customer already started typing a new one
      state = fromServer(res.data.notice);
      state.step = ptr.step;
      writeLocal();
      fillForm();
      render();
      setSaveStatus('saved');
    }, function (err) {
      if (err && err.statusCode === 404) { try { localStorage.removeItem(pointerKey()); } catch (e) { /* ignore */ } return; }
      setSaveStatus('error', friendlyError(err, 'loading your notice'));
    });
  }

  /** "Try again" after the session ended mid-work: same customer only. */
  function recheckSession() {
    var who = account.user && account.user.id;
    if (!who) { initAccount(); return; }
    verifySession().then(function (r) {
      if (r === 'offline') { setAccount('offline'); return; }
      if (r !== 'same') { onSessionCheck(r); return; }
      setAccount('ready');
      if (hasUnsaved()) saveNow().catch(noop);
    });
  }

  function initAccount() {
    if (account.started && account.user && account.state === 'offline') { recheckSession(); return; }
    if (!authReady()) { setAccount('offline'); return; }
    setAccount('loading');
    getCustomerSession().then(function (user) {
      if (!user) {
        if (typeof getCurrentUser === 'function' && getCurrentUser()) { setAccount('role'); scanLegacy(); return null; }
        return apiRequest('/health').then(function () { setAccount('auth'); scanLegacy(); }, function () { setAccount('offline'); });
      }
      var id = str(user.id);
      if (!/^[a-f0-9]{24}$/.test(id)) { setAccount('offline'); return null; }
      account.user = { id: id };
      account.started = true;
      setAccount('ready');
      scanLegacy();
      return syncOnStart();
    }).catch(function () { setAccount('offline'); });
  }

  // Start blank: nothing is read from browser storage. The page is locked
  // until the account is known.
  state = blankState();
  fillForm();
  render();
  initAccount();
})();
