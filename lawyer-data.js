/**
 * lawyer-data.js
 *
 * Lawyer Connect data layer, shared by lawyer-connect.html, find-a-lawyer.html,
 * lawyer-profile.html, free-legal-assistance.html, my-requests.html,
 * lawyer-login.html, lawyer-register.html and lawyer-dashboard.html.
 * Function names and object shapes used by the older pages are unchanged.
 *
 * Backed by the real CASEONE API (MongoDB):
 *
 *   getLawyers()              GET  /api/lawyers               listed lawyers offering PAID consultations (listed
 *                                                             automatically after registration; `reviewed` tells
 *                                                             whether CASEONE has reviewed the profile)
 *   getLawyerById(id)         GET  /api/lawyers/:id           public profile, or null if missing / not listed / hidden
 *   reportLawyer(id, report)  POST /api/lawyers/:id/report    "Report this profile" (anyone)
 *   getSimilarLawyers(l, n)   GET  /api/lawyers/:id/similar
 *   getFreeLawyers(q)         GET  /api/free-aid/lawyers      free / both lawyers (approved free-assistance applicants only)
 *   getLawyerProfile()        GET  /api/lawyer/profile        the logged-in lawyer's own profile (any state)
 *   updateLawyerProfile(_, u) PUT  /api/lawyers/me  (+ PUT /api/lawyer/availability)
 *
 * Consultation requests are REAL (no browser demo data any more):
 *   requestConsultation(d)    POST  /api/consultations                     (customer)
 *   getMyConsultations()      GET   /api/consultations/my                  (customer)
 *   cancelConsultation(id)    PATCH /api/consultations/:id/cancel          (customer)
 *   getConsultRequestsForLawyer()   GET /api/lawyer/consultations          (lawyer)
 *   updateConsultRequestStatus(id, s) PATCH /api/consultations/:id/accept|reject|complete
 *   getClientsForLawyer()     GET   /api/lawyer/clients                    (lawyer)
 *
 * Private uploads (credentials, eligibility documents, photo) are sent as a
 * raw body with the in-memory access token; files are never public.
 *
 * Requires config.js (API_BASE_URL). Signed-in functions also need auth.js.
 */
(function (global) {

  function apiBase() {
    // eslint-disable-next-line no-undef
    return (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/api').replace(/\/+$/, '');
  }

  /* =========================================================
     SAFE DISPLAY HELPERS (lawyer-entered text is never trusted as HTML)
     ========================================================= */
  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** "4.8" — or "New" when the lawyer has no rating (CASEONE has no review system yet). */
  function formatRating(l) {
    const r = Number(l && l.rating);
    return r > 0 ? r.toFixed(1) : 'New';
  }

  /** "₹1,500" — or "Fee not listed" when the lawyer has not set a fee. Free-only lawyers: "₹0 (free)". */
  function formatFee(l) {
    if (l && l.serviceType === 'free') return '₹0 (free)';
    const f = Number(l && (l.paidConsultationFee != null ? l.paidConsultationFee : l.consultationFee));
    return f > 0 ? '₹' + f.toLocaleString('en-IN') : 'Fee not listed';
  }

  /** Absolute URL of a lawyer's public photo, or '' (show initials instead). */
  function photoSrc(l) {
    return l && l.photoUrl ? apiBase() + l.photoUrl : '';
  }

  /** Has CASEONE reviewed this listed profile? Only reviewed lawyers accept requests. */
  function isReviewed(l) {
    return !!(l && l.reviewed === true);
  }

  /**
   * Public badge text: official-source verification vs a manual CASEONE review
   * (never presented as official) vs a profile listed automatically that nobody
   * has reviewed yet (self-reported details).
   */
  function verificationLabel(l) {
    if (!isReviewed(l)) return 'Not yet reviewed by CASEONE';
    return l.verificationMethod === 'official_sources' ? 'Verified Lawyer' : 'Credentials reviewed by CASEONE';
  }

  /** Disclosure shown wherever lawyer profiles are listed. */
  const LISTING_DISCLOSURE = 'Advocates list themselves on CASEONE. Profile details, including Bar Council enrollment, are provided by the advocate and have not been independently checked unless the profile is marked "Credentials reviewed by CASEONE". You can send requests only to reviewed advocates. See something wrong? Use "Report this profile".';

  // Letters and digits only: the result is also used inside inline onerror="…" fallbacks,
  // so quotes or other punctuation from a name must never reach it.
  function initials(name) {
    return String(name || '?').replace(/^Adv\.?\s+/i, '').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase() || '?';
  }

  /** Fills in missing fields so older UI code never crashes on a sparse profile. */
  function normalize(l) {
    if (!l || typeof l !== 'object') return null;
    return {
      id: String(l.id || ''),
      name: String(l.name || 'Lawyer'),
      email: l.email || '',
      verified: l.verified === true,
      verificationStatus: l.verificationStatus || (l.verified ? 'verified' : 'pending'),
      practiceAreas: Array.isArray(l.practiceAreas) ? l.practiceAreas : [],
      experience: Number(l.experience) || 0,
      location: String(l.location || ''),
      languages: Array.isArray(l.languages) ? l.languages : [],
      consultationFee: Number(l.consultationFee) || 0,
      rating: Number(l.rating) || 0,
      consultations: Number(l.consultations) || 0,
      description: String(l.description || ''),
      barNumber: String(l.barNumber || ''),
      availability: l.availability || { days: [], slots: [] },
      reverificationRequired: l.reverificationRequired === true,
      // Lawyer Portal fields (older records: paid, no photo)
      serviceType: ['paid', 'free', 'both'].includes(l.serviceType) ? l.serviceType : 'paid',
      offersPaid: l.offersPaid !== undefined ? l.offersPaid === true : l.serviceType !== 'free',
      offersFree: l.offersFree === true,
      paidConsultationFee: l.paidConsultationFee != null ? Number(l.paidConsultationFee) || 0 : null,
      freeConsultationFee: 0,
      freeServiceNote: String(l.freeServiceNote || ''),
      stateBarCouncil: String(l.stateBarCouncil || ''),
      qualifications: String(l.qualifications || ''),
      photoUrl: String(l.photoUrl || ''),
      hasPhoto: l.hasPhoto === true || !!l.photoUrl,
      phone: String(l.phone || ''),
      verificationState: l.verificationState || '',
      decisionReason: String(l.decisionReason || ''),
      isPublished: l.isPublished !== false,
      acceptsEmergencyRequests: l.acceptsEmergencyRequests === true,
      automatedVerification: l.automatedVerification || null,
      // Lawyer registration: state is public; officeAddress / enrollmentDate only on the lawyer's own profile
      state: String(l.state || ''),
      enrolledSince: l.enrolledSince ? Number(l.enrolledSince) : null,
      enrollmentDate: l.enrollmentDate || null,
      officeAddress: String(l.officeAddress || ''),
      experienceFromEnrollment: l.experienceFromEnrollment === true,
      // 'official_sources' → "Verified Lawyer"; 'manual_review' → "Credentials reviewed by CASEONE";
      // null on a listed profile → "Not yet reviewed by CASEONE"
      verificationMethod: l.verificationMethod || null,
      // Older API responses (reviewed-only directories) have no `reviewed` field: those were all reviewed.
      reviewed: l.reviewed !== undefined ? l.reviewed === true : l.verified === true,
      requestsOpen: l.requestsOpen !== undefined ? l.requestsOpen === true : l.verified === true
    };
  }

  /* =========================================================
     HTTP
     ========================================================= */
  async function getJSON(path) {
    const res = await fetch(apiBase() + path, { headers: { Accept: 'application/json' } });
    let payload = null;
    try { payload = await res.json(); } catch (e) { /* empty */ }
    if (res.status === 404) return null;
    if (!res.ok || !payload || !payload.success) {
      const err = new Error((payload && payload.message) || 'Could not load lawyer data.');
      err.statusCode = res.status;
      throw err;
    }
    return payload.data;
  }

  /** Authenticated call for the logged-in lawyer (auth.js), renewing the session once on 401. */
  async function lawyerRequest(path, options) {
    if (typeof global.apiRequest !== 'function') throw new Error('auth.js is required.');
    try {
      return await global.apiRequest(path, Object.assign({ useAuth: true }, options || {}));
    } catch (err) {
      if (err && err.statusCode === 401 && typeof global.refreshSession === 'function' && await global.refreshSession()) {
        return global.apiRequest(path, Object.assign({ useAuth: true }, options || {}));
      }
      throw err;
    }
  }

  /* =========================================================
     PUBLIC (customer-facing) API
     ========================================================= */
  let directoryCache = null;

  /** All verified, published lawyers (cached for the page's lifetime). */
  function getLawyers() {
    if (!directoryCache) {
      directoryCache = getJSON('/lawyers')
        .then((list) => (Array.isArray(list) ? list.map(normalize).filter(Boolean) : []))
        .catch((err) => { directoryCache = null; throw err; });
    }
    return directoryCache;
  }

  /** One public profile, or null when it does not exist or is not public (pending, rejected, hidden). */
  function getLawyerById(id) {
    if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return Promise.resolve(null);
    return getJSON('/lawyers/' + encodeURIComponent(id)).then(normalize);
  }

  function getSimilarLawyers(lawyer, limit) {
    if (!lawyer || !lawyer.id) return Promise.resolve([]);
    return getJSON('/lawyers/' + encodeURIComponent(lawyer.id) + '/similar?limit=' + (Number(limit) || 4))
      .then((list) => (Array.isArray(list) ? list.map(normalize).filter(Boolean) : []))
      .catch(() => []);
  }

  /* =========================================================
     THE LOGGED-IN LAWYER'S OWN PROFILE (lawyer-dashboard.html)
     ========================================================= */
  async function getLawyerProfile() {
    const res = await lawyerRequest('/lawyer/profile');
    return normalize(res.data);
  }

  // Kept for compatibility with older dashboard code: with the real backend a
  // lawyer profile always exists for a lawyer account, so this just loads it.
  function ensureLawyerProfile() {
    return getLawyerProfile();
  }

  /**
   * Saves the logged-in lawyer's profile. `updates` uses the dashboard's
   * field names (description, barNumber, availability) and is mapped to the
   * API's names. Verification status is never sent (only admins set it).
   */
  async function updateLawyerProfile(_id, updates) {
    updates = updates || {};
    let message = '';
    if (updates.availability) {
      await lawyerRequest('/lawyer/availability', {
        method: 'PUT',
        body: { days: updates.availability.days || [], slots: updates.availability.slots || [] }
      });
    }
    const body = {};
    const map = { name: 'name', barNumber: 'barRegistrationNumber', location: 'location', experience: 'experience', consultationFee: 'consultationFee', description: 'bio', practiceAreas: 'practiceAreas', languages: 'languages', serviceType: 'serviceType', freeServiceNote: 'freeServiceNote', qualifications: 'qualifications', acceptsEmergencyRequests: 'acceptsEmergencyRequests', state: 'state', officeAddress: 'officeAddress' };
    Object.keys(map).forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(updates, k)) body[map[k]] = updates[k];
    });
    if (Object.keys(body).length) {
      const res = await lawyerRequest('/lawyers/me', { method: 'PUT', body });
      message = res && res.message ? res.message : '';
    }
    const profile = await getLawyerProfile();
    if (profile && /verified again/i.test(message)) profile.reverificationRequired = true;
    return profile;
  }

  /* =========================================================
     CONSULTATION REQUESTS (real API)
     ========================================================= */
  /** "Report this profile". Sent signed-in when a session exists, otherwise anonymously. */
  async function reportLawyer(id, report) {
    const send = async (withAuth) => {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const token = withAuth && typeof global.getAccessToken === 'function' ? global.getAccessToken() : '';
      if (token) headers.Authorization = 'Bearer ' + token;
      const res = await fetch(apiBase() + '/lawyers/' + encodeURIComponent(id) + '/report', { method: 'POST', headers, body: JSON.stringify(report || {}) });
      let payload = null;
      try { payload = await res.json(); } catch (e) { /* empty */ }
      return { res, payload };
    };
    let { res, payload } = await send(true);
    if (res.status === 401) ({ res, payload } = await send(false)); // expired session: report anonymously
    if (!res.ok || !payload || !payload.success) {
      const list = payload && payload.errors;
      const err = new Error((list && list[0] && (list[0].message || list[0].msg)) || (payload && payload.message) || 'Could not send the report. Please try again.');
      err.statusCode = res.status;
      throw err;
    }
    return payload;
  }

  async function requestConsultation(details) {
    const res = await lawyerRequest('/consultations', { method: 'POST', body: details });
    return res.data;
  }

  async function getMyConsultations() {
    const res = await lawyerRequest('/consultations/my');
    return Array.isArray(res.data) ? res.data : [];
  }

  async function cancelConsultation(id) {
    const res = await lawyerRequest('/consultations/' + encodeURIComponent(id) + '/cancel', { method: 'PATCH' });
    return res.data;
  }

  /** The signed-in lawyer's incoming requests (the argument is ignored; kept for old callers). */
  async function getConsultRequestsForLawyer() {
    const res = await lawyerRequest('/lawyer/consultations');
    return Array.isArray(res.data) ? res.data : [];
  }

  /** status: 'accepted' | 'rejected' | 'completed' */
  async function updateConsultRequestStatus(requestId, status) {
    const action = { accepted: 'accept', rejected: 'reject', completed: 'complete' }[status];
    if (!action) throw new Error('Unknown status.');
    const res = await lawyerRequest('/consultations/' + encodeURIComponent(requestId) + '/' + action, { method: 'PATCH' });
    return res.data;
  }

  async function getClientsForLawyer() {
    const res = await lawyerRequest('/lawyer/clients');
    return Array.isArray(res.data) ? res.data : [];
  }

  /** Free lawyers for an approved free-assistance applicant. */
  async function getFreeLawyers(query) {
    const q = new URLSearchParams();
    Object.keys(query || {}).forEach((k) => { if (query[k]) q.set(k, query[k]); });
    const res = await lawyerRequest('/free-aid/lawyers' + (q.toString() ? '?' + q.toString() : ''));
    return Array.isArray(res.data) ? res.data.map(normalize).filter(Boolean) : [];
  }

  /* =========================================================
     PRIVATE FILES (raw-body uploads + authenticated downloads)
     ========================================================= */
  async function rawFetch(path, init) {
    const send = () => {
      const headers = Object.assign({}, init.headers || {});
      const token = typeof global.getAccessToken === 'function' ? global.getAccessToken() : null;
      if (token) headers.Authorization = 'Bearer ' + token;
      return fetch(apiBase() + path, Object.assign({}, init, { headers, credentials: 'include' }));
    };
    let res = await send();
    if (res.status === 401 && typeof global.refreshSession === 'function' && await global.refreshSession()) res = await send();
    return res;
  }

  /** Uploads one File. Resolves to the API payload; rejects with err.message from the API. */
  async function uploadPrivateFile(path, file, method) {
    const res = await rawFetch(path, {
      method: method || 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name || 'document') },
      body: file
    });
    let payload = null;
    try { payload = await res.json(); } catch (e) { /* none */ }
    if (!res.ok) {
      const err = new Error((payload && payload.message) || 'Upload failed (' + res.status + ').');
      err.statusCode = res.status;
      throw err;
    }
    return payload;
  }

  /** Opens a private file (own document, or admin review) in a new tab via a temporary blob URL. */
  async function openPrivateFile(path) {
    const win = global.open('', '_blank');
    try {
      const res = await rawFetch(path, { method: 'GET' });
      if (!res.ok) throw new Error(res.status === 404 ? 'File not found.' : 'Could not open the file.');
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url; else global.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      if (win) win.close();
      throw err;
    }
  }

  /** Object URL of a private image (e.g. the lawyer's own photo), or '' when there is none. */
  async function privateImageUrl(path) {
    try {
      const res = await rawFetch(path, { method: 'GET' });
      if (!res.ok) return '';
      return URL.createObjectURL(await res.blob());
    } catch (e) {
      return '';
    }
  }

  global.LegalLensLawyerData = {
    // Public (customer-facing)
    getLawyers,
    getLawyerById,
    getSimilarLawyers,
    // The logged-in lawyer
    getLawyerProfile,
    ensureLawyerProfile,
    updateLawyerProfile,
    getFreeLawyers,
    normalize,
    verificationLabel,
    isReviewed,
    reportLawyer,
    LISTING_DISCLOSURE,
    // Consultation requests / clients (real API)
    requestConsultation,
    getMyConsultations,
    cancelConsultation,
    getConsultRequestsForLawyer,
    updateConsultRequestStatus,
    getClientsForLawyer,
    // Private files
    uploadPrivateFile,
    openPrivateFile,
    privateImageUrl,
    photoSrc,
    initials,
    // Display helpers
    escapeHtml,
    formatRating,
    formatFee
  };

})(window);
