/**
 * LegalLens — Legal Help: voice input (speech → text) with the browser's
 * built-in Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 *
 * - Nothing is sent to Legal Lens while you speak: the browser turns speech
 *   into text, the text appears in the question box, and the user reviews or
 *   edits it and presses Send themselves.
 * - In Chrome and Edge the browser's speech service is online (audio is
 *   processed by the browser vendor's service). Firefox has no support;
 *   Safari support varies. When unsupported, the UI says so and typing works.
 * - Languages: English (India) en-IN, Hindi hi-IN, Marathi mr-IN — whether a
 *   language works depends on the browser.
 *
 *   var voice = LegalHelpVoice.create({ onText, onState, onError });
 *   voice.supported   // false → show the fallback message
 *   voice.start('hi-IN', existingText); voice.stop();
 */
(function (global) {
  'use strict';

  var LANGUAGES = [
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'हिंदी (Hindi)' },
    { code: 'mr-IN', label: 'मराठी (Marathi)' }
  ];
  var STORAGE_KEY = 'legalLens.voiceLanguage';
  var MAX_CHARS = 2000;

  function getRecognitionClass() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }

  function savedLanguage() {
    try {
      var v = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (LANGUAGES.some(function (l) { return l.code === v; })) return v;
    } catch (e) { /* storage blocked: use the default */ }
    return 'en-IN';
  }

  function saveLanguage(code) {
    try { if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
  }

  /**
   * @param {{ onText(text), onState(state: 'listening'|'idle'), onError(code) }} handlers
   *   error codes: unsupported | insecure | not-allowed | no-speech | audio-capture |
   *                network | language-not-supported | start-failed | unknown
   */
  function create(handlers) {
    handlers = handlers || {};
    var Recognition = getRecognitionClass();
    var rec = null;
    var listening = false;
    var base = '';
    var finalText = '';

    function emitText(interim) {
      var spoken = (finalText + ' ' + (interim || '')).replace(/\s+/g, ' ').trim();
      var text = (base ? base.replace(/\s+$/, '') + ' ' : '') + spoken;
      if (handlers.onText) handlers.onText(text.slice(0, MAX_CHARS));
    }

    function setListening(value) {
      listening = value;
      if (handlers.onState) handlers.onState(value ? 'listening' : 'idle');
    }

    function start(language, existingText) {
      if (!Recognition) {
        if (handlers.onError) handlers.onError('unsupported');
        return false;
      }
      if (global.isSecureContext === false) {
        if (handlers.onError) handlers.onError('insecure');
        return false;
      }
      stop(true);
      base = String(existingText || '');
      finalText = '';
      var code = language || savedLanguage();
      saveLanguage(code);

      rec = new Recognition();
      rec.lang = code;
      rec.interimResults = true;
      // Chrome on Android repeats earlier words in continuous mode, so there
      // one phrase is recognised per tap (press the microphone again to add more).
      rec.continuous = !/Android/i.test((global.navigator && global.navigator.userAgent) || '');
      rec.maxAlternatives = 1;

      var current = rec;
      rec.onresult = function (event) {
        if (rec !== current) return;
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var result = event.results[i];
          var t = result[0] && result[0].transcript ? result[0].transcript : '';
          if (result.isFinal) finalText += ' ' + t;
          else interim += ' ' + t;
        }
        emitText(interim);
      };
      rec.onerror = function (event) {
        if (rec !== current) return;
        var err = event && event.error;
        if (err === 'aborted') return;
        var code2 = err === 'not-allowed' || err === 'service-not-allowed' ? 'not-allowed'
          : err === 'no-speech' || err === 'audio-capture' || err === 'network' || err === 'language-not-supported'
            ? err : 'unknown';
        if (handlers.onError) handlers.onError(code2);
      };
      rec.onend = function () {
        if (rec !== current) return;
        rec = null;
        emitText('');
        setListening(false);
      };

      try {
        rec.start();
      } catch (e) {
        rec = null;
        if (handlers.onError) handlers.onError('start-failed');
        return false;
      }
      setListening(true);
      return true;
    }

    /** Stops listening; the text recognised so far stays in the box. */
    function stop(silent) {
      if (!rec) return;
      var r = rec;
      if (silent) {
        rec = null;
        try { r.abort(); } catch (e) { /* ignore */ }
        setListening(false);
        return;
      }
      try { r.stop(); } catch (e) { rec = null; setListening(false); }
    }

    return {
      supported: !!Recognition,
      languages: LANGUAGES,
      language: savedLanguage,
      start: start,
      stop: function () { stop(false); },
      cancel: function () { stop(true); },
      isListening: function () { return listening; }
    };
  }

  global.LegalHelpVoice = { create: create, LANGUAGES: LANGUAGES };
})(window);
