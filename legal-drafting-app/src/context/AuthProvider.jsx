import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from './contexts';
import { authService } from '../services';
import { onAuthLost, setAccessToken } from '../services/apiClient';
import { setMainSiteFlags } from '../services/mainSiteSession';
import { setStorageMode } from '../services/config';
import { MAIN_SITE_URL } from '../services/siteConfig';
import { goToCaseoneLogin, sessionFromRestore } from '../utils/caseoneAccount';

/**
 * Session for the Legal Drafting app — the SAME session as the main CASEONE site.
 * Only CASEONE customer and lawyer accounts use drafting (DRAFTING_ROLES, see
 * utils/caseoneAccount.js canUseDrafting); the backend refuses every other role.
 *
 * There is no separate login here. Signing in happens on the existing CASEONE pages
 * (login.html / lawyer-login.html, auth.js). The backend keeps the session in its
 * httpOnly refresh cookie; on load this app exchanges that cookie for an in-memory
 * access token (POST /api/auth/refresh), exactly like every main-site page does.
 * No token is ever written to localStorage.
 *
 * status:
 *  - 'checking'      the session is being restored (nothing is saved anywhere yet);
 *  - 'authenticated' customer / lawyer → account documents and AI (backend, MongoDB);
 *  - 'anonymous'     not signed in → clearly labelled Demo Mode (browser only, no AI).
 *                    `otherAccount` is set when signed in on CASEONE with an account
 *                    type drafting does not serve (admin): that session is left alone;
 *  - 'unavailable'   the CASEONE server could not be reached, so the sign-in state is
 *                    UNKNOWN — never shown as Demo Mode; Retry, or choose Demo Mode;
 *  - 'expired'       a signed-in session ended while using the app → log in again on
 *                    CASEONE and come back. Nothing is saved in the browser instead,
 *                    and the open document stays on screen.
 * The storage mode (services/config.js) always changes together with the status.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null, otherAccount: null, notice: null });
  const statusRef = useRef('checking');
  const restoreSeq = useRef(0);

  const update = useCallback((next) => {
    statusRef.current = next.status;
    setState({ user: null, otherAccount: null, notice: null, ...next });
  }, []);

  const restore = useCallback(async () => {
    const seq = ++restoreSeq.current;
    setStorageMode('checking');
    update({ status: 'checking' });
    let result;
    try {
      result = sessionFromRestore({ user: await authService.restoreSession() });
    } catch (error) {
      result = sessionFromRestore({ error });
      result.errorMessage = error?.message;
    }
    if (seq !== restoreSeq.current) return;

    if (result.status === 'unavailable') {
      // Unknown sign-in state: never called Demo Mode, nothing saved anywhere.
      setStorageMode('checking');
      update({ status: 'unavailable', notice: { kind: 'unavailable', text: result.errorMessage } });
      return;
    }
    if (result.otherAccount) {
      // e.g. signed in on CASEONE as an admin: that session is left alone, but this app
      // does not use it (the drafting API refuses admin accounts).
      setAccessToken(null);
      setStorageMode('guest');
      update({
        status: 'anonymous',
        otherAccount: result.otherAccount,
        notice: {
          kind: 'unsupported',
          text: 'Legal Drafting works with CASEONE customer and lawyer accounts. Your admin session stays signed in on CASEONE; here only the browser-only Demo Mode is available.',
        },
      });
      return;
    }
    if (result.user) setMainSiteFlags(result.user);
    setStorageMode(result.storage);
    update({ status: result.status, user: result.user });
  }, [update]);

  useEffect(() => {
    restore();
    return () => {
      restoreSeq.current += 1; // ignore a restore that finishes after unmount
    };
  }, [restore]);

  useEffect(() => {
    onAuthLost(() => {
      if (statusRef.current !== 'authenticated') return;
      setAccessToken(null);
      setStorageMode('checking');
      statusRef.current = 'expired';
      // Keep the user (for the right login page and the account label); nothing is
      // saved in the browser instead of the account.
      setState((current) => ({ ...current, status: 'expired', notice: null }));
    });
    return () => onAuthLost(null);
  }, []);

  /** Existing CASEONE login page; comes back to this page after login. */
  const logIn = useCallback(
    (role) => goToCaseoneLogin({ role: role ?? state.user?.role, mainSiteUrl: MAIN_SITE_URL }),
    [state.user],
  );

  /** Server unreachable → the visitor may choose the browser-only Demo Mode explicitly. */
  const continueInDemoMode = useCallback(() => {
    restoreSeq.current += 1;
    setAccessToken(null);
    setStorageMode('guest');
    update({ status: 'anonymous' });
  }, [update]);

  /** Kept for the unused in-app form (components/auth); the UI signs in on CASEONE. */
  const signIn = useCallback(
    async (credentials) => {
      const signedIn = await authService.login(credentials);
      setMainSiteFlags(signedIn);
      setStorageMode('account');
      update({ status: 'authenticated', user: signedIn });
      return signedIn;
    },
    [update],
  );

  /** Signs out of CASEONE (backend session + cookie), here and on the main site. */
  const signOut = useCallback(async () => {
    restoreSeq.current += 1;
    await authService.logout().catch(() => {});
    setStorageMode('guest');
    update({ status: 'anonymous' });
  }, [update]);

  const dismissNotice = useCallback(() => {
    setState((current) => ({ ...current, notice: null }));
  }, []);

  const value = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      otherAccount: state.otherAccount,
      notice: state.notice,
      logIn,
      retry: restore,
      continueInDemoMode,
      signIn,
      signOut,
      dismissNotice,
    }),
    [state, logIn, restore, continueInDemoMode, signIn, signOut, dismissNotice],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
