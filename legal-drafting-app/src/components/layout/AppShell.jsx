import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ScrollManager } from './ScrollManager';
import { PageLoader } from '../common/PageLoader';
import './AppShell.css';

/** Full-height app screens (the drafting workspace) hide the marketing-style footer. */
const isFullHeightRoute = (pathname) => /^\/draft\/(?!new$)[^/]+$/.test(pathname);

export function AppShell() {
  const { pathname } = useLocation();
  const fullHeight = isFullHeightRoute(pathname);
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
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
