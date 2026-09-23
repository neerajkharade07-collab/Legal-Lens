/**
 * lawyer-profile.js
 *
 * Loads a single lawyer by the `id` query parameter and renders
 * the full profile. Reuses:
 *   - window.LegalLensLawyerData (lawyer-data.js) for lawyer records
 *   - the same `legalLensSavedLawyers` localStorage key used on
 *     find-a-lawyer.html, so saved state stays in sync between pages
 *   - the same `localStorage.loggedIn` auth check and consultation
 *     request modal/flow as find-a-lawyer.html
 */
(function () {

  const { getLawyerById, getSimilarLawyers } = window.LegalLensLawyerData;

  /* =========================================================
     AUTH / NAV STATE
     ========================================================= */
  function isLoggedIn() {
    return localStorage.getItem('loggedIn') === 'true';
  }

  function refreshNavAuthState() {
    const loggedOutEl = document.getElementById('navLoggedOut');
    const userEl = document.getElementById('navUser');
    if (isLoggedIn()) {
      loggedOutEl.style.display = 'none';
      userEl.style.display = 'flex';
      const name = localStorage.getItem('userName') || 'Account';
      document.getElementById('navUserName').textContent = name;
      document.getElementById('navUserAvatar').textContent = name.charAt(0).toUpperCase();
    } else {
      loggedOutEl.style.display = 'flex';
      userEl.style.display = 'none';
    }
  }

  refreshNavAuthState();

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
    return name.replace('Adv. ', '').split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  /* =========================================================
     RENDER PROFILE
     ========================================================= */
  function renderProfile(l) {
    document.title = `Legal Lens — ${l.name}`;
    document.getElementById('breadcrumbName').textContent = l.name;

    document.getElementById('heroAvatar').textContent = initials(l.name);
    document.getElementById('heroName').textContent = l.name;

    document.getElementById('heroVerifiedBadge').innerHTML = l.verified
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified Lawyer`
      : `<span class="pending-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Verification Pending</span>`;

    document.getElementById('heroPracticeAreas').textContent = l.practiceAreas.join(' • ');
    document.getElementById('heroLocation').textContent = l.location + ', India';
    document.getElementById('heroLanguages').textContent = l.languages.join(' • ');

    document.getElementById('statExperience').textContent = l.experience;
    document.getElementById('statRating').textContent = l.rating.toFixed(1);
    document.getElementById('statConsultations').textContent = l.consultations;

    document.getElementById('aboutText').textContent = l.description;

    document.getElementById('practiceAreasTags').innerHTML = l.practiceAreas.map(p => `<span>${p}</span>`).join('');
    document.getElementById('languagesTags').innerHTML = l.languages.map(lang => `<span>${lang}</span>`).join('');
    document.getElementById('locationText').textContent = `${l.location}, India`;

    // Experience & Background — built from existing fields only; no invented credentials.
    document.getElementById('backgroundText').textContent =
      `${l.name} has ${l.experience} year${l.experience === 1 ? '' : 's'} of experience practicing ${l.practiceAreas.join(' and ')}. ${l.description}`;

    document.getElementById('panelFee').textContent = `₹${l.consultationFee.toLocaleString('en-IN')}`;
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
          <div class="avatar-circle">${initials(s.name)}</div>
          <h4>${s.name}</h4>
          <div class="sc-areas">${s.practiceAreas.join(' • ')}</div>
          <div class="sc-meta"><span>${s.experience} yrs · ★ ${s.rating.toFixed(1)}</span><span class="sc-fee">₹${s.consultationFee.toLocaleString('en-IN')}</span></div>
          <button class="btn-view-sm" data-similar-id="${s.id}">View Profile</button>
        `;
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

  function startConsultationRequest(lawyer) {
    // SIH demo: no customer login required; the request stays in this browser.

    currentConsultLawyer = lawyer;
    consultLastFocused = document.activeElement;

    document.getElementById('consultSub').textContent = `Demo Mode: a request for ${lawyer.name} is saved in this browser only and is not sent to the lawyer.`;
    consultForm.reset();
    selectedConsultType = null;
    document.querySelectorAll('.consult-type-option').forEach(o => o.classList.remove('selected'));

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
    opt.addEventListener('click', () => {
      document.querySelectorAll('.consult-type-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedConsultType = opt.dataset.type;
    });
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

    const request = {
      id: 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      lawyerId: currentConsultLawyer.id,
      customerName: localStorage.getItem('userName') || 'Guest Client',
      customerEmail: localStorage.getItem('userEmail') || '',
      issue: document.getElementById('consultIssue').value,
      date: document.getElementById('consultDate').value,
      time: document.getElementById('consultTime').value,
      description: document.getElementById('consultDesc').value,
      language: document.getElementById('consultLang').value,
      type: selectedConsultType,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    // Simulate persistence for the prototype (no real backend yet).
    // Uses the same key as find-a-lawyer.html so requests stay consistent.
    let requests = [];
    try { requests = JSON.parse(localStorage.getItem('legalLensConsultRequests')) || []; } catch (e) {}
    requests.push(request);
    localStorage.setItem('legalLensConsultRequests', JSON.stringify(requests));

    consultFormBody.classList.add('hidden');
    consultSuccess.classList.add('active');
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
    getLawyerById(id).then(lawyer => {
      loadingState.style.display = 'none';

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
      ].forEach(btn => btn.addEventListener('click', () => startConsultationRequest(lawyer)));

      // Resume a consultation request that was interrupted by a login redirect.
      const resumeLawyerId = sessionStorage.getItem('postLoginConsultLawyer');
      if (resumeLawyerId === lawyer.id && isLoggedIn()) {
        sessionStorage.removeItem('postLoginConsultLawyer');
        sessionStorage.removeItem('postLoginRedirect');
        startConsultationRequest(lawyer);
      }
    });
  }

})();