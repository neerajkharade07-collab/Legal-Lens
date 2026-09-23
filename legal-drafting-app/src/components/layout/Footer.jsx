import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { PRIMARY_NAV } from '../../data/navigation';
import { SAVE_LOCATION } from '../../services/config';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__disclaimer">
          <Info size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>
            Legal Lens provides AI-assisted drafting tools and informational assistance. Drafts and
            legal information should be reviewed by a qualified legal professional where
            appropriate.
          </span>
        </p>
        <div className="footer__row">
          <p className="footer__meta">
            © {new Date().getFullYear()} Legal Lens · Documents are saved {SAVE_LOCATION}.
          </p>
          <nav aria-label="Footer">
            <ul className="footer__links">
              {PRIMARY_NAV.slice(1).map((item) => (
                <li key={item.to}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
