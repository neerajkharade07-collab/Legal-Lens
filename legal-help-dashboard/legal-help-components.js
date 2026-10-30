/**
 * LegalLens — Legal Help: reusable UI components (plain JS, no framework).
 *
 * Each component is a function that returns a DOM element. Text from the data
 * file is always set with textContent (never innerHTML), so content can later
 * come from an API safely. Only the static SVG icons below use innerHTML.
 */
(function (global) {
  'use strict';

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (key === 'className') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.slice(0, 2) === 'on' && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else el.setAttribute(key, value === true ? '' : value);
    });
    [].concat(children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return el;
  }

  // ---------- icons (outline, 24×24, stroke = currentColor) ----------
  var ICON_PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12.5h18"/>',
    document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.6A4.6 4.6 0 0 1 21 19"/>',
    paperclip: '<path d="m21 11.5-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.9-8.9a3.7 3.7 0 0 1 5.2 5.2l-8.9 8.9a1.8 1.8 0 0 1-2.6-2.6l8.2-8.2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
    arrowUp: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    dots: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7 7.5 20h9l1-13"/>',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'
  };

  function Icon(name, size) {
    var span = h('span', { className: 'llh-icon', 'aria-hidden': 'true' });
    span.innerHTML =
      '<svg viewBox="0 0 24 24" width="' + (size || 20) + '" height="' + (size || 20) +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false">' +
      (ICON_PATHS[name] || '') + '</svg>';
    return span;
  }

  // ---------- QueryCard ----------
  /** One of the four suggestion cards. */
  function QueryCard(query, onSelect) {
    return h(
      'button',
      {
        type: 'button',
        className: 'llh-card',
        'data-topic': query.id,
        'aria-label': query.title + ': ' + query.question,
        onClick: function () { onSelect(query.id); }
      },
      [
        Icon(query.icon, 22),
        h('span', { className: 'llh-card__title', text: query.title }),
        h('span', { className: 'llh-card__question', text: query.question }),
        h('span', { className: 'llh-card__arrow' }, [Icon('arrowRight', 16)])
      ]
    );
  }

  // ---------- SearchBar ----------
  /**
   * ChatGPT-style input: attach · text · mic | send.
   * callbacks: { onSubmit(text), onFile(file), onVoice() }
   * Returns { element, setPlaceholder(text), clear(), focus(), getValue(), setValue(text),
   *           setListening(bool), setUploading(bool) }.
   */
  function SearchBar(options) {
    var fileInput = h('input', {
      type: 'file',
      className: 'llh-visually-hidden',
      accept: options.accept,
      tabindex: '-1',
      'aria-hidden': 'true'
    });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (file) options.onFile(file);
      fileInput.value = ''; // allow choosing the same file again
    });

    var input = h('input', {
      type: 'text',
      className: 'llh-search__input',
      placeholder: options.placeholder,
      'aria-label': options.placeholder.replace(/\.\.\.$/, ''),
      autocomplete: 'off',
      maxlength: '2000'
    });

    var busy = false;
    var uploading = false;
    var micButton = h(
      'button',
      {
        type: 'button',
        className: 'llh-search__icon-btn llh-search__mic',
        'aria-label': 'Speak your question',
        'aria-pressed': 'false',
        title: 'Speak your question',
        onClick: function () { options.onVoice(); }
      },
      [Icon('mic', 20)]
    );
    var send = h(
      'button',
      { type: 'submit', className: 'llh-search__send', 'aria-label': 'Send question', disabled: true },
      [Icon('arrowUp', 18)]
    );
    function syncSend() {
      send.disabled = busy || !input.value.trim();
    }
    input.addEventListener('input', syncSend);

    var form = h(
      'form',
      {
        className: 'llh-search',
        role: 'search',
        onSubmit: function (event) {
          event.preventDefault();
          if (busy) return; // one question at a time
          options.onSubmit(input.value);
        }
      },
      [
        h(
          'button',
          {
            type: 'button',
            className: 'llh-search__icon-btn llh-search__attach',
            'aria-label': 'Attach a legal document (PDF, DOCX, TXT, JPG or PNG)',
            title: 'Attach a document (PDF, DOCX, TXT, JPG, PNG)',
            onClick: function () { if (!uploading) fileInput.click(); }
          },
          [Icon('paperclip', 20)]
        ),
        fileInput,
        input,
        micButton,
        h('span', { className: 'llh-search__divider', 'aria-hidden': 'true' }),
        send
      ]
    );

    return {
      element: form,
      setPlaceholder: function (text) {
        input.placeholder = text;
        input.setAttribute('aria-label', text.replace(/\.\.\.$/, ''));
      },
      clear: function () {
        input.value = '';
        syncSend();
      },
      /** While a response is loading: send is disabled and Enter is ignored. */
      setBusy: function (value) {
        busy = Boolean(value);
        form.setAttribute('aria-busy', busy ? 'true' : 'false');
        syncSend();
      },
      focus: function () { input.focus(); },
      getValue: function () { return input.value; },
      /** Puts (voice) text in the box for the user to review; never sends it. */
      setValue: function (text) {
        input.value = String(text || '').slice(0, 2000);
        syncSend();
      },
      setListening: function (value) {
        micButton.setAttribute('aria-pressed', value ? 'true' : 'false');
        micButton.setAttribute('aria-label', value ? 'Stop listening' : 'Speak your question');
        micButton.classList.toggle('is-listening', !!value);
      },
      setUploading: function (value) {
        uploading = !!value;
        form.classList.toggle('is-uploading', uploading);
      }
    };
  }

  // ---------- VoicePanel ----------
  /**
   * Shown above the search bar while (or after) using the microphone.
   * options: { state: 'listening'|'review'|'error'|'unsupported', languages, language,
   *            message, onLanguage(code), onStop(), onClose() }
   */
  function VoicePanel(options) {
    var select = null;
    if (options.languages && options.state !== 'unsupported') {
      select = h('select', {
        className: 'llh-voice__lang',
        'aria-label': 'Speech language',
        onChange: function (e) { options.onLanguage(e.target.value); }
      }, options.languages.map(function (l) {
        return h('option', { value: l.code, selected: l.code === options.language, text: l.label });
      }));
    }
    var listening = options.state === 'listening';
    return h('div', {
      className: 'llh-voice llh-voice--' + options.state,
      role: options.state === 'error' || options.state === 'unsupported' ? 'alert' : 'status'
    }, [
      h('div', { className: 'llh-voice__row' }, [
        listening ? h('span', { className: 'llh-voice__dot', 'aria-hidden': 'true' }) : null,
        h('p', { className: 'llh-voice__title', text: options.title }),
        select,
        listening
          ? h('button', { type: 'button', className: 'llh-button llh-button--ghost llh-voice__stop', onClick: options.onStop }, [Icon('stop', 14), ' Stop'])
          : h('button', { type: 'button', className: 'llh-voice__close', 'aria-label': 'Close', onClick: options.onClose }, [Icon('close', 16)])
      ]),
      options.message ? h('p', { className: 'llh-voice__text', text: options.message }) : null,
      options.privacy ? h('p', { className: 'llh-voice__privacy', text: options.privacy }) : null
    ]);
  }

  // ---------- DocumentTray ----------
  /** Pages / reading method / limits of one document, as short text pieces. */
  function documentFacts(d, T) {
    var bits = [];
    if (d.pages) bits.push(d.pages + (d.pages === 1 ? ' page' : ' pages'));
    if (d.method === 'ai-ocr') bits.push(T.readByAI || 'read by AI from an image');
    if (d.unreadablePages && d.unreadablePages.length) bits.push((T.unreadablePages || 'no text on page') + ' ' + d.unreadablePages.join(', '));
    if (d.truncated) bits.push(T.truncated || 'only the beginning is used');
    return bits;
  }

  /** Why a document is incomplete: the server's "Incomplete: …" note, or a general sentence. */
  function incompleteText(d, T) {
    var note = String(d.note || '').trim();
    return note || T.incompleteFallback || 'Some of this document is missing from the text.';
  }

  /**
   * The documents attached to this conversation (and an upload in progress).
   * options: { documents: [{ id, name, pages, method, unreadablePages, truncated, note, complete }],
   *            uploading: string|null (file name), error: string|null, onRemove(id), onView(id), text }
   * complete === false (backend v2): part of the document is missing from the
   * text → a visible warning under the document, never a silent omission.
   */
  function DocumentTray(options) {
    var T = options.text || {};
    var warnings = [];
    var items = (options.documents || []).map(function (d) {
      var bits = documentFacts(d, T);
      var incomplete = d.complete === false;
      if (incomplete) {
        bits.unshift(T.incomplete || 'incomplete');
        warnings.push(h('div', { className: 'llh-doc-warning', role: 'note' }, [
          h('p', { className: 'llh-doc-warning__title' }, [
            Icon('info', 15),
            h('span', { text: (T.incompleteTitle || 'Part of this document could not be read') + ': ' }),
            h('span', { className: 'llh-doc-warning__name', text: d.name })
          ]),
          h('p', { className: 'llh-doc-warning__text', text: incompleteText(d, T) + ' ' + (T.incompleteHint || '') })
        ]));
      }
      var warn = incomplete || d.method === 'ai-ocr' || (d.unreadablePages && d.unreadablePages.length);
      return h('li', { className: 'llh-doc' + (warn ? ' llh-doc--warn' : '') + (incomplete ? ' llh-doc--incomplete' : '') }, [
        Icon('document', 16),
        h('span', { className: 'llh-doc__name', text: d.name, title: d.name }),
        bits.length ? h('span', { className: 'llh-doc__meta', text: bits.join(' · ') }) : null,
        options.onView
          ? h('button', {
              type: 'button',
              className: 'llh-doc__view',
              'data-doc-id': d.id,
              'aria-label': (T.viewTextFor || 'View the text read from') + ' ' + d.name,
              onClick: function () { options.onView(d.id); }
            }, [T.viewText || 'View text'])
          : null,
        h('button', {
          type: 'button',
          className: 'llh-doc__remove',
          'aria-label': 'Remove ' + d.name,
          title: 'Remove',
          disabled: options.disabled,
          onClick: function () { options.onRemove(d.id); }
        }, [Icon('close', 14)])
      ]);
    });
    if (options.uploading) {
      items.push(h('li', { className: 'llh-doc llh-doc--busy', role: 'status' }, [
        h('span', { className: 'llh-spinner', 'aria-hidden': 'true' }),
        h('span', { className: 'llh-doc__name', text: (T.reading || 'Reading') + ' ' + options.uploading + '…' })
      ]));
    }
    if (!items.length && !options.error) return h('div', { className: 'llh-docs', hidden: true });
    return h('div', { className: 'llh-docs' }, [
      items.length ? h('ul', { className: 'llh-docs__list', 'aria-label': T.attachedLabel || 'Attached documents' }, items) : null,
      warnings.length ? h('div', { className: 'llh-doc-warnings' }, warnings) : null,
      options.error ? h('p', { className: 'llh-docs__error', role: 'alert', text: options.error }) : null
    ]);
  }

  // ---------- DocumentTextViewer ----------
  /**
   * Dialog showing the text the server extracted from one document.
   * state: 'loading' | 'ready' | 'error'. The text is set with textContent
   * (never HTML), so document content cannot inject markup.
   * options: { state, document, text, errorText, onClose, onRetry, labels }
   */
  function DocumentTextViewer(options) {
    var T = options.labels || {};
    var d = options.document || {};
    var titleId = 'llh-textview-title';
    var body;
    if (options.state === 'loading') {
      body = h('p', { className: 'llh-textview__status', role: 'status' }, [
        h('span', { className: 'llh-spinner', 'aria-hidden': 'true' }), ' ' + (T.textLoading || 'Loading…')
      ]);
    } else if (options.state === 'error') {
      body = h('div', { className: 'llh-textview__status', role: 'alert' }, [
        h('p', { text: options.errorText || '' }),
        options.onRetry ? h('button', { type: 'button', className: 'llh-button llh-button--ghost', onClick: options.onRetry }, [T.textRetry || 'Try again']) : null
      ]);
    } else {
      body = h('pre', { className: 'llh-textview__text', tabindex: '0', text: options.text || '' });
    }
    var facts = documentFacts(d, T);
    if (options.state === 'ready' && typeof options.text === 'string') facts.push(options.text.length.toLocaleString('en-IN') + ' ' + (T.textCharacters || 'characters'));
    var closeBtn = h('button', { type: 'button', className: 'llh-button llh-textview__close', onClick: options.onClose }, [T.textClose || 'Close']);
    var box = h('div', { className: 'llh-dialog__box llh-textview', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
      h('div', { className: 'llh-textview__head' }, [
        h('div', null, [
          h('h2', { className: 'llh-dialog__title', id: titleId, text: T.textTitle || 'Text read from this document' }),
          h('p', { className: 'llh-textview__name', text: d.name || '' }),
          facts.length ? h('p', { className: 'llh-textview__meta', text: facts.join(' · ') }) : null
        ]),
        h('button', { type: 'button', className: 'llh-doc__remove llh-textview__x', 'aria-label': T.textClose || 'Close', onClick: options.onClose }, [Icon('close', 16)])
      ]),
      d.complete === false
        ? h('div', { className: 'llh-doc-warning', role: 'note' }, [
            h('p', { className: 'llh-doc-warning__title' }, [Icon('info', 15), h('span', { text: T.incompleteTitle || 'Part of this document could not be read' })]),
            h('p', { className: 'llh-doc-warning__text', text: incompleteText(d, T) + ' ' + (T.incompleteHint || '') })
          ])
        : null,
      h('p', { className: 'llh-textview__intro', text: T.textIntro || '' }),
      body,
      h('div', { className: 'llh-dialog__actions' }, [closeBtn])
    ]);
    var overlay = h('div', {
      className: 'llh-dialog llh-textview-overlay',
      onClick: function (e) { if (e.target === overlay) options.onClose(); },
      onKeydown: function (e) {
        if (e.key === 'Escape') { e.preventDefault(); options.onClose(); return; }
        if (e.key === 'Tab') {
          // Keep keyboard focus inside the dialog.
          var f = [].slice.call(box.querySelectorAll('button:not([disabled]), [tabindex="0"]'));
          if (!f.length) return;
          var first = f[0];
          var last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }, [box]);
    overlay.focusTarget = closeBtn;
    return overlay;
  }

  // ---------- ReplyLanguagePicker ----------
  /** Native <select> for the AI reply language (Auto / English / Hindi / Marathi). */
  function ReplyLanguagePicker(options) {
    var T = options.labels || {};
    var select = h('select', {
      className: 'llh-lang__select',
      id: 'llh-reply-language',
      title: T.hint || '',
      onChange: function () { options.onChange(select.value); }
    }, (T.options || []).map(function (o) {
      return h('option', { value: o.code, selected: o.code === options.value }, [o.label]);
    }));
    select.value = options.value;
    var el = h('div', { className: 'llh-lang' }, [
      h('label', { className: 'llh-lang__label', for: 'llh-reply-language', text: (T.label || 'Reply language') + ':' }),
      select
    ]);
    return {
      element: el,
      setValue: function (v) { select.value = v; },
      setDisabled: function (on) { select.disabled = !!on; }
    };
  }

  // ---------- LawyerSuggestions ----------
  /**
   * Verified lawyers from the Legal Lens database (sent by the backend).
   * Every value is shown as text; nothing about a lawyer is made up here.
   */
  function LawyerSuggestions(lawyers, M, links) {
    var T = M.lawyerSuggestions || {};
    var area = lawyers.area ? lawyers.area : '';
    var subtitle;
    if (!lawyers.items.length) subtitle = T.none;
    else if (lawyers.city && lawyers.matchedCity) subtitle = (T.inCity || 'Approved lawyers in') + ' ' + lawyers.city + (area ? ' · ' + area : '');
    else if (lawyers.city) subtitle = (T.otherCities || 'No approved lawyer found in') + ' ' + lawyers.city + '. ' + (T.showingOthers || 'Showing approved lawyers from other cities.') + (area ? ' · ' + area : '');
    else subtitle = area ? area : '';

    var cards = lawyers.items.map(function (l) {
      var facts = [];
      if (l.location) facts.push(l.location);
      if (typeof l.experienceYears === 'number' && l.experienceYears > 0) facts.push(l.experienceYears + (l.experienceYears === 1 ? ' year' : ' years') + ' experience');
      var fee = l.consultationFee ? (T.fee || 'Consultation fee') + ': ₹' + Number(l.consultationFee).toLocaleString('en-IN') : (T.feeNotListed || 'Fee not listed');
      return h('li', { className: 'llh-lawyer llh-lawyer--real' }, [
        h('div', { className: 'llh-lawyer__head' }, [
          h('p', { className: 'llh-lawyer__name', text: l.name }),
          // "Verified" only when authorised official sources confirmed the credentials;
          // a CASEONE manual approval is never shown as official verification.
          l.verified ? h('span', { className: 'llh-badge llh-badge--verified' }, [Icon('check', 12), ' ' + (l.verificationMethod === 'official_sources' ? (T.verified || 'Verified') : (T.reviewed || 'Reviewed by CASEONE'))]) : null
        ]),
        l.practiceAreas.length ? h('p', { className: 'llh-lawyer__meta', text: l.practiceAreas.join(', ') }) : null,
        facts.length ? h('p', { className: 'llh-lawyer__meta', text: facts.join(' · ') }) : null,
        l.languages.length ? h('p', { className: 'llh-lawyer__meta', text: (T.languages || 'Languages') + ': ' + l.languages.join(', ') }) : null,
        h('p', { className: 'llh-lawyer__fee', text: fee }),
        links && links.lawyerProfileUrl && /^[a-f0-9]{24}$/i.test(l.id)
          ? h('a', {
              className: 'llh-button llh-button--ghost llh-lawyer__profile',
              href: links.lawyerProfileUrl + '?id=' + encodeURIComponent(l.id),
              'aria-label': (T.viewProfile || 'View profile') + ': ' + l.name
            }, [(T.viewProfile || 'View profile') + ' ', Icon('arrowRight', 15)])
          : null
      ]);
    });

    return h('section', { className: 'llh-panel llh-lawyers', 'aria-label': T.title || 'Approved lawyers on Legal Lens' }, [
      h('h2', { className: 'llh-panel__title', text: T.title || 'Approved lawyers on Legal Lens' }),
      subtitle ? h('p', { className: 'llh-lawyers__subtitle', text: subtitle }) : null,
      cards.length ? h('ul', { className: 'llh-lawyers__list' }, cards) : null,
      h('p', { className: 'llh-panel__disclaimer', text: T.disclaimer || '' }),
      links && links.findLawyerUrl
        ? h('a', { className: 'llh-button llh-button--ghost', href: links.findLawyerUrl }, [(T.browse || 'Browse Lawyer Connect') + ' ', Icon('arrowRight', 15)])
        : null
    ]);
  }

  // ---------- ConversationList ----------
  /**
   * The customer's saved conversations, with Open and Delete (two-step).
   * options: { conversations, currentId, confirmingId, busy, title, emptyText,
   *            retentionText, onOpen(id), onAskDelete(id), onConfirmDelete(id), onCancelDelete() }
   */
  function ConversationList(options) {
    var items = (options.conversations || []).map(function (c) {
      var when = c.lastMessageAt ? new Date(c.lastMessageAt) : null;
      var meta = [
        when && !isNaN(when) ? when.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        c.messageCount ? Math.ceil(c.messageCount / 2) + (c.messageCount > 2 ? ' questions' : ' question') : null
      ].filter(Boolean).join(' · ');
      var confirming = options.confirmingId === c.id;
      return h('li', { className: 'llh-conv' + (options.currentId === c.id ? ' llh-conv--current' : '') }, [
        h('button', {
          type: 'button',
          className: 'llh-conv__open',
          disabled: options.busy,
          'aria-current': options.currentId === c.id ? 'true' : null,
          onClick: function () { options.onOpen(c.id); }
        }, [
          h('span', { className: 'llh-conv__title', text: c.title }),
          meta ? h('span', { className: 'llh-conv__meta', text: meta }) : null
        ]),
        confirming
          ? h('span', { className: 'llh-conv__confirm', role: 'group', 'aria-label': 'Confirm delete' }, [
              h('span', { className: 'llh-conv__ask', text: 'Delete this conversation and its documents?' }),
              h('button', { type: 'button', className: 'llh-button llh-conv__yes', onClick: function () { options.onConfirmDelete(c.id); } }, ['Delete']),
              h('button', { type: 'button', className: 'llh-button llh-button--ghost', onClick: options.onCancelDelete }, ['Cancel'])
            ])
          : h('button', {
              type: 'button',
              className: 'llh-conv__delete',
              'aria-label': 'Delete conversation: ' + c.title,
              title: 'Delete',
              disabled: options.busy,
              onClick: function () { options.onAskDelete(c.id); }
            }, [Icon('close', 15)])
      ]);
    });
    return h('section', { className: 'llh-panel llh-convs', 'aria-label': options.title }, [
      h('h2', { className: 'llh-panel__title', text: options.title }),
      items.length
        ? h('ul', { className: 'llh-convs__list' }, items)
        : h('p', { className: 'llh-convs__empty', text: options.emptyText }),
      options.retentionText ? h('p', { className: 'llh-panel__disclaimer', text: options.retentionText }) : null
    ]);
  }

  // ---------- QuickActions ----------
  /** Short follow-up chips after an answer (court preparation, language switch…). */
  function QuickActions(actions, disabled, onSelect) {
    return h('div', { className: 'llh-quick', role: 'group', 'aria-label': 'Quick follow-ups' }, actions.map(function (a) {
      return h('button', {
        type: 'button',
        className: 'llh-chip llh-quick__chip',
        text: a.label,
        disabled: disabled,
        onClick: function () { onSelect(a); }
      });
    }));
  }

  // ---------- ComingSoonMessage ----------
  /** "Feature coming soon" notice. Optional file name and suggestion chips. */
  function ComingSoonMessage(options) {
    return h('div', { className: 'llh-soon', role: 'status' }, [
      options.fileName ? h('p', { className: 'llh-soon__file', text: options.fileName }) : null,
      h('p', { className: 'llh-soon__title', text: options.title }),
      h('p', { className: 'llh-soon__text', text: options.text }),
      options.suggestions && options.suggestions.length
        ? h(
            'div',
            { className: 'llh-soon__chips', role: 'group', 'aria-label': 'Suggested queries' },
            options.suggestions.map(function (q) {
              return h('button', {
                type: 'button',
                className: 'llh-chip',
                text: q.title,
                disabled: options.disabled,
                onClick: function () { options.onSelect(q.id); }
              });
            })
          )
        : null
    ]);
  }

  // ---------- GovernmentResource ----------
  /** A REAL official website, opened in a new tab. */
  function GovernmentResource(resource) {
    return h('div', { className: 'llh-resource' }, [
      h('p', { className: 'llh-resource__name', text: resource.name }),
      h('p', { className: 'llh-resource__desc', text: resource.description }),
      h(
        'a',
        {
          className: 'llh-button',
          href: resource.url,
          target: '_blank',
          rel: 'noopener noreferrer'
        },
        [
          resource.cta + ' ',
          Icon('arrowRight', 15),
          h('span', { className: 'llh-visually-hidden', text: ' (' + resource.url + ', opens in a new tab)' })
        ]
      )
    ]);
  }

  // ---------- FormattedReply ----------
  /**
   * Renders the AI's plain-text / light-markdown reply: paragraphs, headings,
   * bold / italic, bullet and numbered lists (nested), quotes, horizontal
   * rules, simple tables and fenced draft blocks (with a Copy button).
   *
   * Safety: every piece of text is inserted with textContent / text nodes —
   * the reply can never inject HTML or scripts. URLs stay plain text on
   * purpose: only the official links curated in legal-help-data.js are ever
   * rendered as clickable.
   */

  /** Removes stray escapes / hidden markers before rendering (defensive; the backend cleans too). */
  function cleanReplyText(text) {
    var t = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (/\\n/.test(t)) t = t.replace(/\\r\\n|\\n/g, '\n');
    t = t.replace(/\\t/g, ' ');
    t = t.replace(/\\([*_#\-.()[\]!>|`~+{}])/g, '$1');
    t = t.replace(/\\[ \t]*$/gm, '');
    // Hidden header lines (TYPE / LAWYER) are removed only at the very top,
    // so a draft line like "Type: Draft notice" stays.
    var lines = t.replace(/^\s+/, '').split('\n');
    var headerRe = /^[ \t>*_`#]*(TYPE[ \t]*[:：-][ \t]*\**[ \t]*(question|answer|draft|out[ _-]?of[ _-]?scope)\b|LAWYER[ \t]*[:：])/i;
    while (lines.length && (headerRe.test(lines[0]) || (!lines[0].trim() && lines.length > 1 && headerRe.test(lines[1])))) lines.shift();
    t = lines.join('\n');
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Inline markdown → DOM nodes: ***bold italic***, **bold**, __bold__, *italic*, _italic_, `code`. */
  function inlineNodes(text) {
    var nodes = [];
    var re = /\*\*\*([^*\n]+?)\*\*\*|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)|(^|[^\w])_(?!\s)([^_\n]+?)_(?!\w)|`([^`\n]+)`/g;
    var last = 0;
    var m;
    function pushText(s) {
      // unmatched leftovers such as a lone "**" are noise: drop them
      s = s.replace(/\*\*+/g, '');
      if (s) nodes.push(document.createTextNode(s));
    }
    while ((m = re.exec(text))) {
      var lead = m[4] !== undefined ? m[4] : (m[6] !== undefined ? m[6] : '');
      pushText(text.slice(last, m.index) + lead);
      if (m[1]) nodes.push(h('strong', null, [h('em', { text: m[1] })]));
      else if (m[2] || m[3]) nodes.push(h('strong', { text: m[2] || m[3] }));
      else if (m[5]) nodes.push(h('em', { text: m[5] }));
      else if (m[7]) nodes.push(h('em', { text: m[7] }));
      else if (m[8]) nodes.push(h('code', { className: 'llh-reply__code', text: m[8] }));
      last = re.lastIndex;
    }
    if (last < text.length) pushText(text.slice(last));
    return nodes;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && global.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) { return false; }
  }

  /** A fenced block: shown as a copyable draft (legal notice, WhatsApp message, …). */
  function DraftBlock(text) {
    var body = String(text || '').replace(/^\n+|\n+$/g, '');
    var status = h('span', { className: 'llh-draft__status', 'aria-live': 'polite' });
    var btn = h('button', { type: 'button', className: 'llh-draft__copy' }, ['Copy']);
    btn.addEventListener('click', function () {
      copyToClipboard(body).then(function (ok) {
        status.textContent = ok ? 'Copied' : 'Select the text to copy';
        setTimeout(function () { status.textContent = ''; }, 2500);
      });
    });
    return h('div', { className: 'llh-draft' }, [
      h('div', { className: 'llh-draft__bar' }, [h('span', { className: 'llh-draft__label', text: 'Draft' }), status, btn]),
      h('pre', { className: 'llh-draft__text', text: body })
    ]);
  }

  function splitRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
  }

  function FormattedReply(text) {
    var root = h('div', { className: 'llh-reply' });
    var lines = cleanReplyText(text).split('\n');
    var paragraph = null;
    var lists = []; // stack of { el, indent, tag }

    function closeBlocks() { paragraph = null; lists = []; }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.trim();

      // fenced block (draft) — kept verbatim, no markdown processing
      var fence = /^```\s*([\w-]*)\s*$/.exec(line);
      if (fence) {
        closeBlocks();
        var buf = [];
        for (i = i + 1; i < lines.length && !/^```\s*$/.test(lines[i].trim()); i++) buf.push(lines[i]);
        root.appendChild(DraftBlock(buf.join('\n')));
        continue;
      }

      if (!line) { closeBlocks(); continue; }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { closeBlocks(); root.appendChild(h('hr', { className: 'llh-reply__rule' })); continue; }

      var heading = /^#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        closeBlocks();
        root.appendChild(h('h3', { className: 'llh-reply__heading' }, inlineNodes(heading[1].replace(/\*\*/g, '').replace(/#+\s*$/, ''))));
        continue;
      }

      // simple table: header row followed by a |---|---| separator
      if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
        closeBlocks();
        var head = splitRow(line);
        var rows = [];
        for (i = i + 2; i < lines.length && /^\|.*\|$/.test(lines[i].trim()); i++) rows.push(splitRow(lines[i].trim()));
        i--;
        root.appendChild(h('div', { className: 'llh-reply__table-wrap' }, [
          h('table', { className: 'llh-reply__table' }, [
            h('thead', null, [h('tr', null, head.map(function (c) { return h('th', null, inlineNodes(c)); }))]),
            h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (c) { return h('td', null, inlineNodes(c)); })); }))
          ])
        ]));
        continue;
      }

      var quote = /^>\s?(.*)$/.exec(line);
      if (quote) {
        closeBlocks();
        root.appendChild(h('p', { className: 'llh-reply__quote' }, inlineNodes(quote[1])));
        continue;
      }

      var bullet = /^[-*•+]\s+(.*)$/.exec(line);
      var numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
      if (bullet || numbered) {
        paragraph = null;
        var tag = bullet ? 'ul' : 'ol';
        var indent = raw.match(/^\s*/)[0].replace(/\t/g, '    ').length;
        while (lists.length && indent < lists[lists.length - 1].indent) lists.pop();
        var top = lists[lists.length - 1];
        if (top && indent > top.indent && top.el.lastChild) {
          // deeper indent → nested list inside the previous item
          var nested = h(tag, { className: 'llh-reply__list' });
          top.el.lastChild.appendChild(nested);
          lists.push({ el: nested, indent: indent, tag: tag });
        } else if (!top || top.tag !== tag) {
          if (top) lists.pop();
          var list = h(tag, { className: 'llh-reply__list' });
          if (numbered && numbered[1] !== '1') list.setAttribute('start', numbered[1]);
          (lists.length ? lists[lists.length - 1].el.lastChild : root).appendChild(list);
          lists.push({ el: list, indent: indent, tag: tag });
        }
        lists[lists.length - 1].el.appendChild(h('li', null, inlineNodes(bullet ? bullet[1] : numbered[2])));
        continue;
      }

      if (lists.length && /^\s{2,}/.test(raw) && lists[lists.length - 1].el.lastChild) {
        // indented continuation of a list item
        var li = lists[lists.length - 1].el.lastChild;
        li.appendChild(document.createTextNode(' '));
        inlineNodes(line).forEach(function (n) { li.appendChild(n); });
        continue;
      }

      lists = [];
      if (!paragraph) {
        paragraph = h('p', { className: 'llh-reply__p' });
        root.appendChild(paragraph);
      } else {
        paragraph.appendChild(h('br'));
      }
      inlineNodes(line).forEach(function (n) { paragraph.appendChild(n); });
    }

    return root;
  }

  // ---------- chat messages ----------
  function UserMessage(text, attachments) {
    return h('div', { className: 'llh-bubble-row' }, [
      h('div', { className: 'llh-bubble-wrap' }, [
        attachments && attachments.length
          ? h('p', { className: 'llh-bubble__files' }, attachments.map(function (name) {
              return h('span', { className: 'llh-bubble__file' }, [Icon('paperclip', 13), ' ' + name]);
            }))
          : null,
        h('p', { className: 'llh-bubble', text: text })
      ])
    ]);
  }

  function AssistantMessage(options) {
    var kind = options.kind; // clarification | guidance | out_of_scope (optional)
    return h('article', {
      className: 'llh-answer' + (kind === 'out_of_scope' ? ' llh-answer--scope' : ''),
      'aria-label': options.label
    }, [
      h('p', { className: 'llh-answer__from' }, [
        options.label,
        options.tag ? h('span', { className: 'llh-answer__tag', text: options.tag }) : null
      ]),
      FormattedReply(options.text)
    ]);
  }

  /** Shown while the backend/OpenAI is working. */
  function LoadingMessage(text) {
    return h('div', { className: 'llh-answer llh-answer--loading', role: 'status' }, [
      h('span', { className: 'llh-typing', 'aria-hidden': 'true' }, [h('span'), h('span'), h('span')]),
      h('span', { className: 'llh-typing__label', text: text + '…' })
    ]);
  }

  /** A failed request, with a retry button. */
  function ErrorMessage(options) {
    return h('div', { className: 'llh-error', role: 'alert' }, [
      h('p', { className: 'llh-error__title' }, [Icon('info', 16), h('span', { text: options.title })]),
      h('p', { className: 'llh-error__text', text: options.text }),
      options.onRetry
        ? h(
            'button',
            { type: 'button', className: 'llh-button llh-button--ghost', onClick: options.onRetry, disabled: options.disabled },
            [options.retryLabel]
          )
        : null,
      options.onAction
        ? h('button', { type: 'button', className: 'llh-button llh-button--ghost', onClick: options.onAction }, [options.actionLabel])
        : null
    ]);
  }

  /**
   * Official links for one of the four card topics. (The fictional demo
   * lawyers that used to be shown here were removed: lawyer suggestions now
   * come only from verified lawyers in the Legal Lens database.)
   */
  function TopicResources(topic, messages, uid) {
    var resId = 'llh-res-' + uid;
    return h('div', { className: 'llh-side' }, [
      h('section', { className: 'llh-panel', 'aria-labelledby': resId }, [
        h('h2', { className: 'llh-panel__title', id: resId, text: messages.resourcesTitle }),
        h('div', { className: 'llh-panel__list' }, topic.governmentResources.map(GovernmentResource))
      ])
    ]);
  }

  // ---------- ConversationView ----------
  /**
   * The chat screen: every turn of the conversation, a loading indicator while
   * waiting, errors with retry, and the disclaimer.
   * options: { messages[], loading, topics, text (MESSAGES), onBack, onRetry }
   * A failed request is shown as an error with "Try again" — never as a sample answer.
   */
  function ConversationView(options) {
    var M = options.text;
    var log = h('div', { className: 'llh-log' });

    options.messages.forEach(function (msg) {
      if (msg.role === 'user') {
        log.appendChild(UserMessage(msg.content, msg.attachments));
      } else if (msg.role === 'assistant') {
        var topic = msg.topicId ? options.topics[msg.topicId] : null;
        log.appendChild(
          h('div', { className: 'llh-turn', 'data-message-id': msg.id }, [
            AssistantMessage({
              label: M.replyLabel,
              text: msg.content,
              kind: msg.kind,
              tag: msg.kind && M.replyTags ? M.replyTags[msg.kind] : null
            }),
            topic ? TopicResources(topic, M, msg.id) : null,
            msg.lawyers ? LawyerSuggestions(msg.lawyers, M, options.links) : null
          ])
        );
      } else if (msg.role === 'error') {
        log.appendChild(
          ErrorMessage({
            title: msg.code === 'auth-required' ? M.loginTitle : M.errorTitle,
            text: msg.code === 'auth-required' ? msg.content : msg.content + ' ' + (M.errorNoAnswer || ''),
            retryLabel: M.retry,
            disabled: options.loading,
            onRetry: msg.retryable ? function () { options.onRetry(msg.id); } : null,
            actionLabel: M.login,
            onAction: msg.code === 'auth-required' && options.onLogin ? options.onLogin : null
          })
        );
      }
    });

    if (options.loading) log.appendChild(LoadingMessage(M.thinking));

    // Quick follow-ups after the latest real answer.
    var lastMsg = options.messages[options.messages.length - 1];
    if (!options.loading && options.quickActions && options.onQuickAction && lastMsg &&
        lastMsg.role === 'assistant' && lastMsg.kind !== 'out_of_scope') {
      log.appendChild(QuickActions(options.quickActions, options.loading, options.onQuickAction));
    }

    return h('div', { className: 'llh-result' }, [
      h('div', { className: 'llh-result__bar' }, [
        h(
          'button',
          { type: 'button', className: 'llh-back', onClick: options.onBack },
          [Icon('arrowLeft', 16), ' ' + (M.newConversation || 'New conversation')]
        ),
        options.onHistory
          ? h('button', {
              type: 'button',
              className: 'llh-back llh-history-toggle',
              'aria-expanded': options.historyOpen ? 'true' : 'false',
              onClick: options.onHistory
            }, [M.savedConversations || 'Saved conversations'])
          : null
      ]),
      options.historyPanel || null,
      options.notice ? h('p', { className: 'llh-conv-notice', role: 'status', text: options.notice }) : null,
      log,
      h('p', { className: 'llh-disclaimer', text: M.pageDisclaimer })
    ]);
  }

  global.LegalHelpComponents = {
    h: h,
    Icon: Icon,
    QueryCard: QueryCard,
    SearchBar: SearchBar,
    ComingSoonMessage: ComingSoonMessage,
    GovernmentResource: GovernmentResource,
    VoicePanel: VoicePanel,
    DocumentTray: DocumentTray,
    DocumentTextViewer: DocumentTextViewer,
    ReplyLanguagePicker: ReplyLanguagePicker,
    LawyerSuggestions: LawyerSuggestions,
    QuickActions: QuickActions,
    ConversationList: ConversationList,
    FormattedReply: FormattedReply,
    DraftBlock: DraftBlock,
    cleanReplyText: cleanReplyText,
    UserMessage: UserMessage,
    AssistantMessage: AssistantMessage,
    LoadingMessage: LoadingMessage,
    ErrorMessage: ErrorMessage,
    TopicResources: TopicResources,
    ConversationView: ConversationView
  };
})(window);
