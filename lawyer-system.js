/**
 * lawyer-system.js — small shared helpers for the Lawyer Connect / Lawyer
 * Portal pages (free-legal-assistance.html, my-requests.html,
 * lawyer-portal.html, lawyer-dashboard.html). No data is stored here.
 */
(function (global) {
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(value, withTime) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return String(value);
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (withTime) { opts.hour = 'numeric'; opts.minute = '2-digit'; }
    return d.toLocaleString('en-IN', opts);
  }

  function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  function inr(n) {
    return '₹' + (Number(n) || 0).toLocaleString('en-IN');
  }

  let toastTimer = null;
  function toast(message) {
    let el = document.getElementById('lsToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lsToast';
      el.className = 'ls-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
  }

  /** Consultation status → plain-language label + badge style. */
  const REQUEST_STATUS = {
    pending: { label: 'Pending — waiting for the lawyer', cls: 'ls-badge ls-badge-dashed' },
    accepted: { label: 'Accepted', cls: 'ls-badge ls-badge-solid' },
    rejected: { label: 'Declined by the lawyer', cls: 'ls-badge ls-badge-muted' },
    completed: { label: 'Completed', cls: 'ls-badge' },
    cancelled: { label: 'Cancelled', cls: 'ls-badge ls-badge-muted' }
  };
  function requestBadge(status) {
    const s = REQUEST_STATUS[status] || { label: status, cls: 'ls-badge' };
    return `<span class="${s.cls}">${esc(s.label)}</span>`;
  }

  const DOC_LABELS = {
    law_degree: 'LL.B. / law degree certificate',
    enrollment_certificate: 'Bar Council enrollment certificate / Sanad',
    aadhaar_card: 'Aadhaar card (masked)',
    pan_card: 'PAN card',
    identity_proof: 'Identity proof',
    income_certificate: 'Income certificate',
    ration_card: 'Ration card',
    category_proof: 'Proof of category (e.g. certificate)',
    other: 'Other supporting document'
  };
  const ID_LABELS = {
    aadhaar_masked: 'Masked Aadhaar (first 8 digits hidden)',
    pan: 'PAN card',
    passport: 'Passport',
    voter_id: 'Voter ID',
    driving_licence: 'Driving licence',
    bar_council_id: 'Bar Council ID card',
    other: 'Other government ID'
  };

  /** Mobile menu for the .ls-header pattern. */
  function wireHeader() {
    const header = document.querySelector('.ls-header');
    const btn = header && header.querySelector('.ls-menu-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = header.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  /** Simple accessible modal: open(id), close(id); Escape and backdrop close it. */
  let lastFocus = null;
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    const first = m.querySelector('input, select, textarea, button:not(.ls-modal-close)');
    (first || m.querySelector('.ls-modal-close')).focus();
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.ls-modal.open').forEach((m) => closeModal(m.id));
  });
  document.addEventListener('click', (e) => {
    const m = e.target.classList && e.target.classList.contains('ls-modal') ? e.target : null;
    if (m) closeModal(m.id);
    const c = e.target.closest && e.target.closest('[data-close-modal]');
    if (c) closeModal(c.getAttribute('data-close-modal'));
  });

  /** Sends a visitor to login and brings them back here afterwards. */
  function goToLogin(returnTo, role) {
    try { sessionStorage.setItem('postLoginRedirect', returnTo); } catch (e) { /* storage blocked */ }
    global.location.href = role === 'lawyer' ? 'lawyer-login.html' : 'login.html';
  }

  // ---------------- automated verification (plain language) ----------------
  const AUTO_STATUS = {
    not_started: { label: 'Not started', cls: 'ls-badge ls-badge-muted', text: 'Automatic checks start when you upload documents.' },
    pending_verification: { label: 'Pending verification', cls: 'ls-badge ls-badge-dashed', text: 'Your documents passed the automatic checks we can run. Official online verification is not available for every document yet, so a CASEONE reviewer will confirm them.' },
    needs_review: { label: 'Needs review', cls: 'ls-badge', text: 'Something needs a person to look at it. See the items marked below — you may be able to fix them yourself.' },
    verified: { label: 'Verified', cls: 'ls-badge ls-badge-solid', text: 'Confirmed by authorised official sources.' }
  };
  const OUTCOME_ICON = { pass: '✓', fail: '!', warning: '!', pending: '…', info: 'i' };
  const OUTCOME_LABEL = { pass: 'Passed', fail: 'Needs attention', warning: 'Needs attention', pending: 'Waiting', info: 'Note' };

  function automationBadge(status) {
    const s = AUTO_STATUS[status] || AUTO_STATUS.not_started;
    return `<span class="${s.cls}">${esc(s.label)}</span>`;
  }
  function automationText(status) {
    return (AUTO_STATUS[status] || AUTO_STATUS.not_started).text;
  }
  function renderChecks(checks) {
    if (!checks || !checks.length) return '<li class="auto-check"><span class="auto-ico">…</span><span>No checks yet.</span></li>';
    const order = { fail: 0, warning: 1, pending: 2, info: 3, pass: 4 };
    return checks.slice().sort((a, b) => order[a.outcome] - order[b.outcome]).map((c) =>
      `<li class="auto-check is-${esc(c.outcome)}"><span class="auto-ico" aria-hidden="true">${OUTCOME_ICON[c.outcome] || '•'}</span><span><strong>${esc(c.label)}</strong> <span class="ls-sr">${esc(OUTCOME_LABEL[c.outcome] || '')}:</span> — ${esc(c.message)}</span></li>`).join('');
  }
  /** One line under a document: what was read automatically and any flags. */
  function docAutomationLine(d) {
    const a = d.automation || {};
    const parts = [];
    const f = a.fields || {};
    if (a.extractionStatus === 'extracted') {
      const bits = [];
      if (f.enrollmentNumber) bits.push('enrollment no. ' + f.enrollmentNumber);
      if (f.annualIncome != null) bits.push('income ' + inr(f.annualIncome));
      if (f.category) bits.push('category ' + f.category);
      if (f.certificateNumberMasked) bits.push('certificate ' + f.certificateNumberMasked);
      if (f.cardNumberMasked) bits.push('card ' + f.cardNumberMasked);
      if (f.panMasked) bits.push('PAN ' + f.panMasked);
      if (f.aadhaarLast4) bits.push('masked Aadhaar ending ' + f.aadhaarLast4);
      if (f.enrolledOn) bits.push('enrolled on ' + fmtDate(f.enrolledOn));
      if (f.mentionsLaw) bits.push('LL.B. found');
      parts.push('Read automatically' + (bits.length ? ': ' + bits.join(', ') : ''));
    } else if (a.extractionStatus === 'no_text') {
      parts.push('Could not be read automatically (photo or scan) — a reviewer will read it');
    }
    if (a.signedPdf) parts.push('digitally signed PDF (not yet verified)');
    if (a.verification === 'verified' && a.verifiedBy) parts.push('confirmed by ' + a.verifiedBy);
    const flags = (a.flags || []).map((m) => `<div class="doc-flag" role="note">${esc(m)}</div>`).join('');
    return (parts.length ? `<div class="doc-auto">${esc(parts.join(' · '))}</div>` : '') + flags;
  }

  /** Official helplines for emergencies (shown without login). */
  const HELPLINES = [
    ['15100', 'National Legal Services Authority (NALSA) — free government legal aid'],
    ['112', 'Police / emergency'],
    ['181', 'Women helpline'],
    ['1098', 'Childline'],
    ['1930', 'Cyber crime helpline']
  ];

  document.addEventListener('DOMContentLoaded', wireHeader);

  global.LS = { esc, fmtDate, fmtSize, inr, toast, requestBadge, REQUEST_STATUS, DOC_LABELS, ID_LABELS, openModal, closeModal, goToLogin, automationBadge, automationText, renderChecks, docAutomationLine, AUTO_STATUS, HELPLINES };
})(window);
