import { Check, Plus } from 'lucide-react';
import './HeroPreview.css';

/**
 * Decorative product illustration — not live data. Hidden from assistive tech.
 */
export function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="hero-preview__page">
        <p className="hero-preview__doc-title">Leave and Licence Agreement</p>
        <p className="hero-preview__para">
          This Agreement is made and executed at <span className="field field--filled">Pune</span>{' '}
          on <span className="field">[AGREEMENT DATE]</span>, by and between{' '}
          <span className="field field--filled">Landlord name</span>, hereinafter called the
          “Licensor”, and <span className="field">[TENANT NAME]</span>, hereinafter called the
          “Licensee”.
        </p>
        <p className="hero-preview__heading">1. Premises</p>
        <span className="hero-preview__line" />
        <span className="hero-preview__line hero-preview__line--short" />
        <p className="hero-preview__heading">2. Licence fee and deposit</p>
        <span className="hero-preview__line" />
        <span className="hero-preview__line" />
        <span className="hero-preview__line hero-preview__line--mid" />
      </div>

      <div className="hero-preview__card hero-preview__card--health">
        <div className="hero-preview__card-head">
          <span>Document health</span>
          <span className="hero-preview__tag">Demo</span>
        </div>
        <p className="hero-preview__score">
          82<span>/100</span>
        </p>
        <div className="hero-preview__bar">
          <span style={{ width: '82%' }} />
        </div>
      </div>

      <div className="hero-preview__card hero-preview__card--clause">
        <div className="hero-preview__card-head">
          <span>Missing clause</span>
        </div>
        <p className="hero-preview__clause">Dispute resolution</p>
        <span className="hero-preview__add">
          <Plus size={12} strokeWidth={2} /> Add to draft
        </span>
      </div>

      <div className="hero-preview__card hero-preview__card--saved">
        <Check size={14} strokeWidth={2} /> Draft saved
      </div>
    </div>
  );
}
