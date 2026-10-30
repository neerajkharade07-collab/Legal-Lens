/* =====================================================================
   CASEONE Admin — UI helpers
   XSS safety: every value from the API is inserted as text (textContent
   or text nodes). innerHTML is never used with data. Links built from
   data are limited to mailto: with an encoded, validated address.
   ===================================================================== */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /**
   * h('div', { class: 'x', text: 'y', onclick: fn, attrs: { 'aria-label': 'z' } }, [children])
   * Children may be nodes, strings (→ text nodes), null/false (skipped) or arrays.
   */
  function h(tag, props, children) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = String(v);
      else if (k === 'attrs') Object.keys(v).forEach(function (a) { if (v[a] !== undefined && v[a] !== null && v[a] !== false) n.setAttribute(a, String(v[a])); });
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { n.dataset[d] = String(v[d]); });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'html') throw new Error('html is not allowed');
      else n[k] = v;
    });
    append(n, children);
    return n;
  }
  function append(n, children) {
    if (children === undefined || children === null || children === false) return n;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === undefined || c === null || c === false) return;
      if (Array.isArray(c)) append(n, c);
      else if (typeof c === 'string' || typeof c === 'number') n.appendChild(document.createTextNode(String(c)));
      else n.appendChild(c);
    });
    return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; }

  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, children) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (a) { n.setAttribute(a, String(attrs[a])); });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  var ICONS = {
    overview: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z',
    users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
    lawyers: 'M12 3l8 4-8 4-8-4 8-4zM4 11v5l8 4 8-4v-5',
    verify: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
    aid: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z',
    consultations: 'M8 7V3M16 7V3M4 10h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    contact: 'M4 6h16v12H4zM4 7l8 6 8-6',
    audit: 'M9 5h10M9 12h10M9 19h10M5 5h.01M5 12h.01M5 19h.01',
    system: 'M3 12h4l3-8 4 16 3-8h4',
    admins: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01'
  };
  function icon(name) {
    return svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [svg('path', { d: ICONS[name] || '' })]);
  }

  // ---------- formatting ----------
  var dtf = null;
  try { dtf = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { dtf = null; }
  var df = null;
  try { df = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { df = null; }
  function dateTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return dtf ? dtf.format(d) : d.toISOString().slice(0, 16).replace('T', ' ');
  }
  function date(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return df ? df.format(d) : d.toISOString().slice(0, 10);
  }
  function relative(v) {
    if (!v) return 'never';
    var s = (Date.now() - new Date(v).getTime()) / 1000;
    if (isNaN(s)) return '—';
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 30 * 86400) return Math.floor(s / 86400) + ' d ago';
    return date(v);
  }
  function num(v) {
    var n = Number(v) || 0;
    try { return n.toLocaleString('en-IN'); } catch (e) { return String(n); }
  }
  function money(v) {
    var n = Number(v) || 0;
    try { return '₹' + n.toLocaleString('en-IN'); } catch (e) { return '₹' + n; }
  }
  function duration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return (d ? d + 'd ' : '') + (d || hh ? hh + 'h ' : '') + m + 'm';
  }

  function badge(text, tone) {
    return h('span', { class: 'lla-badge' + (tone ? ' is-' + tone : ''), text: text });
  }

  function mailtoLink(email, subject) {
    var e = String(email || '');
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e)) return null;
    return h('a', { class: 'lla-btn lla-btn-ghost lla-btn-sm', href: 'mailto:' + encodeURIComponent(e) + (subject ? '?subject=' + encodeURIComponent('Re: ' + subject) : ''), text: 'Reply by email' });
  }

  // ---------- states ----------
  function stateBox(kind, title, text, action) {
    return h('div', { class: 'lla-state' + (kind === 'error' ? ' is-error' : ''), attrs: { role: kind === 'error' ? 'alert' : 'status' } }, [
      h('strong', { text: title }),
      text ? h('span', { text: text }) : null,
      action ? h('div', null, h('button', { class: 'lla-btn lla-btn-ghost lla-btn-sm', type: 'button', text: action[0], onclick: action[1] })) : null
    ]);
  }
  function skeletonRows(cols, rows) {
    var out = [];
    for (var i = 0; i < (rows || 6); i++) {
      var tr = h('tr', { class: 'lla-skeleton' });
      for (var c = 0; c < cols; c++) tr.appendChild(h('td', null, h('span', { attrs: { style: 'width:' + (40 + ((i * 7 + c * 13) % 50)) + '%' } })));
      out.push(tr);
    }
    return out;
  }

  /**
   * Table card: { columns: [{ label, render(row) → node|string, className }], rows, onRowClick, empty: [title, text] }
   */
  function table(opts) {
    var thead = h('thead', null, h('tr', null, opts.columns.map(function (c) {
      return h('th', { class: c.className || '', attrs: { scope: 'col' }, text: c.label });
    })));
    var tbody = h('tbody');
    if (opts.loading) append(tbody, skeletonRows(opts.columns.length));
    else if (!opts.rows || !opts.rows.length) {
      tbody.appendChild(h('tr', null, h('td', { attrs: { colspan: opts.columns.length } }, stateBox('empty', opts.empty ? opts.empty[0] : 'Nothing here yet', opts.empty ? opts.empty[1] : ''))));
    } else {
      opts.rows.forEach(function (row) {
        var tr = h('tr', { class: opts.onRowClick ? 'is-clickable' : '' });
        opts.columns.forEach(function (c) {
          var v = c.render(row);
          tr.appendChild(h('td', { class: c.className || '' }, v === undefined || v === null || v === '' ? '—' : v));
        });
        if (opts.onRowClick) {
          tr.tabIndex = 0;
          tr.setAttribute('role', 'button');
          tr.addEventListener('click', function (e) { if (!e.target.closest('button, a, input, select')) opts.onRowClick(row); });
          tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === tr) opts.onRowClick(row); });
        }
        tbody.appendChild(tr);
      });
    }
    return h('table', { class: 'lla-table' }, [thead, tbody]);
  }

  /** Pager: { page, totalPages, total, limit, onPage } */
  function pager(p) {
    var from = p.total ? (p.page - 1) * p.limit + 1 : 0;
    var to = Math.min(p.total, p.page * p.limit);
    var btns = h('div', { class: 'lla-pager-btns' });
    var mk = function (label, page, disabled, current, aria) {
      return h('button', { class: 'lla-page-btn', type: 'button', text: label, disabled: !!disabled, attrs: { 'aria-current': current ? 'page' : null, 'aria-label': aria || ('Page ' + label) }, onclick: function () { p.onPage(page); } });
    };
    btns.appendChild(mk('‹', p.page - 1, p.page <= 1, false, 'Previous page'));
    var pages = [];
    var start = Math.max(1, p.page - 2), end = Math.min(p.totalPages, start + 4);
    start = Math.max(1, end - 4);
    for (var i = start; i <= end; i++) pages.push(i);
    if (start > 1) { btns.appendChild(mk('1', 1)); if (start > 2) btns.appendChild(h('span', { text: '…', attrs: { 'aria-hidden': 'true' } })); }
    pages.forEach(function (n) { btns.appendChild(mk(String(n), n, false, n === p.page)); });
    if (end < p.totalPages) { if (end < p.totalPages - 1) btns.appendChild(h('span', { text: '…', attrs: { 'aria-hidden': 'true' } })); btns.appendChild(mk(String(p.totalPages), p.totalPages)); }
    btns.appendChild(mk('›', p.page + 1, p.page >= p.totalPages, false, 'Next page'));
    return h('div', { class: 'lla-pager' }, [h('span', { text: p.total ? ('Showing ' + num(from) + '–' + num(to) + ' of ' + num(p.total)) : 'No results' }), btns]);
  }

  // ---------- toasts ----------
  function toast(message, isError) {
    var box = $('llaToasts');
    var t = h('div', { class: 'lla-toast' + (isError ? ' is-error' : ''), text: message, attrs: { role: isError ? 'alert' : 'status' } });
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, isError ? 6500 : 3800);
  }

  // ---------- focus helpers ----------
  var lastFocus = null;
  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- drawer ----------
  var drawerOnClose = null;
  function openDrawer(title, body, onClose) {
    lastFocus = document.activeElement;
    $('llaDrawerTitle').textContent = title;
    clear($('llaDrawerBody'));
    append($('llaDrawerBody'), body);
    $('llaDrawerWrap').hidden = false;
    drawerOnClose = onClose || null;
    $('llaDrawer').focus();
  }
  function setDrawerBody(body, title) {
    if (title) $('llaDrawerTitle').textContent = title;
    clear($('llaDrawerBody'));
    append($('llaDrawerBody'), body);
  }
  function closeDrawer() {
    if ($('llaDrawerWrap').hidden) return;
    $('llaDrawerWrap').hidden = true;
    clear($('llaDrawerBody'));
    var cb = drawerOnClose; drawerOnClose = null;
    if (cb) cb();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function drawerOpen() { return !$('llaDrawerWrap').hidden; }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-close-drawer]')) closeDrawer(); });

  // ---------- modal ----------
  var modalState = null;
  /**
   * modal({ title, body: node|[nodes], okText, tone: 'danger'|'good'|null, onOk: () => Promise })
   * onOk may throw/reject: the error message is shown in the modal and it stays open.
   */
  function modal(opts) {
    var prevFocus = document.activeElement;
    $('llaModalTitle').textContent = opts.title;
    clear($('llaModalBody'));
    append($('llaModalBody'), opts.body);
    var err = $('llaModalError'); err.hidden = true; err.textContent = '';
    var ok = $('llaModalOk');
    ok.textContent = opts.okText || 'Confirm';
    ok.className = 'lla-btn ' + (opts.tone === 'danger' ? 'lla-btn-danger' : opts.tone === 'good' ? 'lla-btn-good' : 'lla-btn-primary');
    ok.disabled = false; ok.removeAttribute('aria-busy');
    $('llaModalCancel').disabled = false;
    modalState = { opts: opts, prevFocus: prevFocus, busy: false };
    $('llaModalWrap').hidden = false;
    var first = $('llaModalBody').querySelector('input, textarea, select');
    (first || $('llaModalCancel')).focus();
  }
  function closeModal() {
    if (!modalState || modalState.busy) return;
    var prev = modalState.prevFocus;
    modalState = null;
    $('llaModalWrap').hidden = true;
    clear($('llaModalBody'));
    if (prev && prev.focus) prev.focus();
  }
  function modalError(msg) {
    var err = $('llaModalError');
    err.textContent = msg; err.hidden = false;
  }
  $('llaModalCancel').addEventListener('click', closeModal);
  $('llaModalWrap').addEventListener('click', function (e) { if (e.target === $('llaModalWrap')) closeModal(); });
  $('llaModalOk').addEventListener('click', function () {
    if (!modalState || modalState.busy) return;
    var st = modalState, ok = $('llaModalOk');
    $('llaModalError').hidden = true;
    st.busy = true; ok.disabled = true; ok.setAttribute('aria-busy', 'true'); $('llaModalCancel').disabled = true;
    Promise.resolve().then(function () { return st.opts.onOk(); }).then(function () {
      st.busy = false; closeModal();
    }, function (e) {
      st.busy = false; ok.disabled = false; ok.removeAttribute('aria-busy'); $('llaModalCancel').disabled = false;
      modalError((e && e.message) || 'Something went wrong. Please try again.');
    });
  });
  document.addEventListener('keydown', function (e) {
    if (modalState) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      else trapFocus($('llaModal'), e);
      return;
    }
    if (drawerOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
      else trapFocus($('llaDrawer'), e);
    }
  });

  // ---------- form bits ----------
  function field(label, control, hint) {
    var id = control.id || ('f' + Math.random().toString(36).slice(2, 9));
    control.id = id;
    return h('div', { class: 'lla-field' }, [h('label', { attrs: { for: id }, text: label }), control, hint ? h('p', { class: 'lla-hint', text: hint }) : null]);
  }
  function textarea(props) { return h('textarea', Object.assign({ class: 'lla-textarea' }, props || {})); }
  function input(props) { return h('input', Object.assign({ class: 'lla-input' }, props || {})); }
  function select(options, value, props) {
    var s = h('select', Object.assign({ class: 'lla-select' }, props || {}));
    options.forEach(function (o) { var opt = h('option', { value: o[0], text: o[1] }); s.appendChild(opt); });
    if (value !== undefined) s.value = value;
    return s;
  }
  function debounce(fn, ms) {
    var t = null;
    return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
  }
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
  }

  window.LLAdminUI = {
    $: $, h: h, append: append, clear: clear, svg: svg, icon: icon,
    dateTime: dateTime, date: date, relative: relative, num: num, money: money, duration: duration,
    badge: badge, mailtoLink: mailtoLink, stateBox: stateBox, table: table, pager: pager, toast: toast,
    openDrawer: openDrawer, setDrawerBody: setDrawerBody, closeDrawer: closeDrawer, drawerOpen: drawerOpen,
    modal: modal, closeModal: closeModal, field: field, textarea: textarea, input: input, select: select,
    debounce: debounce, busy: busy
  };
})();
