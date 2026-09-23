import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { isFilled } from '../../utils/fieldTokens';

/** One case-detail input with filled/empty status and binding hints. */
export const DetailField = forwardRef(function DetailField(
  { field, value, onChange, onFocus, onBlur, extracted, missingFromDraft, active },
  ref,
) {
  const id = `field-${field.key}`;
  const hintId = `${id}-hint`;
  const filled = isFilled(value);
  const common = {
    id,
    ref,
    value: value ?? '',
    placeholder: field.placeholder ?? '',
    onChange: (event) => onChange(field.key, event.target.value),
    onFocus: () => onFocus(field.key),
    onBlur: () => onBlur(field.key),
    'aria-describedby': extracted || missingFromDraft ? hintId : undefined,
    className: 'detail-field__input',
  };

  return (
    <div
      className={cn('detail-field', filled && 'is-filled', active && 'is-active')}
      data-field={field.key}
    >
      <div className="detail-field__label-row">
        <span className="detail-field__status" aria-hidden="true" />
        <label htmlFor={id} className="detail-field__label">
          {field.label}
          <span className="visually-hidden">{filled ? ' (filled)' : ' (empty)'}</span>
        </label>
        {extracted && <span className="detail-field__tag">Demo extracted</span>}
      </div>
      {field.type === 'textarea' ? (
        <textarea {...common} rows={field.rows ?? 3} />
      ) : (
        <input
          {...common}
          type={field.type ?? 'text'}
          min={field.min}
          max={field.max}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
        />
      )}
      {(extracted || missingFromDraft) && (
        <p id={hintId} className="detail-field__hint">
          {missingFromDraft
            ? 'Not used in the draft — its placeholder was removed from the document.'
            : 'Pre-filled from your description by pattern matching. Please check.'}
        </p>
      )}
    </div>
  );
});
