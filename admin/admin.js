/* =====================================================================
   CASEONE Admin — application (views and navigation)
   The server enforces every permission; this file only hides what the
   signed-in admin cannot use and explains refusals clearly.
   ===================================================================== */
(function () {
  'use strict';

  var A = window.LLAdminApi;
  var U = window.LLAdminUI;
  var h = U.h;
  var $ = U.$;

  var state = { me: null, catalog: {}, nav: { lawyersPending: 0, contactOpen: 0, verificationsAwaiting: 0, aidAwaiting: 0, reportsOpen: 0 } };

  // ------------------------------------------------------------------ permissions
  function isSuper() { return !!state.me && state.me.level === 'super_admin'; }
  function can(p) {
    if (!state.me) return false;
    if (p === 'super') return isSuper();
    if (!p) return true;
    return isSuper() || state.me.permissions.indexOf(p) >= 0;
  }

  var NAV = [
    { group: 'Dashboard' },
    { id: 'overview', label: 'Overview', icon: 'overview', perm: null },
    { group: 'Operations' },
    { id: 'users', label: 'Users', icon: 'users', perm: 'users:view' },
    { id: 'verifications', label: 'Lawyer verification', icon: 'verify', perm: 'lawyers:view', count: 'verificationsAwaiting' },
    { id: 'lawyers', label: 'Lawyers', icon: 'lawyers', perm: 'lawyers:view' },
    { id: 'freeaid', label: 'Free assistance', icon: 'aid', perm: 'aid:view', count: 'aidAwaiting' },
    { id: 'consultations', label: 'Consultations', icon: 'consultations', perm: 'consultations:view' },
    { id: 'reports', label: 'Profile reports', icon: 'info', perm: 'lawyers:view', count: 'reportsOpen' },
    { id: 'contact', label: 'Contact messages', icon: 'contact', perm: 'contact:view', count: 'contactOpen' },
    { group: 'Governance' },
    { id: 'audit', label: 'Audit log', icon: 'audit', perm: 'audit:view' },
    { id: 'system', label: 'System health', icon: 'system', perm: 'system:view' },
    { id: 'admins', label: 'Admin management', icon: 'admins', perm: 'super' }
  ];

  // ------------------------------------------------------------------ errors
  function isPwdRequired(err) { return err && err.statusCode === 403 && /temporary password/i.test(err.message || ''); }

  function friendly(err) {
    var code = err && err.statusCode;
    if (!code) return 'Could not reach CASEONE. Check your connection and try again.';
    if (code === 401) return 'Your admin session has ended. Please sign in again.';
    if (code === 403) return (err && err.message) || 'Your admin account does not have permission for this.';
    if (code === 404) return (err && err.message) || 'Not found. It may have been removed.';
    if (code === 409 || code === 422 || code === 400) return (err && err.message) || 'Please check the details and try again.';
    if (code === 429) return (err && err.message) || 'Too many requests. Please wait a moment.';
    return 'Something went wrong on the server. Please try again.';
  }

  /** Session-level reactions; returns true if handled (caller should stop). */
  function handleAuthError(err) {
    if (err && err.statusCode === 401) { showLogin('Your admin session has ended. Please sign in again.'); return true; }
    if (isPwdRequired(err)) { showPwd(); return true; }
    return false;
  }

  function errorState(err, retry) {
    if (handleAuthError(err)) return h('div');
    var forbidden = err && err.statusCode === 403;
    return U.stateBox('error', forbidden ? 'You don’t have access to this section' : 'Could not load this section', friendly(err), retry ? ['Try again', retry] : null);
  }

  // ------------------------------------------------------------------ screens
  function showOnly(id) {
    ['llaBoot', 'llaLogin', 'llaPwd', 'llaApp'].forEach(function (x) { $(x).hidden = x !== id; });
  }

  function showLogin(message, notice) {
    state.me = null;
    U.closeDrawer();
    showOnly('llaLogin');
    var e = $('llaLoginError');
    e.textContent = message || '';
    e.hidden = !message;
    var n = $('llaLoginNotice');
    n.textContent = (notice && notice.text) || '';
    n.className = 'lla-form-notice' + (notice && notice.warn ? ' is-warn' : '');
    n.setAttribute('role', notice && notice.warn ? 'alert' : 'status');
    n.hidden = !(notice && notice.text);
    $('llaPassword').value = '';
    setTimeout(function () { $('llaEmail').focus(); }, 0);
  }

  function showPwd() {
    U.closeDrawer();
    showOnly('llaPwd');
    ['llaPwdCurrent', 'llaPwdNew', 'llaPwdNew2'].forEach(function (id) { $(id).value = ''; });
    $('llaPwdError').hidden = true;
    setTimeout(function () { $('llaPwdCurrent').focus(); }, 0);
  }

  /** Removes every trace of the signed-in console from the page (no admin data left in the DOM). */
  function leaveConsole() {
    state.me = null;
    state.catalog = {};
    state.nav = { lawyersPending: 0, contactOpen: 0, verificationsAwaiting: 0, aidAwaiting: 0, reportsOpen: 0 };
    U.closeModal();
    U.closeDrawer();
    closeSidebar();
    ['llaView', 'llaNav', 'llaSideUser', 'llaAdminChip'].forEach(function (id) { U.clear($(id)); });
    document.title = 'CASEONE Admin';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  $('llaLoginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('llaLoginNotice').hidden = true;
    var email = $('llaEmail').value.trim(), pw = $('llaPassword').value;
    var err = $('llaLoginError');
    err.hidden = true;
    if (!email || !pw) { err.textContent = 'Enter your email and password.'; err.hidden = false; return; }
    var btn = $('llaLoginBtn');
    U.busy(btn, true);
    A.login(email, pw).then(function (data) {
      U.busy(btn, false);
      if (data.passwordChangeRequired) { loadMe(); return; }
      loadMe();
    }, function (ex) {
      U.busy(btn, false);
      err.textContent = ex && ex.statusCode === 401 ? 'Incorrect email or password, or this is not an admin account.'
        : ex && ex.statusCode === 403 ? (ex.message || 'This admin account has been deactivated.')
        : friendly(ex);
      err.hidden = false;
      $('llaPassword').value = '';
      $('llaPassword').focus();
    });
  });

  $('llaPwdForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var cur = $('llaPwdCurrent').value, n1 = $('llaPwdNew').value, n2 = $('llaPwdNew2').value;
    var err = $('llaPwdError');
    err.hidden = true;
    var show = function (m) { err.textContent = m; err.hidden = false; };
    if (!cur || !n1) return show('Enter your current password and a new password.');
    if (n1 !== n2) return show('The new passwords do not match.');
    var btn = $('llaPwdBtn');
    U.busy(btn, true);
    A.changePassword(cur, n1).then(function () {
      U.busy(btn, false);
      U.toast('Password changed. Other sessions were signed out.');
      loadMe();
    }, function (ex) {
      U.busy(btn, false);
      if (ex && ex.statusCode === 401) { showLogin('Your session has ended. Please sign in again.'); return; }
      show(friendly(ex));
    });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="logout"]')) {
      var b = e.target.closest('[data-action="logout"]');
      if (b.getAttribute('aria-busy') === 'true') return;
      U.busy(b, true);
      A.logout().then(function (out) {
        U.busy(b, false);
        if (out.result === 'still_signed_in') {
          // Nothing was ended: stay in the console and say so.
          U.toast('Sign-out failed: you are still signed in. ' + (out.message || '') + ' Please try again.', true);
          return;
        }
        leaveConsole();
        if (out.result === 'revoked') {
          showLogin('', { text: 'You have been signed out. All of your admin sessions were ended.' });
        } else {
          showLogin('', { warn: true, text: 'Sign-out could not be fully confirmed. This browser is no longer signed in, but the server did not confirm that your other admin sessions were ended. Close this browser window, then sign in and sign out again when the service is available. If someone else may have access to your account, ask a Super Admin to reset your password.' });
        }
      }, function (ex) {
        U.busy(b, false);
        U.toast((ex && ex.message) || 'Sign-out failed. You are still signed in. Please try again.', true);
      });
    }
  });

  // ------------------------------------------------------------------ boot
  function loadMe() {
    return A.me().then(function (res) {
      state.me = res.data.admin;
      state.catalog = res.data.permissionCatalog || {};
      if (state.me.passwordChangeRequired) { showPwd(); return; }
      startApp();
    }, function (err) {
      if (err && err.statusCode === 403) { showLogin('This page is for CASEONE administrators only.'); return; }
      if (err && err.statusCode === 401) { showLogin(''); return; }
      showLogin(friendly(err));
    });
  }

  function boot() {
    if (!A.ready()) { showLogin('The site configuration could not be loaded. Refresh the page.'); return; }
    A.restore().then(function (user) {
      if (user && user.role === 'admin') return loadMe();
      showLogin(user ? 'You are signed in with a ' + user.role + ' account. Sign in with an admin account to continue.' : '');
      return null;
    });
  }

  // ------------------------------------------------------------------ shell
  function startApp() {
    showOnly('llaApp');
    var me = state.me;
    U.clear($('llaSideUser'));
    U.append($('llaSideUser'), [h('strong', { text: me.name }), me.email]);
    U.clear($('llaAdminChip'));
    U.append($('llaAdminChip'), [isSuper() ? 'Super Admin' : 'Admin']);
    renderNav();
    if (!location.hash) location.replace('#/overview');
    route();
    refreshNavCounts();
  }

  function renderNav() {
    var nav = U.clear($('llaNav'));
    var current = currentView();
    var pendingGroup = null;
    NAV.forEach(function (item) {
      if (item.group) { pendingGroup = item.group; return; }
      if (!can(item.perm)) return;
      if (pendingGroup) { nav.appendChild(h('p', { class: 'lla-nav-group', text: pendingGroup })); pendingGroup = null; }
      var count = item.count ? state.nav[item.count] : 0;
      nav.appendChild(h('a', { href: '#/' + item.id, attrs: { 'aria-current': current === item.id ? 'page' : null }, onclick: closeSidebar }, [
        U.icon(item.icon), h('span', { text: item.label }),
        count ? h('span', { class: 'lla-nav-count', text: count > 99 ? '99+' : String(count), attrs: { 'aria-label': count + ' waiting' } }) : null
      ]));
    });
  }

  function refreshNavCounts() {
    A.get('/overview').then(function (res) {
      state.nav.lawyersPending = res.data.lawyers.pending;
      state.nav.contactOpen = res.data.contact.open;
      state.nav.verificationsAwaiting = res.data.lawyers.verificationsAwaiting || 0;
      state.nav.aidAwaiting = res.data.freeAid ? res.data.freeAid.awaitingReview : 0;
      renderNav();
    }, function () { /* counts are optional */ });
    if (can('lawyers:view')) {
      A.get('/lawyer-reports', { status: 'open', limit: 1 }).then(function (res) {
        state.nav.reportsOpen = (res.data.counts && res.data.counts.open) || 0;
        renderNav();
      }, function () { /* optional */ });
    }
  }

  function currentView() {
    var m = /^#\/([a-z]+)/.exec(location.hash || '');
    return m ? m[1] : 'overview';
  }

  function setTitle(title, sub) {
    $('llaPageTitle').textContent = title;
    $('llaPageSub').textContent = sub || '';
    document.title = title + ' · CASEONE Admin';
  }

  function route() {
    if (!state.me) return;
    U.closeDrawer();
    var id = currentView();
    var item = NAV.filter(function (n) { return n.id === id; })[0];
    var view = VIEWS[id];
    if (!item || !view) { location.replace('#/overview'); return; }
    renderNav();
    var root = U.clear($('llaView'));
    if (!can(item.perm)) {
      setTitle(item.label, '');
      root.appendChild(h('div', { class: 'lla-card' }, U.stateBox('error', 'You don’t have access to this section', 'Ask a Super Admin to grant the required permission.')));
      return;
    }
    setTitle(view.title, view.sub);
    view.render(root);
    $('llaView').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  $('llaRefresh').addEventListener('click', function () { route(); refreshNavCounts(); });

  // mobile sidebar
  function openSidebar() { $('llaSidebar').classList.add('is-open'); $('llaScrim').hidden = false; $('llaMenuBtn').setAttribute('aria-expanded', 'true'); }
  function closeSidebar() { $('llaSidebar').classList.remove('is-open'); $('llaScrim').hidden = true; $('llaMenuBtn').setAttribute('aria-expanded', 'false'); }
  $('llaMenuBtn').addEventListener('click', openSidebar);
  $('llaScrim').addEventListener('click', closeSidebar);

  // ------------------------------------------------------------------ shared bits
  function card(title, sub, body, extra) {
    return h('section', { class: 'lla-card' }, [
      h('div', { class: 'lla-card-head' }, [h('div', null, [h('h2', { class: 'lla-card-title', text: title }), sub ? h('p', { class: 'lla-card-sub', text: sub }) : null]), extra || null]),
      body
    ]);
  }
  function notice(text, warn) {
    return h('div', { class: 'lla-notice' + (warn ? ' is-warn' : '') }, [U.icon('info'), h('span', { text: text })]);
  }
  function searchBox(value, placeholder, onInput) {
    var inp = U.input({ type: 'search', value: value || '', placeholder: placeholder, attrs: { 'aria-label': placeholder, maxlength: 120 } });
    inp.addEventListener('input', U.debounce(function () { onInput(inp.value.trim()); }, 350));
    return h('div', { class: 'lla-search' }, [U.icon('search'), inp]);
  }
  function dl(rows) {
    var out = h('dl', { class: 'lla-dl' });
    rows.forEach(function (r) {
      if (!r) return;
      out.appendChild(h('dt', { text: r[0] }));
      out.appendChild(h('dd', null, r[1] === undefined || r[1] === null || r[1] === '' ? '—' : r[1]));
    });
    return out;
  }
  function tabs(items, active, onPick) {
    return h('div', { class: 'lla-tabs', attrs: { role: 'group', 'aria-label': 'Filter' } }, items.map(function (t) {
      return h('button', { class: 'lla-tab', type: 'button', attrs: { 'aria-pressed': t[0] === active ? 'true' : 'false' }, onclick: function () { onPick(t[0]); } }, [
        t[1], t[2] !== undefined && t[2] !== null ? h('span', { class: 'lla-tab-count', text: U.num(t[2]) }) : null
      ]);
    }));
  }

  /**
   * Generic list page: toolbar (built by the view), table + pager.
   * load(params) → Promise<pageResult>; columns; onRow.
   */
  function listPage(root, cfg) {
    var top = h('div');
    var tableCard = h('section', { class: 'lla-card lla-table-card' });
    root.appendChild(top);
    root.appendChild(tableCard);
    var last = null;
    function draw(loading, data, err) {
      U.clear(tableCard);
      if (err) { tableCard.appendChild(errorState(err, refresh)); return; }
      tableCard.appendChild(h('div', { class: 'lla-table-scroll' }, U.table({ columns: cfg.columns, rows: data ? data.items : [], loading: loading, onRowClick: cfg.onRow, empty: cfg.empty })));
      if (data && !loading) tableCard.appendChild(U.pager({ page: data.page, totalPages: data.totalPages, total: data.total, limit: data.limit, onPage: function (p) { cfg.query.page = p; refresh(); } }));
    }
    function refresh() {
      draw(true);
      var mine = {};
      last = mine;
      return cfg.load(cfg.query).then(function (res) {
        if (last !== mine) return;
        var data = res.data;
        if (cfg.onData) cfg.onData(data, top);
        draw(false, data);
      }, function (err) {
        if (last !== mine) return;
        draw(false, null, err);
      });
    }
    if (cfg.toolbar) cfg.toolbar(top, function () { cfg.query.page = 1; refresh(); });
    refresh();
    return { refresh: refresh, top: top };
  }

  function textModal(o) {
    var ta = U.textarea({ attrs: { maxlength: o.max || 300, rows: 3, placeholder: o.placeholder || '' } });
    var body = [];
    if (o.text) body.push(h('p', { text: o.text }));
    body.push(U.field(o.label, ta, o.hint));
    U.modal({
      title: o.title, body: body, okText: o.okText, tone: o.tone,
      onOk: function () {
        var v = ta.value.trim();
        if (o.required && v.length < 3) throw new Error(o.label + ' must be at least 3 characters.');
        return o.submit(v);
      }
    });
  }

  function apiAction(promise, successMsg) {
    return promise.then(function (res) {
      U.toast((res && res.message) || successMsg);
      refreshNavCounts();
      return res;
    }, function (err) {
      if (handleAuthError(err)) { U.closeModal(); throw new Error('Session ended.'); }
      throw new Error(friendly(err));
    });
  }

  // ------------------------------------------------------------------ chart
  /** Stacked daily bars (customers + lawyers), with hover tooltip, legend and table view. */
  function signupChart(days) {
    var wrap = h('div', { class: 'lla-chart' });
    var legend = h('div', { class: 'lla-legend', attrs: { 'aria-hidden': 'false' } }, [
      h('span', null, [h('i', { attrs: { style: 'background:var(--lla-series-1)' } }), 'Customers']),
      h('span', null, [h('i', { attrs: { style: 'background:var(--lla-series-2)' } }), 'Lawyers'])
    ]);
    var tableBox = h('div', { hidden: true });
    var toggle = h('button', { class: 'lla-link-btn', type: 'button', text: 'View as table', attrs: { 'aria-expanded': 'false' } });
    toggle.addEventListener('click', function () {
      var show = tableBox.hidden;
      tableBox.hidden = !show; wrap.hidden = show;
      toggle.textContent = show ? 'View as chart' : 'View as table';
      toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
    });
    U.append(tableBox, h('div', { class: 'lla-table-scroll' }, U.table({
      columns: [
        { label: 'Day', render: function (d) { return U.date(d.day + 'T12:00:00+05:30'); } },
        { label: 'Customers', className: 'lla-cell-num', render: function (d) { return U.num(d.customers); } },
        { label: 'Lawyers', className: 'lla-cell-num', render: function (d) { return U.num(d.lawyers); } }
      ],
      rows: days.slice().reverse()
    })));
    var tip = h('div', { class: 'lla-tooltip', hidden: true });
    wrap.appendChild(tip);

    function draw() {
      Array.prototype.slice.call(wrap.querySelectorAll('svg')).forEach(function (s) { s.remove(); });
      var W = Math.max(280, wrap.clientWidth || 640), H = 220;
      var m = { l: 30, r: 6, t: 10, b: 26 };
      var pw = W - m.l - m.r, ph = H - m.t - m.b;
      var max = Math.max(1, Math.max.apply(null, days.map(function (d) { return d.customers + d.lawyers; })));
      var step = max <= 4 ? 1 : Math.ceil(max / 4 / (max > 20 ? 5 : 1)) * (max > 20 ? 5 : 1);
      var top = Math.ceil(max / step) * step;
      var y = function (v) { return m.t + ph - (v / top) * ph; };
      var band = pw / days.length;
      var bw = Math.max(3, Math.min(24, band * 0.62));
      var s = U.svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'New sign-ups per day for the last 30 days, customers and lawyers. Use "View as table" for the numbers.' });
      for (var v = 0; v <= top; v += step) {
        s.appendChild(U.svg('line', { class: 'lla-grid-line', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
        var t = U.svg('text', { class: 'lla-axis-text', x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' });
        t.textContent = String(v);
        s.appendChild(t);
      }
      var rounded = function (x, y0, w, hgt, r) {
        r = Math.min(r, hgt, w / 2);
        return 'M' + x + ',' + (y0 + hgt) + 'V' + (y0 + r) + 'Q' + x + ',' + y0 + ' ' + (x + r) + ',' + y0 + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y0 + ' ' + (x + w) + ',' + (y0 + r) + 'V' + (y0 + hgt) + 'Z';
      };
      days.forEach(function (d, i) {
        var cx = m.l + band * i + band / 2;
        var x = cx - bw / 2;
        var g = U.svg('g', {});
        var base = y(0);
        var segs = [['customers', 'var(--lla-series-1)'], ['lawyers', 'var(--lla-series-2)']].filter(function (sg) { return d[sg[0]] > 0; });
        var cum = 0;
        segs.forEach(function (sg, k) {
          var v0 = cum, v1 = cum + d[sg[0]];
          cum = v1;
          var yTop = y(v1), yBot = y(v0) - (k > 0 ? 2 : 0); // 2px surface gap between segments
          var hgt = Math.max(1, yBot - yTop);
          var isTop = k === segs.length - 1;
          g.appendChild(isTop ? U.svg('path', { d: rounded(x, yTop, bw, hgt, 4), fill: sg[1] }) : U.svg('rect', { x: x, y: yTop, width: bw, height: hgt, fill: sg[1] }));
        });
        var hit = U.svg('rect', { class: 'lla-bar-hit', x: m.l + band * i, y: m.t, width: band, height: ph + 2 });
        hit.addEventListener('mouseenter', function () {
          g.setAttribute('class', 'is-hover');
          U.clear(tip);
          U.append(tip, [h('strong', { text: U.date(d.day + 'T12:00:00+05:30') }), h('br'),
            h('i', { attrs: { style: 'background:var(--lla-series-1)' } }), 'Customers: ' + d.customers, h('br'),
            h('i', { attrs: { style: 'background:var(--lla-series-2)' } }), 'Lawyers: ' + d.lawyers]);
          tip.hidden = false;
          tip.style.left = (cx / W * 100) + '%';
          tip.style.top = (y(d.customers + d.lawyers) / H * 220) + 'px';
        });
        hit.addEventListener('mouseleave', function () { g.removeAttribute('class'); tip.hidden = true; });
        s.appendChild(g);
        s.appendChild(hit);
        if (i % 5 === 4 || i === days.length - 1) {
          var lt = U.svg('text', { class: 'lla-axis-text', x: cx, y: H - 6, 'text-anchor': 'middle' });
          var dd = new Date(d.day + 'T12:00:00+05:30');
          lt.textContent = dd.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dd.getMonth()];
          s.appendChild(lt);
        }
      });
      s.appendChild(U.svg('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: 'var(--lla-line)', 'stroke-width': 1 }));
      wrap.insertBefore(s, tip);
    }
    var total = days.reduce(function (a, d) { return a + d.customers + d.lawyers; }, 0);
    var out = h('div', null, [
      h('div', { class: 'lla-toolbar' }, [legend, h('span', { class: 'lla-muted', text: U.num(total) + ' in 30 days', attrs: { style: 'margin-left:auto;font-size:12.5px' } }), toggle]),
      wrap, tableBox
    ]);
    setTimeout(draw, 0);
    var onResize = U.debounce(function () { if (document.body.contains(wrap)) draw(); else window.removeEventListener('resize', onResize); }, 150);
    window.addEventListener('resize', onResize);
    return out;
  }

  // ------------------------------------------------------------------ views
  var VIEWS = {};

  // ---------------- Overview
  VIEWS.overview = {
    title: 'Overview',
    sub: 'Live figures from the CASEONE database',
    render: function (root) {
      var box = h('div');
      root.appendChild(box);
      box.appendChild(h('div', { class: 'lla-card' }, U.stateBox('loading', 'Loading overview…')));
      A.get('/overview').then(function (res) {
        var d = res.data;
        state.nav.lawyersPending = d.lawyers.pending;
        state.nav.contactOpen = d.contact.open;
        renderNav();
        U.clear(box);
        var kpi = function (label, value, foot, link, attention) {
          return h('div', { class: 'lla-card lla-kpi' + (attention ? ' is-attention' : '') }, [
            h('span', { class: 'lla-kpi-label', text: label }),
            h('span', { class: 'lla-kpi-value', text: U.num(value) }),
            h('span', { class: 'lla-kpi-foot', text: foot }),
            link ? h('a', { class: 'lla-kpi-link', href: link, attrs: { 'aria-label': label + ': open' } }) : null
          ]);
        };
        box.appendChild(h('div', { class: 'lla-grid lla-kpis' }, [
          kpi('Customers', d.users.customers, '+' + U.num(d.users.new30) + ' sign-ups (all) in 30 days', can('users:view') ? '#/users' : null),
          kpi('Lawyers', d.users.lawyers, U.num(d.lawyers.publicDirectory) + ' in public directory', can('lawyers:view') ? '#/lawyers' : null),
          kpi('Pending verification', d.lawyers.pending, d.lawyers.pending ? 'Lawyers waiting for review' : 'Nothing waiting', can('lawyers:view') ? '#/lawyers' : null, d.lawyers.pending > 0),
          kpi('Consultations (30 days)', d.consultations.last30, U.num(d.consultations.total) + ' in total', can('consultations:view') ? '#/consultations' : null),
          kpi('Open contact messages', d.contact.open, d.contact.emailIssues ? U.num(d.contact.emailIssues) + ' with email delivery issues' : 'Email delivery OK', can('contact:view') ? '#/contact' : null, d.contact.new > 0),
          kpi('Deactivated accounts', d.users.deactivated, U.num(d.users.admins) + ' admin accounts', can('users:view') ? '#/users' : null)
        ]));

        var attention = [];
        if (d.lawyers.pending) attention.push([U.num(d.lawyers.pending) + ' lawyer profile(s) waiting for verification', can('lawyers:view') ? '#/lawyers' : null]);
        if (d.contact.new) attention.push([U.num(d.contact.new) + ' new contact message(s)', can('contact:view') ? '#/contact' : null]);
        if (d.contact.emailIssues) attention.push([U.num(d.contact.emailIssues) + ' contact message(s) whose notification email failed', can('contact:view') ? '#/contact' : null]);
        var attentionList = attention.length ? h('ul', { class: 'lla-list' }, attention.map(function (a) {
          return h('li', null, [h('span', { text: a[0] }), a[1] ? h('a', { class: 'lla-link-btn', href: a[1], text: 'Open' }) : null]);
        })) : U.stateBox('empty', 'All clear', 'Nothing needs attention right now.');

        box.appendChild(h('div', { class: 'lla-grid lla-cols-2 lla-section-gap' }, [
          card('New sign-ups', 'Customers and lawyers per day, last 30 days', signupChart(d.signups)),
          card('Needs attention', null, attentionList)
        ]));

        var meterList = function (obj, labels) {
          var total = Object.keys(obj).reduce(function (a, k) { return a + (obj[k] || 0); }, 0) || 1;
          return h('ul', { class: 'lla-list' }, Object.keys(labels).map(function (k) {
            return h('li', null, [h('span', { text: labels[k] }), h('span', { class: 'lla-meter', attrs: { 'aria-hidden': 'true' } }, h('span', { attrs: { style: 'width:' + Math.round((obj[k] || 0) / total * 100) + '%' } })), h('span', { class: 'lla-num', text: U.num(obj[k] || 0) })]);
          }));
        };
        var u = d.usage;
        box.appendChild(h('div', { class: 'lla-grid lla-kpis lla-section-gap', attrs: { style: 'grid-template-columns:repeat(auto-fit,minmax(280px,1fr))' } }, [
          card('Lawyer verification', null, meterList({ pending: d.lawyers.pending, verified: d.lawyers.verified, rejected: d.lawyers.rejected }, { pending: 'Pending', verified: 'Verified', rejected: 'Rejected' })),
          card('Consultations by status', null, meterList(d.consultations.byStatus, { pending: 'Pending', accepted: 'Accepted', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled' })),
          card('Feature usage', 'Record counts only — the content is private', h('ul', { class: 'lla-list' }, [
            ['Legal notices', u.legalNotices], ['AI guidance chats', u.guidanceConversations], ['Smart Case Builder cases', u.cases], ['Legal Tracker events', u.trackerEvents], ['Legal drafts', u.drafts]
          ].map(function (r) { return h('li', null, [h('span', { text: r[0] }), h('span', { class: 'lla-num', text: U.num(r[1].total) + '  ·  +' + U.num(r[1].last30) + ' in 30 d' })]); })))
        ]));

        if (d.recentActivity) {
          box.appendChild(h('div', { class: 'lla-section-gap' }, card('Recent admin activity', null, d.recentActivity.length ? h('ul', { class: 'lla-list' }, d.recentActivity.map(function (e) {
            return h('li', null, [h('span', null, [h('strong', { text: e.actor.name || e.actor.email || 'System' }), ' — ' + (e.summary || e.action)]), h('span', { class: 'lla-muted', text: U.relative(e.createdAt) })]);
          })) : U.stateBox('empty', 'No activity yet'), can('audit:view') ? h('a', { class: 'lla-link-btn', href: '#/audit', text: 'Full audit log' }) : null)));
        }
        box.appendChild(h('p', { class: 'lla-hint', text: 'Updated ' + U.dateTime(d.generatedAt) }));
      }, function (err) {
        U.clear(box);
        box.appendChild(h('div', { class: 'lla-card' }, errorState(err, function () { route(); })));
      });
    }
  };

  // ---------------- Users
  var usersQuery = { page: 1, limit: 20, search: '', role: 'all', status: 'all', sort: 'newest' };
  var usersList = null;
  function statusBadge(active) { return active ? U.badge('Active', 'good') : U.badge('Deactivated', 'bad'); }
  function roleBadge(role) { return U.badge(role === 'lawyer' ? 'Lawyer' : 'Customer', 'plain is-info'); }
  function verificationBadge(s) { return s === 'verified' ? U.badge('Verified', 'good') : s === 'rejected' ? U.badge('Rejected', 'bad') : U.badge('Pending', 'warn'); }

  VIEWS.users = {
    title: 'Users',
    sub: 'Customer and lawyer accounts',
    render: function (root) {
      usersList = listPage(root, {
        query: usersQuery,
        toolbar: function (top, reload) {
          top.appendChild(h('div', { class: 'lla-toolbar' }, [
            searchBox(usersQuery.search, 'Search name, email or phone', function (v) { usersQuery.search = v; reload(); }),
            U.select([['all', 'All roles'], ['customer', 'Customers'], ['lawyer', 'Lawyers']], usersQuery.role, { attrs: { 'aria-label': 'Role' }, onchange: function (e) { usersQuery.role = e.target.value; reload(); } }),
            U.select([['all', 'Any status'], ['active', 'Active'], ['deactivated', 'Deactivated']], usersQuery.status, { attrs: { 'aria-label': 'Status' }, onchange: function (e) { usersQuery.status = e.target.value; reload(); } }),
            U.select([['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A–Z'], ['lastLogin', 'Recent login']], usersQuery.sort, { attrs: { 'aria-label': 'Sort' }, onchange: function (e) { usersQuery.sort = e.target.value; reload(); } })
          ]));
        },
        load: function (q) { return A.get('/users', q); },
        columns: [
          { label: 'User', render: function (u) { return h('div', null, [h('div', { class: 'lla-cell-main', text: u.name }), h('div', { class: 'lla-cell-sub', text: u.email })]); } },
          { label: 'Role', render: function (u) { return h('div', { class: 'lla-chips' }, [roleBadge(u.role), u.lawyer ? verificationBadge(u.lawyer.verificationStatus) : null]); } },
          { label: 'Status', render: function (u) { return statusBadge(u.isActive); } },
          { label: 'Joined', className: 'lla-cell-num', render: function (u) { return U.date(u.createdAt); } },
          { label: 'Last login', className: 'lla-cell-num', render: function (u) { return U.relative(u.lastLoginAt); } },
          { label: '', className: 'lla-cell-actions', render: function (u) { return h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'View', attrs: { 'aria-label': 'View ' + u.name }, onclick: function () { openUser(u.id); } }); } }
        ],
        onRow: function (u) { openUser(u.id); },
        empty: ['No users found', 'Try a different search or filter.']
      });
    }
  };

  function openUser(id) {
    U.openDrawer('User details', U.stateBox('loading', 'Loading…'));
    A.get('/users/' + encodeURIComponent(id)).then(function (res) {
      var d = res.data, u = d.user;
      var body = [];
      body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [roleBadge(u.role), statusBadge(u.isActive), u.lawyer ? verificationBadge(u.lawyer.verificationStatus) : null]));
      if (!u.isActive && u.deactivation) {
        body.push(notice('Deactivated ' + U.dateTime(u.deactivation.at) + (u.deactivatedBy ? ' by ' + u.deactivatedBy.name : '') + '. Reason: ' + (u.deactivation.reason || '—'), true));
      }
      body.push(dl([
        ['Name', u.name], ['Email', u.email], ['Phone', u.phone], ['Account created', U.dateTime(u.createdAt)],
        ['Last login', u.lastLoginAt ? U.dateTime(u.lastLoginAt) : 'Never'], ['User ID', u.id]
      ]));
      if (d.lawyerProfile) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Lawyer profile' }));
        body.push(dl([
          ['Bar registration', d.lawyerProfile.barNumber], ['Location', d.lawyerProfile.location],
          ['Public directory', u.lawyer && u.lawyer.isPublished && u.lawyer.verificationStatus === 'verified' && u.isActive ? 'Visible' : 'Hidden'],
          ['Open in Lawyers', can('lawyers:view') ? h('button', { class: 'lla-link-btn', type: 'button', text: 'View verification details', onclick: function () { openLawyer(d.lawyerProfile.id); } }) : '—']
        ]));
      }
      body.push(h('h3', { class: 'lla-sub-title', text: 'Activity (counts only)' }));
      var labels = { legalNotices: 'Legal notices', guidanceConversations: 'AI guidance chats', cases: 'Smart Case Builder cases', trackerEvents: 'Legal Tracker events', drafts: 'Legal drafts', consultations: 'Consultations booked', consultationsReceived: 'Consultation requests received', consultationsCompleted: 'Consultations completed' };
      body.push(h('ul', { class: 'lla-list' }, Object.keys(d.usage).map(function (k) { return h('li', null, [h('span', { text: labels[k] || k }), h('span', { class: 'lla-num', text: U.num(d.usage[k]) })]); })));
      body.push(h('p', { class: 'lla-privacy', text: d.privacyNote }));
      if (can('users:manage')) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Actions' }));
        body.push(h('div', { class: 'lla-actions-row' }, [u.isActive
          ? h('button', { class: 'lla-btn lla-btn-danger lla-btn-sm', type: 'button', text: 'Deactivate account', onclick: function () { deactivateUser(u); } })
          : h('button', { class: 'lla-btn lla-btn-good lla-btn-sm', type: 'button', text: 'Reactivate account', onclick: function () { reactivateUser(u); } })]));
      }
      U.setDrawerBody(body, u.name);
    }, function (err) { U.setDrawerBody(errorState(err, function () { openUser(id); })); });
  }

  function deactivateUser(u) {
    textModal({
      title: 'Deactivate ' + u.name + '?',
      text: 'The user is signed out everywhere immediately and cannot log in or use any protected feature until reactivated.' + (u.role === 'lawyer' ? ' Their profile is hidden from the public lawyer directory while deactivated.' : '') + ' Nothing is deleted.',
      label: 'Reason (recorded in the audit log)', required: true, max: 300, okText: 'Deactivate', tone: 'danger',
      submit: function (reason) {
        return apiAction(A.patch('/users/' + encodeURIComponent(u.id) + '/deactivate', { reason: reason }), 'Account deactivated.').then(function () {
          openUser(u.id); if (usersList) usersList.refresh();
        });
      }
    });
  }
  function reactivateUser(u) {
    textModal({
      title: 'Reactivate ' + u.name + '?',
      text: 'The user can log in again.' + (u.role === 'lawyer' ? ' The public profile visibility they had before is restored (the directory still shows only verified lawyers).' : ''),
      label: 'Note (optional)', required: false, max: 300, okText: 'Reactivate', tone: 'good',
      submit: function (note) {
        return apiAction(A.patch('/users/' + encodeURIComponent(u.id) + '/reactivate', { reason: note }), 'Account reactivated.').then(function (res) {
          if (res && res.data && res.data.directoryNote) U.toast(res.data.directoryNote);
          openUser(u.id); if (usersList) usersList.refresh();
        });
      }
    });
  }

  // ---------------- Lawyers
  var lawyersQuery = { page: 1, limit: 20, status: 'pending', published: 'all', account: 'all', search: '' };
  var lawyersList = null;
  VIEWS.lawyers = {
    title: 'Lawyers',
    sub: 'Verification and public directory',
    render: function (root) {
      var tabBox = h('div');
      lawyersList = listPage(root, {
        query: lawyersQuery,
        toolbar: function (top, reload) {
          top.appendChild(tabBox);
          top.appendChild(h('div', { class: 'lla-toolbar' }, [
            searchBox(lawyersQuery.search, 'Search name, email, bar no. or location', function (v) { lawyersQuery.search = v; reload(); }),
            U.select([['all', 'Directory: any'], ['yes', 'Published'], ['no', 'Hidden']], lawyersQuery.published, { attrs: { 'aria-label': 'Directory visibility' }, onchange: function (e) { lawyersQuery.published = e.target.value; reload(); } }),
            U.select([['all', 'Account: any'], ['active', 'Active accounts'], ['deactivated', 'Deactivated accounts']], lawyersQuery.account, { attrs: { 'aria-label': 'Account status' }, onchange: function (e) { lawyersQuery.account = e.target.value; reload(); } })
          ]));
          tabBox.reload = reload;
        },
        onData: function (data) {
          U.clear(tabBox);
          var c = data.counts || {};
          tabBox.appendChild(tabs([['pending', 'Pending', c.pending], ['verified', 'Verified', c.verified], ['rejected', 'Rejected', c.rejected], ['all', 'All', (c.pending || 0) + (c.verified || 0) + (c.rejected || 0)]], lawyersQuery.status, function (s) { lawyersQuery.status = s; tabBox.reload(); }));
        },
        load: function (q) { return A.get('/lawyer-profiles', q); },
        columns: [
          { label: 'Lawyer', render: function (l) { return h('div', null, [h('div', { class: 'lla-cell-main', text: l.name }), h('div', { class: 'lla-cell-sub', text: l.email })]); } },
          { label: 'Bar no.', render: function (l) { return l.barNumber || '—'; } },
          { label: 'Location', render: function (l) { return l.location || '—'; } },
          { label: 'Verification', render: function (l) { return verificationBadge(l.verificationStatus); } },
          { label: 'Directory', render: function (l) { return l.inPublicDirectory ? U.badge('Public', 'good') : U.badge('Hidden', 'plain'); } },
          { label: 'Account', render: function (l) { return l.account && !l.account.isActive ? U.badge('Deactivated', 'bad') : U.badge('Active', 'plain'); } },
          { label: 'Registered', className: 'lla-cell-num', render: function (l) { return U.date(l.createdAt); } }
        ],
        onRow: function (l) { openLawyer(l.id); },
        empty: ['No lawyers found', 'Try another tab or search.']
      });
    }
  };

  function openLawyer(id) {
    U.openDrawer('Lawyer details', U.stateBox('loading', 'Loading…'));
    A.get('/lawyer-profiles/' + encodeURIComponent(id)).then(function (res) {
      var d = res.data, l = d.lawyer;
      var deactivated = l.account && !l.account.isActive;
      var body = [];
      body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [verificationBadge(l.verificationStatus), l.inPublicDirectory ? U.badge('In public directory', 'good') : U.badge('Not in directory', 'plain'), deactivated ? U.badge('Account deactivated', 'bad') : null]));
      if (deactivated) body.push(notice('This account is deactivated, so the profile is hidden. Reactivate the account in Users before publishing it.', true));
      body.push(dl([
        ['Email', l.email], ['Bar registration', l.barNumber], ['Location', l.location],
        ['Practice areas', l.practiceAreas && l.practiceAreas.length ? h('div', { class: 'lla-chips' }, l.practiceAreas.map(function (p) { return h('span', { class: 'lla-chip', text: p }); })) : '—'],
        ['Languages', (l.languages || []).join(', ')], ['Experience', l.experience ? l.experience + ' years' : '—'], ['Consultation fee', l.consultationFee ? U.money(l.consultationFee) : 'Free / not set'],
        ['Registered', U.dateTime(l.createdAt)], ['Last login', l.account && l.account.lastLoginAt ? U.dateTime(l.account.lastLoginAt) : 'Never'],
        ['Verified', l.verifiedAt ? U.dateTime(l.verifiedAt) + (l.verifiedBy ? ' by ' + l.verifiedBy.name : '') : '—'],
        ['Review note', l.reviewNote]
      ]));
      if (l.bio) { body.push(h('h3', { class: 'lla-sub-title', text: 'Public bio' })); body.push(h('div', { class: 'lla-message-body', text: l.bio })); }
      body.push(h('h3', { class: 'lla-sub-title', text: 'Consultations' }));
      body.push(h('ul', { class: 'lla-list' }, Object.keys(d.consultations).map(function (k) { return h('li', null, [h('span', { text: k.charAt(0).toUpperCase() + k.slice(1) }), h('span', { class: 'lla-num', text: U.num(d.consultations[k]) })]); })));
      if (can('lawyers:review')) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Actions' }));
        body.push(h('div', { class: 'lla-actions-row' }, [
          l.verificationStatus !== 'verified' ? h('button', { class: 'lla-btn lla-btn-good lla-btn-sm', type: 'button', text: 'Verify', onclick: function () { reviewLawyer(l, 'verify'); } }) : null,
          l.verificationStatus !== 'rejected' ? h('button', { class: 'lla-btn lla-btn-danger lla-btn-sm', type: 'button', text: 'Reject', onclick: function () { reviewLawyer(l, 'reject'); } }) : null,
          h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: l.isPublished ? 'Hide from directory' : 'Publish profile', disabled: !l.isPublished && deactivated, attrs: { title: !l.isPublished && deactivated ? 'Reactivate the account first' : null }, onclick: function () { publishLawyer(l); } })
        ]));
      }
      // Permanent deletion: Super Admins only (the server enforces this too).
      if (isSuper()) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Delete lawyer' }));
        body.push(h('p', { class: 'lla-muted', text: 'Permanently removes this lawyer from the Admin Dashboard and the public CASEONE website. This cannot be undone.' }));
        body.push(h('div', { class: 'lla-actions-row' }, [
          h('button', { class: 'lla-btn lla-btn-danger lla-btn-sm', type: 'button', text: 'Delete lawyer', attrs: { 'data-action': 'delete-lawyer' }, onclick: function () { deleteLawyer(l); } })
        ]));
      }
      body.push(h('h3', { class: 'lla-sub-title', text: 'Review history' }));
      body.push(d.reviewHistory.length ? h('ul', { class: 'lla-history' }, d.reviewHistory.map(function (e) {
        return h('li', null, [h('time', { text: U.dateTime(e.createdAt) }), h('span', { text: (e.summary || e.action) + ' — ' + (e.actor.name || e.actor.email || 'admin') })]);
      })) : h('p', { class: 'lla-muted', text: 'No admin actions recorded yet.' }));
      U.setDrawerBody(body, l.name);
    }, function (err) { U.setDrawerBody(errorState(err, function () { openLawyer(id); })); });
  }

  function reviewLawyer(l, verb) {
    textModal({
      title: (verb === 'verify' ? 'Verify ' : 'Reject ') + l.name + '?',
      text: verb === 'verify'
        ? 'Verified profiles can appear in the public directory and AI lawyer suggestions (if published and the account is active). Confirm you have checked the bar registration.'
        : 'The profile is removed from the public directory and AI suggestions. The lawyer can update the profile and be reviewed again.',
      label: 'Review note (optional, visible to admins)', required: false, max: 500,
      okText: verb === 'verify' ? 'Verify lawyer' : 'Reject', tone: verb === 'verify' ? 'good' : 'danger',
      submit: function (note) {
        return apiAction(A.patch('/lawyers/' + encodeURIComponent(l.id) + '/' + verb, { note: note }), verb === 'verify' ? 'Lawyer verified.' : 'Verification rejected.').then(function () {
          openLawyer(l.id); if (lawyersList) lawyersList.refresh();
        });
      }
    });
  }
  function publishLawyer(l) {
    var publish = !l.isPublished;
    U.modal({
      title: publish ? 'Publish ' + l.name + '?' : 'Hide ' + l.name + ' from the directory?',
      body: h('p', { text: publish ? 'The profile becomes visible in the public directory (only if it is verified).' : 'The profile will no longer appear in the public directory or AI suggestions. The account itself stays active.' }),
      okText: publish ? 'Publish' : 'Hide profile', tone: publish ? 'good' : 'danger',
      onOk: function () {
        return apiAction(A.patch('/lawyers/' + encodeURIComponent(l.id) + '/publish', { isPublished: publish }), 'Saved.').then(function () {
          openLawyer(l.id); if (lawyersList) lawyersList.refresh();
        });
      }
    });
  }

  function deleteLawyer(l) {
    var reason = U.textarea({ attrs: { maxlength: 300, rows: 3, 'data-field': 'delete-reason' } });
    var confirmBox = U.input({ attrs: { type: 'text', autocomplete: 'off', spellcheck: 'false', 'data-field': 'delete-confirm' } });
    U.modal({
      title: 'Delete ' + l.name + '?',
      body: [
        h('p', { text: 'This permanently deletes the lawyer. It cannot be undone.' }),
        h('ul', { class: 'lla-muted' }, [
          h('li', { text: 'The profile is removed from the Lawyers list, the verification queue, the public directory, search results, profile pages and saved lawyer lists.' }),
          h('li', { text: 'The account is signed out everywhere and can never sign in again.' }),
          h('li', { text: 'Pending and accepted consultation requests are cancelled; customers keep their request history.' }),
          h('li', { text: 'Uploaded credential documents and the profile photo are deleted. The action is recorded in the audit log.' })
        ]),
        U.field('Reason (recorded in the audit log)', reason),
        U.field('Type the lawyer’s email address to confirm: ' + l.email, confirmBox)
      ],
      okText: 'Delete lawyer permanently', tone: 'danger',
      onOk: function () {
        var why = reason.value.trim();
        if (why.length < 3) throw new Error('Reason must be at least 3 characters.');
        if (confirmBox.value.trim().toLowerCase() !== String(l.email || '').toLowerCase()) throw new Error('The email address does not match. Type it exactly to confirm.');
        return apiAction(A.del('/lawyer-profiles/' + encodeURIComponent(l.id), { confirmEmail: confirmBox.value.trim(), reason: why }), 'Lawyer deleted.').then(function () {
          U.closeDrawer();
          if (lawyersList) lawyersList.refresh();
        });
      }
    });
  }

  // ---------------- Lawyer verification (Lawyer Portal credentials)
  var VSTATE = {
    draft: ['Draft', 'plain'], submitted: ['Submitted', 'warn'], under_review: ['Under review', 'info'],
    more_info_required: ['More info required', 'warn'], approved: ['Approved', 'good'], rejected: ['Rejected', 'bad']
  };
  var DOC_KIND = {
    law_degree: 'LL.B. / law degree', enrollment_certificate: 'Enrollment certificate / Sanad', aadhaar_card: 'Aadhaar card (masked)', pan_card: 'PAN card', identity_proof: 'Identity proof',
    income_certificate: 'Income certificate', ration_card: 'Ration card', category_proof: 'Category proof', other: 'Other'
  };
  var ID_TYPE = { aadhaar_masked: 'Masked Aadhaar', pan: 'PAN', passport: 'Passport', voter_id: 'Voter ID', driving_licence: 'Driving licence', bar_council_id: 'Bar Council ID', other: 'Other ID' };
  function vBadge(s) { var x = VSTATE[s] || [s, 'plain']; return U.badge(x[0], x[1]); }
  function sizeText(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  var AUTO = { not_started: ['Not started', 'plain'], pending_verification: ['Pending verification', 'warn'], needs_review: ['Needs review', 'bad'], verified: ['Verified (official)', 'good'] };
  var OUT = { pass: ['Passed', 'good'], fail: ['Problem', 'bad'], warning: ['Check', 'warn'], pending: ['Waiting', 'plain'], info: ['Note', 'info'] };
  function autoBadge(s) { var x = AUTO[s] || AUTO.not_started; return U.badge(x[0], x[1]); }

  /** Automated checks + official source status + re-run button (never decides on its own here). */
  function automationBlock(a, providerList, onRecheck) {
    a = a || { status: 'not_started', checks: [] };
    var out = [h('h3', { class: 'lla-sub-title', text: 'Automated checks' })];
    out.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:10px' } }, [autoBadge(a.status), a.autoDecision === 'approved' ? U.badge('Approved automatically (trusted official source)', 'good') : null]));
    out.push(a.checks && a.checks.length ? h('ul', { class: 'lla-list' }, a.checks.map(function (c) {
      var o = OUT[c.outcome] || [c.outcome, 'plain'];
      return h('li', null, [h('span', null, [h('div', { class: 'lla-cell-main', text: c.label }), h('div', { class: 'lla-cell-sub', text: c.message })]), U.badge(o[0], o[1])]);
    })) : h('p', { class: 'lla-muted', text: 'No automated checks have run yet.' }));
    if (providerList && providerList.length) {
      out.push(h('p', { class: 'lla-muted', attrs: { style: 'margin-top:10px' }, text: 'Official sources: ' + providerList.map(function (p) {
        return p.label + ' — ' + (p.trusted ? 'connected (trusted)' : p.configured ? 'connected (not trusted: advisory only)' : 'not connected');
      }).join(' · ') + '. Unconnected or inconclusive sources never count as verified.' }));
    }
    if (onRecheck) out.push(h('div', { class: 'lla-actions-row', attrs: { style: 'margin-top:8px' } }, [h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Re-run automated checks', onclick: onRecheck })]));
    return out;
  }

  function docAutoText(d) {
    var a = d.automation || {}, f = a.fields || {}, bits = [];
    if (a.extractionStatus === 'extracted') {
      if (f.enrollmentNumber) bits.push('enrollment ' + f.enrollmentNumber);
      if (f.stateBarCouncil) bits.push(f.stateBarCouncil);
      if (f.name) bits.push('name "' + f.name + '"');
      if (f.annualIncome != null) bits.push('income ' + U.money(f.annualIncome));
      if (f.category) bits.push('category ' + f.category);
      if (f.certificateNumberMasked) bits.push('cert ' + f.certificateNumberMasked);
      if (f.cardNumberMasked) bits.push('card ' + f.cardNumberMasked);
      if (f.mentionsLaw) bits.push('LL.B. text found');
      bits.unshift('Read (' + (a.readBy === 'ai_ocr' ? 'AI OCR' : 'PDF text') + ')');
    } else if (a.extractionStatus === 'no_text') bits.push('Not machine-readable (image/scan)');
    if (a.signedPdf) bits.push('signed PDF (signature not verified)');
    if (a.verification && a.verification !== 'not_run') bits.push('official: ' + a.verification + (a.verifiedBy ? ' by ' + a.verifiedBy : ''));
    return bits.join(' · ');
  }

  function docList(docs, opts) {
    if (!docs.length) return h('p', { class: 'lla-muted', text: 'No documents uploaded.' });
    return h('ul', { class: 'lla-list' }, docs.map(function (d) {
      var label = (DOC_KIND[d.kind] || d.kind) + (d.kind === 'identity_proof' && d.identityType ? ' — ' + (ID_TYPE[d.identityType] || d.identityType) + (d.maskedIdentifier ? ' ' + d.maskedIdentifier : '') : '');
      return h('li', null, [
        h('span', null, [
          h('div', { class: 'lla-cell-main', text: label }),
          h('div', { class: 'lla-cell-sub', text: d.fileName + ' · ' + sizeText(d.size) + ' · ' + U.dateTime(d.uploadedAt) }),
          docAutoText(d) ? h('div', { class: 'lla-cell-sub', text: docAutoText(d) }) : null
        ].concat(((d.automation && d.automation.flags) || []).map(function (m) { return h('div', { class: 'lla-cell-sub', attrs: { style: 'font-weight:600;color:inherit' }, text: '⚠ ' + m }); }))),
        h('span', { class: 'lla-actions-row' }, [
          opts.canOpen ? h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Open', onclick: function () {
            A.openFile(opts.filePath(d.id)).catch(function (err) { U.toast(friendly(err), true); });
          } }) : null,
          opts.canDelete ? h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Delete', onclick: function () {
            U.modal({
              title: 'Delete this document?',
              body: h('p', { text: 'The file is permanently removed from private storage (for retention or deletion requests). This is recorded in the audit log.' }),
              okText: 'Delete document', tone: 'danger',
              onOk: function () { return apiAction(A.del(opts.deletePath(d.id)), 'Document deleted.').then(opts.after); }
            });
          } }) : null
        ])
      ]);
    }));
  }

  var verQuery = { page: 1, limit: 20, state: 'awaiting', search: '' };
  var verList = null;
  VIEWS.verifications = {
    title: 'Lawyer verification',
    sub: 'Manual review of Bar Council credentials submitted through the Lawyer Portal',
    render: function (root) {
      root.appendChild(notice('Each application shows automated checks (document reading, duplicates, consistency, official sources). Only a TRUSTED official source can approve automatically; everything else is decided here. Check enrollment numbers against the State Bar Council roll. Documents open privately and every view is audited.'));
      var tabBox = h('div');
      verList = listPage(root, {
        query: verQuery,
        toolbar: function (top, reload) {
          top.appendChild(tabBox);
          tabBox.reload = reload;
          top.appendChild(h('div', { class: 'lla-toolbar' }, [searchBox(verQuery.search, 'Search name, email, enrollment no., Bar Council', function (v) { verQuery.search = v; reload(); })]));
        },
        onData: function (data) {
          U.clear(tabBox);
          var c = data.counts || {};
          tabBox.appendChild(tabs([
            ['awaiting', 'Awaiting review', c.awaiting], ['submitted', 'Submitted', c.submitted], ['under_review', 'Under review', c.under_review],
            ['more_info_required', 'Info requested', c.more_info_required], ['approved', 'Approved', c.approved], ['rejected', 'Rejected', c.rejected],
            ['draft', 'Draft', c.draft], ['all', 'All', null]
          ], verQuery.state, function (s) { verQuery.state = s; tabBox.reload(); }));
        },
        load: function (q) { return A.get('/lawyer-verifications', q); },
        columns: [
          { label: 'Lawyer', render: function (l) { return h('div', null, [h('div', { class: 'lla-cell-main', text: l.name }), h('div', { class: 'lla-cell-sub', text: l.email })]); } },
          { label: 'Bar Council / enrollment', render: function (l) { return h('div', null, [h('div', { text: l.stateBarCouncil || '—' }), h('div', { class: 'lla-cell-sub', text: l.enrollmentNumber || '' })]); } },
          { label: 'Service', render: function (l) { return { paid: 'Paid', free: 'Free', both: 'Paid + free' }[l.serviceType] || 'Paid'; } },
          { label: 'Status', render: function (l) { return vBadge(l.state); } },
          { label: 'Automated', render: function (l) { return autoBadge(l.automationStatus); } },
          { label: 'Docs', className: 'lla-cell-num', render: function (l) { return U.num(l.documentCount); } },
          { label: 'Submitted', className: 'lla-cell-num', render: function (l) { return l.submittedAt ? U.dateTime(l.submittedAt) : '—'; } }
        ],
        onRow: function (l) { openVerification(l.id); },
        empty: ['Nothing waiting', 'New submissions from the Lawyer Portal appear here.']
      });
    }
  };

  function openVerification(id) {
    U.openDrawer('Lawyer verification', U.stateBox('loading', 'Loading…'));
    A.get('/lawyer-verifications/' + encodeURIComponent(id)).then(function (res) {
      var d = res.data, l = d.lawyer;
      var canReview = can('lawyers:review');
      var body = [];
      body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [vBadge(l.state), l.accountActive ? null : U.badge('Account deactivated', 'bad'), l.isPublished ? null : U.badge('Hidden from directory', 'plain')]));
      if (l.decisionReason && (l.state === 'rejected' || l.state === 'more_info_required')) body.push(notice('Message shown to the lawyer: ' + l.decisionReason, true));
      body.push(dl([
        ['Email', l.email], ['Phone (private)', l.phone], ['State Bar Council', l.stateBarCouncil], ['Enrollment number', l.enrollmentNumber],
        ['Location', [l.location, l.residenceState].filter(Boolean).join(', ')], ['Enrollment date', l.enrollmentDate ? U.date(l.enrollmentDate) : '—'], ['Office location (private)', l.officeAddress || '—'],
        ['Photograph', l.hasPhoto ? 'Uploaded' : 'Not uploaded'], ['Experience', l.experience ? l.experience + ' years' : '—'], ['Qualifications', l.qualifications],
        ['Specializations', (l.practiceAreas || []).join(', ')], ['Languages', (l.languages || []).join(', ')],
        ['Service', { paid: 'Paid', free: 'Free', both: 'Paid + free' }[l.serviceType]],
        ['Consent', l.consent ? 'Accepted ' + U.dateTime(l.consent.acceptedAt) + ' (v' + l.consent.version + ')' : 'Not yet'],
        ['Submitted', l.submittedAt ? U.dateTime(l.submittedAt) : '—'], ['Decided', l.decidedAt ? U.dateTime(l.decidedAt) : '—']
      ]));
      body.push(h('h3', { class: 'lla-sub-title', text: 'Credential documents' }));
      body.push(docList(d.documents, {
        canOpen: canReview, canDelete: canReview,
        filePath: function (docId) { return '/lawyer-documents/' + encodeURIComponent(docId) + '/file'; },
        deletePath: function (docId) { return '/lawyer-documents/' + encodeURIComponent(docId); },
        after: function () { openVerification(id); if (verList) verList.refresh(); }
      }));
      if (!canReview) body.push(h('p', { class: 'lla-muted', text: 'Opening documents and making decisions needs the lawyers:review permission.' }));
      if (d.identityCheck) body.push(notice('PAN (XXXXX' + d.identityCheck.last4 + 'X): ' + (d.identityCheck.outcome || 'no verification source connected') + (d.identityCheck.trusted ? ' (trusted source)' : '') + (d.identityCheck.matchesCard === false ? ' — does NOT match the uploaded PAN card' : d.identityCheck.matchesCard === true ? ' — matches the PAN card' : '') + (d.identityCheck.duplicate ? ' — this PAN is also used by another account' : ''), d.identityCheck.outcome !== 'verified' || d.identityCheck.duplicate || d.identityCheck.matchesCard === false));
      if (d.aadhaarCheck) body.push(notice('Aadhaar consent check: ' + d.aadhaarCheck.outcome + (d.aadhaarCheck.trusted ? ' (licensed provider marked trusted)' : '') + (d.aadhaarCheck.last4 ? ', ending ' + d.aadhaarCheck.last4 : '') + (d.aadhaarCheck.source ? ' — ' + d.aadhaarCheck.source : ''), d.aadhaarCheck.outcome !== 'verified'));
      automationBlock(d.automation, d.providers, canReview ? function () {
        apiAction(A.patch('/lawyer-verifications/' + encodeURIComponent(id) + '/recheck', {}), 'Automated checks updated.').then(function () { openVerification(id); if (verList) verList.refresh(); }, function (e) { U.toast(e.message, true); });
      } : null).forEach(function (n) { body.push(n); });
      var hasDoc = function (k) { return d.documents.some(function (x) { return x.kind === k; }); };
      var missingForApproval = (d.adminRequiredDocuments || d.requiredDocuments || []).filter(function (k) { return !hasDoc(k); });
      var missingOther = (d.requiredDocuments || []).filter(function (k) { return !hasDoc(k) && missingForApproval.indexOf(k) === -1; });
      if (missingForApproval.length) body.push(notice('Missing required documents: ' + missingForApproval.map(function (k) { return DOC_KIND[k]; }).join(', ') + '. Approval is not possible until they are uploaded.', true));
      if (missingOther.length) body.push(notice('Not uploaded (submitted before these were required): ' + missingOther.map(function (k) { return DOC_KIND[k]; }).join(', ') + '.', false));

      if (l.verificationMethod) body.push(notice(l.verificationMethod === 'official_sources' ? 'Approved automatically: every required check was confirmed by a trusted official source.' : 'Approved by manual CASEONE review (not official-source verification). Shown publicly as "Credentials reviewed by CASEONE".', false));
      if (canReview && d.allowedActions.length) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Decision' }));
        if (d.allowedActions.indexOf('approve') >= 0) body.push(h('p', { class: 'lla-muted', text: 'Approving here is a manual review. It is recorded as "manual review" and shown publicly as "Credentials reviewed by CASEONE", never as official verification.' }));
        var go = function (action, note) {
          return apiAction(A.patch('/lawyer-verifications/' + encodeURIComponent(id) + '/' + action, { note: note || '' }), 'Saved.').then(function () { openVerification(id); if (verList) verList.refresh(); });
        };
        body.push(h('div', { class: 'lla-actions-row' }, [
          d.allowedActions.indexOf('start_review') >= 0 ? h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Start review', onclick: function () { go('start-review').catch(function (e) { U.toast(e.message, true); }); } }) : null,
          d.allowedActions.indexOf('approve') >= 0 ? h('button', { class: 'lla-btn lla-btn-good lla-btn-sm', type: 'button', text: 'Approve', disabled: missingForApproval.length > 0, onclick: function () {
            textModal({ title: 'Approve ' + l.name + '?', text: 'This is a manual CASEONE approval, not official Bar Council verification. The lawyer\'s dashboard unlocks, and the profile appears to clients as "Credentials reviewed by CASEONE" (if published and the account is active). Confirm you have checked the enrollment number against the State Bar Council roll and reviewed the documents.', label: 'Internal note (optional)', required: false, max: 500, okText: 'Approve', tone: 'good', submit: function (note) { return go('approve', note); } });
          } }) : null,
          d.allowedActions.indexOf('request_info') >= 0 ? h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Request more information', onclick: function () {
            textModal({ title: 'Request more information', text: 'The lawyer sees this message and can update their details or documents and resubmit.', label: 'What is needed (shown to the lawyer)', required: true, max: 1000, okText: 'Send request', submit: function (note) { return go('request-info', note); } });
          } }) : null,
          d.allowedActions.indexOf('reject') >= 0 ? h('button', { class: 'lla-btn lla-btn-danger lla-btn-sm', type: 'button', text: 'Reject', onclick: function () {
            textModal({ title: 'Reject ' + l.name + '?', text: 'The lawyer sees the reason and may correct and resubmit.', label: 'Reason (shown to the lawyer)', required: true, max: 1000, okText: 'Reject', tone: 'danger', submit: function (note) { return go('reject', note); } });
          } }) : null
        ]));
      }
      body.push(h('h3', { class: 'lla-sub-title', text: 'History' }));
      body.push(d.history.length ? h('ul', { class: 'lla-history' }, d.history.slice().reverse().map(function (e) {
        return h('li', null, [h('time', { text: U.dateTime(e.at) }), h('span', { text: e.stateLabel + ' — ' + ({ lawyer: 'lawyer', admin: 'admin', system: 'system' }[e.byRole] || '') + (e.note ? ': ' + e.note : '') })]);
      })) : h('p', { class: 'lla-muted', text: 'Not submitted yet.' }));
      // Audit trail: every admin action on this application (approve, reject,
      // info requests, document views, re-checks), newest first.
      var auditBox = null;
      if (can('audit:view')) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Admin audit trail' }));
        auditBox = h('div', { attrs: { 'data-audit-trail': '' } }, [h('p', { class: 'lla-muted', text: 'Loading…' })]);
        body.push(auditBox);
      }
      body.push(h('p', { class: 'lla-muted', attrs: { style: 'margin-top:14px' } }, [h('a', { href: '#/lawyers', text: 'Directory and publication settings are in Lawyers →' })]));
      U.setDrawerBody(body, l.name);
      if (auditBox) {
        A.get('/audit-logs', { targetType: 'lawyer', targetId: l.id, limit: 20, page: 1 }).then(function (ar) {
          var rows = (ar.data && ar.data.items) || [];
          var labels = (ar.data && ar.data.actions) || {};
          U.clear(auditBox);
          auditBox.appendChild(rows.length ? h('ul', { class: 'lla-history' }, rows.map(function (e) {
            var who = (e.actor && (e.actor.name || e.actor.email)) || 'system';
            return h('li', null, [h('time', { text: U.dateTime(e.createdAt) }), h('span', { text: (labels[e.action] || e.summary || e.action) + ' — ' + who + (e.outcome && e.outcome !== 'success' ? ' (' + e.outcome + ')' : '') })]);
          })) : h('p', { class: 'lla-muted', text: 'No admin actions recorded for this application yet.' }));
        }, function (err) {
          U.clear(auditBox);
          auditBox.appendChild(h('p', { class: 'lla-muted', text: 'Audit trail could not be loaded: ' + friendly(err) }));
        });
      }
    }, function (err) { U.setDrawerBody(errorState(err, function () { openVerification(id); })); });
  }

  // ---------------- Free assistance applications
  var ASTATE = {
    submitted: ['Pending review', 'warn'], under_review: ['Under review', 'info'], more_info_required: ['Info requested', 'warn'],
    approved: ['Approved', 'good'], rejected: ['Rejected', 'bad'], withdrawn: ['Withdrawn', 'plain']
  };
  var ACAT = {
    income_below_platform_limit: 'Income within guideline', woman_or_child: 'Woman or child', sc_st: 'SC / ST', person_with_disability: 'Person with disability',
    senior_citizen: 'Senior citizen', industrial_workman: 'Industrial workman', victim_of_disaster_violence_or_trafficking: 'Disaster / violence / trafficking',
    in_custody: 'In custody', transgender_person: 'Transgender person', other: 'Other'
  };
  function aBadge(s) { var x = ASTATE[s] || (s === 'draft' ? ['Draft (not submitted)', 'plain'] : [s, 'plain']); return U.badge(x[0], x[1]); }
  var AID_DOC_NAMES = { aadhaar_card: 'Masked Aadhaar', pan_card: 'PAN', income_certificate_or_ration_card: 'Income certificate or ration card' };
  function aidV2(a) { return (a.formVersion || 1) >= 2; }
  // Review reasons from the server (nothing here approves anything).
  function aidReviewCell(a) {
    var r = a.review;
    if (!r || ['submitted', 'under_review', 'more_info_required'].indexOf(a.status) < 0) return '—';
    if (r.quickReview) return U.badge('Quick review', 'good');
    var important = r.reasons.filter(function (x) { return x.level !== 'check' && x.code !== 'urgent'; });
    var blocker = r.reasons.some(function (x) { return x.level === 'blocker'; });
    if (!important.length) return U.badge('Manual checks: ' + r.reasons.filter(function (x) { return x.level === 'check'; }).length, 'plain');
    return h('div', null, [U.badge(important.length + ' to check', blocker ? 'bad' : 'warn'), h('div', { class: 'lla-cell-sub', text: important[0].text.slice(0, 80) })]);
  }
  function aidReasonsBlock(a) {
    var r = a.review;
    if (!r || !r.reasons.length) return r && r.quickReview ? notice('Quick review: all documents were read automatically and nothing was flagged. Still check them yourself before deciding.') : null;
    var order = { blocker: 0, attention: 1, check: 2 };
    var items = r.reasons.slice().sort(function (x, y) { return order[x.level] - order[y.level]; });
    return h('div', { attrs: { style: 'margin:0 0 14px' } }, [
      h('h3', { class: 'lla-sub-title', text: 'What to check' }),
      h('ul', { attrs: { style: 'margin:0;padding-left:18px;line-height:1.6' } }, items.map(function (x) {
        return h('li', null, [x.level === 'blocker' ? U.badge('Blocks approval', 'bad') : x.level === 'attention' ? U.badge('Check', 'warn') : U.badge('Manual', 'plain'), ' ' + x.text]);
      }))
    ]);
  }
  // Phase 2: automatic-approval requirement states (server-side decision; read-only here).
  var REQ_LABELS = { identity: 'Identity (authorised source)', panDocument: 'PAN card document (issuer-backed)', panStatus: 'PAN status (active) — authorised status source', income: 'Income certificate (issuer-confirmed)', binding: 'Identity = certificate holder', incomeBelowLimit: 'Verified income below limit', documents: 'Documents and declaration', consent: 'Valid consent', flags: 'No duplicate / mismatch flags', freshness: 'Evidence current' };
  var REQ_TONE = { VERIFIED: 'good', FAILED: 'bad', MANUAL_REVIEW: 'warn', PENDING: 'plain', NOT_CONFIGURED: 'plain', BLOCKED: 'plain' };
  function aidDecisionBlock(d) {
    var dec = d.decision;
    if (!dec || !dec.requirements) return null;
    var why = {};
    (dec.reasons || []).forEach(function (r) { why[r.requirement] = r.reason; });
    var auto = d.readiness && d.readiness.automaticApproval;
    return h('div', { attrs: { style: 'margin:0 0 14px' } }, [
      h('h3', { class: 'lla-sub-title', text: 'Automatic approval check' }),
      h('p', { class: 'lla-muted', text: dec.eligible ? 'All requirements verified by authorised sources.' + (dec.autoApprovalEnabled ? '' : ' Automatic approval is off, so an admin decides.') : 'Not eligible for automatic approval: an admin decides. ' + (auto ? 'Automatic approval: ' + auto.status + '.' : '') }),
      h('ul', { attrs: { style: 'margin:0;padding-left:18px;line-height:1.7' } }, Object.keys(REQ_LABELS).map(function (k) {
        var st = dec.requirements[k] || 'PENDING';
        return h('li', null, [U.badge(st.replace('_', ' '), REQ_TONE[st] || 'plain'), ' ' + REQ_LABELS[k] + (why[k] ? ' — ' + why[k] : '')]);
      }))
    ]);
  }
  function aidDocsBadge(a) {
    var c = a.documentCheck;
    if (!aidV2(a) || !c) return U.num(a.documentCount);
    if (!c.complete) return U.badge('Missing: ' + c.missing.map(function (m) { return AID_DOC_NAMES[m] || m; }).join(', '), 'bad');
    return c.rationCardOnly ? U.badge('Complete · ration card only', 'warn') : U.badge('Complete', 'good');
  }
  var aidQuery = { page: 1, limit: 20, status: 'submitted', search: '' };
  var aidList = null;
  VIEWS.freeaid = {
    title: 'Free assistance',
    sub: 'CASEONE volunteer program — eligibility applications (not government legal aid)',
    render: function (root) {
      root.appendChild(notice('Manual review: check the masked Aadhaar, PAN and income evidence (income certificate or ration card). CASEONE\'s criterion is an annual household income below the limit — a CASEONE volunteer-program policy, not a government legal-aid limit. If a ration card does not establish household income, request more information (for example an income certificate). Older applications may show an eligibility category.'));
      var tabBox = h('div');
      aidList = listPage(root, {
        query: aidQuery,
        toolbar: function (top, reload) {
          top.appendChild(tabBox);
          tabBox.reload = reload;
          top.appendChild(h('div', { class: 'lla-toolbar' }, [searchBox(aidQuery.search, 'Search applicant name or email', function (v) { aidQuery.search = v; reload(); })]));
        },
        onData: function (data) {
          U.clear(tabBox);
          var c = data.counts || {};
          tabBox.appendChild(tabs(Object.keys(ASTATE).map(function (k) { return [k, ASTATE[k][0], c[k]]; }).concat([['all', 'All', null]]), aidQuery.status, function (s) { aidQuery.status = s; tabBox.reload(); }));
          if (c.urgentOpen) tabBox.appendChild(notice(c.urgentOpen + ' open urgent application' + (c.urgentOpen === 1 ? '' : 's') + ' — shown first. Urgent does not mean eligible; review them on their merits.', true));
        },
        load: function (q) { return A.get('/free-aid-applications', q); },
        columns: [
          { label: 'Applicant', render: function (a) { return a.applicant ? h('div', null, [h('div', { class: 'lla-cell-main' }, [a.urgent && a.urgent.isUrgent ? U.badge('URGENT', 'bad') : null, ' ' + (a.fullName || a.applicant.name)]), h('div', { class: 'lla-cell-sub', text: a.applicant.email })]) : '—'; } },
          { label: 'Basis', render: function (a) { return aidV2(a) ? 'Income below limit' : (ACAT[a.category] || a.category); } },
          { label: 'Income / yr', className: 'lla-cell-num', render: function (a) { return a.annualHouseholdIncome != null ? h('span', null, [U.money(a.annualHouseholdIncome), a.incomeAboveGuideline ? h('span', { attrs: { style: 'margin-left:6px' } }, U.badge('Above guideline', 'warn')) : null]) : '—'; } },
          { label: 'Location', render: function (a) { return [a.city, a.state].filter(Boolean).join(', ') || '—'; } },
          { label: 'Status', render: function (a) { return aBadge(a.status); } },
          { label: 'Automated', render: function (a) { return autoBadge(a.automatedVerification && a.automatedVerification.status); } },
          { label: 'Documents', render: aidDocsBadge },
          { label: 'Review', render: aidReviewCell },
          { label: 'Applied', className: 'lla-cell-num', render: function (a) { return U.dateTime(a.submittedAt || a.createdAt); } }
        ],
        onRow: function (a) { openAid(a.id); },
        empty: ['No applications here', 'Try another tab.']
      });
    }
  };

  function openAid(id) {
    U.openDrawer('Free assistance application', U.stateBox('loading', 'Loading…'));
    A.get('/free-aid-applications/' + encodeURIComponent(id)).then(function (res) {
      var d = res.data, a = d.application;
      var canReview = can('aid:review');
      var body = [];
      body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [aBadge(a.status), a.incomeAboveGuideline ? U.badge(aidV2(a) ? 'Income not below the limit' : 'Income above guideline — manual review', 'warn') : null]));
      if (a.decisionReason && (a.status === 'rejected' || a.status === 'more_info_required')) body.push(notice('Message shown to the applicant: ' + a.decisionReason, true));
      if (a.applicantNote) body.push(notice('Applicant reply: ' + a.applicantNote));
      if (a.urgent && a.urgent.isUrgent) body.push(notice('URGENT — ' + String(a.urgent.reason || '').replace(/_/g, ' ') + (a.urgent.neededBy ? ', needed by ' + U.date(a.urgent.neededBy) : '') + (a.urgent.details ? ': ' + a.urgent.details : '') + (a.urgent.consentToShare ? ' · applicant agreed to share with volunteer advocates before verification' : ''), true));
      var reasonsBlock = aidReasonsBlock(a);
      if (reasonsBlock) body.push(reasonsBlock);
      if (a.approvedBy === 'system' && d.approvalEvidence) body.push(notice('Approved automatically. Evidence: ' + ((d.approvalEvidence.sources || []).map(function (x) { return x.provider + ' ' + x.reference; }).join(', ') || 'recorded') + '.'));
      var decisionBlock = aidDecisionBlock(d);
      if (decisionBlock) body.push(decisionBlock);
      if (aidV2(a) && a.documentCheck && !a.documentCheck.complete) body.push(notice('Required documents missing: ' + a.documentCheck.missing.map(function (m) { return AID_DOC_NAMES[m] || m; }).join(', ') + '. Approval is blocked until they are provided — request more information.', true));
      if (aidV2(a) && a.documentCheck && a.documentCheck.rationCardOnly) body.push(notice('Only a ration card was provided as income evidence. If it does not establish household income, request more information (for example an income certificate).', true));
      body.push(dl(aidV2(a) ? [
        ['Account', a.applicant ? a.applicant.name + ' <' + a.applicant.email + '>' : '—'],
        ['Full name', a.fullName], ['Age', a.age], ['Mobile', a.mobile], ['Address', a.address],
        ['City and state', [a.city, a.state].filter(Boolean).join(', ')], ['Family members', a.householdSize],
        ['Annual household income', a.annualHouseholdIncome != null ? U.money(a.annualHouseholdIncome) + ' / year (must be below ' + U.money(d.incomeGuidelineInr) + ')' : 'Not given'],
        ['Submitted', a.submittedAt ? U.dateTime(a.submittedAt) : '—'], ['Decided', a.decidedAt ? U.dateTime(a.decidedAt) : '—'], ['Approval valid until', a.approvalExpiresAt ? U.dateTime(a.approvalExpiresAt) : '—']
      ] : [
        ['Applicant', a.applicant ? a.applicant.name + ' <' + a.applicant.email + '>' : '—'],
        ['Category', d.categoryLabel], ['Details', a.categoryDetails],
        ['Household income', a.annualHouseholdIncome != null ? U.money(a.annualHouseholdIncome) + ' / year (guideline ' + U.money(d.incomeGuidelineInr) + ')' : 'Not given'],
        ['Household size', a.householdSize], ['Location', [a.city, a.state].filter(Boolean).join(', ')], ['Matter area', a.matterArea],
        ['Applied', U.dateTime(a.createdAt)], ['Decided', a.decidedAt ? U.dateTime(a.decidedAt) : '—'], ['Approval valid until', a.approvalExpiresAt ? U.dateTime(a.approvalExpiresAt) : '—']
      ]));
      if (a.matterSummary) { body.push(h('h3', { class: 'lla-sub-title', text: 'Problem described by the applicant' })); body.push(h('div', { class: 'lla-message-body', text: a.matterSummary })); }
      body.push(h('h3', { class: 'lla-sub-title', text: aidV2(a) ? 'Documents (manual review — not officially verified unless marked)' : 'Supporting documents' }));
      body.push(docList(d.documents, {
        canOpen: canReview, canDelete: canReview,
        filePath: function (docId) { return '/free-aid-documents/' + encodeURIComponent(docId) + '/file'; },
        deletePath: function (docId) { return '/free-aid-documents/' + encodeURIComponent(docId); },
        after: function () { openAid(id); if (aidList) aidList.refresh(); }
      }));
      if (!canReview) body.push(h('p', { class: 'lla-muted', text: 'Opening documents and making decisions needs the aid:review permission.' }));
      automationBlock(a.automatedVerification, d.providers, canReview && ['submitted', 'under_review', 'more_info_required'].indexOf(a.status) >= 0 ? function () {
        apiAction(A.patch('/free-aid-applications/' + encodeURIComponent(id) + '/recheck', {}), 'Automated checks updated.').then(function () { openAid(id); if (aidList) aidList.refresh(); }, function (e) { U.toast(e.message, true); });
      } : null).forEach(function (n) { body.push(n); });
      var s = a.status;
      if (canReview && ['submitted', 'under_review', 'more_info_required'].indexOf(s) >= 0) {
        var go = function (action, note) {
          return apiAction(A.patch('/free-aid-applications/' + encodeURIComponent(id) + '/' + action, { note: note || '' }), 'Saved.').then(function () { openAid(id); if (aidList) aidList.refresh(); });
        };
        body.push(h('h3', { class: 'lla-sub-title', text: 'Decision' }));
        body.push(h('div', { class: 'lla-actions-row' }, [
          s === 'submitted' ? h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Start review', onclick: function () { go('start-review').catch(function (e) { U.toast(e.message, true); }); } }) : null,
          s !== 'more_info_required' ? h('button', { class: 'lla-btn lla-btn-good lla-btn-sm', type: 'button', text: 'Approve', onclick: function () {
            U.modal({ title: 'Approve this application?', body: h('p', { text: 'The applicant can then request free (₹0) consultations from volunteer advocates until the approval expires.' }), okText: 'Approve', tone: 'good', onOk: function () { return go('approve'); } });
          } }) : null,
          s !== 'more_info_required' ? h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Request more information', onclick: function () {
            textModal({ title: 'Request more information', text: 'The applicant sees this message and can add documents and send the application back.', label: 'What is needed (shown to the applicant)', required: true, max: 1000, okText: 'Send request', submit: function (note) { return go('request-info', note); } });
          } }) : null,
          h('button', { class: 'lla-btn lla-btn-danger lla-btn-sm', type: 'button', text: 'Reject', onclick: function () {
            textModal({ title: 'Reject this application?', text: 'The applicant sees the reason and may apply again. Consider pointing them to their Legal Services Authority (NALSA helpline 15100).', label: 'Reason (shown to the applicant)', required: true, max: 1000, okText: 'Reject', tone: 'danger', submit: function (note) { return go('reject', note); } });
          } })
        ]));
      }
      body.push(h('h3', { class: 'lla-sub-title', text: 'History' }));
      body.push(h('ul', { class: 'lla-history' }, (a.history || []).slice().reverse().map(function (e) {
        return h('li', null, [h('time', { text: U.dateTime(e.at) }), h('span', { text: (ASTATE[e.status] ? ASTATE[e.status][0] : e.status) + ' — ' + e.byRole + (e.note ? ': ' + e.note : '') })]);
      })));
      U.setDrawerBody(body, a.applicant ? a.applicant.name : 'Application');
    }, function (err) { U.setDrawerBody(errorState(err, function () { openAid(id); })); });
  }

  // ---------------- Consultations
  var consultQuery = { page: 1, limit: 20, status: 'all', type: 'all', serviceType: 'all', from: '', to: '', search: '' };
  var CSTATUS = { pending: ['Pending', 'warn'], accepted: ['Accepted', 'info'], completed: ['Completed', 'good'], rejected: ['Rejected', 'bad'], cancelled: ['Cancelled', 'plain'] };
  VIEWS.consultations = {
    title: 'Consultations',
    sub: 'Read-only oversight of consultation bookings',
    render: function (root) {
      root.appendChild(notice('The issue description and message written by customers are private and are not shown here.'));
      var tabBox = h('div');
      listPage(root, {
        query: consultQuery,
        toolbar: function (top, reload) {
          top.appendChild(tabBox);
          tabBox.reload = reload;
          var from = U.input({ type: 'date', value: consultQuery.from, attrs: { 'aria-label': 'Booked from' }, onchange: function (e) { consultQuery.from = e.target.value; reload(); } });
          var to = U.input({ type: 'date', value: consultQuery.to, attrs: { 'aria-label': 'Booked until' }, onchange: function (e) { consultQuery.to = e.target.value; reload(); } });
          top.appendChild(h('div', { class: 'lla-toolbar' }, [
            searchBox(consultQuery.search, 'Search customer or lawyer', function (v) { consultQuery.search = v; reload(); }),
            U.select([['all', 'Any type'], ['Video', 'Video'], ['Phone', 'Phone'], ['In-Person', 'In person']], consultQuery.type, { attrs: { 'aria-label': 'Type' }, onchange: function (e) { consultQuery.type = e.target.value; reload(); } }),
            U.select([['all', 'Paid + free'], ['paid', 'Paid only'], ['free', 'Free only']], consultQuery.serviceType, { attrs: { 'aria-label': 'Service' }, onchange: function (e) { consultQuery.serviceType = e.target.value; reload(); } }),
            from, to
          ]));
        },
        onData: function (data) {
          U.clear(tabBox);
          var c = data.counts || {};
          var all = Object.keys(c).reduce(function (a, k) { return a + c[k]; }, 0);
          tabBox.appendChild(tabs([['all', 'All', all]].concat(Object.keys(CSTATUS).map(function (k) { return [k, CSTATUS[k][0], c[k]]; })), consultQuery.status, function (s) { consultQuery.status = s; tabBox.reload(); }));
        },
        load: function (q) { return A.get('/consultations', q); },
        columns: [
          { label: 'Booked', className: 'lla-cell-num', render: function (r) { return U.dateTime(r.createdAt); } },
          { label: 'Customer', render: function (r) { return r.customer ? h('div', null, [h('div', { class: 'lla-cell-main', text: r.customer.name }), h('div', { class: 'lla-cell-sub', text: r.customer.email })]) : '—'; } },
          { label: 'Lawyer', render: function (r) { return r.lawyer ? h('div', null, [h('div', { class: 'lla-cell-main', text: r.lawyer.name }), h('div', { class: 'lla-cell-sub', text: r.lawyer.email })]) : '—'; } },
          { label: 'Type', render: function (r) { return r.type; } },
          { label: 'Service', render: function (r) { return r.serviceType === 'free' ? h('span', null, [U.badge('Free · ₹0', 'info'), r.eligibility === 'unverified_emergency' ? U.badge('Urgent · unverified', 'bad') : null]) : h('span', { text: 'Paid' + (r.feeAtRequest ? ' · ' + U.money(r.feeAtRequest) : '') }); } },
          { label: 'Preferred', className: 'lla-cell-num', render: function (r) { return [r.preferredDate, r.preferredTime].filter(Boolean).join(' ') || '—'; } },
          { label: 'Status', render: function (r) { var s = CSTATUS[r.status] || [r.status, 'plain']; return U.badge(s[0], s[1]); } }
        ],
        empty: ['No consultations found', 'Try a different filter.']
      });
    }
  };

  // ---------------- Contact messages
  var contactQuery = { page: 1, limit: 20, status: 'open', email: 'all', search: '' };
  var contactList = null;
  var MSTATUS = { new: ['New', 'warn'], in_progress: ['In progress', 'info'], resolved: ['Resolved', 'good'], spam: ['Spam', 'plain'] };
  var ESTATUS = { sent: ['Email sent', 'good'], failed: ['Email failed', 'bad'], not_configured: ['Email not configured', 'warn'], pending: ['Email pending', 'plain'] };
  VIEWS.contact = {
    title: 'Contact messages',
    sub: 'Messages sent through the Contact Us form',
    render: function (root) {
      var tabBox = h('div');
      contactList = listPage(root, {
        query: contactQuery,
        toolbar: function (top, reload) {
          top.appendChild(tabBox);
          tabBox.reload = reload;
          top.appendChild(h('div', { class: 'lla-toolbar' }, [
            searchBox(contactQuery.search, 'Search name, email or subject', function (v) { contactQuery.search = v; reload(); }),
            U.select([['all', 'Email: any'], ['failed', 'Email failed'], ['not_configured', 'Email not configured'], ['sent', 'Email sent']], contactQuery.email, { attrs: { 'aria-label': 'Email delivery' }, onchange: function (e) { contactQuery.email = e.target.value; reload(); } })
          ]));
        },
        onData: function (data) {
          U.clear(tabBox);
          var c = data.counts || {};
          tabBox.appendChild(tabs([
            ['open', 'Open', (c.new || 0) + (c.in_progress || 0)], ['new', 'New', c.new], ['in_progress', 'In progress', c.in_progress],
            ['resolved', 'Resolved', c.resolved], ['spam', 'Spam', c.spam], ['all', 'All', null]
          ], contactQuery.status, function (s) { contactQuery.status = s; tabBox.reload(); }));
          if (c.emailIssues) tabBox.appendChild(notice(U.num(c.emailIssues) + ' message(s) were saved but the notification email could not be delivered. They are listed here so nobody is missed.', true));
        },
        load: function (q) { return A.get('/contact-messages', q); },
        columns: [
          { label: 'Received', className: 'lla-cell-num', render: function (m) { return U.dateTime(m.createdAt); } },
          { label: 'From', render: function (m) { return h('div', null, [h('div', { class: 'lla-cell-main', text: m.name }), h('div', { class: 'lla-cell-sub', text: m.email })]); } },
          { label: 'Subject', render: function (m) { return h('div', null, [h('div', { class: 'lla-cell-main', text: m.subject }), h('div', { class: 'lla-cell-sub', text: m.preview })]); } },
          { label: 'Status', render: function (m) { var s = MSTATUS[m.status] || [m.status, 'plain']; return U.badge(s[0], s[1]); } },
          { label: 'Email', render: function (m) { var s = ESTATUS[m.emailDelivery] || ESTATUS.pending; return U.badge(s[0], s[1]); } }
        ],
        onRow: function (m) { openMessage(m.id); },
        empty: ['No messages', 'Nothing in this folder.']
      });
    }
  };

  function openMessage(id) {
    U.openDrawer('Message', U.stateBox('loading', 'Loading…'));
    A.get('/contact-messages/' + encodeURIComponent(id)).then(function (res) {
      var m = res.data.message;
      var body = [];
      var s = MSTATUS[m.status] || [m.status, 'plain'], e = ESTATUS[m.emailDelivery] || ESTATUS.pending;
      body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [U.badge(s[0], s[1]), U.badge(e[0], e[1])]));
      body.push(dl([['From', m.name], ['Email', m.email], ['Received', U.dateTime(m.createdAt)], ['Handled', m.handledAt ? U.dateTime(m.handledAt) : '—'], ['Deleted automatically', U.date(m.expiresAt)]]));
      body.push(h('h3', { class: 'lla-sub-title', text: m.subject }));
      body.push(h('div', { class: 'lla-message-body', text: m.message }));
      var reply = U.mailtoLink(m.email, m.subject);
      if (reply) body.push(h('div', { class: 'lla-actions-row', attrs: { style: 'margin-top:12px' } }, reply));
      if (can('contact:manage')) {
        var st = U.select([['new', 'New'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['spam', 'Spam']], m.status);
        var note = U.textarea({ value: m.adminNote || '', attrs: { maxlength: 1000, rows: 3, placeholder: 'Internal note for the team (not sent to the visitor)' } });
        var save = h('button', { class: 'lla-btn lla-btn-primary lla-btn-sm', type: 'button', text: 'Save' });
        var err = h('p', { class: 'lla-form-error', hidden: true, attrs: { role: 'alert' } });
        save.addEventListener('click', function () {
          err.hidden = true;
          U.busy(save, true);
          A.patch('/contact-messages/' + encodeURIComponent(m.id), { status: st.value, adminNote: note.value }).then(function () {
            U.busy(save, false);
            U.toast('Message updated.');
            refreshNavCounts();
            if (contactList) contactList.refresh();
            openMessage(m.id);
          }, function (ex) {
            U.busy(save, false);
            if (handleAuthError(ex)) return;
            err.textContent = friendly(ex); err.hidden = false;
          });
        });
        body.push(h('h3', { class: 'lla-sub-title', text: 'Handling' }));
        body.push(U.field('Status', st));
        body.push(U.field('Internal note', note));
        body.push(err);
        body.push(h('div', { class: 'lla-actions-row', attrs: { style: 'margin-top:12px' } }, save));
      } else if (m.adminNote) {
        body.push(h('h3', { class: 'lla-sub-title', text: 'Internal note' }));
        body.push(h('div', { class: 'lla-message-body', text: m.adminNote }));
      }
      U.setDrawerBody(body, 'Message from ' + m.name);
    }, function (err) { U.setDrawerBody(errorState(err, function () { openMessage(id); })); });
  }

  // ---------------- Profile reports ("Report this profile")
  // Lawyer profiles are listed automatically after registration, before any
  // review; visitors can report suspicious profiles. A report never hides a
  // profile by itself: the reviewer decides (Hide = the existing publish action).
  var reportsQuery = { page: 1, limit: 20, status: 'open' };
  var reportsList = null;
  var RSTATUS = { open: ['Open', 'warn'], reviewed: ['Reviewed', 'info'], action_taken: ['Action taken', 'good'], dismissed: ['Dismissed', 'plain'] };
  VIEWS.reports = {
    title: 'Profile reports',
    sub: 'Reports about public lawyer profiles, sent with “Report this profile”',
    render: function (root) {
      var tabBox = h('div');
      reportsList = listPage(root, {
        query: reportsQuery,
        toolbar: function (top, reload) {
          top.appendChild(tabBox);
          tabBox.reload = reload;
          top.appendChild(notice('Profiles are listed automatically when a lawyer registers, before any review. Check reported profiles first; hide a profile if it may be fake.'));
        },
        onData: function (data) {
          U.clear(tabBox);
          var c = data.counts || {};
          tabBox.appendChild(tabs([['open', 'Open', c.open], ['reviewed', 'Reviewed', null], ['action_taken', 'Action taken', null], ['dismissed', 'Dismissed', null], ['all', 'All', null]],
            reportsQuery.status, function (s) { reportsQuery.status = s; tabBox.reload(); }));
        },
        load: function (q) { return A.get('/lawyer-reports', q); },
        columns: [
          { label: 'Received', className: 'lla-cell-num', render: function (r) { return U.dateTime(r.createdAt); } },
          { label: 'Lawyer', render: function (r) { return h('div', null, [h('div', { class: 'lla-cell-main', text: r.lawyerName || 'Lawyer' }), h('div', { class: 'lla-cell-sub', text: r.lawyerHidden ? 'Hidden from directory' : r.lawyerListed ? (r.lawyerReviewed ? 'Listed · reviewed' : 'Listed · not yet reviewed') : 'Not listed' })]); } },
          { label: 'Reason', render: function (r) { return h('div', null, [h('div', { class: 'lla-cell-main', text: r.reasonLabel }), r.details ? h('div', { class: 'lla-cell-sub', text: r.details.length > 90 ? r.details.slice(0, 90) + '…' : r.details }) : null]); } },
          { label: 'Status', render: function (r) { var s = RSTATUS[r.status] || [r.status, 'plain']; return U.badge(s[0], s[1]); } }
        ],
        onRow: function (r) { openReport(r); },
        empty: ['No reports', 'Nothing in this folder.']
      });
    }
  };

  function openReport(r) {
    var body = [];
    var s = RSTATUS[r.status] || [r.status, 'plain'];
    body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [U.badge(s[0], s[1]), r.lawyerHidden ? U.badge('Profile hidden', 'plain') : r.lawyerReviewed ? U.badge('Reviewed profile', 'good') : U.badge('Not yet reviewed', 'warn')]));
    body.push(dl([['Lawyer', r.lawyerName || '—'], ['Reason', r.reasonLabel], ['Received', U.dateTime(r.createdAt)], ['Reporter', r.signedIn ? 'Signed-in user' : 'Visitor (not signed in)'], ['Reporter email', r.contactEmail || 'Not given'], ['Handled', r.handledAt ? U.dateTime(r.handledAt) : '—']]));
    if (r.details) { body.push(h('h3', { class: 'lla-sub-title', text: 'Details' })); body.push(h('div', { class: 'lla-message-body', text: r.details })); }
    var links = [h('a', { class: 'lla-btn lla-btn-sm', href: '../lawyer-profile.html?id=' + encodeURIComponent(r.lawyerId), attrs: { target: '_blank', rel: 'noopener' }, text: 'Open public profile' }),
      h('a', { class: 'lla-btn lla-btn-sm', href: '#/verifications', text: 'Lawyer verification' })];
    if (can('lawyers:review') && r.lawyerListed && !r.lawyerHidden) {
      var hide = h('button', { class: 'lla-btn lla-btn-sm lla-btn-danger', type: 'button', text: 'Hide profile from directory' });
      hide.addEventListener('click', function () {
        U.modal({
          title: 'Hide this profile?',
          body: h('p', { text: 'The profile is removed from Lawyer Connect and the Free Legal Aid list. The lawyer keeps dashboard access. You can show it again from Lawyers.' }),
          okText: 'Hide profile', tone: 'danger',
          onOk: function () {
            return A.patch('/lawyers/' + encodeURIComponent(r.lawyerId) + '/publish', { isPublished: false }).then(function () {
              U.toast('Profile hidden from the directory.');
              r.lawyerHidden = true; r.lawyerListed = false;
              if (reportsList) reportsList.refresh();
              openReport(r);
            }, function (ex) { if (handleAuthError(ex)) return; throw new Error(friendly(ex)); });
          }
        });
      });
      links.push(hide);
    }
    body.push(h('div', { class: 'lla-actions-row', attrs: { style: 'margin-top:12px;flex-wrap:wrap;gap:8px' } }, links));
    if (can('lawyers:review')) {
      var st = U.select([['open', 'Open'], ['reviewed', 'Reviewed'], ['action_taken', 'Action taken'], ['dismissed', 'Dismissed']], r.status);
      var note = U.textarea({ value: r.adminNote || '', attrs: { maxlength: 1000, rows: 3, placeholder: 'Internal note for the team (never shown to the reporter or the lawyer)' } });
      var save = h('button', { class: 'lla-btn lla-btn-primary lla-btn-sm', type: 'button', text: 'Save' });
      var err = h('p', { class: 'lla-form-error', hidden: true, attrs: { role: 'alert' } });
      save.addEventListener('click', function () {
        err.hidden = true;
        U.busy(save, true);
        A.patch('/lawyer-reports/' + encodeURIComponent(r.id), { status: st.value, adminNote: note.value }).then(function (res) {
          U.busy(save, false);
          U.toast('Report updated.');
          refreshNavCounts();
          if (reportsList) reportsList.refresh();
          var upd = res.data.report;
          r.status = upd.status; r.adminNote = upd.adminNote; r.handledAt = upd.handledAt;
          openReport(r);
        }, function (ex) {
          U.busy(save, false);
          if (handleAuthError(ex)) return;
          err.textContent = friendly(ex); err.hidden = false;
        });
      });
      body.push(h('h3', { class: 'lla-sub-title', text: 'Handling' }));
      body.push(U.field('Status', st));
      body.push(U.field('Internal note', note));
      body.push(err);
      body.push(h('div', { class: 'lla-actions-row', attrs: { style: 'margin-top:12px' } }, save));
    } else if (r.adminNote) {
      body.push(h('h3', { class: 'lla-sub-title', text: 'Internal note' }));
      body.push(h('div', { class: 'lla-message-body', text: r.adminNote }));
    }
    U.openDrawer('Profile report', body);
    U.setDrawerBody(body, 'Report about ' + (r.lawyerName || 'a lawyer'));
  }

  // ---------------- Audit log
  var auditQuery = { page: 1, limit: 25, action: '', outcome: 'all', from: '', to: '' };
  var auditActions = null;
  VIEWS.audit = {
    title: 'Audit log',
    sub: 'Every administrator action and denied attempt',
    render: function (root) {
      var actionSelect = U.select([['', 'All actions']], auditQuery.action, { attrs: { 'aria-label': 'Action' } });
      var fillActions = function () {
        if (!auditActions) return;
        U.clear(actionSelect);
        actionSelect.appendChild(h('option', { value: '', text: 'All actions' }));
        [['admin.', 'Admin accounts (all)'], ['user.', 'User accounts (all)'], ['lawyer.', 'Lawyer review (all)']].forEach(function (g) { actionSelect.appendChild(h('option', { value: g[0], text: g[1] })); });
        Object.keys(auditActions).forEach(function (k) { actionSelect.appendChild(h('option', { value: k, text: auditActions[k] })); });
        actionSelect.value = auditQuery.action;
      };
      listPage(root, {
        query: auditQuery,
        toolbar: function (top, reload) {
          actionSelect.addEventListener('change', function () { auditQuery.action = actionSelect.value; reload(); });
          top.appendChild(h('div', { class: 'lla-toolbar' }, [
            actionSelect,
            U.select([['all', 'Any outcome'], ['success', 'Success'], ['denied', 'Denied'], ['failed', 'Failed']], auditQuery.outcome, { attrs: { 'aria-label': 'Outcome' }, onchange: function (e) { auditQuery.outcome = e.target.value; reload(); } }),
            U.input({ type: 'date', value: auditQuery.from, attrs: { 'aria-label': 'From' }, onchange: function (e) { auditQuery.from = e.target.value; reload(); } }),
            U.input({ type: 'date', value: auditQuery.to, attrs: { 'aria-label': 'Until' }, onchange: function (e) { auditQuery.to = e.target.value; reload(); } })
          ]));
          fillActions();
        },
        onData: function (data) {
          if (!auditActions) { auditActions = data.actions || {}; fillActions(); }
        },
        load: function (q) { return A.get('/audit-logs', q); },
        columns: [
          { label: 'Time', className: 'lla-cell-num', render: function (e) { return U.dateTime(e.createdAt); } },
          { label: 'Admin', render: function (e) { return h('div', null, [h('div', { class: 'lla-cell-main', text: e.actor.name || e.actor.email || 'System' }), h('div', { class: 'lla-cell-sub', text: e.actor.level === 'super_admin' ? 'Super Admin' : e.actor.level === 'admin' ? 'Admin' : e.actor.email }) ]); } },
          { label: 'Action', render: function (e) { return h('div', null, [h('div', { class: 'lla-cell-main', text: (auditActions && auditActions[e.action]) || e.action }), h('div', { class: 'lla-cell-sub', text: e.summary })]); } },
          { label: 'Target', render: function (e) { return e.target && (e.target.label || e.target.id) ? h('div', { class: 'lla-cell-sub', text: (e.target.type ? e.target.type + ': ' : '') + (e.target.label || e.target.id) }) : '—'; } },
          { label: 'Outcome', render: function (e) { return e.outcome === 'success' ? U.badge('Success', 'good') : e.outcome === 'denied' ? U.badge('Denied', 'bad') : U.badge('Failed', 'warn'); } }
        ],
        onRow: function (e) {
          var details = e.details ? Object.keys(e.details).map(function (k) { var v = e.details[k]; return [k, Array.isArray(v) ? (v.join(', ') || '(none)') : String(v)]; }) : [];
          U.openDrawer('Audit entry', [dl([
            ['Time', U.dateTime(e.createdAt)], ['Admin', (e.actor.name || '') + (e.actor.email ? ' <' + e.actor.email + '>' : '')], ['Level', e.actor.level],
            ['Action', (auditActions && auditActions[e.action]) || e.action], ['Outcome', e.outcome], ['Target', e.target ? (e.target.type + ' ' + (e.target.label || '') + ' ' + (e.target.id ? '(' + e.target.id + ')' : '')).trim() : ''],
            ['Summary', e.summary], ['IP address', e.ip]
          ].concat(details)), h('p', { class: 'lla-privacy', text: 'Audit entries cannot be edited or deleted. They never contain passwords, tokens or private user content.' })]);
        },
        empty: ['No entries', 'No admin activity matches these filters.']
      });
    }
  };

  // ---------------- System health
  VIEWS.system = {
    title: 'System health',
    sub: 'Live checks of the backend (no secrets are shown)',
    render: function (root) {
      var box = h('div');
      root.appendChild(box);
      box.appendChild(h('div', { class: 'lla-card' }, U.stateBox('loading', 'Checking…')));
      A.get('/system').then(function (res) {
        var d = res.data;
        U.clear(box);
        var overall = d.status === 'ok' ? ['All systems operational', 'good'] : d.status === 'degraded' ? ['Running with warnings', 'warn'] : ['Problem detected', 'bad'];
        box.appendChild(h('div', { class: 'lla-card', attrs: { style: 'margin-bottom:16px' } }, h('div', { class: 'lla-card-head', attrs: { style: 'margin:0;align-items:center' } }, [
          h('div', null, [h('h2', { class: 'lla-card-title', text: overall[0] }), h('p', { class: 'lla-card-sub', text: 'Checked ' + U.dateTime(d.checkedAt) })]), U.badge(overall[0], overall[1])
        ])));
        var row = function (k, v, tone) { return h('li', null, [h('span', { text: k }), tone ? U.badge(v, tone) : h('span', { class: 'lla-num', text: v })]); };
        box.appendChild(h('div', { class: 'lla-grid lla-kpis', attrs: { style: 'grid-template-columns:repeat(auto-fit,minmax(260px,1fr))' } }, [
          card('Database', null, h('ul', { class: 'lla-list' }, [row('Connection', d.database.state, d.database.state === 'connected' ? 'good' : 'bad'), row('Ping', d.database.pingMs === null ? '—' : d.database.pingMs + ' ms')])),
          card('Services', 'Configuration status only', h('ul', { class: 'lla-list' }, [row('AI (Gemini)', d.services.ai, d.services.ai === 'configured' ? 'good' : 'warn'), row('Email (contact form)', d.services.email, d.services.email === 'configured' ? 'good' : 'warn')])),
          card('Server', null, h('ul', { class: 'lla-list' }, [row('Uptime', U.duration(d.server.uptimeSeconds)), row('Environment', d.server.environment), row('Node.js', d.server.nodeVersion), row('Memory (RSS)', d.server.memoryMb.rss + ' MB'), row('App version', d.server.appVersion || '—')])),
          card('Data retention', null, h('ul', { class: 'lla-list' }, [row('Audit log', d.retention.auditLogDays + ' days'), row('Contact messages', d.retention.contactMessageDays + ' days')]))
        ]));
      }, function (err) {
        U.clear(box);
        box.appendChild(h('div', { class: 'lla-card' }, errorState(err, function () { route(); })));
      });
    }
  };

  // ---------------- Admin management (Super Admin)
  var adminsData = null;
  VIEWS.admins = {
    title: 'Admin management',
    sub: 'Super Admin only — administrator accounts and permissions',
    render: function (root) {
      var head = h('div', { class: 'lla-toolbar' }, [
        h('p', { class: 'lla-muted', attrs: { style: 'margin:0;flex:1;min-width:220px' }, text: 'Regular admins can only use the permissions you grant. Admin management itself can never be granted. Nobody can change their own account here.' }),
        h('button', { class: 'lla-btn lla-btn-primary', type: 'button', text: 'Add admin', onclick: addAdmin })
      ]);
      var tableCard = h('section', { class: 'lla-card lla-table-card' });
      root.appendChild(head);
      root.appendChild(tableCard);
      var draw = function (loading, err) {
        U.clear(tableCard);
        if (err) { tableCard.appendChild(errorState(err, load)); return; }
        tableCard.appendChild(h('div', { class: 'lla-table-scroll' }, U.table({
          loading: loading,
          rows: adminsData ? adminsData.items : [],
          columns: [
            { label: 'Admin', render: function (a) { return h('div', null, [h('div', { class: 'lla-cell-main', text: a.name + (a.id === state.me.id ? ' (you)' : '') }), h('div', { class: 'lla-cell-sub', text: a.email })]); } },
            { label: 'Level', render: function (a) { return a.level === 'super_admin' ? U.badge('Super Admin', 'dark') : U.badge(a.legacy ? 'Admin (legacy)' : 'Admin', 'plain'); } },
            { label: 'Permissions', render: function (a) { return a.level === 'super_admin' ? 'All' : (a.permissions.length ? String(a.permissions.length) + ' granted' : 'None'); } },
            { label: 'Status', render: function (a) { return a.isActive ? (a.passwordChangeRequired ? U.badge('Must change password', 'warn') : U.badge('Active', 'good')) : U.badge('Deactivated', 'bad'); } },
            { label: 'Last login', className: 'lla-cell-num', render: function (a) { return U.relative(a.lastLoginAt); } }
          ],
          onRowClick: function (a) { openAdmin(a.id); },
          empty: ['No admin accounts']
        })));
      };
      function load() {
        draw(true);
        return A.get('/admins').then(function (res) { adminsData = res.data; draw(false); }, function (err) { draw(false, err); });
      }
      VIEWS.admins.reload = load;
      load();
    }
  };

  function permissionChecks(selected, disabled) {
    var boxes = {};
    var wrap = h('div', { class: 'lla-checks' }, Object.keys(state.catalog).map(function (k) {
      var cb = h('input', { type: 'checkbox', value: k, checked: selected.indexOf(k) >= 0, disabled: !!disabled });
      boxes[k] = cb;
      return h('label', { class: 'lla-check' }, [cb, h('span', null, [h('strong', { text: k }), h('small', { text: state.catalog[k] })])]);
    }));
    // "manage" implies "view" (the server enforces the same rule)
    var implies = { 'users:manage': 'users:view', 'lawyers:review': 'lawyers:view', 'contact:manage': 'contact:view', 'aid:review': 'aid:view' };
    Object.keys(implies).forEach(function (m) {
      if (!boxes[m] || !boxes[implies[m]]) return;
      boxes[m].addEventListener('change', function () { if (boxes[m].checked) boxes[implies[m]].checked = true; });
      boxes[implies[m]].addEventListener('change', function () { if (!boxes[implies[m]].checked) boxes[m].checked = false; });
    });
    wrap.value = function () { return Object.keys(boxes).filter(function (k) { return boxes[k].checked; }); };
    wrap.setDisabled = function (d) { Object.keys(boxes).forEach(function (k) { boxes[k].disabled = d; }); };
    return wrap;
  }

  function tempPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var special = '@#$%&*!?';
    var arr = new Uint32Array(14);
    window.crypto.getRandomValues(arr);
    var out = '';
    for (var i = 0; i < 11; i++) out += chars[arr[i] % chars.length];
    return out + special[arr[11] % special.length] + String(arr[12] % 10) + 'Aa'.charAt(arr[13] % 2);
  }
  function passwordField(label) {
    var inp = U.input({ type: 'text', attrs: { maxlength: 128, autocomplete: 'off', spellcheck: 'false' } });
    var gen = h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Generate', onclick: function () { inp.value = tempPassword(); } });
    var f = U.field(label, inp, 'Share it with the admin securely. They must choose a new password when they first sign in.');
    f.insertBefore(h('div', { class: 'lla-pw-row' }, [inp, gen]), f.querySelector('.lla-hint'));
    f.input = inp;
    return f;
  }

  function addAdmin() {
    var name = U.input({ attrs: { maxlength: 120, autocomplete: 'off' } });
    var email = U.input({ type: 'email', attrs: { maxlength: 254, autocomplete: 'off' } });
    var pw = passwordField('Temporary password');
    var level = U.select([['admin', 'Admin — only the permissions below'], ['super_admin', 'Super Admin — everything, incl. admin management']], 'admin');
    var perms = permissionChecks(['lawyers:view', 'lawyers:review']);
    level.addEventListener('change', function () { perms.setDisabled(level.value === 'super_admin'); });
    U.modal({
      title: 'Add an admin',
      body: [U.field('Name', name), U.field('Email', email, 'Must not already be used by a customer, lawyer or admin account.'), pw, U.field('Level', level), h('label', { class: 'lla-hint', text: 'Permissions (for Admin level)' }), perms],
      okText: 'Create admin',
      onOk: function () {
        if (name.value.trim().length < 2) throw new Error('Enter the admin’s name.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) throw new Error('Enter a valid email address.');
        if (!pw.input.value) throw new Error('Enter or generate a temporary password.');
        return apiAction(A.post('/admins', { name: name.value.trim(), email: email.value.trim(), temporaryPassword: pw.input.value, level: level.value, permissions: level.value === 'super_admin' ? [] : perms.value() }), 'Admin created.').then(function () {
          if (VIEWS.admins.reload) VIEWS.admins.reload();
        });
      }
    });
  }

  function openAdmin(id) {
    var a = adminsData && adminsData.items.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var self = a.id === state.me.id;
    var body = [];
    body.push(h('div', { class: 'lla-chips', attrs: { style: 'margin-bottom:14px' } }, [
      a.level === 'super_admin' ? U.badge('Super Admin', 'dark') : U.badge(a.legacy ? 'Admin (legacy)' : 'Admin', 'plain'),
      a.isActive ? U.badge('Active', 'good') : U.badge('Deactivated', 'bad'),
      a.passwordChangeRequired ? U.badge('Must change password', 'warn') : null
    ]));
    if (a.legacy) body.push(notice('Created before the dashboard existed. It keeps exactly what it could do before: lawyer review. It was not promoted.'));
    body.push(dl([['Email', a.email], ['Created', U.dateTime(a.createdAt)], ['Last login', a.lastLoginAt ? U.dateTime(a.lastLoginAt) : 'Never'],
      a.deactivation ? ['Deactivated', U.dateTime(a.deactivation.at) + ' — ' + (a.deactivation.reason || '')] : null]));
    body.push(h('h3', { class: 'lla-sub-title', text: 'Permissions' }));
    body.push(a.level === 'super_admin' ? h('p', { class: 'lla-muted', text: 'Super Admins have every permission, including admin management.' })
      : (a.permissions.length ? h('div', { class: 'lla-chips' }, a.permissions.map(function (p) { return h('span', { class: 'lla-chip', text: p }); })) : h('p', { class: 'lla-muted', text: 'No permissions — this admin can only see the overview.' })));
    if (self) {
      body.push(h('p', { class: 'lla-privacy', text: 'This is your own account. You cannot change your own level, permissions or status — ask another Super Admin.' }));
    } else {
      var acts = [];
      if (a.level !== 'super_admin') acts.push(h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Edit permissions', onclick: function () { editPermissions(a); } }));
      acts.push(h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: a.level === 'super_admin' ? 'Change to Admin' : 'Promote to Super Admin', onclick: function () { changeLevel(a); } }));
      acts.push(h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: 'Set temporary password', onclick: function () { resetPassword(a); } }));
      acts.push(a.isActive
        ? h('button', { class: 'lla-btn lla-btn-danger lla-btn-sm', type: 'button', text: 'Deactivate', onclick: function () { setAdminActive(a, false); } })
        : h('button', { class: 'lla-btn lla-btn-good lla-btn-sm', type: 'button', text: 'Reactivate', onclick: function () { setAdminActive(a, true); } }));
      body.push(h('h3', { class: 'lla-sub-title', text: 'Actions' }));
      body.push(h('div', { class: 'lla-actions-row' }, acts));
    }
    U.openDrawer(a.name, body);
  }

  function afterAdminChange(id) {
    return (VIEWS.admins.reload ? VIEWS.admins.reload() : Promise.resolve()).then(function () { U.closeDrawer(); if (id) openAdmin(id); });
  }
  function editPermissions(a) {
    var perms = permissionChecks(a.permissions);
    U.modal({
      title: 'Permissions for ' + a.name,
      body: [h('p', { text: 'Removing a permission signs this admin out immediately.' }), perms],
      okText: 'Save permissions',
      onOk: function () { return apiAction(A.patch('/admins/' + encodeURIComponent(a.id) + '/permissions', { permissions: perms.value() }), 'Permissions updated.').then(function () { return afterAdminChange(a.id); }); }
    });
  }
  function changeLevel(a) {
    var promote = a.level !== 'super_admin';
    U.modal({
      title: promote ? 'Promote ' + a.name + ' to Super Admin?' : 'Change ' + a.name + ' to Admin?',
      body: h('p', { text: promote ? 'Super Admins can do everything, including managing other admins and their permissions.' : 'The account loses all permissions (grant them again as needed) and is signed out. The last active Super Admin cannot be demoted.' }),
      okText: promote ? 'Promote' : 'Change to Admin', tone: promote ? null : 'danger',
      onOk: function () { return apiAction(A.patch('/admins/' + encodeURIComponent(a.id) + '/level', { level: promote ? 'super_admin' : 'admin' }), 'Level updated.').then(function () { return afterAdminChange(a.id); }); }
    });
  }
  function resetPassword(a) {
    var pw = passwordField('Temporary password');
    U.modal({
      title: 'Set a temporary password for ' + a.name,
      body: [h('p', { text: 'The admin is signed out everywhere and must choose a new password at the next sign-in.' }), pw],
      okText: 'Set temporary password', tone: 'danger',
      onOk: function () {
        if (!pw.input.value) throw new Error('Enter or generate a temporary password.');
        return apiAction(A.post('/admins/' + encodeURIComponent(a.id) + '/reset-password', { temporaryPassword: pw.input.value }), 'Temporary password set.').then(function () { return afterAdminChange(a.id); });
      }
    });
  }
  function setAdminActive(a, active) {
    textModal({
      title: (active ? 'Reactivate ' : 'Deactivate ') + a.name + '?',
      text: active ? 'The admin can sign in again with the same level and permissions.' : 'The admin is signed out everywhere and cannot sign in until reactivated. The last active Super Admin cannot be deactivated.',
      label: active ? 'Note (optional)' : 'Reason (recorded in the audit log)', required: !active, max: 300,
      okText: active ? 'Reactivate' : 'Deactivate', tone: active ? 'good' : 'danger',
      submit: function (v) {
        return apiAction(A.patch('/admins/' + encodeURIComponent(a.id) + (active ? '/reactivate' : '/deactivate'), { reason: v }), active ? 'Admin reactivated.' : 'Admin deactivated.').then(function () { return afterAdminChange(a.id); });
      }
    });
  }

  boot();
})();
