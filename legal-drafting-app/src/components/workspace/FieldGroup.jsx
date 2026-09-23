import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { isFilled } from '../../utils/fieldTokens';
import { DetailField } from './DetailField';

export function FieldGroup({
  group,
  open,
  onToggle,
  fields,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  activeKey,
  extractedKeys,
  presentKeys,
  registerInput,
}) {
  const filled = group.fields.filter((f) => isFilled(fields[f.key])).length;
  const panelId = `group-${group.id}`;
  return (
    <section className={cn('field-group', open && 'is-open')}>
      <h3 className="field-group__heading">
        <button
          type="button"
          className="field-group__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(group.id)}
        >
          <span className="field-group__title">{group.title}</span>
          <span
            className={cn('field-group__count', filled === group.fields.length && 'is-complete')}
          >
            {filled}/{group.fields.length}
          </span>
          <ChevronDown
            className="field-group__chevron"
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={panelId} className="field-group__body" hidden={!open}>
        {group.fields.map((field) => (
          <DetailField
            key={field.key}
            ref={(node) => registerInput(field.key, node)}
            field={field}
            value={fields[field.key]}
            onChange={onFieldChange}
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
            active={activeKey === field.key}
            extracted={extractedKeys.has(field.key)}
            missingFromDraft={presentKeys !== null && !presentKeys.has(field.key)}
          />
        ))}
      </div>
    </section>
  );
}
