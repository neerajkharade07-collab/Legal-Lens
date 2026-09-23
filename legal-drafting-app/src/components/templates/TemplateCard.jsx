import { Star, Eye, ArrowRight } from 'lucide-react';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { TEMPLATE_STATUS_LABEL } from '../../data/templates/demoTemplates';
import { cn } from '../../utils/cn';

export function TemplateCard({
  template,
  categoryLabels,
  favourite,
  onToggleFavourite,
  onPreview,
  onUse,
}) {
  const headingId = `template-${template.id}`;
  return (
    <article className="tpl-card" aria-labelledby={headingId}>
      <div className="tpl-card__top">
        <span className="tpl-card__icon" aria-hidden="true">
          <DocumentTypeIcon name={template.icon} size={20} />
        </span>
        <button
          type="button"
          className={cn('tpl-card__fav', favourite && 'is-active')}
          aria-pressed={favourite}
          aria-label={`${favourite ? 'Remove' : 'Add'} ${template.name} ${favourite ? 'from' : 'to'} favourites`}
          onClick={() => onToggleFavourite(template)}
        >
          <Star size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <p className="tpl-card__category">{categoryLabels.join(' · ')}</p>
      <h2 id={headingId} className="tpl-card__title">
        {template.name}
      </h2>
      <p className="tpl-card__desc">{template.description}</p>
      <div className="tpl-card__badges">
        <Badge tone="outline">
          {template.structured ? 'Structured fields' : 'Free-text template'}
        </Badge>
        <Badge tone="demo">{TEMPLATE_STATUS_LABEL}</Badge>
      </div>
      <p className="tpl-card__meta">Language: {template.languages.join(', ')}</p>
      <div className="tpl-card__actions">
        <Button
          variant="secondary"
          size="sm"
          icon={Eye}
          onClick={() => onPreview(template)}
          aria-label={`Preview ${template.name}`}
        >
          Preview
        </Button>
        <Button
          size="sm"
          iconRight={ArrowRight}
          onClick={() => onUse(template)}
          aria-label={`Use template: ${template.name}`}
        >
          Use Template
        </Button>
      </div>
    </article>
  );
}
