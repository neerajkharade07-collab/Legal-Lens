import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './contexts';
import { authService } from '../services';
import { onAuthLost } from '../services/apiClient';
import { setMainSiteFlags } from '../services/mainSiteSession';
import { DRAFTING_GUEST_MODE } from '../services/config';

/**
 * Session for the Legal Drafting app, using the existing Legal Lens auth API.
 * On load it tries the refresh cookie first, so a user already signed in on
 * the main Legal Lens site (same backend) lands straight on the dashboard.
 * status: 'checking' | 'authenticated' | 'anonymous'
 *
 * SIH demo (DRAFTING_GUEST_MODE): no session is looked up or created — the app
 * starts 'anonymous' straight away and runs as a guest (documents in this
 * browser only). Nothing is faked: there is no user, token or login.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState(DRAFTING_GUEST_MODE ? 'anonymous' : 'checking');
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (DRAFTING_GUEST_MODE) return undefined;
    let cancelled = false;
    authService
      .restoreSession()
      .catch(() => null)
      .then((restored) => {
        if (cancelled) return;
        if (restored) setMainSiteFlags(restored);
        setUser(restored);
        setStatus(restored ? 'authenticated' : 'anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onAuthLost(() => {
      setUser(null);
      setStatus('anonymous');
    });
    return () => onAuthLost(null);
  }, []);

  const signIn = useCallback(async (credentials) => {
    const signedIn = await authService.login(credentials);
    setMainSiteFlags(signedIn);
    setUser(signedIn);
    setStatus('authenticated');
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    await authService.logout().catch(() => {});
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
