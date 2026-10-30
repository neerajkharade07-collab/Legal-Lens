/**
 * lawyer-register.js — CASEONE four-step lawyer registration.
 *
 *   1. Account               POST /api/auth/lawyer/signup (password hashed on the server)
 *   2. Professional profile  PUT  /api/lawyer/verification/details + PUT /api/lawyer/photo
 *   3. Documents             POST /api/lawyer/verification/documents?kind=…  (Aadhaar, PAN, Sanad, law degree)
 *                            POST /api/lawyer/verification/submit { consent }  ("Complete registration")
 *   4. Registration complete → the Lawyer Dashboard opens automatically.
 *
 * Completing registration opens the lawyer's own dashboard and lists the
 * profile in Lawyer Connect automatically, marked "Not yet reviewed by CASEONE".
 * Client requests open after a basic CASEONE review. Uploaded documents are
 * stored privately and are never described as verified here.
 * Upload progress is the real progress of the request (XMLHttpRequest events).
 * Requires config.js, auth.js, lawyer-data.js and lawyer-system.js.
 */
(function () {
  'use strict';

  const LS = window.LS;
  const D = window.LegalLensLawyerData;
  const esc = LS.esc;

  const STEPS = ['account', 'professional', 'documents', 'complete'];
  const STEP_TITLES = { account: 'Account', professional: 'Professional profile', documents: 'Documents', complete: 'Registration complete' };
  const SERVICE_TEXT = {
    paid: 'Find a Paid Lawyer.',
    free: 'the Free Legal Aid directory, after the CASEONE review (it shows reviewed lawyers only).',
    both: 'Find a Paid Lawyer now, and the Free Legal Aid directory after the CASEONE review (it shows reviewed lawyers only).'
  };
  const STATES_UT = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
  const BAR_COUNCILS = ['Bar Council of Andhra Pradesh', 'Bar Council of Assam, Nagaland, Meghalaya, Manipur, Tripura, Mizoram & Arunachal Pradesh', 'Bar Council of Bihar', 'Bar Council of Chhattisgarh', 'Bar Council of Delhi', 'Bar Council of Gujarat', 'Bar Council of Himachal Pradesh', 'Bar Council of Jammu & Kashmir and Ladakh', 'Bar Council of Jharkhand', 'Bar Council of Karnataka', 'Bar Council of Kerala', 'Bar Council of Madhya Pradesh', 'Bar Council of Maharashtra & Goa', 'Bar Council of Odisha', 'Bar Council of Punjab & Haryana', 'Bar Council of Rajasthan', 'Bar Council of Tamil Nadu & Puducherry', 'Bar Council of Telangana', 'Bar Council of Uttar Pradesh', 'Bar Council of Uttarakhand', 'Bar Council of West Bengal'];
  const PRACTICE_AREAS = ['Criminal Law', 'Property Law', 'Family Law', 'Civil Law', 'Consumer Law', 'Cyber Law', 'Employment Law', 'Business / Corporate Law', 'Banking / Finance', 'Tenant / Rental Disputes'];
  const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada'];
  // Neutral descriptions: uploading a document never means it has been verified.
  const DOCS = [
    { kind: 'aadhaar_card', tag: 'UID', title: 'Aadhaar card (masked)', why: 'Upload the masked Aadhaar (only the last 4 digits visible), for example the masked PDF from UIDAI (myAadhaar → Download Aadhaar → masked Aadhaar). If the PDF is password-protected, save an unlocked copy first. A file showing the full 12-digit number is refused.' },
    { kind: 'pan_card', tag: 'PAN', title: 'PAN card', why: 'A copy of your PAN card for the CASEONE review. Only the last 4 characters of the number are ever kept.' },
    { kind: 'enrollment_certificate', tag: 'BAR', title: 'Advocate Sanad / Bar Council enrollment certificate', why: 'Your certificate of enrollment as an advocate, issued by your State Bar Council.' },
    { kind: 'law_degree', tag: 'LLB', title: 'Law degree certificate', why: 'Your LL.B. (or equivalent) degree certificate.' }
  ];
  const DOC_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
  const DOC_MAX = 5 * 1024 * 1024;
  const PHOTO_MAX = 2 * 1024 * 1024;
  const MOBILE_RE = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const $ = (id) => document.getElementById(id);
  let v = null;            // GET /lawyer/verification data
  let signedIn = false;
  let current = null;
  let updateMode = false;  // ?update=1 after CASEONE asked for changes
  let photoUrl = '';
  let busyUploads = 0;

  // ------------------------------------------------------------ api helpers
  async function call(path, opts) {
    try {
      return await apiRequest(path, Object.assign({ useAuth: true }, opts || {}));
    } catch (err) {
      if (err && err.statusCode === 401 && await refreshSession()) return apiRequest(path, Object.assign({ useAuth: true }, opts || {}));
      throw err;
    }
  }

  /** Real upload progress via XMLHttpRequest. onPhase('uploading', pct) / onPhase('processing'). */
  function xhrUpload(path, file, method, onPhase, retried) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, API_BASE_URL + path);
      xhr.withCredentials = true;
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'document'));
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPhase('uploading', Math.round((e.loaded / e.total) * 100)); };
      xhr.upload.onload = () => onPhase('processing');
      xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'));
      xhr.onload = async () => {
        let payload = null;
        try { payload = JSON.parse(xhr.responseText); } catch (e) { /* none */ }
        if (xhr.status === 401 && !retried && await refreshSession()) {
          xhrUpload(path, file, method, onPhase, true).then(resolve, reject);
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
        else reject(Object.assign(new Error((payload && payload.message) || 'Upload failed (' + xhr.status + ').'), { statusCode: xhr.status }));
      };
      onPhase('uploading', 0);
      xhr.send(file);
    });
  }

  async function loadVerification() {
    const res = await call('/lawyer/verification');
    v = res.data;
    return v;
  }

  // ------------------------------------------------------------ ui helpers
  function alertBox(msg, strong) {
    const el = $('globalAlert');
    el.textContent = msg || '';
    el.classList.toggle('is-strong', !!strong);
    el.hidden = !msg;
  }
  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.classList.toggle('is-loading', busy);
    if (label) btn.querySelector('.lbl').textContent = label;
  }
  function fieldError(id, on, msg) {
    const f = $('f-' + id);
    if (!f) return;
    f.classList.toggle('has-error', !!on);
    const err = f.querySelector('.err');
    if (err && msg) err.textContent = msg;
    const input = $(id);
    if (input) input.setAttribute('aria-invalid', on ? 'true' : 'false');
  }
  function focusFirstError(form) {
    const f = form.querySelector('.has-error input, .has-error select, .has-error textarea');
    if (f) f.focus();
  }
  function applyServerFieldErrors(err, map) {
    const list = (err.details && err.details.errors) || [];
    let any = false;
    list.forEach((e) => { if (map[e.field]) { fieldError(map[e.field], true, e.message); any = true; } });
    return any;
  }

  // ------------------------------------------------------------ step state
  const docsIn = () => {
    const kinds = new Set(((v && v.documents) || []).map((d) => d.kind));
    return DOCS.filter((d) => kinds.has(d.kind)).length;
  };
  const registered = () => !!(v && v.registrationComplete);
  function stepComplete(step) {
    if (step === 'account') return signedIn && !!(v && v.details && v.details.name && v.details.phone);
    if (!v) return false;
    const d = v.details || {};
    // Only REQUIRED items count; everything in "Optional details" is optional.
    if (step === 'professional') return !!(d.state && d.location && d.hasPhoto && d.stateBarCouncil && d.enrollmentNumber && (d.practiceAreas || []).length && v.listing && v.listing.serviceTypeChosen);
    if (step === 'documents') return docsIn() === 4;
    if (step === 'complete') return registered();
    return false;
  }
  function firstIncomplete() {
    for (const s of ['account', 'professional', 'documents']) if (!stepComplete(s)) return s;
    return 'documents';
  }
  /** Editing is possible while registering, and after CASEONE asked for an update. */
  function canEditNow() { return !!v && v.canEdit && (!registered() || updateMode); }

  function renderRail() {
    const n = docsIn();
    $('railDocCount').textContent = n + ' of 4';
    $('railMeter').style.width = (n * 25) + '%';
    document.querySelectorAll('#railDocs li').forEach((li) => {
      li.classList.toggle('is-in', !!((v && v.documents) || []).some((d) => d.kind === li.dataset.kind));
    });
    document.querySelectorAll('.rail-step').forEach((b) => {
      const s = b.dataset.step;
      const done = stepComplete(s);
      b.classList.toggle('is-done', done && s !== current);
      b.classList.toggle('is-current', s === current);
      b.classList.remove('is-attention');
      const clickable = signedIn && (s === 'complete' ? registered() : (s === 'account' || canEditNow()));
      b.dataset.clickable = clickable ? 'true' : 'false';
      b.setAttribute('aria-current', s === current ? 'step' : 'false');
      b.disabled = !clickable && s !== current;
    });
    const idx = STEPS.indexOf(current);
    $('rmTitle').textContent = STEP_TITLES[current] || 'Register as a lawyer';
    $('rmStep').textContent = 'Step ' + (idx + 1) + ' of 4';
    $('rmMeter').style.width = (current === 'complete' ? 100 : Math.round((idx / 4) * 100)) + '%';
  }

  function show(step, opts) {
    if (step !== 'account' && !signedIn) step = 'account';
    if (['professional', 'documents'].includes(step) && v && !canEditNow()) step = registered() ? 'complete' : step;
    current = step;
    $('loadingState').hidden = true;
    STEPS.forEach((s) => { $('step-' + s).hidden = s !== step; });
    renderRail();
    if (step === 'account') renderAccount();
    if (step === 'professional') renderProfessional();
    if (step === 'documents') renderDocuments();
    if (step === 'complete') renderComplete(opts && opts.fresh);
    if (!opts || !opts.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    const h = $('step-' + step).querySelector('h2');
    if (h && opts && opts.focus) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); show(g.dataset.goto, { focus: true }); return; }
    const r = e.target.closest('.rail-step');
    if (r && r.dataset.clickable === 'true') show(r.dataset.step, { focus: true });
  });

  function renderSession() {
    const u = getCurrentUser();
    $('sessionBox').hidden = !(signedIn && u);
    if (u) $('sessionWho').textContent = 'Signed in as ' + u.email;
  }
  $('logoutBtn').addEventListener('click', () => logoutUser());
  $('clientLogout').addEventListener('click', () => logoutUser());

  // ------------------------------------------------------------ step 1: account
  document.querySelectorAll('.pw-toggle').forEach((b) => b.addEventListener('click', () => {
    const input = $(b.dataset.toggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  }));
  const PW_RULES = { len: (p) => p.length >= 8, upper: (p) => /[A-Z]/.test(p), lower: (p) => /[a-z]/.test(p), num: (p) => /[0-9]/.test(p), sym: (p) => /[^A-Za-z0-9]/.test(p) };
  function pwOk(p) { return Object.values(PW_RULES).every((fn) => fn(p)); }
  $('acPassword').addEventListener('input', () => {
    const p = $('acPassword').value;
    document.querySelectorAll('#pwRules li').forEach((li) => li.classList.toggle('ok', PW_RULES[li.dataset.rule](p)));
    fieldError('acPassword', false);
  });
  ['acName', 'acEmail', 'acPhone', 'acConfirm'].forEach((id) => $(id).addEventListener('input', () => fieldError(id, false)));
  $('acTerms').addEventListener('change', () => $('f-acTerms').classList.remove('has-error'));

  /** Signed in: the account step only edits name and mobile (email and password are already set). */
  function renderAccount() {
    const existing = signedIn && v;
    $('acPasswordRow').hidden = !!existing;
    document.querySelectorAll('[data-new-only]').forEach((el) => { el.hidden = !!existing; });
    $('acEmail').disabled = !!existing;
    $('h-account').textContent = existing ? 'Your account' : 'Create your lawyer account';
    $('btnAccount').querySelector('.lbl').textContent = existing ? 'Save and continue' : 'Create account and continue';
    if (existing) {
      const d = v.details || {};
      $('acName').value = d.name || '';
      $('acEmail').value = d.email || '';
      $('acPhone').value = d.phone || '';
      $('accountIntro').textContent = 'Use your name exactly as it appears on your Sanad and identity documents. Your email and password stay as they are.';
    }
  }

  $('formAccount').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (signedIn && v) return saveAccount();
    const name = $('acName').value.trim();
    const email = $('acEmail').value.trim();
    const phone = $('acPhone').value.trim();
    const pw = $('acPassword').value;
    let ok = true;
    if (name.length < 2) { fieldError('acName', true); ok = false; }
    if (!EMAIL_RE.test(email)) { fieldError('acEmail', true, 'Enter a valid email address.'); ok = false; }
    if (!MOBILE_RE.test(phone)) { fieldError('acPhone', true); ok = false; }
    if (!pwOk(pw)) { fieldError('acPassword', true); ok = false; }
    if (!pw || $('acConfirm').value !== pw) { fieldError('acConfirm', true); ok = false; }
    if (!$('acTerms').checked) { $('f-acTerms').classList.add('has-error'); ok = false; }
    if (!ok) { focusFirstError($('formAccount')); return; }

    const btn = $('btnAccount');
    setBusy(btn, true, 'Creating your account…');
    alertBox('');
    try {
      const res = await apiRequest('/auth/lawyer/signup', { method: 'POST', body: { name, email, password: pw, phone } });
      // The signup response set the httpOnly refresh cookie; exchange it for an in-memory session.
      if (!(await refreshSession())) {
        alertBox('Your account was created. Please log in to continue your registration.', true);
        setBusy(btn, false, 'Create account and continue');
        setTimeout(() => { window.location.href = 'lawyer-login.html'; }, 2500);
        return;
      }
      setUiConvenienceFlags('lawyer', res.data.user, res.data.lawyerId);
      signedIn = true;
      $('acPassword').value = '';
      $('acConfirm').value = '';
      await call('/lawyer/verification/details', { method: 'PUT', body: { phone } }).catch(() => {});
      await loadVerification();
      renderSession();
      LS.toast('Account created. Your progress is saved as you go.');
      show('professional', { focus: true });
    } catch (err) {
      setBusy(btn, false, 'Create account and continue');
      if (err.statusCode === 409) { fieldError('acEmail', true, 'An account with this email already exists. Log in instead, or use another email.'); focusFirstError($('formAccount')); return; }
      if (!applyServerFieldErrors(err, { name: 'acName', email: 'acEmail', password: 'acPassword', phone: 'acPhone' })) alertBox(err.message || 'Could not create the account. Please try again.', true);
      focusFirstError($('formAccount'));
    }
  });

  async function saveAccount() {
    const body = { name: $('acName').value.trim(), phone: $('acPhone').value.trim() };
    let ok = true;
    if (body.name.length < 2) { fieldError('acName', true); ok = false; }
    if (!MOBILE_RE.test(body.phone)) { fieldError('acPhone', true); ok = false; }
    if (!ok) { focusFirstError($('formAccount')); return; }
    const btn = $('btnAccount');
    setBusy(btn, true, 'Saving…');
    try {
      const res = await call('/lawyer/verification/details', { method: 'PUT', body });
      v = res.data;
      try { localStorage.setItem('userName', body.name); } catch (x) { /* ignore */ }
      show(canEditNow() ? 'professional' : 'complete', { focus: true });
    } catch (err) {
      if (!applyServerFieldErrors(err, { name: 'acName', phone: 'acPhone' })) alertBox(err.message, true);
      focusFirstError($('formAccount'));
    } finally { setBusy(btn, false, 'Save and continue'); }
  }

  // ------------------------------------------------------------ step 2: professional profile
  $('pState').innerHTML = '<option value="">Choose your state</option>' + STATES_UT.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  ['pState', 'pCity'].forEach((id) => $(id).addEventListener('input', () => fieldError(id, false)));

  async function refreshPhoto() {
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = ''; }
    if (v && v.details && v.details.hasPhoto) photoUrl = await D.privateImageUrl('/lawyer/photo');
    const frame = $('photoFrame');
    frame.classList.toggle('has-photo', !!photoUrl);
    frame.innerHTML = photoUrl ? `<img src="${photoUrl}" alt="Your professional photograph">` : 'No photo';
    $('photoBtnLabel').textContent = photoUrl ? 'Replace photo' : 'Upload photo';
  }

  $('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const err = $('photoError');
    err.hidden = true;
    $('f-pPhoto').classList.remove('has-error');
    err.hidden = true;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) { err.textContent = 'Choose a JPG or PNG photo.'; err.hidden = false; return; }
    if (file.size > PHOTO_MAX) { err.textContent = 'This photo is larger than 2 MB. Choose a smaller one.'; err.hidden = false; return; }
    const prog = $('photoProgress');
    prog.hidden = false;
    busyUploads += 1;
    try {
      await xhrUpload('/lawyer/photo', file, 'PUT', (phase, pct) => phaseUi(prog, phase, pct, 'photo'));
      prog.hidden = true;
      await loadVerification();
      await refreshPhoto();
      renderRail();
      LS.toast('Photo saved.');
    } catch (ex) {
      prog.hidden = true;
      err.textContent = ex.message;
      err.hidden = false;
    } finally { busyUploads -= 1; }
  });

  $('prCouncil').innerHTML = '<option value="">Choose your State Bar Council</option>' + BAR_COUNCILS.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  function chips(container, options, name) {
    container.innerHTML = options.map((o, i) => `<label class="chip"><input type="checkbox" name="${name}" value="${esc(o)}" id="${name}-${i}"><span>${esc(o)}</span></label>`).join('');
  }
  chips($('prAreas'), PRACTICE_AREAS, 'area');
  chips($('prLangs'), LANGUAGES, 'lang');
  $('prDate').max = new Date().toISOString().slice(0, 10);
  ['prCouncil', 'prEnroll', 'prDate', 'prBio', 'prFee'].forEach((id) => $(id).addEventListener('input', () => fieldError(id, false)));
  $('prAreas').addEventListener('change', () => fieldError('prAreas', false));
  $('prBio').addEventListener('input', () => { $('prBioCount').textContent = $('prBio').value.length + ' / 2000'; });
  const checked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((i) => i.value);

  function practiceYearsText(dateStr) {
    if (!dateStr) return 'Your years of practice are calculated from this date.';
    const d = new Date(dateStr + 'T00:00:00Z');
    const n = new Date();
    if (isNaN(d) || d > n) return 'Your years of practice are calculated from this date.';
    let y = n.getUTCFullYear() - d.getUTCFullYear();
    if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) y -= 1;
    return 'Years of practice (calculated from this date): ' + y + (y === 1 ? ' year' : ' years') + '.';
  }
  $('prDate').addEventListener('input', () => { $('prDate-hint').textContent = practiceYearsText($('prDate').value); });

  function renderUpdateNote() {
    const note = $('updateNote');
    const ob = (v && v.onboarding) || {};
    const show = updateMode && (ob.code === 'action_required' || ob.code === 'not_listed');
    note.hidden = !show;
    if (show) note.textContent = 'CASEONE asked for an update: ' + (v.decisionReason || ob.message) + ' Change what is needed, then send it again from the Documents step. Your dashboard stays open.';
  }

  function renderProfessional() {
    const d = v.details || {};
    renderUpdateNote();
    $('pState').value = d.state || '';
    $('pCity').value = d.location || '';
    refreshPhoto();
    if (d.stateBarCouncil && !BAR_COUNCILS.includes(d.stateBarCouncil)) $('prCouncil').insertAdjacentHTML('beforeend', `<option value="${esc(d.stateBarCouncil)}">${esc(d.stateBarCouncil)}</option>`);
    $('prCouncil').value = d.stateBarCouncil || '';
    $('prEnroll').value = d.enrollmentNumber || '';
    $('prDate').value = d.enrollmentDate || '';
    $('prQual').value = d.qualifications || '';
    $('prOffice').value = d.officeAddress || '';
    $('prBio').value = d.bio || '';
    $('prBioCount').textContent = $('prBio').value.length + ' / 2000';
    $('prDate-hint').textContent = practiceYearsText($('prDate').value);
    document.querySelectorAll('input[name="area"]').forEach((i) => { i.checked = (d.practiceAreas || []).includes(i.value); });
    document.querySelectorAll('input[name="lang"]').forEach((i) => { i.checked = (d.languages || []).includes(i.value); });
    // The service type is an explicit choice: nothing is pre-selected until it has been saved.
    const chosen = v.listing && v.listing.serviceTypeChosen ? d.serviceType : '';
    document.querySelectorAll('input[name="prService"]').forEach((r) => { r.checked = r.value === chosen; });
    $('prFee').value = d.consultationFee ? d.consultationFee : '';
    if (d.enrollmentDate || d.qualifications || (d.languages || []).length || d.officeAddress || d.bio) $('optDetails').open = true;
    syncFee();
  }
  function syncFee() {
    const t = (document.querySelector('input[name="prService"]:checked') || {}).value;
    $('f-prFee').hidden = !(t === 'paid' || t === 'both');
  }
  document.querySelectorAll('input[name="prService"]').forEach((r) => r.addEventListener('change', () => { syncFee(); $('f-prService').classList.remove('has-error'); }));

  $('formProfessional').addEventListener('submit', async (e) => {
    e.preventDefault();
    const maxBio = (v && v.maxBioLength) || 2000;
    const serviceType = (document.querySelector('input[name="prService"]:checked') || {}).value || '';
    const feeRaw = $('prFee').value.trim();
    const body = {
      state: $('pState').value,
      location: $('pCity').value.trim(),
      stateBarCouncil: $('prCouncil').value,
      enrollmentNumber: $('prEnroll').value.trim(),
      practiceAreas: checked('area'),
      languages: checked('lang'),
      qualifications: $('prQual').value.trim(),
      officeAddress: $('prOffice').value.trim(),
      bio: $('prBio').value.trim()
    };
    if (serviceType) body.serviceType = serviceType;
    // Optional enrollment date: sent only when filled in (an empty value is not a date).
    if ($('prDate').value) body.enrollmentDate = $('prDate').value;
    if (serviceType && serviceType !== 'free') body.consultationFee = feeRaw === '' ? 0 : Number(feeRaw); // 0 = not set yet
    let ok = true;
    if (!body.state) { fieldError('pState', true); ok = false; }
    if (!body.location) { fieldError('pCity', true); ok = false; }
    if (!(v.details && v.details.hasPhoto)) { const pe = $('photoError'); pe.textContent = 'Upload your professional photograph.'; pe.hidden = false; $('f-pPhoto').classList.add('has-error'); ok = false; }
    if (!body.stateBarCouncil) { fieldError('prCouncil', true); ok = false; }
    if (body.enrollmentNumber.length < 3) { fieldError('prEnroll', true); ok = false; }
    if (!body.practiceAreas.length) { fieldError('prAreas', true); ok = false; }
    if (!serviceType) { $('f-prService').classList.add('has-error'); ok = false; }
    if (body.enrollmentDate && (body.enrollmentDate > new Date().toISOString().slice(0, 10) || body.enrollmentDate < '1950-01-01')) { $('optDetails').open = true; fieldError('prDate', true); ok = false; }
    if (body.bio.length > maxBio) { $('optDetails').open = true; fieldError('prBio', true); ok = false; }
    if (feeRaw !== '' && serviceType && serviceType !== 'free' && (!Number.isInteger(body.consultationFee) || body.consultationFee < 1 || body.consultationFee > 100000)) { fieldError('prFee', true); ok = false; }
    if (!ok) {
      const first = $('formProfessional').querySelector('.has-error input, .has-error select, .has-error textarea');
      if (first) first.focus();
      return;
    }
    const btn = $('btnProfessional');
    setBusy(btn, true, 'Saving…');
    try {
      const res = await call('/lawyer/verification/details', { method: 'PUT', body });
      v = res.data;
      show('documents', { focus: true });
    } catch (err) {
      if (!applyServerFieldErrors(err, { state: 'pState', location: 'pCity', stateBarCouncil: 'prCouncil', enrollmentNumber: 'prEnroll', enrollmentDate: 'prDate', bio: 'prBio', consultationFee: 'prFee' })) alertBox(err.message, true);
      focusFirstError($('formProfessional'));
    } finally { setBusy(btn, false, 'Save and continue'); }
  });

  // ------------------------------------------------------------ step 3: documents + complete registration
  function docOf(kind) {
    return ((v && v.documents) || []).filter((d) => d.kind === kind).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0] || null;
  }
  function slotHTML(meta) {
    return `<div class="doc-slot" id="slot-${meta.kind}" data-kind="${meta.kind}">
      <div class="ds-icon" aria-hidden="true">${meta.tag}</div>
      <div class="ds-body">
        <div class="ds-head"><h3 id="slot-${meta.kind}-title">${esc(meta.title)}</h3><span class="ds-state">Required</span></div>
        <p class="ds-why">${esc(meta.why)}</p>
        <div class="ds-file" hidden></div>
        <div class="ds-progress" hidden><div class="ds-bar"><span></span></div><span class="ds-progress-text" aria-live="polite"></span></div>
        <p class="ds-error" role="alert" hidden></p>
        <div class="ds-actions">
          <span class="btn btn-sm file-btn"><span class="ds-pick">Choose file</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-labelledby="slot-${meta.kind}-title"></span>
          <button type="button" class="btn btn-outline btn-sm ds-view" hidden>View file</button>
        </div>
        <p class="ds-formats">PDF, JPG or PNG, up to 5 MB. Stored privately.</p>
      </div>
    </div>`;
  }
  $('docSlots').innerHTML = DOCS.map(slotHTML).join('');

  function renderDocuments() {
    DOCS.forEach((meta) => {
      const slot = $('slot-' + meta.kind);
      const d = docOf(meta.kind);
      slot.classList.toggle('is-in', !!d);
      slot.querySelector('.ds-state').textContent = d ? 'Uploaded' : 'Required';
      const f = slot.querySelector('.ds-file');
      f.hidden = !d;
      if (d) f.innerHTML = `<strong>${esc(d.fileName)}</strong> <span>(${esc(LS.fmtSize(d.size))}, uploaded ${esc(LS.fmtDate(d.uploadedAt, true))})</span>`;
      slot.querySelector('.ds-pick').textContent = d ? 'Replace file' : 'Choose file';
      const view = slot.querySelector('.ds-view');
      view.hidden = !d;
      view.dataset.id = d ? d.id : '';
    });
    const missing = (v && v.missing) || [];
    const box = $('completeMissing');
    box.hidden = !missing.length;
    box.innerHTML = missing.length ? '<strong>To complete your registration, add:</strong><ul class="missing-list">' + missing.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul>' : '';
    $('btnComplete').disabled = missing.length > 0;
    $('btnComplete').querySelector('.lbl').textContent = registered() ? 'Send again for review' : 'Complete registration';
  }

  function phaseUi(prog, phase, pct, what) {
    const text = prog.querySelector('.ds-progress-text');
    const bar = prog.querySelector('.ds-bar span');
    prog.classList.toggle('is-processing', phase === 'processing');
    if (phase === 'uploading') {
      bar.style.width = (pct || 0) + '%';
      text.textContent = 'Uploading… ' + (pct || 0) + '%';
    } else {
      text.textContent = what === 'photo' ? 'Saving your photo…' : 'Saving the file securely…';
    }
  }

  $('docSlots').addEventListener('change', async (e) => {
    const input = e.target.closest('input[type="file"]');
    if (!input) return;
    const slot = input.closest('.doc-slot');
    const kind = slot.dataset.kind;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    const err = slot.querySelector('.ds-error');
    const prog = slot.querySelector('.ds-progress');
    err.hidden = true;
    slot.classList.remove('is-error');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const fail = (msg) => { err.textContent = msg; err.hidden = false; slot.classList.add('is-error'); };
    if (!DOC_EXT.includes(ext)) return fail('This file type is not supported. Upload a PDF, JPG or PNG.');
    if (file.size === 0) return fail('This file is empty. Choose another file.');
    if (file.size > DOC_MAX) return fail('This file is larger than 5 MB. Upload a smaller copy (for example a PDF from DigiLocker).');
    prog.hidden = false;
    input.disabled = true;
    busyUploads += 1;
    try {
      const res = await xhrUpload('/lawyer/verification/documents?kind=' + encodeURIComponent(kind), file, 'POST', (phase, pct) => phaseUi(prog, phase, pct));
      v = res.data.verification;
      prog.hidden = true;
      renderDocuments();
      renderRail();
      LS.toast(res.data.replaced ? 'File replaced.' : 'File uploaded securely.');
    } catch (ex) {
      prog.hidden = true;
      fail(ex.message || 'The upload failed. Please try again.');
    } finally {
      input.disabled = false;
      busyUploads -= 1;
    }
  });
  $('docSlots').addEventListener('click', async (e) => {
    const b = e.target.closest('.ds-view');
    if (!b || !b.dataset.id) return;
    try { await D.openPrivateFile('/lawyer/verification/documents/' + encodeURIComponent(b.dataset.id) + '/file'); } catch (ex) { LS.toast(ex.message); }
  });
  $('svConsent').addEventListener('change', () => $('f-svConsent').classList.remove('has-error'));

  $('formComplete').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busyUploads) { LS.toast('Please wait for the upload to finish.'); return; }
    if (!$('svConsent').checked) { $('f-svConsent').classList.add('has-error'); $('svConsent').focus(); return; }
    const wasRegistered = registered();
    const btn = $('btnComplete');
    const label = wasRegistered ? 'Send again for review' : 'Complete registration';
    setBusy(btn, true, wasRegistered ? 'Sending…' : 'Completing registration…');
    $('submitError').hidden = true;
    try {
      const res = await call('/lawyer/verification/submit', { method: 'POST', body: { consent: true } });
      v = res.data;
      setBusy(btn, false, label);
      if (wasRegistered) {
        LS.toast(res.message);
        window.location.href = 'lawyer-dashboard.html';
        return;
      }
      show('complete', { focus: true, fresh: true });
    } catch (err) {
      setBusy(btn, false, label);
      $('submitError').hidden = false;
      $('submitError').textContent = err.message;
      await loadVerification().then(() => renderDocuments()).catch(() => {});
    }
  });

  // ------------------------------------------------------------ step 4: registration complete
  let dashTimer = null;
  function renderComplete(fresh) {
    const d = (v && v.details) || {};
    $('cpMsg').textContent = 'Your dashboard is ready and your profile is now listed in Lawyer Connect, marked “Not yet reviewed by CASEONE”. Clients can send you requests after a basic CASEONE review.';
    $('cpListingText').textContent = SERVICE_TEXT[d.serviceType] || SERVICE_TEXT.paid;
    clearTimeout(dashTimer);
    let left = 3;
    const tick = () => {
      $('cpMeta').textContent = left > 0 ? 'Opening your dashboard in ' + left + ' second' + (left === 1 ? '' : 's') + '…' : 'Opening your dashboard…';
      if (left <= 0) { window.location.href = 'lawyer-dashboard.html'; return; }
      left -= 1;
      dashTimer = setTimeout(tick, 1000);
    };
    tick();
    if (fresh) LS.toast('Registration complete.');
  }
  $('btnDashboard').addEventListener('click', () => { clearTimeout(dashTimer); window.location.href = 'lawyer-dashboard.html'; });

  // ------------------------------------------------------------ start
  function route() {
    if (!v) return show('account');
    if (registered()) {
      // Registered lawyers belong on their dashboard; ?update=1 lets them edit
      // and resend when CASEONE asked for changes.
      if (updateMode && v.canEdit) return show(stepComplete('professional') ? 'documents' : 'professional');
      window.location.replace('lawyer-dashboard.html');
      return undefined;
    }
    return show(firstIncomplete());
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    updateMode = params.get('update') === '1';
    let ok = false;
    try { ok = await restoreSession(); } catch (e) { ok = false; }
    const user = getCurrentUser();
    if (ok && user && user.role !== 'lawyer') {
      $('clientSessionNote').hidden = false;
      $('formAccount').querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
      signedIn = false;
      show('account');
      return;
    }
    if (!(ok && user)) { show('account'); return; }
    signedIn = true;
    renderSession();
    try {
      await loadVerification();
    } catch (err) {
      $('loadingState').hidden = true;
      alertBox('Could not load your registration: ' + err.message, true);
      return;
    }
    route();
  }

  window.addEventListener('beforeunload', (e) => {
    if (busyUploads > 0) { e.preventDefault(); e.returnValue = ''; }
  });

  init();
})();
