/**
 * LegalLens — Legal Help service layer.
 *
 * The only place the UI talks to the backend. Questions go to the EXISTING
 * Legal Lens endpoint:
 *
  *   POST {apiBaseUrl}/guidance/chat
 *   body:     { message: string, history?: [{ role: 'user' | 'assistant', content }], documentIds?: [id],
 *               language?: 'en' | 'hi' | 'mr' }   (no language = auto: follow the question's language)
 *   success:  { success: true, reply: string, type?: 'clarification' | 'guidance' | 'draft' | 'out_of_scope',
 *               lawyers?: { area, city, matchedCity, items: [...] } }
 *   failure:  { success: false, message: string, code?: string }   (400 / 404 / 500 / 503 …)
 *             code (Part 1 backend v2): ai_quota | ai_timeout | ai_unavailable | ai_not_configured |
 *                                       ai_blocked | ai_empty | ai_failed
 *
 *   POST   {apiBaseUrl}/guidance/documents          raw file body + X-File-Name header
 *   GET    {apiBaseUrl}/guidance/documents/:id/text the extracted text of one of YOUR documents
 *   DELETE {apiBaseUrl}/guidance/documents/:id
 *
 *   Saved conversations (customer's own only):
 *   chat body + conversationId | newConversation:true  → reply includes conversationId
 *   GET    {apiBaseUrl}/guidance/conversations
 *   GET    {apiBaseUrl}/guidance/conversations/:id
 *   PATCH  {apiBaseUrl}/guidance/conversations/:id   { title }
 *   DELETE {apiBaseUrl}/guidance/conversations/:id
 *
 * No API key lives in the browser — the AI (Gemini) is called only by the backend.
 *
 * Authentication (customers only) uses the project's existing auth.js:
 * the in-memory access token is sent as "Authorization: Bearer …" (same as
 * Case Builder / Tracker / Dashboard), with credentials included so the
 * httpOnly refresh cookie can renew the session. On a 401 the session is
 * refreshed once through auth.js (refreshSession) and the question re-sent.
 *
 * Results the UI understands:
 *   { status: 'answered', reply, type }       type: clarification (asking for details) |
 *                                             guidance | draft (document / message draft) |
 *                                             out_of_scope (not a legal matter)
 *   { status: 'error', code, message }        code: offline | unreachable | timeout |
 *                                             ai-failed | ai-quota | ai-timeout | ai-unavailable |
 *                                             ai-empty | ai-declined | not-configured | rate-limited |
 *                                             too-long | invalid | auth-required |
 *                                             forbidden | unknown
 *   Failures are always reported as failures: the UI never replaces them with sample answers.
 *   { status: 'aborted' }                     the request was cancelled by the UI
 *
 * Uploads: { status: 'uploaded', document } or { status: 'error', code, message }.
 */
(function (global) {
  'use strict';

  var DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
  var DEFAULT_TIMEOUT_MS = 60000;

  // The backend accepts JSON bodies up to 64 kb on /guidance and itself keeps
  // the opening message plus the 20 most recent turns (40,000 characters).
  // Stay below the body limit so a long consultation keeps its context.
  var MAX_BODY_BYTES = 60000;
  var MAX_HISTORY_ITEM_CHARS = 4000;
  var REPLY_TYPES = ['clarification', 'guidance', 'draft', 'out_of_scope'];
  var MAX_MESSAGE_CHARS = 2000;

  // Must match the backend (services/documentTextExtractor.js).
  var ACCEPTED_FILE_EXTENSIONS = ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
  var ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt,.jpg,.jpeg,.png';
  var MAX_FILE_BYTES = 8 * 1024 * 1024;
  var FILE_MIME = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png'
  };

  function byteLength(text) {
    return typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length * 3;
  }

  /**
   * Most recent turns first, trimmed so the whole request fits the backend's
   * body limit (Hindi / Marathi text is 3 bytes per character in UTF-8).
   */
  var REPLY_LANGUAGES = ['auto', 'en', 'hi', 'mr'];

  function buildBody(message, history, documentIds, conversation) {
    var turns = (history || [])
      .filter(function (m) {
        return (m.role === 'user' || m.role === 'assistant') && m.content;
      })
      .map(function (m) {
        return { role: m.role, content: String(m.content).slice(0, MAX_HISTORY_ITEM_CHARS) };
      });

    var body = { message: message, history: turns };
    // Drop the oldest turns first, but keep the opening message (it usually
    // states the case: who, what, how much) for as long as possible.
    while (body.history.length > 1 && byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
      body.history.splice(1, 1);
    }
    if (body.history.length && byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) body.history = [];
    if (!body.history.length) delete body.history;
    if (documentIds && documentIds.length) body.documentIds = documentIds.slice(0, 3);
    if (conversation && conversation.conversationId) {
      // Saved conversation: the server loads the history itself.
      body.conversationId = conversation.conversationId;
      delete body.history;
    } else if (conversation && conversation.newConversation) {
      body.newConversation = true;
    }
    // Reply language chosen on the page; 'auto' is the server default, so it is not sent.
    if (conversation && conversation.language && conversation.language !== 'auto' &&
        REPLY_LANGUAGES.indexOf(conversation.language) !== -1) {
      body.language = conversation.language;
    }
    return body;
  }

  function codeForStatus(status) {
    if (status === 400) return 'invalid';
    if (status === 401) return 'auth-required';
    if (status === 403) return 'forbidden';
    if (status === 413) return 'too-long';
    if (status === 429) return 'rate-limited';
    if (status === 503) return 'ai-unavailable';
    if (status >= 500) return 'ai-failed';
    return 'unknown';
  }

  /** Backend error codes (POST /guidance/chat) → codes the UI has messages for. */
  var AI_CODES = {
    ai_quota: 'ai-quota',
    ai_timeout: 'ai-timeout',
    ai_unavailable: 'ai-unavailable',
    ai_not_configured: 'not-configured',
    ai_blocked: 'ai-declined',
    ai_empty: 'ai-empty',
    ai_failed: 'ai-failed'
  };

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
     * @param {{ signal?: AbortSignal, documentIds?: string[] }} opts lets the UI cancel (e.g. "back
     *        to suggestions") and attach uploaded documents
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

      var requestBody = JSON.stringify(buildBody(question, history, opts && opts.documentIds, opts));

      return withSession(function (authHeaders) {
        return fetch(apiBaseUrl + '/guidance/chat', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders),
          credentials: 'include', // same as auth.js apiRequest (refresh cookie, cross-origin dev)
          body: requestBody,
          signal: controller.signal
        });
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () { return null; })
            .then(function (json) {
              if (res.ok && json && json.success && typeof json.reply === 'string' && json.reply.trim()) {
                return {
                  status: 'answered',
                  reply: json.reply.trim(),
                  // Older backends send no type: treat their replies as guidance.
                  type: REPLY_TYPES.indexOf(json.type) !== -1 ? json.type : 'guidance',
                  lawyers: validLawyers(json.lawyers),
                  conversationId: typeof json.conversationId === 'string' && /^[a-f0-9]{24}$/i.test(json.conversationId) ? json.conversationId : null,
                  conversationTitle: typeof json.conversationTitle === 'string' ? json.conversationTitle : null,
                  saveFailed: json.saveFailed === true
                };
              }
              // Backend v2 says exactly what went wrong with the AI (json.code).
              var aiCode = json && typeof json.code === 'string' ? AI_CODES[json.code] : null;
              var code = res.ok ? 'ai-failed'
                : aiCode ? aiCode
                : res.status === 404 ? (json && /conversation/i.test(json.message || '') ? 'conversation-missing' : 'document-missing')
                  : res.status === 409 ? 'conversation-full'
                    : res.status === 422 ? 'ai-declined'
                      : codeForStatus(res.status);
              return {
                status: 'error',
                code: code,
                // Server messages are shown only for input / limit problems (e.g. "Please enter a legal question.").
                serverMessage: [400, 404, 409, 422].indexOf(res.status) !== -1 && json && json.message ? json.message : null
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

    /**
     * Runs a request with the auth.js session: Bearer access token, and on a
     * 401 one session refresh (httpOnly cookie) and a re-send.
     * @param {(authHeaders: object) => Promise<Response>} doFetch
     */
    function withSession(doFetch) {
      function attempt() {
        var token = typeof global.getAccessToken === 'function' ? global.getAccessToken() : null;
        return doFetch(token ? { Authorization: 'Bearer ' + token } : {});
      }
      var ready = typeof global.getAccessToken === 'function' && !global.getAccessToken() &&
        typeof global.restoreSession === 'function'
        ? global.restoreSession().catch(function () { return false; })
        : Promise.resolve(true);
      return ready.then(attempt).then(function (res) {
        if (res.status !== 401 || typeof global.refreshSession !== 'function') return res;
        return global.refreshSession().then(function (ok) { return ok ? attempt() : res; });
      });
    }

    /** Checks a file before uploading (same rules as the server). */
    function checkFile(file) {
      var name = file && file.name ? String(file.name) : '';
      var ext = name.indexOf('.') !== -1 ? name.split('.').pop().toLowerCase() : '';
      if (ext === 'doc') return { ok: false, code: 'invalid-file', message: 'Old Word .doc files are not supported. Please save it as .docx or PDF.' };
      if (!name || ACCEPTED_FILE_EXTENSIONS.indexOf(ext) === -1) return { ok: false, code: 'invalid-file' };
      if (!file.size) return { ok: false, code: 'invalid-file', message: 'The file is empty.' };
      if (file.size > MAX_FILE_BYTES) return { ok: false, code: 'file-too-large' };
      return { ok: true, ext: ext };
    }

    /**
     * Uploads one document; the server reads its text (PDF, DOCX, TXT; images
     * and scans through the AI) and returns its metadata.
     */
    function uploadDocument(file, opts) {
      var check = checkFile(file);
      if (!check.ok) return Promise.resolve({ status: 'error', code: check.code, message: check.message || null });
      if (isOffline()) return Promise.resolve({ status: 'error', code: 'offline' });
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 120000);
      var external = opts && opts.signal;
      if (external) external.addEventListener('abort', function () { controller.abort(); });

      return withSession(function (authHeaders) {
        return fetch(apiBaseUrl + '/guidance/documents', {
          method: 'POST',
          headers: Object.assign({
            'Content-Type': FILE_MIME[check.ext],
            'X-File-Name': encodeURIComponent(file.name),
            Accept: 'application/json'
          }, authHeaders),
          credentials: 'include',
          body: file,
          signal: controller.signal
        });
      })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (json) {
            if (res.ok && json && json.success && json.data && json.data.document) {
              return { status: 'uploaded', document: json.data.document };
            }
            var code = res.status === 401 ? 'auth-required' : res.status === 403 ? 'forbidden'
              : res.status === 429 ? 'rate-limited' : res.status === 413 ? 'file-too-large'
                : res.status === 503 ? 'server-busy' : 'upload-failed';
            // The server's message explains file problems (type, size, unreadable…)
            // and, for 503, which reader is unavailable (e.g. PDF reading).
            var message = json && json.message && ((res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403) || res.status === 503)
              ? json.message : null;
            return { status: 'error', code: code, message: message };
          });
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return { status: 'error', code: 'timeout' };
          return { status: 'error', code: isOffline() ? 'offline' : 'unreachable' };
        })
        .then(function (result) {
          clearTimeout(timer);
          return result;
        });
    }

    /** Deletes one of the user's uploaded documents (best effort). */
    function deleteDocument(id) {
      if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return Promise.resolve(false);
      return withSession(function (authHeaders) {
        return fetch(apiBaseUrl + '/guidance/documents/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: Object.assign({ Accept: 'application/json' }, authHeaders),
          credentials: 'include'
        });
      })
        .then(function (res) { return res.ok || res.status === 404; })
        .catch(function () { return false; });
    }

    /**
     * The text the server extracted from one of the customer's documents.
     * Resolves { status: 'ok', text, document } or { status: 'error', httpStatus }.
     */
    function getDocumentText(id) {
      if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return Promise.resolve({ status: 'error', httpStatus: 404 });
      if (isOffline()) return Promise.resolve({ status: 'error', httpStatus: 0, offline: true });
      return getWithSession('/guidance/documents/' + encodeURIComponent(id) + '/text').then(function (r) {
        if (!r.ok || !r.data || typeof r.data.text !== 'string') return { status: 'error', httpStatus: r.status };
        return { status: 'ok', text: r.data.text, document: r.data.document || null };
      });
    }

    /** GET with the session; resolves { ok, status, data }. */
    function getWithSession(path) {
      return withSession(function (authHeaders) {
        return fetch(apiBaseUrl + path, {
          method: 'GET',
          headers: Object.assign({ Accept: 'application/json' }, authHeaders),
          credentials: 'include'
        });
      })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (json) {
            return { ok: res.ok && !!(json && json.success), status: res.status, data: json && json.data };
          });
        })
        .catch(function () { return { ok: false, status: 0, data: null }; });
    }

    /** The customer's saved conversations (titles only). status 401 → not logged in. */
    function listConversations() {
      return getWithSession('/guidance/conversations').then(function (r) {
        if (!r.ok || !r.data || !Array.isArray(r.data.conversations)) return { status: 'error', httpStatus: r.status };
        return {
          status: 'ok',
          limits: r.data.limits || {},
          conversations: r.data.conversations.filter(function (c) { return c && /^[a-f0-9]{24}$/i.test(c.id); }).map(function (c) {
            return {
              id: c.id,
              title: typeof c.title === 'string' ? c.title : 'Legal conversation',
              messageCount: Number(c.messageCount) || 0,
              lastMessageAt: c.lastMessageAt || null
            };
          })
        };
      });
    }

    /** One saved conversation with its messages and documents. */
    function getConversation(id) {
      if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return Promise.resolve({ status: 'error', httpStatus: 404 });
      return getWithSession('/guidance/conversations/' + encodeURIComponent(id)).then(function (r) {
        var c = r.ok && r.data && r.data.conversation;
        if (!c || !Array.isArray(c.messages)) return { status: 'error', httpStatus: r.status };
        return {
          status: 'ok',
          conversation: {
            id: c.id,
            title: String(c.title || ''),
            full: c.full === true,
            messages: c.messages.filter(function (m) {
              return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
            }).map(function (m) {
              return {
                role: m.role,
                content: m.content,
                kind: m.role === 'assistant' ? (REPLY_TYPES.indexOf(m.kind) !== -1 ? m.kind : 'guidance') : undefined,
                attachments: Array.isArray(m.attachments) ? m.attachments.filter(function (a) { return typeof a === 'string'; }) : [],
                lawyers: m.lawyers ? validLawyers(m.lawyers) : null
              };
            }),
            documents: (Array.isArray(c.documents) ? c.documents : []).filter(function (d) {
              return d && /^[a-f0-9]{24}$/i.test(d.id) && typeof d.name === 'string';
            })
          }
        };
      });
    }

    /**
     * Renames one of the customer's conversations (saved in MongoDB).
     * Resolves { ok: true, conversation } or { ok: false, status, message }.
     */
    function renameConversation(id, title) {
      if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return Promise.resolve({ ok: false, status: 404 });
      return withSession(function (authHeaders) {
        return fetch(apiBaseUrl + '/guidance/conversations/' + encodeURIComponent(id), {
          method: 'PATCH',
          headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, authHeaders),
          credentials: 'include',
          body: JSON.stringify({ title: String(title || '') })
        });
      })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (json) {
            var c = json && json.data && json.data.conversation;
            if (res.ok && c && typeof c.title === 'string') return { ok: true, conversation: { id: c.id, title: c.title } };
            return { ok: false, status: res.status, message: res.status === 422 && json && json.message ? json.message : null };
          });
        })
        .catch(function () { return { ok: false, status: 0, message: null }; });
    }

    /** Deletes one of the customer's conversations (and the documents uploaded in it). */
    function deleteConversation(id) {
      if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return Promise.resolve(false);
      return withSession(function (authHeaders) {
        return fetch(apiBaseUrl + '/guidance/conversations/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: Object.assign({ Accept: 'application/json' }, authHeaders),
          credentials: 'include'
        });
      })
        .then(function (res) { return res.ok || res.status === 404; })
        .catch(function () { return false; });
    }

    return {
      apiBaseUrl: apiBaseUrl,
      listConversations: listConversations,
      getConversation: getConversation,
      renameConversation: renameConversation,
      deleteConversation: deleteConversation,
      ACCEPTED_FILE_TYPES: ACCEPTED_FILE_TYPES,
      MAX_MESSAGE_CHARS: MAX_MESSAGE_CHARS,
      MAX_FILE_BYTES: MAX_FILE_BYTES,
      askGuidance: askGuidance,
      uploadDocument: uploadDocument,
      getDocumentText: getDocumentText,
      deleteDocument: deleteDocument,
      REPLY_LANGUAGES: REPLY_LANGUAGES.slice()
    };
  }

  /** Keeps only well-formed lawyer suggestions from the server (shown as text only). */
  function validLawyers(value) {
    if (!value || !Array.isArray(value.items)) return null;
    var str = function (v) { return typeof v === 'string' ? v : ''; };
    return {
      area: str(value.area) || null,
      city: str(value.city) || null,
      matchedCity: value.matchedCity !== false,
      items: value.items.filter(function (l) { return l && typeof l.id === 'string' && typeof l.name === 'string'; }).slice(0, 6).map(function (l) {
        return {
          id: l.id,
          name: l.name,
          verified: l.verified === true,
          practiceAreas: Array.isArray(l.practiceAreas) ? l.practiceAreas.filter(function (x) { return typeof x === 'string'; }) : [],
          location: str(l.location),
          languages: Array.isArray(l.languages) ? l.languages.filter(function (x) { return typeof x === 'string'; }) : [],
          experienceYears: typeof l.experienceYears === 'number' ? l.experienceYears : null,
          consultationFee: typeof l.consultationFee === 'number' && l.consultationFee > 0 ? l.consultationFee : null
        };
      })
    };
  }

  global.LegalHelpService = { create: createLegalHelpService, buildBody: buildBody };
})(window);
