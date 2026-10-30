/**
 * free-legal-assistance.js — CASEONE volunteer free legal assistance.
 *
 * Journey: Basic Details → Upload Documents → Application Review (admin)
 *          → Free Lawyer Directory → Free Consultation Request.
 *
 *   signed out            → short explanation + sign in / create account
 *   no application        → step 1 Basic Details (prefilled from the account)
 *   draft                 → step 2 Upload Documents, then step 3 Review & submit
 *   income at/above limit → CASEONE criterion not met + Find a Paid Lawyer
 *   submitted / review    → Pending Review (no directory access)
 *   more info required    → reviewer's message, replace documents, send back
 *   rejected / withdrawn  → reason, apply again
 *   approved              → Free Lawyer Directory (reviewed lawyers) + requests
 *
 * Messages here are preliminary. Every rule (income, required documents,
 * approval, directory access) is enforced by the backend; eligibility is
 * decided by an authorised CASEONE admin.
 */
(function () {
  const { esc, fmtDate, fmtSize, inr, toast, DOC_LABELS, openModal } = window.LS;
  const D = window.LegalLensLawyerData;
  const root = document.getElementById('aidApp');
  const PRACTICE_AREAS = ['Criminal Law', 'Property Law', 'Family Law', 'Civil Law', 'Consumer Law', 'Cyber Law', 'Employment Law', 'Business / Corporate Law', 'Banking / Finance', 'Tenant / Rental Disputes'];
  const OLD_DOC_KINDS = ['income_certificate', 'ration_card', 'category_proof', 'identity_proof', 'other'];
  const FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png'];
  const DOCS = {
    aadhaar_card: { title: 'Masked Aadhaar Card', hint: 'Only the last 4 digits visible. Download the masked Aadhaar from the UIDAI website.' },
    pan_card: { title: 'PAN Card', hint: '' },
    income_certificate: { title: 'Income Certificate', hint: '' },
    ration_card: { title: 'Ration Card', hint: '' }
  };
  const STATUS_LABEL = {
    draft: 'Not submitted',
    submitted: 'Pending Review',
    under_review: 'Under Review',
    more_info_required: 'More Information Needed',
    approved: 'Approved',
    rejected: 'Not Approved',
    withdrawn: 'Withdrawn'
  };
  const URGENT_REASONS = [
    ['court_date_soon', 'Court hearing within days'],
    ['arrest_or_detention', 'Arrest or detention'],
    ['domestic_violence', 'Domestic violence or threat to safety'],
    ['eviction_or_demolition', 'Eviction or demolition'],
    ['other', 'Other urgent situation']
  ];
  // Official help that does not depend on CASEONE (no promise of a CASEONE lawyer).
  const URGENT_HELP = 'For immediate help, call NALSA legal aid 15100, police 112, women helpline 181 or Childline 1098. CASEONE reviews urgent applications first but cannot guarantee that a volunteer lawyer will be available.';
  const wantedLawyer = new URLSearchParams(location.search).get('lawyer');

  let policy = null;
  let user = null;
  let app = null;
  let step = 1; // 1 details · 2 documents · 3 review (draft only)
  let editingDetails = false;
  let typedDetails = null; // kept when the income check sends the client back to edit
  const uploading = {}; // kind -> true while a file is being uploaded

  const limit = () => (policy && policy.incomeGuidelineInr) || 250000;
  const maxMb = () => (policy && policy.maxFileMb) || 5;

  function api(path, opts) {
    return window.apiRequest(path, Object.assign({ useAuth: true }, opts || {})).catch(async (err) => {
      if (err.statusCode === 401 && await window.refreshSession()) return window.apiRequest(path, Object.assign({ useAuth: true }, opts || {}));
      throw err;
    });
  }
  const errCode = (err) => (err && err.details && err.details.code) || '';

  function errorState(message) {
    root.innerHTML = `<div class="ls-state" role="alert"><h3>Something went wrong</h3><p>${esc(message)}</p><button class="ls-btn ls-btn-outline" type="button" id="retryBtn">Try again</button></div>`;
    document.getElementById('retryBtn').addEventListener('click', init);
  }

  function steps(current) {
    const names = ['Basic Details', 'Upload Documents', 'Application Review'];
    return `<ol class="fla-steps" aria-label="Application progress">${names.map((n, i) => {
      const cls = i + 1 < current ? 'done' : i + 1 === current ? 'current' : '';
      return `<li class="${cls}"${i + 1 === current ? ' aria-current="step"' : ''}><span>${esc(n)}</span></li>`;
    }).join('')}</ol><p class="fla-after">After approval, you can use the Free Lawyer Directory.</p>`;
  }

  // ------------------------------------------------------------ signed out / wrong role
  function renderSignedOut() {
    root.innerHTML = `${steps(0)}
      <div class="ls-card">
        <h2 class="fla-h2">Sign in to apply</h2>
        <p class="fla-sub">You need a CASEONE client account. Your details and documents stay private.</p>
        <div class="ls-actions" style="margin-top:0">
          <button class="ls-btn" type="button" id="signInBtn">Sign in</button>
          <a class="ls-btn ls-btn-outline" href="signup.html" id="signUpLink">Create account</a>
        </div>
      </div>`;
    const back = 'free-legal-assistance.html' + (wantedLawyer ? '?lawyer=' + encodeURIComponent(wantedLawyer) : '');
    document.getElementById('signInBtn').addEventListener('click', () => window.LS.goToLogin(back));
    document.getElementById('signUpLink').addEventListener('click', () => { try { sessionStorage.setItem('postLoginRedirect', back); } catch (e) { /* storage blocked */ } });
  }

  function renderWrongRole() {
    root.innerHTML = `<div class="ls-state"><h3>Free Legal Assistance is for clients</h3><p>You are signed in with a ${esc(user.role)} account. Please sign in with a client account to apply.</p>
      <div class="ls-actions" style="justify-content:center">${user.role === 'lawyer' ? '<a class="ls-btn" href="lawyer-dashboard.html">Go to your dashboard</a>' : ''}<button class="ls-btn ls-btn-outline" type="button" id="logoutBtn">Sign out</button></div></div>`;
    document.getElementById('logoutBtn').addEventListener('click', () => window.logoutUser());
  }

  // ------------------------------------------------------------ step 1: basic details
  function detailsSource() {
    if (typedDetails) return typedDetails;
    if (app && (app.formVersion || 1) >= 2 && ['draft', 'more_info_required'].includes(app.status)) return app;
    // Prefill from the signed-in account (name, mobile) — nothing is asked twice.
    return { fullName: user.name || '', mobile: user.phone || '' };
  }

  function field(id, label, input, hint) {
    return `<div class="ls-field"><label for="${id}">${label}</label>${input}${hint ? `<div class="ls-hint">${hint}</div>` : ''}<div class="fla-err" id="${id}Err" hidden></div></div>`;
  }

  function renderDetails() {
    const v = detailsSource();
    const val = (k) => esc(v[k] != null ? v[k] : '');
    root.innerHTML = `${steps(1)}
      <div class="ls-card">
        <h2 class="fla-h2">Basic Details</h2>
        <p class="fla-sub">All fields are required.</p>
        <div class="ls-alert" id="formError" role="alert" hidden></div>
        <form id="detailsForm" novalidate>
          ${field('fullName', 'Full Name', `<input class="ls-input" id="fullName" maxlength="100" autocomplete="name" value="${val('fullName')}">`)}
          <div class="ls-field-row">
            ${field('age', 'Age', `<input class="ls-input" id="age" type="number" inputmode="numeric" min="18" max="120" value="${val('age')}">`)}
            ${field('mobile', 'Mobile Number', `<input class="ls-input" id="mobile" type="tel" inputmode="tel" maxlength="15" autocomplete="tel" placeholder="10-digit mobile number" value="${val('mobile')}">`)}
          </div>
          ${field('address', 'Address', `<input class="ls-input" id="address" maxlength="300" autocomplete="street-address" value="${val('address')}">`)}
          <div class="ls-field-row">
            ${field('city', 'City', `<input class="ls-input" id="city" maxlength="80" autocomplete="address-level2" value="${val('city')}">`)}
            ${field('state', 'State', `<input class="ls-input" id="state" maxlength="80" autocomplete="address-level1" value="${val('state')}">`)}
          </div>
          <div class="ls-field-row">
            ${field('householdSize', 'Number of Family Members', `<input class="ls-input" id="householdSize" type="number" inputmode="numeric" min="1" max="30" value="${val('householdSize')}">`)}
            ${field('income', 'Annual Household Income (₹)', `<input class="ls-input" id="income" type="number" inputmode="numeric" min="0" step="1" value="${esc(v.annualHouseholdIncome != null ? v.annualHouseholdIncome : '')}">`, 'Total yearly income of all family members.')}
          </div>
          ${field('summary', 'Brief Description of Legal Problem', `<textarea class="ls-textarea" id="summary" maxlength="1000">${val('matterSummary')}</textarea>`, '20–1000 characters. Do not include ID numbers or passwords.')}
          <div class="ls-actions">
            <button class="ls-btn" type="submit" id="detailsBtn">Save and continue</button>
            ${editingDetails ? '<button class="ls-btn ls-btn-outline" type="button" id="cancelEdit">Cancel</button>' : ''}
          </div>
        </form>
      </div>`;
    document.getElementById('detailsForm').addEventListener('submit', (e) => { e.preventDefault(); saveDetails(); });
    const c = document.getElementById('cancelEdit');
    if (c) c.addEventListener('click', () => { editingDetails = false; render(); });
  }

  function readDetails() {
    const t = (id) => document.getElementById(id).value.trim();
    const n = (id) => (t(id) === '' ? null : Number(t(id)));
    return {
      fullName: t('fullName'),
      age: n('age'),
      mobile: t('mobile'),
      address: t('address'),
      city: t('city'),
      state: t('state'),
      householdSize: n('householdSize'),
      annualHouseholdIncome: n('income'),
      matterSummary: t('summary')
    };
  }

  function normaliseMobile(m) {
    let d = String(m || '').replace(/[\s()-]/g, '');
    if (d.startsWith('+91')) d = d.slice(3);
    else if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return d;
  }

  function validateDetails(d) {
    const errors = {};
    if (!/^[\p{L}][\p{L}\p{M} .'-]{1,99}$/u.test(d.fullName)) errors.fullName = 'Please enter your full name (letters only).';
    if (!Number.isInteger(d.age) || d.age < 18 || d.age > 120) errors.age = 'Age must be between 18 and 120. A parent or guardian can apply for a child.';
    if (!/^[6-9]\d{9}$/.test(normaliseMobile(d.mobile))) errors.mobile = 'Please enter a valid 10-digit Indian mobile number.';
    if (d.address.length < 5) errors.address = 'Please enter your address.';
    if (d.city.length < 2) errors.city = 'Please enter your city.';
    if (d.state.length < 2) errors.state = 'Please enter your state.';
    if (!Number.isInteger(d.householdSize) || d.householdSize < 1 || d.householdSize > 30) errors.householdSize = 'Enter a number between 1 and 30.';
    if (!Number.isInteger(d.annualHouseholdIncome) || d.annualHouseholdIncome < 0) errors.income = 'Enter your annual household income in whole rupees.';
    if (d.matterSummary.length < 20) errors.summary = 'Please describe your problem in at least 20 characters.';
    return errors;
  }

  function showErrors(errors) {
    root.querySelectorAll('.fla-err').forEach((el) => { el.hidden = true; el.textContent = ''; });
    root.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const keys = Object.keys(errors);
    keys.forEach((k) => {
      const el = document.getElementById(k);
      const box = document.getElementById(k + 'Err');
      if (el) { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', k + 'Err'); }
      if (box) { box.textContent = errors[k]; box.hidden = false; }
    });
    if (keys.length) document.getElementById(keys[0]).focus();
    return keys.length === 0;
  }

  async function saveDetails() {
    const d = readDetails();
    if (!showErrors(validateDetails(d))) return;
    d.mobile = normaliseMobile(d.mobile);
    // Preliminary check only; the server applies the same rule.
    typedDetails = d;
    if (d.annualHouseholdIncome >= limit()) return renderAboveLimit(d.annualHouseholdIncome);
    const btn = document.getElementById('detailsBtn');
    const box = document.getElementById('formError');
    box.hidden = true;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const existing = app && ['draft', 'more_info_required'].includes(app.status) && (app.formVersion || 1) >= 2;
      const res = await api('/free-aid/application', { method: existing ? 'PUT' : 'POST', body: d });
      app = res.data.application;
      editingDetails = false;
      typedDetails = null;
      step = 2;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Save and continue';
      if (errCode(err) === 'INCOME_ABOVE_LIMIT') return renderAboveLimit(d.annualHouseholdIncome);
      const list = err.details && Array.isArray(err.details.errors) ? err.details.errors.map((x) => x.msg || x.message || x).filter(Boolean) : [];
      box.textContent = list.length ? list.join(' ') : (err.message || 'Could not save. Please try again.');
      box.hidden = false;
    }
  }

  // ------------------------------------------------------------ income at or above the criterion
  function renderAboveLimit(income) {
    root.innerHTML = `
      <div class="ls-card">
        <h2 class="fla-h2">You do not meet the income criterion of this program</h2>
        <p class="fla-sub">CASEONE's volunteer Free Legal Assistance is for households with an annual income below ${esc(inr(limit()))}. You entered ${esc(inr(income))}. Your application was not submitted.</p>
        <p class="fla-sub">This applies only to CASEONE's volunteer program. Government legal aid has its own eligibility rules — you can check with your Legal Services Authority (<a href="https://nalsa.gov.in/" target="_blank" rel="noopener noreferrer">nalsa.gov.in</a>, helpline 15100).</p>
        <div class="ls-actions" style="margin-top:0">
          <a class="ls-btn" href="find-a-lawyer.html" id="paidLawyerBtn">Find a Paid Lawyer</a>
          <button class="ls-btn ls-btn-outline" type="button" id="editIncomeBtn">Edit my details</button>
        </div>
      </div>`;
    document.getElementById('editIncomeBtn').addEventListener('click', () => { editingDetails = !!app; renderDetails(); });
  }

  // ------------------------------------------------------------ step 2: documents
  function docsOf(kind) {
    return (app.documents || []).filter((d) => d.kind === kind);
  }

  function docRow(kind, editable) {
    const doc = docsOf(kind).slice(-1)[0];
    const meta = DOCS[kind];
    let status;
    if (uploading[kind]) status = '<div class="fla-doc-status">Uploading…</div>';
    else if (doc) {
      const flags = (doc.automation && doc.automation.flags) || [];
      status = `<div class="fla-doc-status ok">Uploaded · ${esc(doc.fileName)} · ${esc(fmtSize(doc.size))}</div>${flags.map((f) => `<div class="fla-doc-status bad">${esc(f)}</div>`).join('')}`;
    } else status = '<div class="fla-doc-status">Not uploaded</div>';
    const actions = [];
    if (doc) actions.push(`<button class="ls-btn ls-btn-ghost ls-btn-sm" type="button" data-view-doc="${esc(doc.id)}">View</button>`);
    if (editable) {
      actions.push(`<label class="ls-btn ls-btn-outline ls-btn-sm" for="file_${kind}">${doc ? 'Replace' : 'Choose file'}</label><input class="fla-file" type="file" id="file_${kind}" data-kind="${kind}" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"${uploading[kind] ? ' disabled' : ''}>`);
      if (doc) actions.push(`<button class="ls-btn ls-btn-ghost ls-btn-sm" type="button" data-del-doc="${esc(doc.id)}">Remove</button>`);
    }
    return `<li class="fla-doc" id="row_${kind}"><div style="min-width:0"><div class="fla-doc-title">${esc(meta.title)}</div>${meta.hint && editable ? `<div class="ls-hint" style="margin-top:2px">${esc(meta.hint)}</div>` : ''}${status}</div><div class="fla-doc-actions">${actions.join('')}</div></li>`;
  }

  function docsList(editable) {
    if (!editable) {
      // Read-only (pending review): just the files that were submitted.
      const kinds = ['aadhaar_card', 'pan_card', 'income_certificate', 'ration_card'].filter((k) => docsOf(k).length);
      return `<ul class="fla-docs">${kinds.map((k) => docRow(k, false)).join('')}</ul>`;
    }
    return `<ul class="fla-docs">
        ${docRow('aadhaar_card', editable)}
        ${docRow('pan_card', editable)}
      </ul>
      <p class="fla-or">And at least one of these</p>
      <ul class="fla-docs" style="border-top:0">
        ${docRow('income_certificate', editable)}
        ${docRow('ration_card', editable)}
      </ul>
      <p class="ls-hint">PDF, JPG or PNG, up to ${esc(maxMb())} MB each. Stored privately; only authorised CASEONE reviewers can open them.</p>`;
  }

  const docCheck = () => app.documentCheck || { complete: false, missing: [] };

  function renderDocuments() {
    const ok = docCheck().complete;
    root.innerHTML = `${steps(2)}
      <div class="ls-card">
        <h2 class="fla-h2">Upload Documents</h2>
        <p class="fla-sub">Masked Aadhaar and PAN are required, plus your Income Certificate <strong>or</strong> Ration Card.</p>
        <div class="ls-alert" id="docError" role="alert" hidden></div>
        ${docsList(true)}
        ${officialBlock()}
        <div class="ls-actions">
          <button class="ls-btn" type="button" id="toReviewBtn"${ok ? '' : ' disabled aria-disabled="true"'}>Continue</button>
          <button class="ls-btn ls-btn-outline" type="button" id="editDetailsBtn">Edit details</button>
        </div>
        ${ok ? '' : `<p class="ls-hint" id="missingHint">${esc(missingText(docCheck().missing))}</p>`}
      </div>`;
    wireDocs();
    document.getElementById('toReviewBtn').addEventListener('click', () => { if (docCheck().complete) { step = 3; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    document.getElementById('editDetailsBtn').addEventListener('click', () => { editingDetails = true; render(); });
  }

  function missingText(missing) {
    const names = { aadhaar_card: 'Masked Aadhaar Card', pan_card: 'PAN Card', income_certificate_or_ration_card: 'Income Certificate or Ration Card' };
    return missing && missing.length ? 'Still needed: ' + missing.map((m) => names[m] || m).join(', ') + '.' : '';
  }

  // Optional official verification (shown only when CASEONE has DigiLocker access).
  function officialBlock() {
    const o = app && app.officialVerification;
    if (!o || (!o.available && !o.verified)) return '';
    if (o.verified) {
      return `<div class="ls-note" id="dlBlock" style="margin-top:18px"><strong>DigiLocker check completed</strong> on ${esc(fmtDate(o.verifiedAt))}.${o.panFound ? ' PAN card document found.' : ''} A CASEONE reviewer still checks your application. <button class="ls-btn ls-btn-ghost ls-btn-sm" type="button" id="dlRemove">Remove</button></div>`;
    }
    return `<div class="ls-note" id="dlBlock" style="margin-top:18px"><strong>Optional:</strong> verify your identity with DigiLocker for a faster review. You sign in on DigiLocker and choose what to share; CASEONE does not see your DigiLocker password. <div class="ls-actions" style="margin-top:10px"><button class="ls-btn ls-btn-outline ls-btn-sm" type="button" id="dlStart">Verify with DigiLocker</button></div></div>`;
  }

  function wireOfficial() {
    const st = document.getElementById('dlStart');
    if (st) st.addEventListener('click', async () => {
      st.disabled = true;
      try {
        const r = await api('/free-aid/verification/digilocker/start', { method: 'POST' });
        window.location.href = r.data.redirectUrl;
      } catch (e) { st.disabled = false; toast(e.message); }
    });
    const rm = document.getElementById('dlRemove');
    if (rm) rm.addEventListener('click', async () => {
      if (!window.confirm('Remove your DigiLocker verification? Your application will be reviewed by a CASEONE admin.')) return;
      rm.disabled = true;
      try {
        const r = await api('/free-aid/verification', { method: 'DELETE' });
        toast(r.message);
        app = (await api('/free-aid/application')).data.application;
        render();
      } catch (e) { rm.disabled = false; toast(e.message); }
    });
  }

  function wireDocs() {
    wireOfficial();
    root.querySelectorAll('[data-view-doc]').forEach((b) => b.addEventListener('click', () => {
      D.openPrivateFile('/free-aid/application/documents/' + encodeURIComponent(b.dataset.viewDoc) + '/file').catch((e) => toast(e.message));
    }));
    root.querySelectorAll('[data-del-doc]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('Remove this document? It will be deleted from CASEONE storage.')) return;
      b.disabled = true;
      try {
        const res = await api('/free-aid/application/documents/' + encodeURIComponent(b.dataset.delDoc), { method: 'DELETE' });
        app = res.data.application;
        toast('Document removed.');
        render();
      } catch (e) { b.disabled = false; toast(e.message); }
    }));
    root.querySelectorAll('input[type="file"][data-kind]').forEach((input) => input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) uploadDoc(input.dataset.kind, file);
    }));
  }

  function docError(msg) {
    const box = document.getElementById('docError');
    if (box) { box.textContent = msg; box.hidden = false; } else toast(msg);
  }

  /** Correction instructions returned by the server (fixable document problems). */
  function docProblems(problems) {
    const box = document.getElementById('docError');
    if (!box) return toast(problems.map((p) => p.message).join(' '));
    box.innerHTML = `<strong>Please correct these documents, then submit again:</strong><ul style="margin:8px 0 0;padding-left:18px">${problems.map((p) => `<li>${esc(p.message)}</li>`).join('')}</ul>`;
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function uploadDoc(kind, file) {
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1];
    if (!ext || !FILE_TYPES.includes(ext.toLowerCase())) return docError('Please choose a PDF, JPG, JPEG or PNG file.');
    if (file.size > maxMb() * 1024 * 1024) return docError(`This file is larger than ${maxMb()} MB.`);
    if (file.size === 0) return docError('This file is empty.');
    uploading[kind] = true;
    render();
    try {
      const res = await D.uploadPrivateFile('/free-aid/application/documents?kind=' + encodeURIComponent(kind), file);
      app = res.data.application;
      uploading[kind] = false;
      render();
      toast(res.message || 'Document uploaded.');
    } catch (err) {
      uploading[kind] = false;
      render();
      docError(err.message || 'Upload failed. Please try again.');
    }
  }

  // ------------------------------------------------------------ step 3: review and submit
  function summary() {
    const rows = [
      ['Full Name', app.fullName], ['Age', app.age], ['Mobile Number', app.mobile], ['Address', app.address],
      ['City and State', [app.city, app.state].filter(Boolean).join(', ')], ['Family Members', app.householdSize],
      ['Annual Household Income', app.annualHouseholdIncome != null ? inr(app.annualHouseholdIncome) : ''], ['Legal Problem', app.matterSummary]
    ];
    return `<dl class="fla-summary">${rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${esc(r[1] != null ? r[1] : '')}</dd>`).join('')}</dl>`;
  }

  function renderReview() {
    const docs = ['aadhaar_card', 'pan_card', 'income_certificate', 'ration_card'].map((k) => docsOf(k).slice(-1)[0]).filter(Boolean);
    root.innerHTML = `${steps(3)}
      <div class="ls-card">
        <h2 class="fla-h2">Application Review</h2>
        <p class="fla-sub">Check your details before submitting.</p>
        ${summary()}
        <h3 style="font-size:14px;margin:0 0 8px">Documents</h3>
        <ul class="ls-list" style="margin-bottom:20px">${docs.map((d) => `<li>${esc(DOCS[d.kind].title)} — ${esc(d.fileName)}</li>`).join('')}</ul>
        <div class="ls-alert" id="submitError" role="alert" hidden></div>
        <label class="ls-check" style="margin-bottom:12px"><input type="checkbox" id="urgent"><span>This is urgent</span></label>
        <div id="urgentBox" hidden style="margin:0 0 16px 26px">
          <div class="ls-field" style="margin-bottom:8px"><label for="urgentReason">What is happening?</label><select class="ls-select" id="urgentReason">${URGENT_REASONS.map((r) => `<option value="${r[0]}">${esc(r[1])}</option>`).join('')}</select></div>
          <p class="ls-hint" id="urgentHelp" style="margin:0">${esc(URGENT_HELP)}</p>
        </div>
        <label class="ls-check"><input type="checkbox" id="declaration"><span>I confirm that these details are true. I understand that this is a CASEONE volunteer program, not government legal aid, and that an authorised CASEONE reviewer will check my documents.</span></label>
        <div class="fla-err" id="declarationErr" hidden>Please tick the box to submit.</div>
        <div class="ls-actions">
          <button class="ls-btn" type="button" id="submitBtn">Submit application</button>
          <button class="ls-btn ls-btn-outline" type="button" id="backToDocs">Back</button>
        </div>
      </div>`;
    document.getElementById('backToDocs').addEventListener('click', () => { step = 2; render(); });
    document.getElementById('submitBtn').addEventListener('click', submit);
    document.getElementById('urgent').addEventListener('change', (e) => { document.getElementById('urgentBox').hidden = !e.target.checked; });
  }

  async function submit() {
    const decl = document.getElementById('declaration');
    const declErr = document.getElementById('declarationErr');
    if (!decl.checked) { declErr.hidden = false; decl.focus(); return; }
    declErr.hidden = true;
    const btn = document.getElementById('submitBtn');
    const box = document.getElementById('submitError');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const body = { declaration: true };
      if (document.getElementById('urgent').checked) { body.urgent = true; body.urgentReason = document.getElementById('urgentReason').value; }
      const res = await api('/free-aid/application/submit', { method: 'POST', body });
      app = res.data.application;
      step = 1;
      render(res.message || 'Application submitted successfully. Your documents are under review.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Submit application';
      if (errCode(err) === 'INCOME_ABOVE_LIMIT') return renderAboveLimit(app.annualHouseholdIncome);
      if (errCode(err) === 'DOCUMENTS_MISSING') { step = 2; render(); return docError(err.message); }
      if (errCode(err) === 'DOCUMENTS_NEED_CORRECTION') {
        const d = err.details.data || {};
        if (d.application) app = d.application;
        step = 2; render();
        return docProblems(d.problems || []);
      }
      box.textContent = err.message || 'Could not submit. Please try again.';
      box.hidden = false;
    }
  }

  // ------------------------------------------------------------ status after submission
  function badge(status) {
    const solid = status === 'approved';
    const muted = status === 'rejected' || status === 'withdrawn';
    return `<span class="ls-badge${solid ? ' ls-badge-solid' : muted ? ' ls-badge-muted' : ' ls-badge-dashed'}" id="aidStatus">${esc(STATUS_LABEL[status] || status)}</span>`;
  }

  function oldDocsCard() {
    // Older applications (before the simplified form): documents as they were.
    const docs = app.documents || [];
    const list = docs.length
      ? `<ul class="ls-docs">${docs.map((d) => `<li class="ls-doc"><div style="min-width:0"><div class="ls-doc-name">${esc(DOC_LABELS[d.kind] || d.kind)}</div><div class="ls-doc-meta">${esc(d.fileName)} · ${esc(fmtSize(d.size))}</div></div>
          <div class="ls-doc-actions"><button class="ls-btn ls-btn-outline ls-btn-sm" type="button" data-view-doc="${esc(d.id)}">View</button>${app.canEdit ? `<button class="ls-btn ls-btn-ghost ls-btn-sm" type="button" data-del-doc="${esc(d.id)}">Remove</button>` : ''}</div></li>`).join('')}</ul>`
      : '<p class="ls-hint">No documents.</p>';
    const uploader = app.canEdit ? `
      <div class="ls-upload-row" style="margin-top:14px">
        <div class="ls-field" style="margin:0"><label for="oldKind">Document type</label><select class="ls-select" id="oldKind">${OLD_DOC_KINDS.map((k) => `<option value="${k}">${esc(DOC_LABELS[k] || k)}</option>`).join('')}</select></div>
        <div class="ls-field" style="margin:0"><label for="oldFile">File</label><input class="ls-input" id="oldFile" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></div>
      </div>` : '';
    return `<h3 style="font-size:14px;margin:22px 0 10px">Documents</h3><div class="ls-alert" id="docError" role="alert" hidden></div>${list}${uploader}`;
  }

  function renderStatus(flash) {
    const s = app.status;
    const v2 = (app.formVersion || 1) >= 2;
    let message = '';
    let actions = '';
    let docs = '';
    if (s === 'submitted' || s === 'under_review') {
      message = `<p class="fla-sub">${s === 'submitted' ? 'Your documents are under review. A CASEONE admin will check your application.' : 'A CASEONE admin is reviewing your application.'} The Free Lawyer Directory opens after approval.</p>`;
      if (app.urgent && app.urgent.isUrgent) message += `<div class="ls-alert" role="note" id="urgentNote" style="margin-bottom:6px"><strong>Marked urgent.</strong> ${esc(URGENT_HELP)}</div>`;
      actions = '<button class="ls-btn ls-btn-outline" type="button" id="withdrawBtn">Withdraw application</button>';
      docs = v2 ? `<h3 style="font-size:14px;margin:22px 0 0">Documents</h3>${docsList(false)}${officialBlock()}` : oldDocsCard();
    }
    if (s === 'more_info_required') {
      message = `<div class="ls-alert ls-alert-strong" role="status"><strong>The reviewer asked:</strong><br>${esc(app.decisionReason)}</div>`;
      docs = (v2 ? `<div class="ls-alert" id="docError" role="alert" hidden style="margin-top:18px"></div><h3 style="font-size:14px;margin:22px 0 0">Documents</h3>${docsList(true)}` : oldDocsCard()) +
        `<div class="ls-field" style="margin-top:18px"><label for="resubmitNote">Your reply <span class="fla-req">(optional)</span></label><textarea class="ls-textarea" id="resubmitNote" maxlength="1000" placeholder="Explain what you have added or changed."></textarea></div>`;
      actions = `<button class="ls-btn" type="button" id="resubmitBtn">Send back for review</button>${v2 ? '<button class="ls-btn ls-btn-outline" type="button" id="editDetailsBtn">Edit details</button>' : ''}<button class="ls-btn ls-btn-ghost" type="button" id="withdrawBtn">Withdraw</button>`;
    }
    if (s === 'rejected') {
      message = `<div class="ls-alert" role="status"><strong>Reason:</strong> ${esc(app.decisionReason || 'Not given')}</div>
        <p class="fla-sub" style="margin-top:14px">You can apply again if your situation changes, consult a paid lawyer, or contact your <a href="https://nalsa.gov.in/" target="_blank" rel="noopener noreferrer">Legal Services Authority</a> for government legal aid.</p>`;
      actions = '<a class="ls-btn" href="find-a-lawyer.html">Find a Paid Lawyer</a><button class="ls-btn ls-btn-outline" type="button" id="reapplyBtn">Apply again</button>';
    }
    if (s === 'withdrawn' || (s === 'approved' && !app.approvedAndValid)) {
      message = s === 'withdrawn' ? '<p class="fla-sub">You withdrew this application.</p>' : '<p class="fla-sub">Your approval period has ended. You can apply again.</p>';
      actions = '<button class="ls-btn" type="button" id="reapplyBtn">Apply again</button>';
    }
    const shownStep = ['submitted', 'under_review', 'more_info_required'].includes(s) ? 3 : 0;
    root.innerHTML = `${shownStep ? steps(3) : ''}
      ${flash ? `<div class="ls-alert ls-alert-strong" role="status" id="aidFlash" style="margin-bottom:18px">${esc(flash)}</div>` : ''}
      <div class="ls-card">
        <div class="fla-status"><div><h2 class="fla-h2" style="margin:0">Your application</h2><div class="ls-hint" style="margin-top:2px">Submitted ${esc(fmtDate(app.submittedAt || app.createdAt))}</div></div>${badge(s)}</div>
        ${message}
        ${docs}
        ${actions ? `<div class="ls-actions">${actions}</div>` : ''}
      </div>`;
    wireDocs();
    wireOldUploader();
    const w = document.getElementById('withdrawBtn');
    if (w) w.addEventListener('click', async () => {
      if (!window.confirm('Withdraw your application? You can apply again later.')) return;
      w.disabled = true;
      try { app = (await api('/free-aid/application/withdraw', { method: 'POST' })).data.application; toast('Application withdrawn.'); render(); } catch (e) { w.disabled = false; toast(e.message); }
    });
    const r = document.getElementById('resubmitBtn');
    if (r) r.addEventListener('click', async () => {
      r.disabled = true;
      try {
        app = (await api('/free-aid/application/resubmit', { method: 'POST', body: { note: document.getElementById('resubmitNote').value.trim() } })).data.application;
        render('Thank you. Your application is back with the review team.');
      } catch (e) { r.disabled = false; docError(e.message); }
    });
    const ed = document.getElementById('editDetailsBtn');
    if (ed) ed.addEventListener('click', () => { editingDetails = true; renderDetails(); });
    const ra = document.getElementById('reapplyBtn');
    if (ra) ra.addEventListener('click', () => { app = null; step = 1; renderDetails(); });
  }

  function wireOldUploader() {
    const f = document.getElementById('oldFile');
    if (!f) return;
    f.addEventListener('change', async () => {
      const file = f.files[0];
      if (!file) return;
      if (file.size > maxMb() * 1024 * 1024) return docError(`This file is larger than ${maxMb()} MB.`);
      try {
        const res = await D.uploadPrivateFile('/free-aid/application/documents?kind=' + encodeURIComponent(document.getElementById('oldKind').value), file);
        app = res.data.application;
        render();
        toast(res.message || 'Document uploaded.');
      } catch (err) { docError(err.message); }
    });
  }

  // ------------------------------------------------------------ approved: Free Lawyer Directory
  let freeLawyers = [];
  let selectedLawyer = null;

  function avatar(l) {
    const src = D.photoSrc(l);
    const ini = esc(D.initials(l.name));
    return `<span class="ls-avatar">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.parentNode.textContent='${ini}'">` : ini}</span>`;
  }

  function renderApproved() {
    root.innerHTML = `
      <div class="ls-card ls-card-dark">
        <div class="fla-status"><h2 class="fla-h2" style="margin:0">Your application is approved</h2><span class="ls-badge" style="border-color:#fff" id="aidStatus">Approved</span></div>
        <p style="margin:0;font-size:14px">Valid until ${esc(fmtDate(app.approvalExpiresAt))}. Choose a lawyer below and request a free consultation (₹0).</p>
      </div>
      <section style="margin-top:32px" aria-labelledby="flTitle">
        <h2 class="fla-h2" id="flTitle">Free Lawyer Directory</h2>
        <p class="fla-sub">Lawyers reviewed by CASEONE who offer free consultations. A request is confirmed only when the lawyer accepts it.</p>
        <form class="fla-filters" id="flFilters" role="search">
          <div class="ls-field" style="margin:0"><label for="flArea">Practice area</label><select class="ls-select" id="flArea"><option value="">All areas</option>${PRACTICE_AREAS.map((a) => `<option>${esc(a)}</option>`).join('')}</select></div>
          <div class="ls-field" style="margin:0"><label for="flCity">City</label><input class="ls-input" id="flCity" placeholder="e.g. Pune" maxlength="80"></div>
        </form>
        <div id="flList"><div class="ls-skeleton"></div></div>
      </section>`;
    const reload = () => loadFreeLawyers();
    document.getElementById('flArea').addEventListener('change', reload);
    let t = null;
    document.getElementById('flCity').addEventListener('input', () => { clearTimeout(t); t = setTimeout(reload, 350); });
    document.getElementById('flFilters').addEventListener('submit', (e) => { e.preventDefault(); reload(); });
    loadFreeLawyers().then(() => {
      if (wantedLawyer) {
        const l = freeLawyers.find((x) => x.id === wantedLawyer);
        if (l) openRequest(l);
      }
    });
  }

  async function loadFreeLawyers() {
    const list = document.getElementById('flList');
    list.innerHTML = '<div class="ls-skeleton"></div>';
    try {
      freeLawyers = await D.getFreeLawyers({ area: document.getElementById('flArea').value, city: document.getElementById('flCity').value.trim() });
    } catch (err) {
      list.innerHTML = `<div class="ls-state" role="alert"><h3>Could not load lawyers</h3><p>${esc(err.message)}</p></div>`;
      return;
    }
    if (!freeLawyers.length) {
      const filtered = document.getElementById('flArea').value || document.getElementById('flCity').value.trim();
      list.innerHTML = filtered
        ? '<div class="ls-state"><h3>No lawyers match these filters</h3><p>Try another practice area or city.</p></div>'
        : '<div class="ls-state"><h3>No reviewed lawyers offer free consultations yet</h3><p>Please check back soon. For government legal aid, call 15100.</p></div>';
      return;
    }
    list.innerHTML = `<div class="ls-lawyers">${freeLawyers.map((l) => `
      <article class="ls-lawyer" data-lawyer-card="${esc(l.id)}">
        <div class="ls-lawyer-top">${avatar(l)}<div><h3>${esc(l.name)}</h3><div class="ls-meta">${esc(l.location || '')}</div></div></div>
        <div class="ls-meta">${esc((l.practiceAreas || []).join(' · '))}</div>
        ${l.experience || l.stateBarCouncil ? `<div class="ls-meta">${esc([l.experience ? l.experience + ' yrs experience' : '', l.stateBarCouncil].filter(Boolean).join(' · '))}</div>` : ''}
        <div class="ls-meta"><strong>${esc(D.verificationLabel(l))}</strong></div>
        <div class="ls-fee-row"><span>Free consultation</span><strong>₹0</strong></div>
        <div class="ls-actions" style="margin-top:4px">${l.requestsOpen ? `<button class="ls-btn ls-btn-sm" type="button" data-req="${esc(l.id)}">Request Free Consultation</button>` : '<button class="ls-btn ls-btn-sm" type="button" disabled>Requests not open</button>'}<a class="ls-btn ls-btn-outline ls-btn-sm" href="lawyer-profile.html?id=${encodeURIComponent(l.id)}">Profile</a><button class="ls-btn ls-btn-ghost ls-btn-sm" type="button" data-report-lawyer="${esc(l.id)}" data-report-name="${esc(l.name)}">Report</button></div>
      </article>`).join('')}</div>`;
    list.querySelectorAll('[data-req]').forEach((b) => b.addEventListener('click', () => openRequest(freeLawyers.find((x) => x.id === b.dataset.req))));
  }

  function openRequest(l) {
    if (!l || !l.requestsOpen) return;
    selectedLawyer = l;
    document.getElementById('freeRequestSub').textContent = `Free consultation with ${l.name} · ₹0. The lawyer will accept or decline your request.`;
    const issue = document.getElementById('frIssue');
    const areas = (l.practiceAreas && l.practiceAreas.length) ? l.practiceAreas : PRACTICE_AREAS;
    issue.innerHTML = areas.map((a) => `<option${a === app.matterArea ? ' selected' : ''}>${esc(a)}</option>`).join('');
    document.getElementById('frMessage').value = app.matterSummary || '';
    document.getElementById('freeRequestError').hidden = true;
    document.getElementById('freeRequestForm').hidden = false;
    document.getElementById('freeRequestDone').hidden = true;
    openModal('freeRequestModal');
  }

  document.getElementById('freeRequestFormEl').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('frMessage').value.trim();
    const errBox = document.getElementById('freeRequestError');
    if (!msg) { errBox.textContent = 'Please describe what help you need.'; errBox.hidden = false; return; }
    const btn = document.getElementById('frSubmit');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await D.requestConsultation({
        lawyerId: selectedLawyer.id,
        serviceType: 'free',
        issue: document.getElementById('frIssue').value,
        message: msg,
        type: document.getElementById('frType').value,
        language: document.getElementById('frLanguage').value
      });
      document.getElementById('freeRequestForm').hidden = true;
      document.getElementById('freeRequestDone').hidden = false;
    } catch (err) {
      errBox.textContent = err.message || 'Could not send the request.';
      errBox.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = 'Send request (₹0)';
    }
  });

  // ------------------------------------------------------------ main
  function render(flash) {
    if (!user) return renderSignedOut();
    if (user.role !== 'customer') return renderWrongRole();
    if (!app || (editingDetails && ['draft', 'more_info_required'].includes(app.status))) return renderDetails();
    if (app.status === 'draft') {
      if (step <= 1) step = 2;
      if (step === 3 && !docCheck().complete) step = 2;
      return step === 3 ? renderReview() : renderDocuments();
    }
    if (app.status === 'approved' && app.approvedAndValid) return renderApproved();
    return renderStatus(flash);
  }

  async function init() {
    try {
      const [p, ok] = await Promise.all([
        window.apiRequest('/free-aid/policy').then((r) => r.data),
        window.restoreSession()
      ]);
      policy = p;
      const lim = document.getElementById('infoLimit');
      if (lim) lim.textContent = inr(limit());
      user = ok ? window.getCurrentUser() : null;
      if (user && user.role === 'customer') app = (await api('/free-aid/application')).data.application;
      render();
      // Returned from DigiLocker: show the outcome once, then clean the address bar.
      const v = new URLSearchParams(location.search).get('verification');
      if (v) {
        const msg = { verified: 'DigiLocker verification received.', cancelled: 'DigiLocker verification was cancelled.', expired: 'The DigiLocker link expired. Please try again.', unavailable: 'DigiLocker did not respond. Please try again later; your application is not affected.' }[v] || 'DigiLocker verification did not complete. Your application is not affected.';
        toast(msg);
        try { history.replaceState(null, '', location.pathname + (wantedLawyer ? '?lawyer=' + encodeURIComponent(wantedLawyer) : '')); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      errorState(err.message || 'Please check your connection. (Local setup: is the backend running?)');
    }
  }

  init();
})();
