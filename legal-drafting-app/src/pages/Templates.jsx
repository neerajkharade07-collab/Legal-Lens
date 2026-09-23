import { useMemo, useState } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useFavoriteTemplates } from '../hooks/useFavoriteTemplates';
import { useTemplateActions } from '../hooks/useTemplateActions';
import { useToast } from '../hooks/useToast';
import { templatesService } from '../services';
import { TEMPLATE_DISCLAIMER } from '../data/templates/demoTemplates';
import { TemplateCard } from '../components/templates/TemplateCard';
import { TemplatePreviewModal } from '../components/templates/TemplatePreviewModal';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { DemoNotice } from '../components/intelligence/IntelShared';
import { cn } from '../utils/cn';
import './Templates.css';

/** Legal Template Library: search, categories, favourites, preview, use. */
export default function Templates() {
  useDocumentTitle('Template Library');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [previewing, setPreviewing] = useState(null);
  const { favorites, isFavorite, toggleFavorite } = useFavoriteTemplates();
  const { applyTemplate, recent } = useTemplateActions();
  const { toast } = useToast();

  const filters = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'favourites', label: 'Favourites' },
      ...(recent.length ? [{ id: 'recent', label: 'Recently used' }] : []),
      ...templatesService.TEMPLATE_CATEGORIES,
    ],
    [recent.length],
  );

  const results = useMemo(
    () => templatesService.searchTemplates({ query, category, favourites: favorites, recent }),
    [query, category, favorites, recent],
  );

  const handleFavourite = (template) => {
    const added = toggleFavorite(template.id);
    toast({
      title: added ? 'Added to favourites' : 'Removed from favourites',
      description: template.name,
      duration: 2000,
    });
  };

  const handleUse = (template) => {
    setPreviewing(null);
    applyTemplate(template);
  };

  const activeFilter = filters.find((f) => f.id === category);

  return (
    <div className="templates container">
      <header className="templates__head">
        <p className="eyebrow">Templates</p>
        <h1 className="templates__title">Template Library</h1>
        <p className="templates__lead">
          Drafting templates to start from. Structured templates open with case-detail fields;
          others open as editable documents.
        </p>
      </header>

      <DemoNotice>
        {TEMPLATE_DISCLAIMER} Templates are demo starting points and are not legally valid for every
        situation.
      </DemoNotice>

      <div className="templates__toolbar">
        <div className="templates__search">
          <label htmlFor="template-search" className="visually-hidden">
            Search templates
          </label>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            id="template-search"
            type="search"
            placeholder="Search templates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="templates__clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="templates__filters" role="group" aria-label="Filter by category">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cn('templates__chip', category === f.id && 'is-active')}
              aria-pressed={category === f.id}
              onClick={() => setCategory(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="templates__count" aria-live="polite">
        {results.length} template{results.length === 1 ? '' : 's'}
        {category !== 'all' && ` in ${activeFilter?.label}`}
        {query && ` matching “${query}”`}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={
            category === 'favourites' && !query
              ? 'No favourite templates yet'
              : query
                ? 'No templates match your search'
                : 'No templates in this category'
          }
          description={
            category === 'favourites' && !query
              ? 'Use the star on a template to keep it here.'
              : 'Try a different search term or category.'
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('');
                setCategory('all');
              }}
            >
              Show all templates
            </Button>
          }
        />
      ) : (
        <div className="templates__grid">
          {results.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              categoryLabels={template.categories.map(templatesService.categoryLabel)}
              favourite={isFavorite(template.id)}
              onToggleFavourite={handleFavourite}
              onPreview={setPreviewing}
              onUse={handleUse}
            />
          ))}
        </div>
      )}

      <TemplatePreviewModal
        template={previewing}
        onClose={() => setPreviewing(null)}
        onUse={handleUse}
      />
    </div>
  );
}
