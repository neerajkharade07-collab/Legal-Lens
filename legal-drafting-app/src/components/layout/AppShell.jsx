import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollManager } from './ScrollManager';
import { PageLoader } from '../common/PageLoader';
import './AppShell.css';

/** Full-height app screens (the drafting workspace) hide the marketing-style footer. */
const isFullHeightRoute = (pathname) => /^\/draft\/(?!new$)[^/]+$/.test(pathname);

function skipToMain(event) {
  event.preventDefault();
  document.getElementById('main-content')?.focus();
}

export function AppShell() {
  const { pathname } = useLocation();
  const fullHeight = isFullHeightRoute(pathname);
  return (
    <div className="app-shell">
      {/* index.html sets <base href=".../legal-drafting/">, so a plain "#main-content"
          link would load the app's home page; move focus in place instead. */}
      <a href="#main-content" className="skip-link" onClick={skipToMain}>
        Skip to main content
      </a>
      <ScrollManager />
      <Navbar />
      <main id="main-content" className="app-shell__main" tabIndex={-1}>
        {/* SIH demo: no sign-in gate — the dashboard opens directly in Guest / Demo Mode.
            (components/auth/AuthGate.jsx is kept for a future signed-in build.) */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      {!fullHeight && <Footer />}
    </div>
  );
}
