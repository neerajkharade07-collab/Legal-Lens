/**
 * google-signin.js — "Continue with Google" button (CASEONE customer pages).
 *
 * Same flow as the login page: Google Identity Services, authorization-code
 * flow in a popup. Google's own account chooser opens, the one-time code is
 * sent to the EXISTING backend endpoint (POST /api/auth/google via
 * signInWithGoogleCode() in auth.js), which verifies it with Google and signs
 * the account in — or creates a customer account the first time. No separate
 * authentication system: the client id, verification, roles and redirects all
 * come from the existing backend and auth.js.
 *
 * Markup: <button type="button" class="google-btn" id="googleBtn"
 *           data-google-action="Signing up with Google…"
 *           data-google-disabled="…message when Google is not configured…">
 *           <svg …></svg><span>Continue with Google</span></button>
 * Requires config.js and auth.js (loaded before this file) and, for messages,
 * window.legalLensToast(message).
 */
(function () {
  'use strict';
  const btn = document.getElementById('googleBtn');
  if (!btn) return;
  const label = btn.querySelector('span');
  const idleText = label.textContent;
  const busyText = btn.getAttribute('data-google-action') || 'Signing in with Google…';
  const disabledText = btn.getAttribute('data-google-disabled') || 'Google sign-in is not set up yet. Please use your email and password.';
  const toast = (msg) => (window.legalLensToast ? window.legalLensToast(msg) : null);
  let codeClient = null;
  let state = null;
  let status = 'loading'; // loading | ready | disabled | failed
  let busy = false;

  function setBusy(on) {
    busy = on;
    btn.disabled = on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    label.textContent = on ? busyText : idleText;
  }

  function randomState() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function onCode(response) {
    if (!response || response.error) {
      if (response && response.error === 'access_denied') toast('Google sign-in was cancelled.');
      else toast('Google sign-in did not complete. Please try again.');
      return;
    }
    // The backend requires the X-Requested-With header (sent by auth.js);
    // state is an extra check whenever Google echoes it.
    if (response.state !== undefined && response.state !== state) {
      toast('Google sign-in could not be verified. Please try again.');
      return;
    }
    setBusy(true);
    signInWithGoogleCode(response.code).then((data) => {
      if (data && data.linked) showLinkedNotice(data.message);
    }).catch((err) => {
      setBusy(false);
      const s = err && err.statusCode;
      if (!s) toast('Unable to reach CASEONE right now. Please check your connection and try again.');
      else if (s === 429) toast('Too many attempts. Please wait a few minutes and try again.');
      else toast((err && err.message) || 'Google sign-in failed. Please try again.');
    });
  }

  // Google was linked to an existing account (its old password switched off);
  // auth.js redirects a few seconds later so this can be read.
  function showLinkedNotice(message) {
    const note = document.createElement('div');
    note.id = 'googleLinkedNotice';
    note.setAttribute('role', 'status');
    note.textContent = (message || 'Google sign-in was added to your account.') + ' Continuing…';
    note.style.cssText = 'margin-top:14px;padding:12px 14px;border:1px solid var(--black);border-radius:11px;background:var(--white);font-size:13px;line-height:1.55;color:var(--gray-800);';
    btn.insertAdjacentElement('afterend', note);
    label.textContent = 'Signed in with Google';
  }

  function onPopupError(err) {
    const type = err && err.type;
    if (type === 'popup_failed_to_open') toast('The Google window was blocked. Please allow pop-ups for this site and try again.');
    else if (type === 'popup_closed') toast('Google sign-in was closed before it finished.');
    else toast('Google sign-in did not complete. Please try again.');
  }

  function loadGoogleScript() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const tag = document.createElement('script');
      tag.src = 'https://accounts.google.com/gsi/client';
      tag.async = true;
      tag.onload = () => resolve();
      tag.onerror = () => reject(new Error('gsi'));
      document.head.appendChild(tag);
    });
  }

  // Prepared on page load, so the click can open the popup immediately
  // (browsers block pop-ups that are not opened directly by a click).
  Promise.resolve()
    .then(() => getGoogleSignInConfig())
    .then((cfg) => {
      if (!cfg || !cfg.enabled || !cfg.clientId) {
        // Not configured on the server: say so instead of pretending to work.
        status = 'disabled';
        btn.setAttribute('aria-disabled', 'true');
        btn.title = disabledText;
        return null;
      }
      return loadGoogleScript().then(() => {
        state = randomState();
        codeClient = google.accounts.oauth2.initCodeClient({
          client_id: cfg.clientId,
          scope: 'openid email profile',
          ux_mode: 'popup',
          select_account: true,
          state,
          callback: onCode,
          error_callback: onPopupError
        });
        status = 'ready';
      });
    })
    .catch(() => { status = status === 'disabled' ? 'disabled' : 'failed'; });

  btn.addEventListener('click', () => {
    if (busy) return;
    if (status === 'ready' && codeClient) { codeClient.requestCode(); return; }
    if (status === 'loading') toast('Google sign-in is still loading. Please try again in a moment.');
    else if (status === 'disabled') toast(disabledText);
    else toast('Google sign-in could not be loaded. Check your connection or ad blocker, then reload the page.');
  });
})();
