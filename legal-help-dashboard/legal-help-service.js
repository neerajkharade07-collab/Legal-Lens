/**
 * LegalLens — Legal Help service layer.
 *
 * The only place the UI talks to the backend. Questions go to the EXISTING
 * Legal Lens endpoint:
 *
 *   POST {apiBaseUrl}/guidance/chat
 *   body:     { message: string, history?: [{ role: 'user' | 'assistant', content }] }
 *   success:  { success: true, reply: string }
 *   failure:  { success: false, message: string }   (400 / 500 / 503 …)
 *
 * No API key lives in the browser — OpenAI is called only by the backend.
 *
 * Results the UI understands:
 *   { status: 'answered', reply }
 *   { status: 'error', code, message }        code: offline | unreachable | timeout |
 *                                             ai-failed | not-configured | rate-limited |
 *                                             too-long | invalid | unknown
 *   { status: 'aborted' }                     the request was cancelled by the UI
 *   { status: 'unsupported', reason }         paperclip / microphone (not built yet)
 */
(function (global) {
  'use strict';

  var DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
  var DEFAULT_TIMEOUT_MS = 60000;

  // The backend accepts JSON bodies up to 10 kb on this route; stay well below.
  var MAX_BODY_BYTES = 8000;
  var MAX_HISTORY_ITEM_CHARS = 1500;
  var MAX_MESSAGE_CHARS = 2000;

  var ACCEPTED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
  var ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

  function byteLength(text) {
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length * 3;
  }

  /**
   * Most recent turns first, trimmed so the whole request fits the backend's
   * body limit (Hindi / Marathi text is 3 bytes per character in UTF-8).
   */
  function buildBody(message, history) {
    var turns = (history || [])
      .filter(function (m) {
        return (m.role === 'user' || m.role === 'assistant') && m.content;
      })
      .map(function (m) {
        return { role: m.role, content: String(m.content).slice(0, MAX_HISTORY_ITEM_CHARS) };
      });

    var body = { message: message, history: turns };
    while (body.history.length && byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
      body.history.shift(); // drop the oldest turn first
    }
    if (!body.history.length) delete body.history;
    return body;
  }

  function codeForStatus(status) {
    if (status === 400) return 'invalid';
    if (status === 413) return 'too-long';
    if (status === 429) return 'rate-limited';
    if (status === 503) return 'not-configured';
    if (status >= 500) return 'ai-failed';
    return 'unknown';
  }

  function isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  function createLegalHelpService(options) {
    options = options || {};
    var apiBaseUrl = String(
      options.apiBaseUrl || global.LEGAL_LENS_API_BASE_URL || DEFAULT_API_BASE_URL
    ).replace(/\/+$/, '');
    var timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    /**
     * Ask the AI Legal Guidance assistant.
     * @param {string} message the user's question
     * @param {Array<{role, content}>} history earlier turns of this conversation
     * @param {{ signal?: AbortSignal }} opts lets the UI cancel (e.g. "back to suggestions")
     */
    function askGuidance(message, history, opts) {
      var question = String(message || '').trim();
      if (!question) return Promise.resolve({ status: 'error', code: 'invalid' });
      if (question.length > MAX_MESSAGE_CHARS) {
        return Promise.resolve({ status: 'error', code: 'too-long-question' });
      }
      if (isOffline()) return Promise.resolve({ status: 'error', code: 'offline' });

      var controller = new AbortController();
      var timedOut = false;
      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      var external = opts && opts.signal;
      if (external) {
        if (external.aborted) controller.abort();
        else external.addEventListener('abort', function () { controller.abort(); });
      }

      return fetch(apiBaseUrl + '/guidance/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildBody(question, history)),
        signal: controller.signal
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () { return null; })
            .then(function (json) {
              if (res.ok && json && json.success && typeof json.reply === 'string' && json.reply.trim()) {
                return { status: 'answered', reply: json.reply.trim() };
              }
              return {
                status: 'error',
                code: res.ok ? 'ai-failed' : codeForStatus(res.status),
                // Server messages are shown only for input problems (e.g. "Please enter a legal question.").
                serverMessage: res.status === 400 && json && json.message ? json.message : null
              };
            });
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') {
            return timedOut ? { status: 'error', code: 'timeout' } : { status: 'aborted' };
          }
          // fetch() rejects with a TypeError when the server is down, the port is
          // wrong, or CORS blocks the page's origin.
          return { status: 'error', code: isOffline() ? 'offline' : 'unreachable' };
        })
        .then(function (result) {
          clearTimeout(timer);
          return result;
        });
    }

    return {
      apiBaseUrl: apiBaseUrl,
      ACCEPTED_FILE_TYPES: ACCEPTED_FILE_TYPES,
      MAX_MESSAGE_CHARS: MAX_MESSAGE_CHARS,
      askGuidance: askGuidance,

      /**
       * Paperclip. The file is NOT read, uploaded or analysed.
       * FUTURE: send it to the document-analysis / OCR service here.
       */
      analyzeDocument: function (file) {
        var name = file && file.name ? file.name : '';
        var ext = name.split('.').pop().toLowerCase();
        if (!name || ACCEPTED_FILE_EXTENSIONS.indexOf(ext) === -1) {
          return Promise.resolve({ status: 'unsupported', reason: 'invalid-file', fileName: name });
        }
        return Promise.resolve({ status: 'unsupported', reason: 'document', fileName: name });
      },

      /**
       * Microphone. No microphone permission is requested.
       * FUTURE: speech-to-text here, then pass the transcript to askGuidance().
       */
      startVoiceInput: function () {
        return Promise.resolve({ status: 'unsupported', reason: 'voice' });
      }
    };
  }

  global.LegalHelpService = { create: createLegalHelpService, buildBody: buildBody };
})(window);
