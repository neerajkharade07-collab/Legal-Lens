import { Link } from 'react-router-dom';
import legalLensLogo from '../../assets/legal-lens-logo.png';
import './BrandMark.css';

export function BrandMark({ compact = false }) {
  return (
    <Link to="/" className="brand" aria-label="Legal Lens — Legal Drafting Assistant, home">
      <span className="brand__logo" aria-hidden="true">
        <img
          src={legalLensLogo}
          alt=""
          width="30"
          height="30"
          style={{ display: 'block', objectFit: 'contain' }}
        />
      </span>
      <span className="brand__text">
        <span className="brand__name">Legal Lens</span>
        {!compact && <span className="brand__product">Legal Drafting Assistant</span>}
      </span>
    </Link>
  );
}
