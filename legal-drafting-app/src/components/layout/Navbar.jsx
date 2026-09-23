import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Plus, UserRound, LogOut, House } from 'lucide-react';
import { PRIMARY_NAV } from '../../data/navigation';
import { NAV_ICONS } from './navIcons';
import { BrandMark } from './BrandMark';
import { Button } from '../common/Button';
import { DropdownMenu } from '../common/DropdownMenu';
import { useAuth } from '../../hooks/useAuth';
import { MAIN_SITE_URL } from '../../services/siteConfig';
import { DRAFTING_GUEST_MODE } from '../../services/config';
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
  const { status: authStatus, user, signOut } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Account';

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
            {authStatus === 'authenticated' ? (
              <>
                <DropdownMenu
                  icon={UserRound}
                  label={firstName}
                  buttonLabel={`Account: ${user?.name ?? ''}`}
                  buttonClassName="navbar__account"
                  items={[
                    {
                      id: 'home',
                      label: 'Legal Lens home',
                      icon: House,
                      onSelect: () => window.location.assign(MAIN_SITE_URL),
                    },
                    { id: 'signout', label: 'Sign out', icon: LogOut, onSelect: signOut },
                  ]}
                />
                <Button size="sm" icon={Plus} className="navbar__cta" onClick={startNewDraft}>
                  New Draft
                </Button>
              </>
            ) : (
              <>
                {DRAFTING_GUEST_MODE && (
                  <span
                    className="navbar__demo-badge"
                    title="Demo Mode: no sign-in. Drafts are saved only in this browser."
                  >
                    Demo Mode
                  </span>
                )}
                <a className="navbar__home-link" href={MAIN_SITE_URL}>
                  Legal Lens home
                </a>
                {DRAFTING_GUEST_MODE && (
                  <Button size="sm" icon={Plus} className="navbar__cta" onClick={startNewDraft}>
                    New Draft
                  </Button>
                )}
              </>
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
            <Button icon={Plus} fullWidth onClick={startNewDraft}>
              New Draft
            </Button>
            <p className="mobile-nav__note">
              {authStatus === 'authenticated'
                ? `Signed in as ${user?.email ?? ''}. Documents are saved to your account.`
                : DRAFTING_GUEST_MODE
                  ? 'Demo Mode — no sign-in needed. Drafts are saved only in this browser.'
                  : 'Sign in with your Legal Lens account to save documents.'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
