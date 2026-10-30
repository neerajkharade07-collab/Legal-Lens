/**
 * lawyer-report.js — "Report this profile" dialog (CASEONE).
 *
 * Lawyer profiles are listed automatically after registration, before any
 * review, so every listing page offers a way to flag a suspicious profile.
 *
 *   CaseoneReport.open(lawyerId, lawyerName)
 *   <button data-report-lawyer="<id>" data-report-name="<name>">Report this profile</button>
 *
 * Sends POST /api/lawyers/:id/report through LegalLensLawyerData.reportLawyer
 * (requires lawyer-data.js). Works signed in or not. Nothing is stored in the
 * browser.
 */
(function (global) {
  'use strict';

  const REASONS = [
    ['not_a_lawyer', 'May not be a real advocate'],
    ['wrong_details', 'Details look false or misleading'],
    ['impersonation', 'Uses someone else’s name or photo'],
    ['misconduct', 'Unprofessional or abusive behaviour'],
    ['other', 'Something else']
  ];

  const CSS = `
  .cr-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .cr-dialog { background: #fff; color: #0a0a0a; width: 100%; max-width: 460px; max-height: calc(100vh - 32px); overflow-y: auto; border-radius: 16px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); font-family: inherit; }
  .cr-dialog h2 { font-size: 19px; font-weight: 700; margin: 0 0 6px; }
  .cr-dialog .cr-sub { font-size: 13px; color: #555; line-height: 1.6; margin: 0 0 16px; }
  .cr-dialog fieldset { border: 0; padding: 0; margin: 0 0 14px; }
  .cr-dialog legend, .cr-dialog label.cr-lbl { font-size: 13px; font-weight: 600; margin-bottom: 8px; display: block; }
  .cr-opt { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; padding: 8px 10px; border: 1px solid #e3e3e3; border-radius: 10px; margin-bottom: 6px; cursor: pointer; }
  .cr-opt input { margin-top: 3px; accent-color: #0a0a0a; }
  .cr-dialog textarea, .cr-dialog input[type=email] { width: 100%; box-sizing: border-box; border: 1px solid #d0d0d0; border-radius: 10px; padding: 10px 12px; font: inherit; font-size: 13.5px; margin-bottom: 4px; }
  .cr-dialog textarea { min-height: 84px; resize: vertical; }
  .cr-hint { font-size: 12px; color: #666; margin: 0 0 12px; }
  .cr-err { font-size: 13px; color: #fff; background: #0a0a0a; border-radius: 8px; padding: 9px 12px; margin: 0 0 12px; }
  .cr-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: 6px; }
  .cr-btn { border-radius: 999px; padding: 10px 18px; font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; border: 1px solid #0a0a0a; background: #fff; color: #0a0a0a; }
  .cr-btn.cr-primary { background: #0a0a0a; color: #fff; }
  .cr-btn:disabled { opacity: 0.6; cursor: default; }
  .cr-btn:focus-visible, .cr-opt:focus-within { outline: 2px solid #0a0a0a; outline-offset: 2px; }
  .cr-done { font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
  `;

  let lastFocus = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function ensureStyle() {
    if (document.getElementById('crStyle')) return;
    const st = document.createElement('style');
    st.id = 'crStyle';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function close() {
    const s = document.getElementById('crScrim');
    if (s) s.remove();
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const box = document.querySelector('#crScrim .cr-dialog');
      if (!box) return;
      const f = Array.from(box.querySelectorAll('button, input, textarea')).filter((el) => !el.disabled);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function open(lawyerId, lawyerName) {
    if (!lawyerId) return;
    ensureStyle();
    close();
    lastFocus = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'cr-scrim';
    scrim.id = 'crScrim';
    scrim.innerHTML = `<div class="cr-dialog" role="dialog" aria-modal="true" aria-labelledby="crTitle">
      <h2 id="crTitle">Report this profile</h2>
      <p class="cr-sub">Tell the CASEONE team what looks wrong with ${lawyerName ? '<strong>' + esc(lawyerName) + '</strong>' : 'this profile'}. Reports are reviewed by people; the advocate is not told who reported them.</p>
      <form id="crForm" novalidate>
        <fieldset><legend>Reason</legend>
          ${REASONS.map(([v, t]) => `<label class="cr-opt"><input type="radio" name="crReason" value="${v}"><span>${esc(t)}</span></label>`).join('')}
        </fieldset>
        <label class="cr-lbl" for="crDetails">Details <span style="font-weight:400;color:#666">(optional)</span></label>
        <textarea id="crDetails" maxlength="1000" placeholder="What did you notice? Do not include your own Aadhaar, PAN or other ID numbers."></textarea>
        <p class="cr-hint"><span id="crCount">0</span> / 1000</p>
        <label class="cr-lbl" for="crEmail">Your email <span style="font-weight:400;color:#666">(optional, only if you want us to contact you)</span></label>
        <input type="email" id="crEmail" maxlength="254" autocomplete="email">
        <div class="cr-err" id="crErr" role="alert" hidden></div>
        <div class="cr-actions">
          <button type="button" class="cr-btn" id="crCancel">Cancel</button>
          <button type="submit" class="cr-btn cr-primary" id="crSend">Send report</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(scrim);
    document.addEventListener('keydown', onKey, true);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
    document.getElementById('crCancel').addEventListener('click', close);
    const details = document.getElementById('crDetails');
    details.addEventListener('input', () => { document.getElementById('crCount').textContent = details.value.length; });
    const first = scrim.querySelector('input[name="crReason"]');
    if (first) first.focus();
    document.getElementById('crForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('crErr');
      err.hidden = true;
      const reason = (scrim.querySelector('input[name="crReason"]:checked') || {}).value;
      const contactEmail = document.getElementById('crEmail').value.trim();
      if (!reason) { err.textContent = 'Please choose a reason.'; err.hidden = false; return; }
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) { err.textContent = 'Please enter a valid email address, or leave it empty.'; err.hidden = false; return; }
      const btn = document.getElementById('crSend');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const D = global.LegalLensLawyerData;
        const res = await D.reportLawyer(lawyerId, { reason, details: details.value.trim(), contactEmail });
        const box = scrim.querySelector('.cr-dialog');
        box.innerHTML = `<h2 id="crTitle">Report sent</h2><p class="cr-done" role="status">${esc(res.message || 'Thank you. The CASEONE team will look into this profile.')}</p><div class="cr-actions"><button type="button" class="cr-btn cr-primary" id="crClose">Close</button></div>`;
        const c = document.getElementById('crClose');
        c.addEventListener('click', close);
        c.focus();
      } catch (ex) {
        err.textContent = ex.message || 'Could not send the report. Please try again.';
        err.hidden = false;
        btn.disabled = false;
        btn.textContent = 'Send report';
      }
    });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-report-lawyer]');
    if (!b) return;
    e.preventDefault();
    open(b.getAttribute('data-report-lawyer'), b.getAttribute('data-report-name') || '');
  });

  global.CaseoneReport = { open, close };
})(window);
