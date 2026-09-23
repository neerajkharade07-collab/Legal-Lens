import { Check } from 'lucide-react';
import { DOCUMENT_TYPES } from '../../data/documentTypes';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { cn } from '../../utils/cn';
import './DocumentTypePicker.css';

/** Radio-group of document types (native radios → arrow-key navigation for free). */
export function DocumentTypePicker({ value, onChange, inputRef, invalid, errorId }) {
  return (
    <fieldset
      className={cn('type-picker', invalid && 'is-invalid')}
      aria-describedby={invalid ? errorId : undefined}
    >
      <legend className="setup-label">Document type</legend>
      <div className="type-picker__grid">
        {DOCUMENT_TYPES.map((type, index) => {
          const selected = value === type.id;
          return (
            <label key={type.id} className={cn('type-picker__option', selected && 'is-selected')}>
              <input
                ref={index === 0 ? inputRef : undefined}
                type="radio"
                name="draft-document-type"
                value={type.id}
                checked={selected}
                onChange={() => onChange(type.id)}
                className="visually-hidden"
              />
              <span className="type-picker__icon" aria-hidden="true">
                <DocumentTypeIcon name={type.icon} size={18} />
              </span>
              <span className="type-picker__text">
                <span className="type-picker__name">{type.name}</span>
                <span className="type-picker__category">{type.category}</span>
              </span>
              <span className="type-picker__check" aria-hidden="true">
                {selected && <Check size={12} strokeWidth={2.5} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
