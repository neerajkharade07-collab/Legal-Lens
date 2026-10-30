/**
 * LegalLens — Legal Help dashboard (entry point).
 *
 *   LegalHelpDashboard.mount(document.getElementById('legal-help'), {
 *     apiBaseUrl: 'http://localhost:5000/api'   // your Legal Lens backend
 *   });
 *
 * Two states inside one component:
 *   home → headline, four suggested questions, search bar
 *   chat → the conversation: questions, AI answers from POST /api/guidance/chat,
 *          loading / error states, official links for the suggested topics,
 *          verified lawyer suggestions (from the Legal Lens database) and
 *          quick follow-ups (court preparation, Hindi, Marathi, lawyer)
 *
 * Paperclip: uploads a document (PDF, DOCX, TXT; JPG/PNG read by the AI) to
 * POST /api/guidance/documents. Up to 3 documents stay attached to the
 * conversation and are sent (by id) with every later question.
 * Microphone: speech-to-text in the browser (legal-help-voice.js); the text
 * goes into the box for review — it is never sent automatically.
 * Documents: "View text" shows the text the server extracted
 * (GET /api/guidance/documents/:id/text); documents the server marks
 * complete:false get a visible "could not be read" warning.
 * Reply language: Auto / English / Hindi / Marathi, sent with each question.
 * AI failures are always shown as errors with "Try again" — the page never
 * substitutes prepared sample answers for a failed live answer.
 *
 * Load order: legal-help-data.js → legal-help-service.js → legal-help-voice.js →
 *             legal-help-components.js → legal-help.js
 */
(function (global) {
  'use strict';

  var data = global.LegalHelpData;
  var ui = global.LegalHelpComponents;
  var h = ui.h;
  var M = data.MESSAGES;

  var PLACEHOLDERS = { home: 'Ask a legal question...', chat: 'Ask a follow-up question...' };

  /** Errors that "Try again" cannot fix (the user has to change something first). */
  var NOT_RETRYABLE = {
    invalid: true,
    'too-long-question': true,
    'auth-required': true,
    forbidden: true,
    'document-missing': true,
    'conversation-full': true,
    'conversation-missing': true
  };

  var LANGUAGE_KEY = 'legalLens.guidance.replyLanguage'; // only 'auto' | 'en' | 'hi' | 'mr'

  function suggestionList() {
    return data.QUERY_ORDER.map(function (id) { return data.legalQueries[id]; });
  }

  function mount(target, options) {
    if (!target) throw new Error('LegalHelpDashboard.mount: target element not found.');
    options = options || {};

    var service = options.service || global.LegalHelpService.create(options);

    var state = {
      view: 'home',
      messages: [], // { id, role: 'user' | 'assistant' | 'error', content, topicId?, retryable?, attachments?, lawyers? }
      loading: false,
      documents: [], // { id, name, pages, pagesRead, method, unreadablePages, truncated, note, complete, sent }
      uploading: null, // file name while uploading
      docError: null,
      conversationId: null, // saved conversation (MongoDB) — set after the first answer
      conversationFull: false,
      replyLanguage: readLanguage(service.REPLY_LANGUAGES || ['auto', 'en', 'hi', 'mr'])
    };
    var MAX_DOCUMENTS = 3;
    var pageSession = 0; // changes when the user leaves a conversation; late upload results for it are discarded
    var CURRENT_KEY = 'legalLens.guidance.currentConversation'; // only the id, never message text
    // Saved-conversation list shown in the sidebar (not named "history": history() builds the chat history below).
    // status: loading | ready | error | signedOut. MongoDB (via the API) is the only source of the list.
    var convList = { status: 'loading', conversations: [], loadingId: null };
    var openSeq = 0; // increases on every chat switch / New Chat; older responses are ignored
    var chatNotice = null; // one-line note above the conversation (restored / expired documents…)
    var links = {
      findLawyerUrl: options.findLawyerUrl || '../find-a-lawyer.html',
      lawyerProfileUrl: options.lawyerProfileUrl || '../lawyer-profile.html'
    };
    var VT = M.voice || {};
    var DT = M.documents || {};
    var nextId = 1;
    var inFlight = null; // AbortController of the current request

    // ---------- skeleton ----------
    var main = h('div', { className: 'llh__main' });
    var notice = h('div', { className: 'llh__notice', 'aria-live': 'polite' });
    var docTray = h('div', { className: 'llh__docs' });
    var announcer = h('p', { className: 'llh-visually-hidden', 'aria-live': 'polite' });
    var searchBar = ui.SearchBar({
      placeholder: PLACEHOLDERS.home,
      accept: service.ACCEPTED_FILE_TYPES,
      onSubmit: function (text) { ask(text, null); },
      onFile: handleFile,
      onVoice: handleVoice
    });
    var ST = M.sidebar || {};
    var sidebar = global.LegalHelpSidebar ? global.LegalHelpSidebar.create({
      text: ST,
      onNew: newChat,
      onOpen: openConversation,
      onRename: renameConversation,
      onDelete: deleteConversation,
      onRetry: loadHistory,
      onLogin: goToLogin,
      onToggle: function (collapsed) { app.classList.toggle('is-collapsed', collapsed); syncTopbar(); },
      onDrawer: function (open) { app.classList.toggle('is-drawer-open', open); syncTopbar(); }
    }) : null;

    var topTitle = h('p', { className: 'llh-topbar__title' });
    var menuBtn = h('button', {
      type: 'button',
      className: 'llh-topbar__menu',
      'aria-controls': 'llh-sidebar',
      onClick: function () {
        if (!sidebar) return;
        if (isMobile()) sidebar.setDrawerOpen(!sidebar.isDrawerOpen());
        else sidebar.setCollapsed(false);
      }
    }, [ui.Icon('menu', 20)]);
    var topNew = h('button', {
      type: 'button',
      className: 'llh-topbar__new',
      'aria-label': ST.newChat || 'New Chat',
      title: ST.newChat || 'New Chat',
      onClick: function () { newChat(); }
    }, [ui.Icon('plus', 18)]);
    var topbar = h('div', { className: 'llh-topbar' }, [menuBtn, topTitle, topNew]);

    var LT = M.replyLanguage || {};
    var languagePicker = ui.ReplyLanguagePicker({
      labels: LT,
      value: state.replyLanguage,
      onChange: setReplyLanguage
    });
    var textViewerHost = h('div', { className: 'llh-textview-host' });

    var root = h('section', { className: 'llh', 'aria-label': 'LegalLens legal help' }, [
      sidebar ? topbar : null,
      h('div', { className: 'llh__scroll' }, [main]),
      h('div', { className: 'llh__composer' }, [
        h('div', { className: 'llh__composer-inner' }, [notice, docTray, searchBar.element, languagePicker.element])
      ]),
      announcer,
      textViewerHost
    ]);
    var app = h('div', { className: 'llh-app' + (sidebar && sidebar.isCollapsed() ? ' is-collapsed' : '') }, [
      sidebar ? sidebar.element : null,
      sidebar ? sidebar.scrim : null,
      root,
      sidebar ? sidebar.dialog : null
    ]);

    function isMobile() {
      return typeof global.matchMedia === 'function' && global.matchMedia('(max-width: 900px)').matches;
    }

    function activeTitle() {
      if (!state.conversationId) return ST.newChatTitle || 'New chat';
      var c = convList.conversations.filter(function (x) { return x.id === state.conversationId; })[0];
      return c ? c.title : (ST.newChatTitle || 'New chat');
    }

    function syncTopbar() {
      if (!sidebar) return;
      topTitle.textContent = activeTitle();
      var mobile = isMobile();
      var label = mobile ? (ST.openMenu || 'Open chat list') : (ST.expand || 'Open sidebar');
      menuBtn.setAttribute('aria-label', label);
      menuBtn.setAttribute('title', label);
      menuBtn.setAttribute('aria-expanded', mobile ? String(sidebar.isDrawerOpen()) : String(!sidebar.isCollapsed()));
    }

    function updateSidebar() {
      if (!sidebar) return;
      sidebar.update({
        status: convList.status,
        conversations: convList.conversations,
        activeId: state.conversationId,
        loadingId: convList.loadingId
      });
      syncTopbar();
    }

    if (typeof global.matchMedia === 'function') {
      var mq = global.matchMedia('(max-width: 900px)');
      var onMq = function () { if (!mq.matches && sidebar && sidebar.isDrawerOpen()) sidebar.setDrawerOpen(false); syncTopbar(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }

    target.innerHTML = '';
    target.appendChild(app);

    // ---------- views ----------
    function renderHome() {
      main.innerHTML = '';
      main.appendChild(
        h('div', { className: 'llh-home' }, [
          h('h1', { className: 'llh-home__title', tabindex: '-1' }, ['Legal Help,', h('br'), 'Made Simple.']),
          h(
            'div',
            { className: 'llh-home__grid', role: 'list', 'aria-label': 'Suggested legal queries' },
            suggestionList().map(function (q) {
              var card = ui.QueryCard(q, askTopic);
              return h('div', { role: 'listitem', className: 'llh-home__cell' }, [card]);
            })
          ),
          // Without the sidebar script, keep the in-page list of saved chats.
          !sidebar && convList.status === 'ready' && convList.conversations.length ? h('p', { className: 'llh-panel__disclaimer', text: M.retention || '' }) : null
        ])
      );
    }

    function renderChat() {
      main.innerHTML = '';
      main.appendChild(
        ui.ConversationView({
          messages: state.messages,
          loading: state.loading,
          topics: data.legalQueries,
          text: M,
          onBack: goHome,
          onRetry: retry,
          onLogin: goToLogin,
          links: links,
          quickActions: state.conversationFull ? null : M.quickActions,
          onQuickAction: function (action) { ask(action.message, null); },
          notice: chatNotice
        })
      );
    }

    function renderDocs() {
      var tray = ui.DocumentTray({
        documents: state.documents,
        uploading: state.uploading,
        error: state.docError,
        disabled: state.loading,
        text: DT,
        onRemove: removeDocument,
        onView: viewDocumentText
      });
      docTray.innerHTML = '';
      docTray.appendChild(tray);
      searchBar.setUploading(!!state.uploading);
    }

    function render() {
      root.setAttribute('data-view', state.view);
      root.setAttribute('aria-busy', state.loading ? 'true' : 'false');
      searchBar.setPlaceholder(PLACEHOLDERS[state.view]);
      searchBar.setBusy(state.loading);
      languagePicker.setValue(state.replyLanguage);
      if (state.view === 'chat') renderChat();
      else renderHome();
      renderDocs();
      updateSidebar();
    }

    /** Bring a newly added message into view (the page itself scrolls). */
    function reveal(selector, block) {
      var el = selector ? main.querySelector(selector) : null;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: block || 'nearest', behavior: 'auto' });
      }
    }

    // ---------- notices (paperclip, microphone, input problems) ----------
    function clearNotice() {
      notice.innerHTML = '';
    }

    function showNotice(title, text, fileName) {
      notice.innerHTML = '';
      notice.appendChild(
        ui.ComingSoonMessage({
          title: title,
          text: text,
          fileName: fileName,
          suggestions: state.view === 'chat' ? suggestionList() : null,
          disabled: state.loading,
          onSelect: askTopic
        })
      );
    }

    // ---------- asking ----------
    // Only real questions and real AI answers form the conversation history.
    function isConversationTurn(m) {
      return m.role === 'user' || m.role === 'assistant';
    }

    function history() {
      return state.messages
        .filter(isConversationTurn)
        .map(function (m) { return { role: m.role, content: m.content }; });
    }

    function errorText(result) {
      if (result.code === 'invalid' && result.serverMessage) return result.serverMessage;
      if ((result.code === 'conversation-full' || result.code === 'ai-declined' || result.code === 'conversation-missing') && result.serverMessage) {
        if (result.code === 'conversation-full') state.conversationFull = true;
        if (result.code === 'conversation-missing') forgetConversation();
        return result.serverMessage;
      }
      if (result.code === 'too-long-question') return M.tooLongQuestion;
      return M.errors[result.code] || M.errors.unknown;
    }

    function documentIds() {
      return state.documents.map(function (d) { return d.id; });
    }

    /** Sends the conversation (everything before `userMessage`) plus the question. */
    function send(userMessage, priorHistory) {
      state.loading = true;
      render();
      reveal('.llh-answer--loading', 'nearest');

      var controller = new AbortController();
      inFlight = controller;

      service
        .askGuidance(userMessage.content, priorHistory, {
          signal: controller.signal,
          documentIds: documentIds(),
          conversationId: state.conversationId,
          newConversation: !state.conversationId,
          language: state.replyLanguage
        })
        .then(function (result) {
          if (inFlight !== controller || result.status === 'aborted') {
            // The user switched chats while this answer was on its way. It was
            // still saved to its own conversation on the server: refresh the list.
            if (result.status === 'answered' && result.conversationId) loadHistory();
            return;
          }
          inFlight = null;
          state.loading = false;

          var id = nextId++;
          if (result.status === 'answered' && result.conversationId) {
            rememberConversation(result.conversationId, result.conversationTitle);
          }
          if (result.status === 'answered') {
            state.messages.push({
              id: id,
              role: 'assistant',
              content: result.reply,
              kind: result.type, // clarification | guidance | draft | out_of_scope
              // Official links only accompany real legal answers.
              topicId: result.type === 'out_of_scope' ? null : userMessage.topicId,
              // Verified lawyers from the database, only when the AI judged it useful.
              lawyers: result.type === 'out_of_scope' ? null : result.lawyers || null
            });
            render();
            reveal('[data-message-id="' + id + '"]', 'start');
            announcer.textContent = result.type === 'out_of_scope'
              ? 'LegalLens can only help with legal matters.'
              : result.type === 'clarification' ? 'LegalLens asked a few questions.' : 'LegalLens replied.';
          } else {
            // Every failure (AI down, quota, timeout, empty answer, offline…) is
            // shown as an error; nothing is invented in its place.
            var text = errorText(result);
            state.messages.push({
              id: id,
              role: 'error',
              content: text,
              code: result.code,
              retryable: !NOT_RETRYABLE[result.code],
              forUser: userMessage.id
            });
            render();
            reveal('.llh-error', 'nearest');
            announcer.textContent = text;
          }
        });
    }

    /** New question — typed, from a card (topicId) or a chip. */
    function ask(text, topicId) {
      if (state.loading) return; // prevents duplicate submissions
      var question = String(text || '').trim();

      if (!question) {
        showNotice(M.emptyQuestion, '');
        searchBar.focus();
        return;
      }
      if (question.length > service.MAX_MESSAGE_CHARS) {
        showNotice(M.tooLongQuestion, '');
        return;
      }

      if (voice && voice.isListening()) voice.cancel();
      clearNotice();
      searchBar.clear();
      state.docError = null;

      var prior = history();
      // Show which documents were attached for the first time with this question.
      var fresh = state.documents.filter(function (d) { return !d.sent; });
      fresh.forEach(function (d) { d.sent = true; });
      var userMessage = {
        id: nextId++,
        role: 'user',
        content: question,
        topicId: topicId || null,
        attachments: fresh.map(function (d) { return d.name; })
      };
      state.view = 'chat';
      state.messages.push(userMessage);
      send(userMessage, prior);
    }

    function askTopic(topicId) {
      var topic = data.legalQueries[topicId];
      if (topic) ask(topic.question, topicId);
    }

    /** Retry a failed request: drop the error, resend the same question. */
    function retry(errorId) {
      if (state.loading) return;
      var index = state.messages.findIndex(function (m) { return m.id === errorId; });
      if (index === -1) return;
      var error = state.messages[index];
      state.messages.splice(index, 1);

      var userIndex = state.messages.findIndex(function (m) { return m.id === error.forUser; });
      if (userIndex === -1) return render();
      var userMessage = state.messages[userIndex];
      var prior = state.messages
        .slice(0, userIndex)
        .filter(isConversationTurn)
        .map(function (m) { return { role: m.role, content: m.content }; });
      send(userMessage, prior);
    }

    /** Existing customer login; auth.js brings the customer back to this page afterwards. */
    function goToLogin() {
      try { sessionStorage.setItem('postLoginRedirect', options.returnPath || 'legal-help-dashboard/index.html'); } catch (e) { /* ignore */ }
      global.location.href = options.loginUrl || '../login.html';
    }

    // ---------- documents (paperclip) ----------
    function handleFile(file) {
      if (state.uploading) return;
      clearNotice();
      if (state.documents.length >= MAX_DOCUMENTS) {
        state.docError = DT.maxReached;
        renderDocs();
        return;
      }
      state.docError = null;
      state.uploading = file && file.name ? file.name : 'document';
      renderDocs();
      var forConversation = pageSession;
      service.uploadDocument(file).then(function (result) {
        if (forConversation !== pageSession) {
          // The user left that conversation while the file was being read.
          if (result.status === 'uploaded') service.deleteDocument(result.document.id);
          return;
        }
        state.uploading = null;
        if (result.status === 'uploaded') {
          var d = result.document;
          state.documents.push(toDocState(d, false));
          // Suggest a question the user can edit or send.
          if (!searchBar.getValue().trim()) searchBar.setValue((DT.suggestedQuestion || '') + d.name);
          announcer.textContent = d.complete === false
            ? (DT.incompleteTitle || 'Part of this document could not be read') + ': ' + d.name
            : (DT.readyNotice || 'Document read.');
          searchBar.focus();
        } else {
          state.docError = result.message || (DT.errors && DT.errors[result.code]) || (DT.errors && DT.errors['upload-failed']);
          announcer.textContent = state.docError;
        }
        renderDocs();
      });
    }

    /** Document metadata from the server → what the page keeps (no text). */
    function toDocState(d, sent) {
      return {
        id: d.id,
        name: d.name,
        pages: d.pages,
        pagesRead: typeof d.pagesRead === 'number' ? d.pagesRead : null,
        method: d.method,
        unreadablePages: Array.isArray(d.unreadablePages) ? d.unreadablePages : [],
        truncated: !!d.truncated,
        note: d.note || '',
        // Only an explicit false from the server means incomplete (older servers send nothing).
        complete: d.complete === false ? false : d.complete === true ? true : null,
        sent: sent
      };
    }

    // ---------- viewing a document's extracted text ----------
    var textView = null; // { id, seq, opener }
    var textViewSeq = 0;

    function closeDocumentText() {
      if (!textView) return;
      var opener = textView.opener;
      var docId = textView.id;
      textView = null;
      textViewerHost.innerHTML = '';
      // The tray may have been re-rendered meanwhile: find this document's button again.
      if (!opener || !document.body.contains(opener)) {
        opener = docTray.querySelector('[data-doc-id="' + docId + '"]');
      }
      if (opener && document.body.contains(opener)) opener.focus();
      else searchBar.focus();
    }

    function showTextViewer(viewState, doc, text, errorText) {
      textViewerHost.innerHTML = '';
      var dialog = ui.DocumentTextViewer({
        state: viewState,
        document: doc,
        text: text,
        errorText: errorText,
        labels: DT,
        onClose: closeDocumentText,
        onRetry: viewState === 'error' ? function () { viewDocumentText(doc.id); } : null
      });
      textViewerHost.appendChild(dialog);
      if (dialog.focusTarget) dialog.focusTarget.focus();
    }

    function viewDocumentText(id) {
      var doc = state.documents.filter(function (d) { return d.id === id; })[0];
      if (!doc) return;
      var seq = ++textViewSeq;
      var opener = textView ? textView.opener : document.activeElement;
      textView = { id: id, seq: seq, opener: opener };
      showTextViewer('loading', doc, null, null);
      var TE = DT.textErrors || {};
      service.getDocumentText(id).then(function (r) {
        if (!textView || textView.seq !== seq) return; // closed or replaced meanwhile
        if (r.status === 'ok') {
          // The server's latest metadata (e.g. complete:false) wins over the copy in the tray.
          var fresh = r.document ? toDocState(r.document, doc.sent) : doc;
          state.documents.forEach(function (d, i) { if (d.id === id) state.documents[i] = fresh; });
          renderDocs();
          showTextViewer('ready', fresh, r.text, null);
          return;
        }
        var msg = r.offline ? TE.offline : r.httpStatus === 404 ? TE.notFound
          : (r.httpStatus === 401 || r.httpStatus === 403) ? TE.auth : TE.failed;
        showTextViewer('error', doc, null, msg || 'The text could not be loaded.');
      });
    }

    // ---------- reply language ----------
    function readLanguage(allowed) {
      var v = null;
      try { v = localStorage.getItem(LANGUAGE_KEY); } catch (e) { /* storage blocked */ }
      return allowed.indexOf(v) !== -1 ? v : 'auto';
    }

    function setReplyLanguage(code) {
      var allowed = service.REPLY_LANGUAGES || ['auto', 'en', 'hi', 'mr'];
      if (allowed.indexOf(code) === -1) code = 'auto';
      state.replyLanguage = code;
      try { localStorage.setItem(LANGUAGE_KEY, code); } catch (e) { /* storage blocked: kept for this visit */ }
      var opt = (LT.options || []).filter(function (o) { return o.code === code; })[0];
      announcer.textContent = (LT.changed || 'Replies will be in') + ' ' + (opt ? opt.label : code) + '.';
    }

    function removeDocument(id) {
      state.documents = state.documents.filter(function (d) { return d.id !== id; });
      state.docError = null;
      renderDocs();
      service.deleteDocument(id); // also removes the extracted text from the server
    }

    // ---------- voice input (microphone) ----------
    var voiceLanguage = null;
    var voice = global.LegalHelpVoice
      ? global.LegalHelpVoice.create({
          onText: function (text) { searchBar.setValue(text); },
          onState: function (s) {
            searchBar.setListening(s === 'listening');
            if (s === 'listening') showVoice('listening');
            else if (voicePanelState === 'listening') {
              if (searchBar.getValue().trim()) {
                showVoice('review');
                searchBar.focus();
              } else {
                clearNotice();
                voicePanelState = null;
              }
            }
          },
          onError: function (code) {
            searchBar.setListening(false);
            showVoice(code === 'unsupported' ? 'unsupported' : 'error', (VT.errors && VT.errors[code]) || (VT.errors && VT.errors.unknown));
          }
        })
      : null;
    var voicePanelState = null;

    function showVoice(panelState, message) {
      voicePanelState = panelState;
      var titles = { listening: VT.listening, review: VT.reviewTitle, error: VT.errorTitle, unsupported: VT.unsupportedTitle };
      notice.innerHTML = '';
      notice.appendChild(ui.VoicePanel({
        state: panelState,
        title: titles[panelState],
        message: panelState === 'review' ? VT.review : message,
        privacy: panelState === 'listening' ? VT.privacy : null,
        languages: voice ? voice.languages : null,
        language: voiceLanguage || (voice ? voice.language() : 'en-IN'),
        onLanguage: function (code) {
          voiceLanguage = code;
          if (voice && voice.isListening()) voice.start(code, searchBar.getValue());
        },
        onStop: function () { if (voice) voice.stop(); },
        onClose: function () { voicePanelState = null; clearNotice(); }
      }));
    }

    function handleVoice() {
      if (!voice || !voice.supported) {
        showVoice('unsupported', VT.errors && VT.errors.unsupported);
        return;
      }
      if (voice.isListening()) {
        voice.stop();
        return;
      }
      voice.start(voiceLanguage || voice.language(), searchBar.getValue());
    }

    // ---------- navigation ----------
    /** Sidebar "New Chat": a blank conversation; the previous one stays saved. */
    function newChat() {
      var alreadyBlank = state.view === 'home' && !state.conversationId && !state.messages.length && !state.loading;
      if (sidebar && sidebar.isDrawerOpen()) sidebar.setDrawerOpen(false);
      if (alreadyBlank) {
        // Nothing to save or clear: no empty conversation is created.
        searchBar.focus();
        return;
      }
      goHome();
      searchBar.focus();
    }

    function goHome() {
      closeDocumentText();
      openSeq += 1;            // a chat that is still opening must not replace the new one
      convList.loadingId = null;
      inFlight = null;         // detach (not abort): a pending answer is still saved to its own chat
      if (voice && voice.isListening()) voice.cancel();
      // Documents already used in the saved conversation stay with it (they
      // expire on their own). Documents uploaded but never sent are deleted.
      state.documents.forEach(function (d) { if (!d.sent || !state.conversationId) service.deleteDocument(d.id); });
      state.documents = [];
      forgetConversation();
      chatNotice = null;
      state.conversationFull = false;
      state.docError = null;
      state.uploading = null;
      pageSession += 1;
      voicePanelState = null;
      clearNotice();
      searchBar.clear();
      state.view = 'home';
      state.messages = [];
      state.loading = false;
      render();
      var title = root.querySelector('.llh-home__title');
      if (title) title.focus({ preventScroll: true });
    }

    // ---------- saved conversations ----------
    function rememberConversation(id, title) {
      var isNew = state.conversationId !== id;
      state.conversationId = id;
      try { sessionStorage.setItem(CURRENT_KEY, id); } catch (e) { /* storage blocked */ }
      if (isNew) loadHistory();
      else if (title) {
        // A new question moved this chat to the top on the server: mirror that.
        var idx = -1;
        convList.conversations.forEach(function (c, i) { if (c.id === id) { idx = i; c.title = title; } });
        if (idx > 0) {
          var moved = convList.conversations.splice(idx, 1)[0];
          moved.lastMessageAt = new Date().toISOString();
          convList.conversations.unshift(moved);
        } else if (idx === 0) {
          convList.conversations[0].lastMessageAt = new Date().toISOString();
        }
        updateSidebar();
      }
    }

    function forgetConversation() {
      state.conversationId = null;
      try { sessionStorage.removeItem(CURRENT_KEY); } catch (e) { /* storage blocked */ }
    }

    var historySeq = 0;
    function loadHistory() {
      var seq = ++historySeq;
      convList.status = 'loading';
      updateSidebar();
      return service.listConversations().then(function (r) {
        if (seq !== historySeq) return; // a newer refresh is on its way
        if (r.status === 'ok') {
          convList.status = 'ready';
          convList.conversations = r.conversations;
        } else if (r.httpStatus === 401 || r.httpStatus === 403) {
          convList.status = 'signedOut';
          convList.conversations = [];
        } else {
          convList.status = 'error'; // keep the last list we had
        }
        updateSidebar();
      });
    }

    /** Reopens a saved conversation: messages, lawyer suggestions and its still-available documents. */
    function openConversation(id) {
      if (sidebar && sidebar.isDrawerOpen()) sidebar.setDrawerOpen(false);
      if (id === state.conversationId && state.view === 'chat' && convList.loadingId === null) return; // already open
      var seq = ++openSeq;
      convList.loadingId = id;
      updateSidebar();
      service.getConversation(id).then(function (r) {
        if (seq !== openSeq) return; // the user picked another chat (or New Chat) meanwhile
        convList.loadingId = null;
        if (r.status !== 'ok') {
          // The current chat stays exactly as it was.
          if (r.httpStatus === 404) {
            if (state.conversationId === id) forgetConversation();
            convList.conversations = convList.conversations.filter(function (c) { return c.id !== id; });
          }
          var why = r.httpStatus === 404 ? (M.conversationMissing || 'This conversation could not be opened.') : (ST.openFailed || "Couldn't open that chat.");
          if (sidebar) sidebar.flash(why);
          announcer.textContent = why;
          if (r.httpStatus === 401) convList.status = 'signedOut';
          updateSidebar();
          return;
        }
        var c = r.conversation;
        closeDocumentText();
        inFlight = null; // detach any answer still on its way for the previous chat
        state.loading = false;
        if (voice && voice.isListening()) voice.cancel();
        // Unsent uploads from the conversation we are leaving are deleted.
        state.documents.forEach(function (d) { if (!d.sent) service.deleteDocument(d.id); });
        pageSession += 1;
        state.uploading = null;
        state.docError = null;
        state.messages = c.messages.map(function (m) {
          return {
            id: nextId++,
            role: m.role,
            content: m.content,
            kind: m.kind,
            attachments: m.attachments,
            lawyers: m.lawyers && m.lawyers.items ? m.lawyers : null
          };
        });
        state.documents = c.documents.filter(function (d) { return d.available && d.active; }).map(function (d) {
          return toDocState(d, true);
        });
        var expired = c.documents.filter(function (d) { return !d.available; }).map(function (d) { return d.name; });
        chatNotice = expired.length
          ? (M.documentsExpired || 'No longer available (deleted or expired):') + ' ' + expired.join(', ') + '. ' + (M.documentsExpiredHint || 'Upload them again if you need them.')
          : null;
        state.conversationFull = c.full;
        if (c.full) chatNotice = (chatNotice ? chatNotice + ' ' : '') + (M.conversationFull || 'This conversation has reached its length limit; start a new conversation to continue.');
        state.view = 'chat';
        state.loading = false;
        rememberConversation(c.id, c.title);
        // The list title may be older than the server's (e.g. renamed on another device).
        convList.conversations.forEach(function (x) { if (x.id === c.id) x.title = c.title; });
        clearNotice();
        render();
        var last = main.querySelector('.llh-log > :last-child');
        if (last && typeof last.scrollIntoView === 'function') last.scrollIntoView({ block: 'end' });
        announcer.textContent = (M.conversationOpened || 'Saved conversation opened:') + ' ' + c.title;
      });
    }

    /** Deletes one chat (and its documents) on the server. Resolves true/false for the sidebar dialog. */
    function deleteConversation(id) {
      return service.deleteConversation(id).then(function (ok) {
        if (!ok) {
          announcer.textContent = M.conversationDeleteFailed || 'The conversation could not be deleted. Please try again.';
          return false;
        }
        convList.conversations = convList.conversations.filter(function (c) { return c.id !== id; });
        announcer.textContent = M.conversationDeleted || 'Conversation deleted.';
        if (sidebar) sidebar.flash(M.conversationDeleted || 'Conversation deleted.');
        if (state.conversationId === id) {
          state.documents = []; // deleted on the server together with the conversation
          goHome();
        } else {
          updateSidebar();
        }
        return true;
      });
    }

    /** Renames one chat on the server; the sidebar shows the saved title. */
    function renameConversation(id, title) {
      return service.renameConversation(id, title).then(function (r) {
        if (r.ok) {
          convList.conversations.forEach(function (c) { if (c.id === id) c.title = r.conversation.title; });
          updateSidebar();
          return { ok: true };
        }
        if (r.status === 404) {
          convList.conversations = convList.conversations.filter(function (c) { return c.id !== id; });
          updateSidebar();
          return { ok: false, message: M.conversationMissing };
        }
        return { ok: false, message: r.message };
      });
    }

    render();

    // Saved history (customers only) and, after a page refresh, the conversation that was open.
    loadHistory().then(function () {
      var saved = null;
      try { saved = sessionStorage.getItem(CURRENT_KEY); } catch (e) { /* storage blocked */ }
      if (convList.status === 'ready' && saved && /^[a-f0-9]{24}$/i.test(saved) && state.view === 'home' && !state.messages.length) {
        openConversation(saved);
      }
    });

    // Small public API for the host page.
    return {
      element: root,
      app: app,
      ask: function (question) { ask(question, null); },
      openTopic: askTopic,
      reset: goHome,
      getState: function () {
        return {
          view: state.view,
          loading: state.loading,
          messages: state.messages.slice(),
          documents: state.documents.slice(),
          conversationId: state.conversationId,
          replyLanguage: state.replyLanguage
        };
      },
      destroy: function () {
        if (inFlight) inFlight.abort();
        target.innerHTML = '';
      }
    };
  }

  global.LegalHelpDashboard = { mount: mount };
})(window);
