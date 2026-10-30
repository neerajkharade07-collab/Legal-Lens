/**
 * LegalLens — Legal Help: ChatGPT-style conversation sidebar.
 *
 *   var sidebar = LegalHelpSidebar.create({
 *     text,                       // MESSAGES.sidebar (labels)
 *     onNew(), onOpen(id), onRetry(), onLogin(),
 *     onRename(id, title) → Promise<{ ok, message? }>,
 *     onDelete(id)        → Promise<boolean>,
 *     onToggle(collapsed)         // desktop collapse / expand
 *   });
 *   sidebar.update({ status: 'loading'|'ready'|'error'|'signedOut', conversations, activeId, loadingId });
 *
 * The list itself always comes from the backend (MongoDB); this file only
 * displays it. Titles are inserted with textContent (never as HTML).
 * The search filters the loaded list in the browser (titles only).
 */
(function (global) {
  'use strict';

  var ui = global.LegalHelpComponents;
  var h = ui.h;
  var Icon = ui.Icon;

  var COLLAPSE_KEY = 'legalLens.guidance.sidebarCollapsed'; // per-browser display preference only
  var MAX_TITLE = 80;

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  /** "Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older". */
  function groupLabel(dateValue, T) {
    var d = dateValue ? new Date(dateValue) : null;
    if (!d || isNaN(d)) return T.groupOlder || 'Older';
    var days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
    if (days <= 0) return T.groupToday || 'Today';
    if (days === 1) return T.groupYesterday || 'Yesterday';
    if (days <= 7) return T.groupWeek || 'Previous 7 days';
    if (days <= 30) return T.groupMonth || 'Previous 30 days';
    return T.groupOlder || 'Older';
  }

  function create(options) {
    var T = options.text || {};
    var data = { status: 'loading', conversations: [], activeId: null, loadingId: null };
    var query = '';
    var openMenuId = null;
    var renamingId = null;
    var renameError = '';
    var savingId = null;
    var flash = '';
    var flashTimer = null;
    var collapsed = false;
    try { collapsed = global.localStorage && global.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) { /* ignore */ }

    // ---------- static parts ----------
    var listEl = h('div', { className: 'llh-sn__list', id: 'llh-sn-list' });
    var flashEl = h('p', { className: 'llh-sn__flash', role: 'status', 'aria-live': 'polite' });
    var search = h('input', {
      type: 'search',
      className: 'llh-sn__search-input',
      placeholder: T.searchPlaceholder || 'Search chats',
      'aria-label': T.searchLabel || 'Search chats by title',
      maxlength: '80',
      autocomplete: 'off'
    });
    search.addEventListener('input', function () {
      query = search.value.trim().toLowerCase();
      renderList();
    });

    var newBtn = h('button', {
      type: 'button',
      className: 'llh-sn__new',
      onClick: function () { closeMenu(); options.onNew(); }
    }, [Icon('plus', 17), h('span', { text: T.newChat || 'New Chat' })]);

    var collapseBtn = h('button', {
      type: 'button',
      className: 'llh-sn__icon-btn llh-sn__collapse',
      'aria-label': T.collapse || 'Close sidebar',
      title: T.collapse || 'Close sidebar',
      onClick: function () { setCollapsed(true); }
    }, [Icon('sidebar', 18)]);

    var closeBtn = h('button', {
      type: 'button',
      className: 'llh-sn__icon-btn llh-sn__close',
      'aria-label': T.closeMenu || 'Close chat list',
      title: T.closeMenu || 'Close chat list',
      onClick: function () { setDrawerOpen(false); }
    }, [Icon('close', 18)]);

    var element = h('aside', { className: 'llh-sn', 'aria-label': T.label || 'Chats', id: 'llh-sidebar' }, [
      h('div', { className: 'llh-sn__top' }, [
        h('a', { className: 'llh-sn__brand', href: '../index.html', 'aria-label': 'Legal Lens home' }, [
          h('span', { className: 'llh-sn__logo', 'aria-hidden': 'true', text: 'LL' }),
          h('span', { className: 'llh-sn__name', text: 'Legal Lens' })
        ]),
        collapseBtn,
        closeBtn
      ]),
      newBtn,
      h('div', { className: 'llh-sn__search' }, [Icon('search', 15), search]),
      flashEl,
      listEl,
      h('p', { className: 'llh-sn__foot', text: T.footer || '' })
    ]);

    var scrim = h('div', { className: 'llh-sn-scrim', hidden: true, onClick: function () { setDrawerOpen(false); } });

    // ---------- delete confirmation dialog ----------
    var dialogTitle = h('h2', { className: 'llh-dialog__title', id: 'llh-dialog-title', text: T.deleteTitle || 'Delete chat?' });
    var dialogText = h('p', { className: 'llh-dialog__text', id: 'llh-dialog-text' });
    var dialogMsg = h('p', { className: 'llh-dialog__msg', role: 'alert' });
    var cancelBtn = h('button', { type: 'button', className: 'llh-button llh-button--ghost', text: T.cancel || 'Cancel' });
    var confirmBtn = h('button', { type: 'button', className: 'llh-button llh-dialog__danger', text: T.deleteConfirm || 'Delete' });
    var dialogBox = h('div', {
      className: 'llh-dialog__box',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'llh-dialog-title',
      'aria-describedby': 'llh-dialog-text'
    }, [dialogTitle, dialogText, dialogMsg, h('div', { className: 'llh-dialog__actions' }, [cancelBtn, confirmBtn])]);
    var dialog = h('div', { className: 'llh-dialog', hidden: true }, [dialogBox]);
    var dialogReturnFocus = null;
    var dialogId = null;

    function openDialog(conv, returnFocus) {
      dialogId = conv.id;
      dialogReturnFocus = returnFocus || null;
      dialogText.textContent = (T.deleteText || 'This will permanently delete') + ' "' + conv.title + '" ' + (T.deleteTextEnd || 'and the documents uploaded in it. Other chats are not affected.');
      dialogMsg.textContent = '';
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      dialog.hidden = false;
      cancelBtn.focus();
    }
    function closeDialog() {
      dialog.hidden = true;
      dialogId = null;
      if (dialogReturnFocus && document.contains(dialogReturnFocus)) dialogReturnFocus.focus();
      else search.focus();
    }
    cancelBtn.addEventListener('click', closeDialog);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); });
    confirmBtn.addEventListener('click', function () {
      var id = dialogId;
      if (!id) return;
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      dialogMsg.textContent = T.deleting || 'Deleting…';
      Promise.resolve(options.onDelete(id)).then(function (ok) {
        if (ok) {
          dialogReturnFocus = null;
          closeDialog();
        } else {
          dialogMsg.textContent = T.deleteFailed || 'The chat could not be deleted. Please try again.';
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
        }
      });
    });
    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
      if (e.key === 'Tab') {
        // Keep focus inside the dialog (two buttons).
        var first = cancelBtn;
        var last = confirmBtn;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // ---------- menus ----------
    function closeMenu() {
      if (openMenuId === null) return;
      openMenuId = null;
      renderList();
    }
    document.addEventListener('click', function (e) {
      if (openMenuId !== null && !element.contains(e.target)) closeMenu();
    });

    function focusMenuItem(menu, index) {
      var items = menu.querySelectorAll('[role="menuitem"]');
      if (items.length) items[(index + items.length) % items.length].focus();
    }

    // ---------- list ----------
    function setFlash(text) {
      flash = text || '';
      flashEl.textContent = flash;
      clearTimeout(flashTimer);
      if (flash) flashTimer = setTimeout(function () { flash = ''; flashEl.textContent = ''; }, 6000);
    }

    function renameRow(conv) {
      var input = h('input', {
        type: 'text',
        className: 'llh-sn__rename-input',
        value: conv.title,
        maxlength: String(MAX_TITLE),
        'aria-label': T.renameLabel || 'New chat title',
        disabled: savingId === conv.id
      });
      var hint = h('p', { className: 'llh-sn__rename-msg', role: 'alert', text: renameError });
      function cancel() {
        renamingId = null;
        renameError = '';
        renderList();
        var btn = listEl.querySelector('[data-conv-open="' + conv.id + '"]');
        if (btn) btn.focus();
      }
      function save() {
        var value = input.value.replace(/\s+/g, ' ').trim();
        if (!value) { renameError = T.renameEmpty || 'Please enter a title.'; hint.textContent = renameError; return; }
        if (value.length > MAX_TITLE) { renameError = T.renameTooLong || 'Please use at most 80 characters.'; hint.textContent = renameError; return; }
        if (value === conv.title) { cancel(); return; }
        savingId = conv.id;
        input.disabled = true;
        Promise.resolve(options.onRename(conv.id, value)).then(function (r) {
          savingId = null;
          if (r && r.ok) {
            renamingId = null;
            renameError = '';
            renderList();
            setFlash(T.renamed || 'Chat renamed.');
            var btn = listEl.querySelector('[data-conv-open="' + conv.id + '"]');
            if (btn) btn.focus();
          } else {
            renameError = (r && r.message) || T.renameFailed || 'The chat could not be renamed. Please try again.';
            renderList();
          }
        });
      }
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      var row = h('li', { className: 'llh-sn__item llh-sn__item--rename' }, [
        h('div', { className: 'llh-sn__rename' }, [
          input,
          h('div', { className: 'llh-sn__rename-actions' }, [
            h('button', { type: 'button', className: 'llh-sn__mini', onClick: save, disabled: savingId === conv.id, text: T.save || 'Save' }),
            h('button', { type: 'button', className: 'llh-sn__mini llh-sn__mini--ghost', onClick: cancel, text: T.cancel || 'Cancel' })
          ]),
          hint
        ])
      ]);
      setTimeout(function () {
        if (document.contains(input) && !input.disabled) { input.focus(); input.select(); }
      }, 0);
      return row;
    }

    function itemRow(conv) {
      if (renamingId === conv.id) return renameRow(conv);
      var active = data.activeId === conv.id;
      var menuOpen = openMenuId === conv.id;
      var menuBtn = h('button', {
        type: 'button',
        className: 'llh-sn__more',
        'aria-label': (T.moreFor || 'Options for') + ' ' + conv.title,
        'aria-haspopup': 'menu',
        'aria-expanded': menuOpen ? 'true' : 'false',
        title: T.more || 'More options',
        onClick: function (e) {
          e.stopPropagation();
          openMenuId = menuOpen ? null : conv.id;
          renderList();
          if (openMenuId) {
            var m = listEl.querySelector('.llh-sn__menu');
            if (m) focusMenuItem(m, 0);
          }
        }
      }, [Icon('dots', 16)]);

      var menu = null;
      if (menuOpen) {
        menu = h('div', { className: 'llh-sn__menu', role: 'menu', 'aria-label': (T.moreFor || 'Options for') + ' ' + conv.title }, [
          h('button', {
            type: 'button', role: 'menuitem', className: 'llh-sn__menu-item',
            onClick: function (e) { e.stopPropagation(); openMenuId = null; renamingId = conv.id; renameError = ''; renderList(); }
          }, [Icon('pencil', 15), h('span', { text: T.rename || 'Rename' })]),
          h('button', {
            type: 'button', role: 'menuitem', className: 'llh-sn__menu-item llh-sn__menu-item--danger',
            onClick: function (e) { e.stopPropagation(); openMenuId = null; renderList(); openDialog(conv, listEl.querySelector('[data-conv-more="' + conv.id + '"]')); }
          }, [Icon('trash', 15), h('span', { text: T.delete || 'Delete' })])
        ]);
        menu.addEventListener('keydown', function (e) {
          var items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
          var i = items.indexOf(document.activeElement);
          if (e.key === 'ArrowDown') { e.preventDefault(); focusMenuItem(menu, i + 1); }
          if (e.key === 'ArrowUp') { e.preventDefault(); focusMenuItem(menu, i - 1); }
          if (e.key === 'Escape' || e.key === 'Tab') {
            if (e.key === 'Escape') e.preventDefault();
            openMenuId = null;
            renderList();
            var b = listEl.querySelector('[data-conv-more="' + conv.id + '"]');
            if (b && e.key === 'Escape') b.focus();
          }
        });
      }
      menuBtn.setAttribute('data-conv-more', conv.id);

      return h('li', { className: 'llh-sn__item' + (active ? ' is-active' : '') + (menuOpen ? ' is-menu' : '') }, [
        h('button', {
          type: 'button',
          className: 'llh-sn__open',
          'data-conv-open': conv.id,
          'aria-current': active ? 'page' : null,
          title: conv.title,
          onClick: function () { closeMenu(); options.onOpen(conv.id); }
        }, [
          h('span', { className: 'llh-sn__title', text: conv.title }),
          data.loadingId === conv.id ? h('span', { className: 'llh-spinner llh-sn__spin', 'aria-label': T.opening || 'Opening…' }) : null
        ]),
        menuBtn,
        menu
      ]);
    }

    function stateMessage(text, actionLabel, onAction) {
      return h('div', { className: 'llh-sn__state' }, [
        h('p', { text: text }),
        actionLabel ? h('button', { type: 'button', className: 'llh-sn__mini', onClick: onAction, text: actionLabel }) : null
      ]);
    }

    function renderList() {
      listEl.innerHTML = '';
      if (data.status === 'signedOut') {
        listEl.appendChild(stateMessage(T.signedOut || 'Log in to save your chats and see them here.', T.login || 'Log in', options.onLogin));
        return;
      }
      if (data.status === 'loading' && !data.conversations.length) {
        listEl.appendChild(h('div', { className: 'llh-sn__state', role: 'status' }, [
          h('span', { className: 'llh-spinner', 'aria-hidden': 'true' }),
          h('p', { text: T.loading || 'Loading chats…' })
        ]));
        return;
      }
      if (data.status === 'error' && !data.conversations.length) {
        listEl.appendChild(stateMessage(T.error || "Couldn't load your chats.", T.retry || 'Try again', options.onRetry));
        return;
      }
      if (!data.conversations.length) {
        listEl.appendChild(stateMessage(T.empty || 'No chats yet. Ask a legal question to start one.'));
        return;
      }
      var list = data.conversations.filter(function (c) {
        return !query || String(c.title).toLowerCase().indexOf(query) !== -1;
      });
      if (!list.length) {
        listEl.appendChild(stateMessage((T.noMatch || 'No chats match') + ' "' + search.value.trim() + '".'));
        return;
      }
      var groups = [];
      var byLabel = {};
      list.forEach(function (c) {
        var label = groupLabel(c.lastMessageAt, T);
        if (!byLabel[label]) { byLabel[label] = []; groups.push(label); }
        byLabel[label].push(c);
      });
      groups.forEach(function (label) {
        listEl.appendChild(h('section', { className: 'llh-sn__group', 'aria-label': label }, [
          h('h3', { className: 'llh-sn__group-title', text: label }),
          h('ul', { className: 'llh-sn__items' }, byLabel[label].map(itemRow))
        ]));
      });
      if (data.status === 'error') {
        listEl.appendChild(stateMessage(T.errorRefresh || "Couldn't refresh the list.", T.retry || 'Try again', options.onRetry));
      }
    }

    // ---------- collapse (desktop) / drawer (mobile) ----------
    var drawerOpen = false;
    var lastFocus = null;

    function setCollapsed(value) {
      collapsed = !!value;
      try { if (global.localStorage) global.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
      if (options.onToggle) options.onToggle(collapsed);
    }

    function setDrawerOpen(value) {
      drawerOpen = !!value;
      element.classList.toggle('is-open', drawerOpen);
      scrim.hidden = !drawerOpen;
      if (drawerOpen) {
        lastFocus = document.activeElement;
        setTimeout(function () { newBtn.focus(); }, 0);
      } else if (lastFocus && document.contains(lastFocus)) {
        lastFocus.focus();
      }
      if (options.onDrawer) options.onDrawer(drawerOpen);
    }

    element.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawerOpen && openMenuId === null && renamingId === null) {
        e.preventDefault();
        setDrawerOpen(false);
      }
    });

    renderList();

    return {
      element: element,
      scrim: scrim,
      dialog: dialog,
      isCollapsed: function () { return collapsed; },
      setCollapsed: setCollapsed,
      isDrawerOpen: function () { return drawerOpen; },
      setDrawerOpen: setDrawerOpen,
      flash: setFlash,
      /** Re-renders the list with new data (keeps search text, menus and rename state). */
      update: function (next) {
        data.status = next.status || data.status;
        data.conversations = Array.isArray(next.conversations) ? next.conversations : data.conversations;
        data.activeId = next.activeId || null;
        data.loadingId = next.loadingId || null;
        if (openMenuId && !data.conversations.some(function (c) { return c.id === openMenuId; })) openMenuId = null;
        if (renamingId && !data.conversations.some(function (c) { return c.id === renamingId; })) renamingId = null;
        // Do not rebuild while the user is typing a new title (it would steal focus).
        if (renamingId && savingId === null && document.activeElement && document.activeElement.classList.contains('llh-sn__rename-input')) return;
        renderList();
      }
    };
  }

  global.LegalHelpSidebar = { create: create };
})(window);
