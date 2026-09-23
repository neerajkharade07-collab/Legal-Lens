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
 *          loading / error states, official links for the suggested topics
 *
 * Load order: legal-help-data.js → legal-help-service.js →
 *             legal-help-components.js → legal-help.js
 */
(function (global) {
  'use strict';

  var data = global.LegalHelpData;
  var ui = global.LegalHelpComponents;
  var h = ui.h;
  var M = data.MESSAGES;

  var PLACEHOLDERS = { home: 'Ask a legal question...', chat: 'Ask a follow-up question...' };

  /** Service problems that switch the answer to labelled Demo Mode sample guidance. */
  var DEMO_FALLBACK_CODES = {
    unreachable: true,
    'not-configured': true,
    'ai-failed': true,
    timeout: true,
    'rate-limited': true,
    unknown: true
  };

  /** A typed question identical to a suggested one gets that topic's sample guidance. */
  function topicForQuestion(text) {
    var q = String(text || '').trim().toLowerCase();
    var match = data.QUERY_ORDER.filter(function (id) {
      return data.legalQueries[id].question.toLowerCase() === q;
    })[0];
    return match || null;
  }

  function suggestionList() {
    return data.QUERY_ORDER.map(function (id) { return data.legalQueries[id]; });
  }

  function mount(target, options) {
    if (!target) throw new Error('LegalHelpDashboard.mount: target element not found.');
    options = options || {};

    var service = options.service || global.LegalHelpService.create(options);

    var state = {
      view: 'home',
      messages: [], // { id, role: 'user' | 'assistant' | 'error', content, topicId?, retryable? }
      loading: false
    };
    var nextId = 1;
    var inFlight = null; // AbortController of the current request

    // ---------- skeleton ----------
    var main = h('div', { className: 'llh__main' });
    var notice = h('div', { className: 'llh__notice', 'aria-live': 'polite' });
    var announcer = h('p', { className: 'llh-visually-hidden', 'aria-live': 'polite' });
    var searchBar = ui.SearchBar({
      placeholder: PLACEHOLDERS.home,
      accept: service.ACCEPTED_FILE_TYPES,
      onSubmit: function (text) { ask(text, null); },
      onFile: handleFile,
      onVoice: handleVoice
    });
    var root = h('section', { className: 'llh', 'aria-label': 'LegalLens legal help' }, [
      h('div', { className: 'llh__scroll' }, [main]),
      h('div', { className: 'llh__composer' }, [
        h('div', { className: 'llh__composer-inner' }, [notice, searchBar.element])
      ]),
      announcer
    ]);

    target.innerHTML = '';
    target.appendChild(root);

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
          )
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
          onRetryLive: retry
        })
      );
    }

    function render() {
      root.setAttribute('data-view', state.view);
      root.setAttribute('aria-busy', state.loading ? 'true' : 'false');
      searchBar.setPlaceholder(PLACEHOLDERS[state.view]);
      searchBar.setBusy(state.loading);
      if (state.view === 'chat') renderChat();
      else renderHome();
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
    // Demo Mode sample answers are never sent to the live AI as conversation history.
    function isConversationTurn(m) {
      return (m.role === 'user' || m.role === 'assistant') && !m.demo;
    }

    function history() {
      return state.messages
        .filter(isConversationTurn)
        .map(function (m) { return { role: m.role, content: m.content }; });
    }

    function errorText(result) {
      if (result.code === 'invalid' && result.serverMessage) return result.serverMessage;
      if (result.code === 'too-long-question') return M.tooLongQuestion;
      return M.errors[result.code] || M.errors.unknown;
    }

    /** Sends the conversation (everything before `userMessage`) plus the question. */
    function send(userMessage, priorHistory) {
      state.loading = true;
      render();
      reveal('.llh-answer--loading', 'nearest');

      var controller = new AbortController();
      inFlight = controller;

      service
        .askGuidance(userMessage.content, priorHistory, { signal: controller.signal })
        .then(function (result) {
          if (inFlight !== controller || result.status === 'aborted') return; // user left this conversation
          inFlight = null;
          state.loading = false;

          var id = nextId++;
          if (result.status === 'answered') {
            state.messages.push({ id: id, role: 'assistant', content: result.reply, topicId: userMessage.topicId });
            render();
            reveal('[data-message-id="' + id + '"]', 'start');
            announcer.textContent = 'LegalLens replied.';
          } else if (DEMO_FALLBACK_CODES[result.code]) {
            // SIH demo: the live AI service is unavailable — show clearly labelled
            // sample guidance instead of a raw server error.
            var demoTopic = userMessage.topicId || topicForQuestion(userMessage.content);
            state.messages.push({
              id: id,
              role: 'assistant',
              demo: true,
              content: (demoTopic && data.demoGuidance && data.demoGuidance[demoTopic]) || data.demoGeneric,
              topicId: demoTopic || null,
              forUser: userMessage.id
            });
            render();
            reveal('[data-message-id="' + id + '"]', 'start');
            announcer.textContent = 'Demo Mode: sample guidance shown.';
          } else {
            var text = errorText(result);
            state.messages.push({
              id: id,
              role: 'error',
              content: text,
              retryable: result.code !== 'invalid' && result.code !== 'too-long-question',
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

      clearNotice();
      searchBar.clear();

      var prior = history();
      var userMessage = { id: nextId++, role: 'user', content: question, topicId: topicId || null };
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

    // ---------- not built yet ----------
    function handleFile(file) {
      service.analyzeDocument(file).then(function (result) {
        showNotice(
          M.comingSoonTitle,
          result.reason === 'invalid-file' ? M.invalidFile : M.document,
          result.fileName
        );
      });
    }

    function handleVoice() {
      service.startVoiceInput().then(function () {
        showNotice(M.comingSoonTitle, M.voice);
      });
    }

    // ---------- navigation ----------
    function goHome() {
      if (inFlight) inFlight.abort();
      inFlight = null;
      clearNotice();
      searchBar.clear();
      state.view = 'home';
      state.messages = [];
      state.loading = false;
      render();
      var title = root.querySelector('.llh-home__title');
      if (title) title.focus({ preventScroll: true });
    }

    render();

    // Small public API for the host page.
    return {
      element: root,
      ask: function (question) { ask(question, null); },
      openTopic: askTopic,
      reset: goHome,
      getState: function () {
        return { view: state.view, loading: state.loading, messages: state.messages.slice() };
      },
      destroy: function () {
        if (inFlight) inFlight.abort();
        target.innerHTML = '';
      }
    };
  }

  global.LegalHelpDashboard = { mount: mount };
})(window);
