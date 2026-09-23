import { ArrowRight } from 'lucide-react';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { Button } from '../common/Button';
import './DocumentTypeCard.css';

export function DocumentTypeCard({ type, onCreate }) {
  const headingId = `doc-type-${type.id}`;
  return (
    <article className="doc-type-card" aria-labelledby={headingId}>
      <div className="doc-type-card__top">
        <span className="doc-type-card__icon">
          <DocumentTypeIcon name={type.icon} size={22} />
        </span>
        <span className="doc-type-card__category">{type.category}</span>
      </div>
      <h3 id={headingId} className="doc-type-card__title">
        {type.name}
      </h3>
      <p className="doc-type-card__desc">{type.description}</p>
      <ul className="doc-type-card__sections" aria-label="Sections covered">
        {type.sections.map((section) => (
          <li key={section}>{section}</li>
        ))}
      </ul>
      <Button
        className="doc-type-card__cta"
        variant="secondary"
        iconRight={ArrowRight}
        fullWidth
        onClick={() => onCreate(type)}
        aria-label={`Create draft: ${type.name}`}
      >
        Create Draft
      </Button>
    </article>
  );
}
