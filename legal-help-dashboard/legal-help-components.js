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
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5h.01"/>'
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
   * Returns { element, setPlaceholder(text), clear(), focus() }.
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
            className: 'llh-search__icon-btn',
            'aria-label': 'Attach a document (PDF, JPG, JPEG or PNG)',
            title: 'Attach a document',
            onClick: function () { fileInput.click(); }
          },
          [Icon('paperclip', 20)]
        ),
        fileInput,
        input,
        h(
          'button',
          {
            type: 'button',
            className: 'llh-search__icon-btn',
            'aria-label': 'Voice input',
            title: 'Voice input',
            onClick: function () { options.onVoice(); }
          },
          [Icon('mic', 20)]
        ),
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
      focus: function () { input.focus(); }
    };
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

  // ---------- LawyerCard ----------
  /** A FICTIONAL demo profile. "View Profile" never opens a page. */
  function LawyerCard(lawyer, messageText) {
    var status = h('p', { className: 'llh-lawyer__status', role: 'status' });
    var meta = [lawyer.practice, lawyer.experience, lawyer.city].filter(Boolean).join(' · ');
    return h('div', { className: 'llh-lawyer' }, [
      h('div', { className: 'llh-lawyer__head' }, [
        h('p', { className: 'llh-lawyer__name', text: lawyer.name }),
        lawyer.isDemo ? h('span', { className: 'llh-badge', text: 'Demo profile' }) : null
      ]),
      h('p', { className: 'llh-lawyer__meta', text: meta }),
      h(
        'button',
        {
          type: 'button',
          className: 'llh-button llh-button--ghost',
          'aria-label': 'View profile of ' + lawyer.name + ' (demo)',
          onClick: function () { status.textContent = messageText; }
        },
        ['View Profile ', Icon('arrowRight', 15)]
      ),
      status
    ]);
  }

  // ---------- FormattedReply ----------
  /**
   * Renders the AI's plain-text/markdown-ish reply as paragraphs, headings and
   * lists. Everything is created with textContent — the reply can never inject
   * HTML or scripts. URLs are left as plain text on purpose: only the official
   * links curated in legal-help-data.js are ever rendered as clickable.
   */
  function inlineNodes(text) {
    var nodes = [];
    var re = /\*\*([^*]+)\*\*|__([^_]+)__/g;
    var last = 0;
    var match;
    while ((match = re.exec(text))) {
      if (match.index > last) nodes.push(document.createTextNode(text.slice(last, match.index)));
      nodes.push(h('strong', { text: match[1] || match[2] }));
      last = re.lastIndex;
    }
    if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
    return nodes;
  }

  function FormattedReply(text) {
    var root = h('div', { className: 'llh-reply' });
    var paragraph = null;
    var list = null;

    function closeBlocks() {
      paragraph = null;
      list = null;
    }

    String(text || '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .forEach(function (raw) {
        var line = raw.trim();
        if (!line) return closeBlocks();

        var heading = /^#{1,6}\s+(.*)$/.exec(line);
        var bullet = /^[-*•]\s+(.*)$/.exec(line);
        var numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);

        if (heading) {
          closeBlocks();
          root.appendChild(h('h3', { className: 'llh-reply__heading' }, inlineNodes(heading[1].replace(/\*\*/g, ''))));
          return;
        }
        if (bullet || numbered) {
          var tag = bullet ? 'ul' : 'ol';
          if (!list || list.tagName.toLowerCase() !== tag) {
            paragraph = null;
            list = h(tag, { className: 'llh-reply__list' });
            if (numbered && numbered[1] !== '1') list.setAttribute('start', numbered[1]);
            root.appendChild(list);
          }
          list.appendChild(h('li', null, inlineNodes(bullet ? bullet[1] : numbered[2])));
          return;
        }
        if (list && /^\s{2,}/.test(raw) && list.lastChild) {
          // indented continuation of a list item
          list.lastChild.appendChild(document.createTextNode(' '));
          inlineNodes(line).forEach(function (n) { list.lastChild.appendChild(n); });
          return;
        }
        list = null;
        if (!paragraph) {
          paragraph = h('p', { className: 'llh-reply__p' });
          root.appendChild(paragraph);
        } else {
          paragraph.appendChild(h('br'));
        }
        inlineNodes(line).forEach(function (n) { paragraph.appendChild(n); });
      });

    return root;
  }

  // ---------- chat messages ----------
  function UserMessage(text) {
    return h('div', { className: 'llh-bubble-row' }, [h('p', { className: 'llh-bubble', text: text })]);
  }

  function AssistantMessage(options) {
    return h('article', { className: 'llh-answer', 'aria-label': options.label }, [
      h('p', { className: 'llh-answer__from', text: options.label }),
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
        : null
    ]);
  }

  /** Official links + demo lawyers for one of the four card topics. */
  function TopicResources(topic, messages, uid) {
    var resId = 'llh-res-' + uid;
    var lawId = 'llh-law-' + uid;
    return h('div', { className: 'llh-side' }, [
      h('section', { className: 'llh-panel', 'aria-labelledby': resId }, [
        h('h2', { className: 'llh-panel__title', id: resId, text: messages.resourcesTitle }),
        h('div', { className: 'llh-panel__list' }, topic.governmentResources.map(GovernmentResource))
      ]),
      h('section', { className: 'llh-panel', 'aria-labelledby': lawId }, [
        h('h2', { className: 'llh-panel__title', id: lawId, text: messages.lawyersTitle }),
        h('p', { className: 'llh-panel__disclaimer', text: messages.lawyerDisclaimer }),
        h(
          'div',
          { className: 'llh-panel__list' },
          topic.lawyers.map(function (lawyer) { return LawyerCard(lawyer, messages.lawyerProfiles); })
        )
      ])
    ]);
  }

  // ---------- ConversationView ----------
  /**
   * The chat screen: every turn of the conversation, a loading indicator while
   * waiting, errors with retry, and the disclaimer.
   * options: { messages[], loading, topics, text (MESSAGES), onBack, onRetry }
   */
  function ConversationView(options) {
    var M = options.text;
    var log = h('div', { className: 'llh-log' });

    options.messages.forEach(function (msg) {
      if (msg.role === 'user') {
        log.appendChild(UserMessage(msg.content));
      } else if (msg.role === 'assistant') {
        var topic = msg.topicId ? options.topics[msg.topicId] : null;
        log.appendChild(
          h('div', { className: 'llh-turn', 'data-message-id': msg.id }, [
            msg.demo
              ? h('div', { className: 'llh-demo-note', role: 'note' }, [
                  h('strong', { text: 'Demo Mode' }),
                  h('span', { text: ' ' + M.demoNotice })
                ])
              : null,
            AssistantMessage({ label: msg.demo ? M.demoLabel : M.replyLabel, text: msg.content }),
            topic ? TopicResources(topic, M, msg.id) : null,
            msg.demo && options.onRetryLive
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'llh-demo-retry',
                    disabled: options.loading,
                    onClick: function () { options.onRetryLive(msg.id); }
                  },
                  [M.demoRetry]
                )
              : null
          ])
        );
      } else if (msg.role === 'error') {
        log.appendChild(
          ErrorMessage({
            title: M.errorTitle,
            text: msg.content,
            retryLabel: M.retry,
            disabled: options.loading,
            onRetry: msg.retryable ? function () { options.onRetry(msg.id); } : null
          })
        );
      }
    });

    if (options.loading) log.appendChild(LoadingMessage(M.thinking));

    return h('div', { className: 'llh-result' }, [
      h(
        'button',
        { type: 'button', className: 'llh-back', onClick: options.onBack },
        [Icon('arrowLeft', 16), ' All suggested queries']
      ),
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
    LawyerCard: LawyerCard,
    FormattedReply: FormattedReply,
    UserMessage: UserMessage,
    AssistantMessage: AssistantMessage,
    LoadingMessage: LoadingMessage,
    ErrorMessage: ErrorMessage,
    TopicResources: TopicResources,
    ConversationView: ConversationView
  };
})(window);
