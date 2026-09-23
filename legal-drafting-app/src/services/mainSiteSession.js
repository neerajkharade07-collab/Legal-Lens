/**
 * Keeps the main Legal Lens site's navbar in step with this app.
 *
 * The main site (auth.js / auth.html) keeps a few NON-secret UI flags in
 * localStorage — loggedIn, userRole, userName, userEmail — purely so its
 * navbar can render the signed-in state. Tokens are never stored there: the
 * access token stays in memory and the refresh token is the backend's
 * httpOnly cookie. Both apps are served from the same origin, so this app
 * writes/clears the same flags on sign-in/sign-out, exactly like the main
 * site's own setUiConvenienceFlags() / clearUiConvenienceFlags().
 */
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function setMainSiteFlags(user) {
  if (!user) return;
  safe(() => {
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('userRole', user.role || 'customer');
    if (user.name) localStorage.setItem('userName', user.name);
    if (user.email) localStorage.setItem('userEmail', user.email);
  });
}

export function clearMainSiteFlags() {
  // userName / userEmail are intentionally kept, like the main site does,
  // so the sign-in form can be prefilled next time.
  safe(() => {
    localStorage.removeItem('loggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('currentLawyerId');
  });
}

/** Email / role the main site last used — for prefilling the sign-in form. */
export function getMainSiteHints() {
  return safe(
    () => ({
      email: localStorage.getItem('userEmail') || '',
      role: localStorage.getItem('userRole') === 'lawyer' ? 'lawyer' : 'customer',
    }),
    { email: '', role: 'customer' },
  );
}
