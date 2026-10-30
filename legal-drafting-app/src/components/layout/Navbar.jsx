import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Plus,
  UserRound,
  LogOut,
  House,
  LogIn,
  FileText,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import { PRIMARY_NAV } from '../../data/navigation';
import { NAV_ICONS } from './navIcons';
import { BrandMark } from './BrandMark';
import { Button } from '../common/Button';
import { DropdownMenu } from '../common/DropdownMenu';
import { useAuth } from '../../hooks/useAuth';
import { MAIN_SITE_URL } from '../../services/siteConfig';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { dashboardPageFor, mainSitePage, roleLabel } from '../../utils/caseoneAccount';
import { useToast } from '../../hooks/useToast';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useDraftSetup } from '../../hooks/useDraftSetup';
import { cn } from '../../utils/cn';
import './Navbar.css';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const { openDraftSetup } = useDraftSetup();
  const navigate = useNavigate();
  const {
    status: authStatus,
    user,
    otherAccount,
    signOut,
    logIn,
    retry,
    continueInDemoMode,
    notice,
    dismissNotice,
  } = useAuth();
  const { toast } = useToast();
  const [expiredDismissed, setExpiredDismissed] = useState(false);
  const firstName = user?.name?.split(' ')[0] || 'My Account';
  // Signed out (or an account type that cannot use drafting): browser-only Demo Mode.
  // A signed-in customer/lawyer, an unreachable server or an ended session is never Demo Mode.
  const isDemo = authStatus === 'anonymous';
  const isAdminVisitor = isDemo && Boolean(otherAccount);

  // Session messages (server unreachable, account type not supported) are shown once.
  useEffect(() => {
    if (!notice) return;
    toast({
      title: notice.kind === 'unavailable' ? "Can't reach CASEONE" : 'Legal Drafting',
      description: notice.text,
      variant: 'default',
    });
    dismissNotice();
  }, [notice, toast, dismissNotice]);

  useEffect(() => {
    if (authStatus !== 'expired') setExpiredDismissed(false);
  }, [authStatus]);

  const accountMenu = [
    { id: 'documents', label: 'My Documents', icon: FileText, onSelect: () => navigate('/documents') },
    {
      id: 'dashboard',
      label: 'My CASEONE dashboard',
      icon: LayoutDashboard,
      onSelect: () => window.location.assign(mainSitePage(dashboardPageFor(user?.role), MAIN_SITE_URL)),
    },
    {
      id: 'home',
      label: 'CASEONE home',
      icon: House,
      onSelect: () => window.location.assign(MAIN_SITE_URL),
    },
    { id: 'signout', label: 'Sign out', icon: LogOut, onSelect: signOut },
  ];
  const accountCard = user && (
    <div className="navbar__account-card">
      <span className="navbar__account-name">{user.name || 'CASEONE account'}</span>
      {user.email && <span className="navbar__account-email">{user.email}</span>}
      <span className="navbar__account-role">{roleLabel(user.role)}</span>
    </div>
  );

  function startNewDraft() {
    setMenuOpen(false);
    openDraftSetup({ source: 'navbar' });
  }

  useLockBodyScroll(menuOpen);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the drawer; focus moves into it when opened.
  useEffect(() => {
    if (!menuOpen) return undefined;
    drawerRef.current?.querySelector('a, button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      <header className={cn('navbar', scrolled && 'navbar--scrolled')}>
        <div className="navbar__inner container">
          <BrandMark />

          <nav className="navbar__nav" aria-label="Primary">
            <ul className="navbar__links">
              {PRIMARY_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => cn('navbar__link', isActive && 'is-active')}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="navbar__actions">
            {authStatus === 'authenticated' && (
              <>
                <DropdownMenu
                  icon={UserRound}
                  label={firstName}
                  buttonLabel={`My Account: ${user?.name ?? ''} (${roleLabel(user?.role)})`}
                  buttonClassName="navbar__account"
                  header={accountCard}
                  items={accountMenu}
                />
                <Button size="sm" icon={Plus} className="navbar__cta" onClick={startNewDraft}>
                  New Draft
                </Button>
              </>
            )}
            {authStatus === 'expired' && (
              <>
                <span className="navbar__session-state" role="status">
                  Session ended
                </span>
                <Button size="sm" icon={LogIn} onClick={() => logIn()}>
                  Log in again
                </Button>
              </>
            )}
            {authStatus === 'unavailable' && (
              <>
                <span
                  className="navbar__session-state"
                  role="status"
                  title="The CASEONE server could not be reached, so your sign-in could not be checked."
                >
                  Server unreachable
                </span>
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={retry}>
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="navbar__cta"
                  onClick={continueInDemoMode}
                  title="Work without an account: drafts stay only in this browser and AI is off."
                >
                  Use Demo Mode
                </Button>
              </>
            )}
            {isDemo && (
              <>
                <span
                  className="navbar__demo-badge"
                  title={
                    isAdminVisitor
                      ? 'Signed in on CASEONE as an admin. Legal Drafting works with customer and lawyer accounts, so only the browser-only Demo Mode is available here.'
                      : 'Demo Mode: you are not signed in. Drafts are saved only in this browser and AI drafting is off.'
                  }
                >
                  {isAdminVisitor ? 'Admin · Demo Mode' : 'Demo Mode'}
                </span>
                <a className="navbar__home-link" href={MAIN_SITE_URL}>
                  CASEONE home
                </a>
                {!isAdminVisitor && (
                  <Button size="sm" variant="secondary" icon={LogIn} onClick={() => logIn('customer')}>
                    Log in
                  </Button>
                )}
                <Button size="sm" icon={Plus} className="navbar__cta" onClick={startNewDraft}>
                  New Draft
                </Button>
              </>
            )}
            {authStatus === 'checking' && (
              <a className="navbar__home-link" href={MAIN_SITE_URL}>
                CASEONE home
              </a>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              className="navbar__menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X size={20} strokeWidth={1.75} />
              ) : (
                <Menu size={20} strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile / tablet drawer — rendered outside <header> because the header's backdrop-filter
          would otherwise become the containing block for these fixed elements. The layer clips the
          off-canvas panel so it never causes horizontal scroll. */}
      <div className={cn('mobile-nav-layer', menuOpen && 'is-open')}>
        <div
          className={cn('mobile-nav__backdrop', menuOpen && 'is-open')}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
        <div
          id="mobile-nav"
          ref={drawerRef}
          className={cn('mobile-nav', menuOpen && 'is-open')}
          aria-hidden={!menuOpen}
          inert={!menuOpen ? true : undefined}
        >
          <nav aria-label="Primary mobile">
            <ul className="mobile-nav__links">
              {PRIMARY_NAV.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => cn('mobile-nav__link', isActive && 'is-active')}
                    >
                      {Icon && <Icon size={18} strokeWidth={1.5} aria-hidden="true" />}
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mobile-nav__footer">
            {/* On phones the header's "CASEONE home" link is hidden to fit; it is offered here. */}
            <a className="btn btn--secondary btn--md btn--full mobile-nav__home" href={MAIN_SITE_URL}>
              <span className="btn__label">CASEONE home</span>
            </a>
            {(authStatus === 'authenticated' || isDemo) && (
              <Button icon={Plus} fullWidth onClick={startNewDraft}>
                New Draft
              </Button>
            )}
            {authStatus === 'authenticated' && (
              <Button
                variant="secondary"
                icon={LogOut}
                fullWidth
                onClick={() => {
                  setMenuOpen(false);
                  signOut();
                }}
              >
                Sign out
              </Button>
            )}
            {isDemo && !isAdminVisitor && (
              <Button variant="secondary" icon={LogIn} fullWidth onClick={() => logIn('customer')}>
                Log in on CASEONE
              </Button>
            )}
            {authStatus === 'expired' && (
              <Button icon={LogIn} fullWidth onClick={() => logIn()}>
                Log in again
              </Button>
            )}
            {authStatus === 'unavailable' && (
              <>
                <Button variant="secondary" icon={RefreshCw} fullWidth onClick={retry}>
                  Retry
                </Button>
                <Button variant="secondary" fullWidth onClick={continueInDemoMode}>
                  Use Demo Mode (this browser only)
                </Button>
              </>
            )}
            <p className="mobile-nav__note">
              {authStatus === 'authenticated'
                ? `Signed in as ${user?.name || user?.email || ''} (${roleLabel(user?.role)}). Documents are saved to your CASEONE account.`
                : authStatus === 'expired'
                  ? 'Your CASEONE session has ended. Log in again to keep saving; you will come back here.'
                  : authStatus === 'unavailable'
                    ? "Can't reach the CASEONE server, so your sign-in could not be checked."
                    : isAdminVisitor
                      ? 'Signed in as an admin. Legal Drafting works with customer and lawyer accounts; this is the browser-only Demo Mode.'
                      : isDemo
                        ? 'Demo Mode — you are not signed in. Drafts are saved only in this browser and AI drafting is off. Log in on CASEONE to save to your account.'
                        : 'Checking your session…'}
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={authStatus === 'expired' && !expiredDismissed}
        title="Your CASEONE session has ended"
        description="Log in again on CASEONE to keep saving to your account — you will come back to this page. Changes made since the last save have not been saved; copy anything important before you leave."
        confirmLabel="Log in again"
        cancelLabel="Stay on this page"
        onConfirm={() => logIn()}
        onCancel={() => setExpiredDismissed(true)}
      />
    </>
  );
}
