import { Star, ArrowRight } from 'lucide-react';
import { DOCUMENT_TYPES } from '../../data/documentTypes';
import { useFavoriteTemplates } from '../../hooks/useFavoriteTemplates';
import { useToast } from '../../hooks/useToast';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';
import './TemplatesPanel.css';

export function TemplatesPanel({ onUseTemplate }) {
  const { isFavorite, toggleFavorite } = useFavoriteTemplates();
  const { toast } = useToast();

  function handleFavorite(template) {
    const added = toggleFavorite(template.id);
    toast({
      title: added ? 'Added to favourites' : 'Removed from favourites',
      description: template.name,
      variant: added ? 'success' : 'default',
    });
  }

  return (
    <section className="panel templates-panel" aria-labelledby="templates-panel-title">
      <header className="panel__header">
        <div className="panel__heading">
          <h2 id="templates-panel-title" className="panel__title">
            Templates
          </h2>
        </div>
        <Button variant="link" size="sm" to="/templates">
          Library
        </Button>
      </header>
      <p className="templates-panel__note">
        {DOCUMENT_TYPES.length} starter templates. More document types will be added over time.
      </p>

      <ul className="templates-panel__list">
        {DOCUMENT_TYPES.map((template) => {
          const favorite = isFavorite(template.id);
          return (
            <li key={template.id} className="templates-panel__item">
              <span className="templates-panel__icon" aria-hidden="true">
                <DocumentTypeIcon name={template.icon} size={16} />
              </span>
              <div className="templates-panel__text">
                <p className="templates-panel__name">{template.name}</p>
                <p className="templates-panel__category">{template.category}</p>
              </div>
              <button
                type="button"
                className={cn('templates-panel__fav', favorite && 'is-active')}
                aria-pressed={favorite}
                aria-label={`${favorite ? 'Remove' : 'Add'} ${template.name} ${favorite ? 'from' : 'to'} favourites`}
                onClick={() => handleFavorite(template)}
              >
                <Star size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <Button
                variant="secondary"
                size="sm"
                iconRight={ArrowRight}
                onClick={() => onUseTemplate(template)}
                aria-label={`Use template: ${template.name}`}
              >
                Use
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
