/**
 * lawyer-profile.js
 *
 * Loads a single lawyer by the `id` query parameter and renders
 * the full profile. Reuses:
 *   - window.LegalLensLawyerData (lawyer-data.js) for lawyer records
 *   - the same `legalLensSavedLawyers` localStorage key used on
 *     find-a-lawyer.html, so saved state stays in sync between pages
 *   - the real session (auth.js) and the real consultation API
 *     (POST /api/consultations) — requests are no longer browser-only
 */
(function () {

  // Real lawyer records from the CASEONE API (only verified, published
  // profiles are public). Lawyer-entered text is escaped before use in HTML.
  const { getLawyerById, getSimilarLawyers, escapeHtml, formatFee, photoSrc, requestConsultation } = window.LegalLensLawyerData;
  const esc = escapeHtml;

  /* =========================================================
     AUTH / NAV STATE
     ========================================================= */
  let sessionUser = null;
  function isLoggedIn() {
    return !!sessionUser;
  }

  function refreshNavAuthState() {
    const loggedOutEl = document.getElementById('navLoggedOut');
    const userEl = document.getElementById('navUser');
    if (isLoggedIn()) {
      loggedOutEl.style.display = 'none';
      userEl.style.display = 'flex';
      const name = sessionUser.name || 'Account';
      document.getElementById('navUserName').textContent = name;
      document.getElementById('navUserAvatar').textContent = name.charAt(0).toUpperCase();
    } else {
      loggedOutEl.style.display = 'flex';
      userEl.style.display = 'none';
    }
  }

  const sessionReady = (typeof restoreSession === 'function' ? restoreSession() : Promise.resolve(false))
    .then((ok) => { sessionUser = ok && typeof getCurrentUser === 'function' ? getCurrentUser() : null; refreshNavAuthState(); return sessionUser; })
    .catch(() => null);
  refreshNavAuthState();
  document.getElementById('navUser').addEventListener('click', () => {
    window.location.href = sessionUser && sessionUser.role === 'lawyer' ? 'lawyer-dashboard.html' : 'my-requests.html';
  });

  /* =========================================================
     SAVED LAWYERS (shared localStorage key with find-a-lawyer.html)
     ========================================================= */
  const SAVED_KEY = 'legalLensSavedLawyers';

  function getSavedIds() {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function toggleSaved(id) {
    let saved = getSavedIds();
    if (saved.includes(id)) {
      saved = saved.filter(x => x !== id);
    } else {
      saved.push(id);
    }
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    return saved;
  }

  function updateSaveButtons(id) {
    const isSaved = getSavedIds().includes(id);
    [
      { btn: document.getElementById('heroSaveBtn'), label: document.getElementById('heroSaveLabel') },
      { btn: document.getElementById('panelSaveBtn'), label: document.getElementById('panelSaveLabel') }
    ].forEach(({ btn, label }) => {
      btn.classList.toggle('saved', isSaved);
      btn.setAttribute('aria-pressed', String(isSaved));
      label.textContent = isSaved ? 'Saved' : 'Save Lawyer';
    });
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function initials(name) {
    return window.LegalLensLawyerData.initials(name);
  }

  function setAvatar(el, l) {
    const src = photoSrc(l);
    el.classList.remove('has-photo');
    el.textContent = initials(l.name);
    if (!src) return;
    const img = new Image();
    img.alt = 'Photo of ' + l.name;
    img.onload = () => { el.textContent = ''; el.classList.add('has-photo'); el.appendChild(img); };
    img.src = src;
  }

  function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  /* =========================================================
     RENDER PROFILE
     ========================================================= */
  function renderProfile(l) {
    document.title = `CASEONE — ${l.name}`;
    document.getElementById('breadcrumbName').textContent = l.name;

    setAvatar(document.getElementById('heroAvatar'), l);
    document.getElementById('heroName').textContent = l.name;

    // Review status (automatic listing): reviewed by CASEONE / official sources, or not yet reviewed.
    const D = window.LegalLensLawyerData;
    document.getElementById('heroVerifiedBadge').innerHTML = D.isReviewed(l)
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> ${escapeHtml(D.verificationLabel(l))}`
      : `<span class="pending-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> ${escapeHtml(D.verificationLabel(l))}</span>`;
    document.getElementById('heroReviewNote').hidden = !!l.requestsOpen;
    const rp = document.getElementById('panelReportBtn');
    rp.setAttribute('data-report-lawyer', l.id);
    rp.setAttribute('data-report-name', l.name);

    document.getElementById('heroPracticeAreas').textContent = l.practiceAreas.join(' • ');
    document.getElementById('heroLocation').textContent = l.location ? [l.location, l.state].filter(Boolean).join(', ') + ', India' : 'Location not listed';
    document.getElementById('heroLanguages').textContent = l.languages.join(' • ');

    document.getElementById('statExperience').textContent = l.experience;
    document.getElementById('statRating').textContent = l.offersPaid ? formatFee(l) : '—';
    document.getElementById('statConsultations').textContent = l.offersFree ? '₹0' : '—';

    const facts = [
      ['State Bar Council', l.stateBarCouncil],
      ['Enrollment number', l.barNumber],
      ['Qualifications', l.qualifications]
    ].filter(([, v]) => v);
    document.getElementById('barFacts').innerHTML = facts.length
      ? facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')
      : '<dt>Details</dt><dd>Not listed</dd>';

    const rows = [];
    if (l.offersPaid) rows.push(`<div class="service-row"><strong>Paid consultation — ${esc(formatFee(l))}</strong><span>Fee set by the advocate. No payment is taken on CASEONE.</span></div>`);
    if (l.offersFree) rows.push(`<div class="service-row"><strong>Free consultation — ₹0</strong><span>${esc(l.freeServiceNote || 'For applicants approved through CASEONE Free Legal Assistance.')}</span></div>`);
    document.getElementById('servicesText').innerHTML = rows.join('');

    const av = l.availability || {};
    if (av.days && av.days.length) {
      document.getElementById('availabilitySection').hidden = false;
      document.getElementById('availabilityText').textContent = av.days.join(', ') + (av.slots && av.slots.length ? ' · ' + av.slots.join(', ') : '');
    }

    document.getElementById('aboutText').textContent = l.description;

    document.getElementById('practiceAreasTags').innerHTML = l.practiceAreas.map(p => `<span>${esc(p)}</span>`).join('');
    document.getElementById('languagesTags').innerHTML = l.languages.map(lang => `<span>${esc(lang)}</span>`).join('');
    document.getElementById('locationText').textContent = l.location ? `${[l.location, l.state].filter(Boolean).join(', ')}, India` + (l.enrolledSince ? ` · enrolled since ${l.enrolledSince}` : '') : 'Location not listed';

    // Experience & Background — built from existing fields only; no invented credentials.
    document.getElementById('backgroundText').textContent =
      `${l.name} has ${l.experience} year${l.experience === 1 ? '' : 's'} of experience practicing ${l.practiceAreas.join(' and ')}. ${l.description}`;

    document.getElementById('panelFee').textContent = l.offersPaid ? formatFee(l) : '₹0';
    if (!l.offersPaid) {
      document.querySelector('.consult-panel h3').textContent = 'Free Consultation';
      document.getElementById('panelRequestBtn').hidden = true;
      document.getElementById('heroRequestBtn').textContent = 'Request free help (₹0)';
      document.getElementById('mobileRequestBtn').textContent = 'Request free help (₹0)';
    }
    if (l.offersFree) {
      const freeBtn = document.getElementById('panelFreeBtn');
      freeBtn.hidden = false;
      freeBtn.href = 'free-legal-assistance.html?lawyer=' + encodeURIComponent(l.id);
    }
    if (!l.requestsOpen) {
      // Listed automatically, not reviewed yet: requests stay closed until the CASEONE review.
      ['heroRequestBtn', 'panelRequestBtn', 'mobileRequestBtn'].forEach((id) => {
        const b = document.getElementById(id);
        b.disabled = true;
        b.textContent = 'Requests open after review';
        b.title = 'Requests open after a CASEONE review';
      });
      document.getElementById('panelFreeBtn').hidden = true;
      document.getElementById('panelNote').textContent = 'This advocate is not reviewed by CASEONE yet, so requests are not open. You can save the profile and check back later.';
    }
    document.getElementById('panelConsultTypes').innerHTML =
      ['Video Consultation', 'Phone Consultation', 'In-Person Consultation'].map(t => `<span>${t}</span>`).join('');

    updateSaveButtons(l.id);

    // Reveal-on-scroll setup (elements exist now that content is rendered)
    setupScrollReveal();
  }

  /* =========================================================
     SIMILAR LAWYERS
     ========================================================= */
  function renderSimilar(l) {
    getSimilarLawyers(l, 4).then(similar => {
      const grid = document.getElementById('similarGrid');
      grid.innerHTML = '';

      similar.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'similar-card';
        card.innerHTML = `
          <div class="avatar-circle" data-avatar></div>
          <h4>${esc(s.name)}</h4>
          <div class="sc-areas">${esc(s.practiceAreas.join(' • '))}</div>
          <div class="sc-meta"><span>${esc(s.experience)} yrs · ${esc(s.location || '')}</span><span class="sc-fee">${esc(formatFee(s))}</span></div>
          <button class="btn-view-sm" data-similar-id="${esc(s.id)}">View Profile</button>
        `;
        setAvatar(card.querySelector('[data-avatar]'), s); // photo with initials fallback
        card.querySelector('[data-similar-id]').addEventListener('click', () => {
          window.location.href = `lawyer-profile.html?id=${encodeURIComponent(s.id)}`;
        });
        grid.appendChild(card);
        setTimeout(() => card.classList.add('card-in'), i * 60);
      });
    });
  }

  /* =========================================================
     SAVE BUTTON WIRING
     ========================================================= */
  function wireSaveButtons(id) {
    [document.getElementById('heroSaveBtn'), document.getElementById('panelSaveBtn')].forEach(btn => {
      btn.addEventListener('click', () => {
        toggleSaved(id);
        updateSaveButtons(id);
      });
    });
  }

  /* =========================================================
     CONSULTATION REQUEST MODAL (same flow/storage as find-a-lawyer.html)
     ========================================================= */
  const consultModalOverlay = document.getElementById('consultModalOverlay');
  const consultFormBody = document.getElementById('consultFormBody');
  const consultSuccess = document.getElementById('consultSuccess');
  const consultForm = document.getElementById('consultForm');
  let consultLastFocused = null;
  let currentConsultLawyer = null;
  let selectedConsultType = null;

  async function startConsultationRequest(lawyer) {
    // Free-only advocates are requested through Free Legal Assistance.
    if (!lawyer.offersPaid) {
      window.location.href = 'free-legal-assistance.html?lawyer=' + encodeURIComponent(lawyer.id);
      return;
    }
    await sessionReady;
    if (!sessionUser) {
      try {
        sessionStorage.setItem('postLoginRedirect', 'lawyer-profile.html?id=' + encodeURIComponent(lawyer.id));
        sessionStorage.setItem('postLoginConsultLawyer', lawyer.id);
      } catch (e) { /* storage blocked */ }
      window.location.href = 'login.html';
      return;
    }
    if (sessionUser.role !== 'customer') {
      window.alert('Consultation requests are sent from a client account. Please sign in with a client account.');
      return;
    }

    currentConsultLawyer = lawyer;
    consultLastFocused = document.activeElement;
    document.getElementById('consultError').hidden = true;

    document.getElementById('consultSub').textContent = `Request a paid consultation with ${lawyer.name} (fee: ${formatFee(lawyer)}). Nothing is booked until the lawyer accepts. No payment is taken on CASEONE.`;
    consultForm.reset();
    selectedConsultType = null;
    document.querySelectorAll('.consult-type-option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-checked', 'false'); });

    consultFormBody.classList.remove('hidden');
    consultSuccess.classList.remove('active');

    consultModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('consultCloseBtn').focus();
  }

  function closeConsultModal() {
    consultModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    if (consultLastFocused) consultLastFocused.focus();
  }

  document.getElementById('consultCloseBtn').addEventListener('click', closeConsultModal);
  document.getElementById('cancelConsultBtn').addEventListener('click', closeConsultModal);
  document.getElementById('consultDoneBtn').addEventListener('click', closeConsultModal);
  consultModalOverlay.addEventListener('click', (e) => { if (e.target === consultModalOverlay) closeConsultModal(); });

  document.querySelectorAll('.consult-type-option').forEach(opt => {
    const choose = () => {
      document.querySelectorAll('.consult-type-option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-checked', 'false'); });
      opt.classList.add('selected');
      opt.setAttribute('aria-checked', 'true');
      selectedConsultType = opt.dataset.type;
    };
    opt.addEventListener('click', choose);
    opt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  });

  consultForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!selectedConsultType) {
      const group = document.getElementById('consultTypeGroup');
      group.style.outline = '2px solid var(--black)';
      group.style.outlineOffset = '4px';
      setTimeout(() => { group.style.outline = 'none'; }, 900);
      return;
    }

    const sendBtn = document.getElementById('sendConsultBtn');
    const errBox = document.getElementById('consultError');
    errBox.hidden = true;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    requestConsultation({
      lawyerId: currentConsultLawyer.id,
      serviceType: 'paid',
      issue: document.getElementById('consultIssue').value,
      preferredDate: document.getElementById('consultDate').value,
      preferredTime: document.getElementById('consultTime').value,
      message: document.getElementById('consultDesc').value,
      language: document.getElementById('consultLang').value,
      type: selectedConsultType
    }).then(() => {
      consultFormBody.classList.add('hidden');
      consultSuccess.classList.add('active');
    }).catch((err) => {
      errBox.textContent = err && err.message ? err.message : 'Could not send the request. Please try again.';
      errBox.hidden = false;
    }).finally(() => {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Request';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && consultModalOverlay.classList.contains('active')) {
      closeConsultModal();
    }
  });

  /* =========================================================
     SCROLL REVEAL
     ========================================================= */
  let revealObserverAttached = false;
  function setupScrollReveal() {
    if (revealObserverAttached) return;
    revealObserverAttached = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealEls = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window && !prefersReducedMotion) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      revealEls.forEach(el => observer.observe(el));
    } else {
      revealEls.forEach(el => el.classList.add('in-view'));
    }
  }

  /* =========================================================
     PAGE INIT — load lawyer by ID, or show not-found / loading states
     ========================================================= */
  const loadingState = document.getElementById('loadingState');
  const notFoundState = document.getElementById('notFoundState');
  const profileContent = document.getElementById('profileContent');
  const mobileStickyCta = document.getElementById('mobileStickyCta');

  const id = getIdFromUrl();

  if (!id) {
    loadingState.style.display = 'none';
    notFoundState.style.display = 'block';
  } else {
    getLawyerById(id).catch(() => 'error').then(lawyer => {
      loadingState.style.display = 'none';

      if (lawyer === 'error') {
        // Could not reach the server: say so instead of "not found".
        notFoundState.querySelector('h1').textContent = "Couldn't load this profile";
        notFoundState.querySelector('p').textContent = 'Please check your internet connection and try again.';
        notFoundState.style.display = 'block';
        return;
      }
      if (!lawyer) {
        notFoundState.style.display = 'block';
        return;
      }

      profileContent.style.display = 'block';
      mobileStickyCta.style.display = 'block';

      renderProfile(lawyer);
      renderSimilar(lawyer);
      wireSaveButtons(lawyer.id);

      [
        document.getElementById('heroRequestBtn'),
        document.getElementById('panelRequestBtn'),
        document.getElementById('mobileRequestBtn')
      ].forEach(btn => btn.addEventListener('click', () => { if (lawyer.requestsOpen) startConsultationRequest(lawyer); }));

      // Resume a consultation request that was interrupted by a login redirect.
      sessionReady.then(() => {
        let resumeLawyerId = null;
        try { resumeLawyerId = sessionStorage.getItem('postLoginConsultLawyer'); } catch (e) { /* blocked */ }
        if (resumeLawyerId === lawyer.id && isLoggedIn() && lawyer.requestsOpen) {
          try { sessionStorage.removeItem('postLoginConsultLawyer'); sessionStorage.removeItem('postLoginRedirect'); } catch (e) { /* blocked */ }
          startConsultationRequest(lawyer);
        }
      });
    });
  }

})();