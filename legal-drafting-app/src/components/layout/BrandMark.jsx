import { Link } from 'react-router-dom';
import './BrandMark.css';

export function BrandMark({ compact = false }) {
  return (
    <Link to="/" className="brand" aria-label="Legal Lens — Legal Drafting Assistant, home">
      <span className="brand__logo" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="30" height="30">
          <rect width="32" height="32" rx="7" fill="currentColor" />
          <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.4" />
          <path d="M19 19l5.5 5.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="brand__text">
        <span className="brand__name">Legal Lens</span>
        {!compact && <span className="brand__product">Legal Drafting Assistant</span>}
      </span>
    </Link>
  );
}
