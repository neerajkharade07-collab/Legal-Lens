import { useMemo, useRef } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { BlockPreview } from '../intelligence/BlockPreview';
import { templatesService } from '../../services';
import { TEMPLATE_DISCLAIMER, TEMPLATE_STATUS_LABEL } from '../../data/templates/demoTemplates';
import '../intelligence/IntelShared.css';

export function TemplatePreviewModal({ template, onClose, onUse }) {
  const primaryRef = useRef(null);
  const preview = useMemo(
    () => (template ? templatesService.getTemplatePreview(template) : null),
    [template],
  );
  if (!template) return null;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      labelledBy="tpl-preview-title"
      describedBy="tpl-preview-disclaimer"
      initialFocusRef={primaryRef}
      className="tpl-preview"
    >
      <header className="tpl-preview__header">
        <span className="tpl-card__icon" aria-hidden="true">
          <DocumentTypeIcon name={template.icon} size={20} />
        </span>
        <div className="tpl-preview__heading">
          <p className="eyebrow">
            {template.categories.map(templatesService.categoryLabel).join(' · ')}
          </p>
          <h2 id="tpl-preview-title" className="tpl-preview__title">
            {template.name}
          </h2>
          <div className="tpl-card__badges">
            <Badge tone="outline">
              {template.structured ? 'Structured fields' : 'Free-text template'}
            </Badge>
            <Badge tone="demo">{TEMPLATE_STATUS_LABEL}</Badge>
            <Badge tone="outline">{template.languages.join(', ')}</Badge>
          </div>
        </div>
        <ModalCloseButton onClick={onClose} />
      </header>

      <div className="tpl-preview__body">
        <p id="tpl-preview-disclaimer" className="tpl-preview__disclaimer">
          <Info size={15} strokeWidth={1.75} aria-hidden="true" />
          {TEMPLATE_DISCLAIMER}
        </p>

        <section className="tpl-preview__section">
          <h3>Purpose</h3>
          <p>{template.purpose}</p>
        </section>

        <section className="tpl-preview__section">
          <h3>Sections included</h3>
          <ol className="tpl-preview__sections">
            {template.sections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="tpl-preview__section">
          <h3>Sample structure</h3>
          <p className="tpl-preview__hint">
            {template.structured
              ? 'Bracketed labels are linked to case-detail fields you fill in the workspace.'
              : 'Bracketed text marks details to replace in the editor.'}
          </p>
          <div className="tpl-preview__sample">
            <BlockPreview blocks={preview.content} label={`Sample structure of ${template.name}`} />
          </div>
        </section>
      </div>

      <footer className="tpl-preview__footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button ref={primaryRef} iconRight={ArrowRight} onClick={() => onUse(template)}>
          Use Template
        </Button>
      </footer>
    </Modal>
  );
}
