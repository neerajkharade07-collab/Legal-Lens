/** Auth calls to the existing backend (/api/auth/*). */
import { apiRequest, refreshSession, setAccessToken } from './apiClient';
import { clearMainSiteFlags } from './mainSiteSession';

export async function login({ email, password, role = 'customer' }) {
  const json = await apiRequest(`/auth/${role === 'lawyer' ? 'lawyer' : 'customer'}/login`, {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  setAccessToken(json.data.accessToken);
  return json.data.user;
}

/** Restores a session from the refresh cookie (e.g. signed in on the main Legal Lens site). */
export async function restoreSession() {
  const session = await refreshSession();
  return session?.user ?? null;
}

export async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST', auth: false });
  } finally {
    setAccessToken(null);
    clearMainSiteFlags(); // signed out of the main Legal Lens site too
  }
}
