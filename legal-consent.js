/* =====================================================================
   Legal Lens — first-visit Terms & Privacy acceptance (homepage)
   ---------------------------------------------------------------------
   - Loaded in <head> of index.html. If no valid acceptance is stored it
     immediately marks <html> so the page is dimmed/blurred, then builds
     the modal once the DOM is ready.
   - Acceptance is stored ONLY in this browser under a versioned key:
       legalLens.legalConsent.v1 = { accepted, version, acceptedAt }
     Bump POLICY_VERSION (e.g. to "v2") to ask everyone again after the
     policies change.
   - No backend call, no personal data stored.
   - NOTE FOR THE TEAM: the policy text below is an MVP draft and should
     be reviewed by a qualified legal / privacy professional.
   ===================================================================== */
(function () {
  'use strict';

  var POLICY_VERSION = 'v1';
  var STORAGE_KEY = 'legalLens.legalConsent.' + POLICY_VERSION;
  var LAST_UPDATED = '2 October 2026';
  var SUPPORT_EMAIL = 'support.legallens@gmail.com';

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      return !!(data && data.accepted === true && data.version === POLICY_VERSION);
    } catch (e) {
      return false;
    }
  }

  function saveConsent() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        accepted: true,
        version: POLICY_VERSION,
        acceptedAt: new Date().toISOString()
      }));
    } catch (e) {
      /* Storage blocked (e.g. private mode): acceptance lasts for this page view only. */
    }
  }

  if (readConsent()) return;

  var root = document.documentElement;
  root.classList.add('llc-active'); // dims + blurs the page and locks scrolling (see legal-consent.css)

  /* ---------------- policy content (static, trusted markup) ---------------- */
  var mail = '<a href="mailto:' + SUPPORT_EMAIL + '">' + SUPPORT_EMAIL + '</a>';

  var CONTENT =
    '<section class="llc-doc" id="llcTerms" aria-labelledby="llcTermsTitle">' +
      '<h3 class="llc-doc-title" id="llcTermsTitle">Terms &amp; Conditions</h3>' +
      '<p class="llc-meta">Last updated: ' + LAST_UPDATED + '</p>' +

      '<h4>1. Acceptance of Terms</h4>' +
      '<p>By accessing or using Legal Lens (the “Service”), you agree to these Terms &amp; Conditions. If you do not agree, please do not use the Service.</p>' +

      '<h4>2. Description of Legal Lens services</h4>' +
      '<p>Legal Lens is a legal-technology platform that helps people understand legal situations and prepare for next steps. Depending on availability, the Service may include:</p>' +
      '<ul>' +
        '<li>AI Legal Guidance &amp; Navigation</li>' +
        '<li>Legal Drafting Assistant</li>' +
        '<li>Legal Notice Assistant</li>' +
        '<li>Smart Case Builder &amp; Evidence Vault</li>' +
        '<li>Legal Deadline &amp; Case Tracker</li>' +
        '<li>Lawyer Connect</li>' +
        '<li>Legal information articles (Blog) and a Contact form</li>' +
      '</ul>' +
      '<p>Features may be added, changed or removed over time, and some features may be offered as early or limited versions.</p>' +

      '<h4>3. AI-assisted legal information and tools</h4>' +
      '<p>Some features use artificial intelligence or automated templates to generate explanations, drafts, checklists or suggestions. This output is general legal information and drafting assistance. It is not legal advice and does not replace advice from a qualified legal professional who knows the facts of your situation.</p>' +

      '<h4>4. User responsibilities</h4>' +
      '<p>You are responsible for:</p>' +
      '<ul>' +
        '<li>the accuracy and completeness of the information you provide;</li>' +
        '<li>reviewing any output carefully before relying on it, sending it or filing it;</li>' +
        '<li>checking important information, deadlines and procedures with official sources or a qualified legal professional;</li>' +
        '<li>keeping your own copies of important documents.</li>' +
      '</ul>' +

      '<h4>5. Accuracy and limitations of AI-generated information</h4>' +
      '<p>AI-generated and automatically prepared content can be incomplete, outdated or incorrect, and may not reflect the law that applies to your situation. Laws and procedures differ and change over time. Legal Lens does not guarantee that any content is accurate, complete, current or suitable for your purpose.</p>' +

      '<h4>6. No guarantee of legal outcomes</h4>' +
      '<p>Using Legal Lens does not guarantee any particular result in a dispute, negotiation, complaint, application or case.</p>' +

      '<h4>7. Lawyer Connect limitations</h4>' +
      '<p>Lawyer Connect is intended to help you find and contact lawyers. Legal Lens is not a party to any arrangement between you and a lawyer. Any legal services, fees and professional responsibilities are a matter between you and that lawyer. Please make your own assessment before engaging any lawyer. Using Lawyer Connect, or any other part of Legal Lens, does not by itself create an advocate–client relationship with Legal Lens or with any lawyer.</p>' +

      '<h4>8. User-provided information and documents</h4>' +
      '<p>You keep any rights you have in the information and documents you provide. You confirm that you are entitled to share them and that doing so does not violate any law or the rights of others. Avoid sharing sensitive information about yourself or other people unless it is necessary for your purpose.</p>' +

      '<h4>9. Prohibited activities and misuse</h4>' +
      '<p>You must not use the Service to:</p>' +
      '<ul>' +
        '<li>break any law, or help anyone else to do so;</li>' +
        '<li>create false, misleading, fraudulent, threatening or harassing documents or messages;</li>' +
        '<li>impersonate any person, lawyer, court or authority;</li>' +
        '<li>upload malicious code, or attempt to disrupt, overload or gain unauthorised access to the Service;</li>' +
        '<li>copy, scrape or resell the Service or its content without permission.</li>' +
      '</ul>' +

      '<h4>10. Intellectual property</h4>' +
      '<p>The Legal Lens name, logo, design, software and original content are owned by or licensed to Legal Lens. You may use the Service and its output for your own lawful purposes, but you may not copy or reuse the Service itself without permission.</p>' +

      '<h4>11. Third-party services</h4>' +
      '<p>Legal Lens may rely on third-party services (for example, hosting, email delivery or AI service providers) and may link to external websites such as official government or court portals. Legal Lens is not responsible for the content, availability or practices of third-party websites and services.</p>' +

      '<h4>12. Availability and changes to the Service</h4>' +
      '<p>The Service is provided on an “as available” basis. It may be interrupted, changed, limited or discontinued at any time, with or without notice.</p>' +

      '<h4>13. Disclaimer and limitation of liability</h4>' +
      '<p>To the extent permitted by applicable law, the Service and its content are provided “as is”, without warranties of any kind, and Legal Lens is not liable for any loss or damage arising from your use of, or reliance on, the Service or its content. Nothing in these Terms excludes any liability that cannot be excluded under applicable law.</p>' +

      '<h4>14. Changes to these Terms</h4>' +
      '<p>We may update these Terms from time to time. When we make significant changes, we may ask you to review and accept the updated Terms before continuing to use the Service.</p>' +

      '<h4>15. Contact</h4>' +
      '<p>Questions about these Terms can be sent to ' + mail + '.</p>' +
    '</section>' +

    '<section class="llc-doc" id="llcPrivacy" aria-labelledby="llcPrivacyTitle">' +
      '<h3 class="llc-doc-title" id="llcPrivacyTitle">Privacy Policy</h3>' +
      '<p class="llc-meta">Last updated: ' + LAST_UPDATED + '</p>' +

      '<h4>1. Information you provide</h4>' +
      '<p>We receive the information you choose to enter or submit while using Legal Lens. This depends on the features you use and may include:</p>' +
      '<ul>' +
        '<li><strong>Contact form:</strong> your name, email address, subject and message, which are sent to the Legal Lens support inbox so we can reply.</li>' +
        '<li><strong>Accounts:</strong> if you create an account or sign in where this is available, the details needed for that account, such as your name, email address and login credentials.</li>' +
        '<li><strong>Legal questions, case information and documents:</strong> when you use features that send information to Legal Lens servers (for example AI Legal Guidance or Lawyer Connect), the questions, case details, documents or requests you submit.</li>' +
      '</ul>' +

      '<h4>2. Information stored in your browser</h4>' +
      '<p>Some features save information only in your own browser (local storage) so your work is still there when you return. This currently includes, for example, your language preference, Smart Case Builder cases and evidence notes, Legal Deadline &amp; Case Tracker events, Legal Notice Assistant drafts, and your acceptance of these policies. This information stays on your device unless a feature clearly sends it to our servers. You can remove it by clearing your browser’s site data.</p>' +

      '<h4>3. How we use information</h4>' +
      '<ul>' +
        '<li>to provide and operate the features you use;</li>' +
        '<li>to respond to your messages and support requests;</li>' +
        '<li>to maintain, secure and improve the Service and prevent misuse;</li>' +
        '<li>to comply with legal obligations where applicable.</li>' +
      '</ul>' +
      '<p>We do not sell your personal information.</p>' +

      '<h4>4. Service providers and infrastructure</h4>' +
      '<p>To run Legal Lens we use third-party providers for website hosting, backend infrastructure, databases, email delivery and, for some features, AI processing. Information needed for a feature may be processed by these providers on our behalf.</p>' +

      '<h4>5. Data security</h4>' +
      '<p>We take reasonable steps to protect information. However, no website, network or storage method is completely secure, and we cannot guarantee absolute security. Please avoid sharing information that is not needed for your purpose.</p>' +

      '<h4>6. Data retention</h4>' +
      '<p>We keep information for as long as it is reasonably needed for the purposes described in this policy or as required by law. Information stored only in your browser stays there until you delete it or clear your browser data.</p>' +

      '<h4>7. Your choices and rights</h4>' +
      '<ul>' +
        '<li>You can choose not to provide information, although some features may then not work.</li>' +
        '<li>You can clear information stored in your browser at any time.</li>' +
        '<li>You can contact us to ask about, correct or delete information you have submitted to us, subject to applicable law.</li>' +
      '</ul>' +

      '<h4>8. Changes to this Policy</h4>' +
      '<p>We may update this Privacy Policy from time to time. When we make significant changes, we may ask you to review the updated policy before continuing.</p>' +

      '<h4>9. Contact</h4>' +
      '<p>Privacy questions or requests can be sent to ' + mail + '.</p>' +
    '</section>' +

    '<section class="llc-doc llc-doc-disclaimer" id="llcDisclaimer" aria-labelledby="llcDisclaimerTitle">' +
      '<h3 class="llc-doc-title" id="llcDisclaimerTitle">Important Legal Disclaimer</h3>' +
      '<p>Legal Lens provides AI-assisted legal information and tools. <strong>Legal Lens is not a law firm</strong> and does not provide legal advice or legal representation.</p>' +
      '<ul>' +
        '<li>AI-generated or automatically prepared content is <strong>not</strong> reviewed by a lawyer unless this is clearly stated for a specific service.</li>' +
        '<li>Content on Legal Lens is not approved by any court or government authority, and is not guaranteed to be accurate, complete or legally valid.</li>' +
        '<li>Using Legal Lens does not create an advocate–client relationship.</li>' +
        '<li>For decisions with significant legal, financial or personal consequences, please consult a qualified legal professional.</li>' +
      '</ul>' +
    '</section>';

  /* ---------------- build + behaviour ---------------- */
  var overlay, dialog, scrollArea, checkbox, acceptBtn, lastFocus = null;
  var hiddenSiblings = [];

  function build() {
    overlay = document.createElement('div');
    overlay.className = 'llc-overlay';
    overlay.id = 'llcRoot';
    overlay.innerHTML =
      '<div class="llc-dialog" role="dialog" aria-modal="true" aria-labelledby="llcTitle" aria-describedby="llcSubtitle">' +
        '<div class="llc-head">' +
          '<div class="llc-brand"><span class="llc-logo"><img src="LegalLens-logo.jpeg" alt="" width="736" height="816"></span><span class="llc-brand-name">Legal Lens</span></div>' +
          '<h2 class="llc-title" id="llcTitle" tabindex="-1">Before you continue</h2>' +
          '<p class="llc-subtitle" id="llcSubtitle">Please review the Legal Lens Terms &amp; Conditions and Privacy Policy</p>' +
          '<nav class="llc-tabs" aria-label="Jump to section">' +
            '<button type="button" class="llc-tab" data-llc-jump="llcTerms">Terms &amp; Conditions</button>' +
            '<button type="button" class="llc-tab" data-llc-jump="llcPrivacy">Privacy Policy</button>' +
            '<button type="button" class="llc-tab" data-llc-jump="llcDisclaimer">Legal Disclaimer</button>' +
          '</nav>' +
        '</div>' +
        '<div class="llc-scroll" id="llcScroll" tabindex="0" role="region" aria-label="Terms, Privacy Policy and Legal Disclaimer">' +
          CONTENT +
        '</div>' +
        '<div class="llc-foot">' +
          '<label class="llc-check" for="llcAgree">' +
            '<input type="checkbox" id="llcAgree">' +
            '<span class="llc-box" aria-hidden="true"></span>' +
            '<span class="llc-check-text">I have read and agree to the Terms &amp; Conditions and acknowledge the Privacy Policy.</span>' +
          '</label>' +
          '<button type="button" class="llc-accept" id="llcAccept" disabled aria-disabled="true">Accept &amp; Continue</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    dialog = overlay.querySelector('.llc-dialog');
    scrollArea = overlay.querySelector('#llcScroll');
    checkbox = overlay.querySelector('#llcAgree');
    acceptBtn = overlay.querySelector('#llcAccept');

    // Make everything else on the page non-interactive and hidden from assistive tech.
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === overlay || el.tagName === 'SCRIPT') return;
      if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); hiddenSiblings.push(el); }
      if (el.getAttribute('aria-hidden') !== 'true') { el.setAttribute('aria-hidden', 'true'); el.setAttribute('data-llc-aria', ''); }
    });

    checkbox.addEventListener('change', function () {
      acceptBtn.disabled = !checkbox.checked;
      acceptBtn.setAttribute('aria-disabled', checkbox.checked ? 'false' : 'true');
    });

    acceptBtn.addEventListener('click', function () {
      if (!checkbox.checked) return;
      saveConsent();
      close();
    });

    overlay.addEventListener('click', function (e) {
      var jump = e.target.closest('[data-llc-jump]');
      if (jump) {
        var target = overlay.querySelector('#' + jump.getAttribute('data-llc-jump'));
        if (target) scrollArea.scrollTo({ top: target.offsetTop - scrollArea.offsetTop - 4, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
      // Clicks outside the dialog do nothing (mandatory step).
    });

    // Keep keyboard focus inside the dialog; Escape does not dismiss it.
    // Keys are stopped here so homepage keyboard handlers never see them.
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      e.stopPropagation();
    });

    // If focus somehow lands outside (e.g. browser UI), pull it back.
    document.addEventListener('focusin', keepFocus, true);

    lastFocus = document.activeElement;
    requestAnimationFrame(function () {
      overlay.classList.add('is-visible');
      overlay.querySelector('#llcTitle').focus({ preventScroll: true });
    });
  }

  function focusables() {
    return Array.prototype.filter.call(
      dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null || el === document.activeElement; }
    );
  }

  function keepFocus(e) {
    if (overlay && !overlay.contains(e.target)) {
      e.stopPropagation();
      overlay.querySelector('#llcTitle').focus({ preventScroll: true });
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function close() {
    document.removeEventListener('focusin', keepFocus, true);
    hiddenSiblings.forEach(function (el) { el.removeAttribute('inert'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-llc-aria]'), function (el) {
      el.removeAttribute('aria-hidden'); el.removeAttribute('data-llc-aria');
    });
    root.classList.remove('llc-active'); // un-blur + restore scrolling
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-closing');
    var done = function () { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; };
    if (prefersReducedMotion()) done(); else setTimeout(done, 280);
    if (lastFocus && lastFocus !== document.body && document.contains(lastFocus) && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();