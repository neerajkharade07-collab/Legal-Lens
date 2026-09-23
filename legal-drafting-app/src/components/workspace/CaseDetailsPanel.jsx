import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, Info, X } from 'lucide-react';
import { FieldGroup } from './FieldGroup';
import { DemoBadge } from '../common/Badge';
import './CaseDetailsPanel.css';

/**
 * Left panel: schema-driven case-detail fields, grouped and collapsible.
 * `focusRequest` ({ key, n }) opens the field's group and focuses it
 * (used when a token is clicked in the document).
 */
export function CaseDetailsPanel({
  schema,
  fields,
  onFieldChange,
  activeKey,
  onActiveKeyChange,
  completion,
  extraction,
  presentKeys,
  setup,
  source,
  focusRequest,
  onCollapse,
}) {
  const [openGroups, setOpenGroups] = useState(
    () => new Set(schema.groups.slice(0, 2).map((g) => g.id)),
  );
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const inputs = useRef(new Map());

  // A field counts as "extracted" while it still holds the extracted value.
  const extractedKeys = useMemo(
    () =>
      new Set(
        Object.entries(extraction?.values ?? {})
          .filter(([key, value]) => fields[key] === value)
          .map(([key]) => key),
      ),
    [extraction, fields],
  );
  const extractedCount = Object.keys(extraction?.values ?? {}).length;

  useEffect(() => {
    if (!focusRequest?.key) return;
    const group = schema.groups.find((g) => g.fields.some((f) => f.key === focusRequest.key));
    if (group) setOpenGroups((current) => new Set(current).add(group.id));
    // Wait for the group to render open before focusing.
    requestAnimationFrame(() => {
      const input = inputs.current.get(focusRequest.key);
      input?.focus({ preventScroll: true });
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [focusRequest, schema]);

  const toggleGroup = (id) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOpen = openGroups.size === schema.groups.length;

  return (
    <div className="details">
      <div className="details__head">
        <div className="details__title-row">
          <h2 className="details__title">Case details</h2>
          <button
            type="button"
            className="details__link"
            onClick={() =>
              setOpenGroups(allOpen ? new Set() : new Set(schema.groups.map((g) => g.id)))
            }
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
          {onCollapse && (
            <button
              type="button"
              className="panel-icon-btn"
              onClick={onCollapse}
              aria-label="Collapse case details"
            >
              <PanelLeftClose size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="details__completion">
          <strong>{completion.filled}</strong> of {completion.total} fields completed
        </p>
        <div
          className="details__meter"
          role="progressbar"
          aria-label="Fields completed"
          aria-valuemin={0}
          aria-valuemax={completion.total}
          aria-valuenow={completion.filled}
        >
          <span style={{ width: `${completion.percent}%` }} />
        </div>
        <p className="details__note">Counts filled fields only — not legal completeness.</p>
      </div>

      <div className="details__scroll">
        {extractedCount > 0 && !noticeDismissed && (
          <div className="details__notice" role="note">
            <Info size={15} strokeWidth={1.75} aria-hidden="true" />
            <p>
              <strong>
                {extractedCount} field{extractedCount === 1 ? ' was' : 's were'} pre-filled
              </strong>{' '}
              from your description by simple pattern matching. This is a demo extraction, not AI —
              please check each value.
            </p>
            <button
              type="button"
              className="details__notice-close"
              onClick={() => setNoticeDismissed(true)}
              aria-label="Dismiss notice"
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        )}

        {source && (
          <div className="details__source">
            <p className="details__source-title">
              {source.kind === 'compared-document'
                ? 'Created from a comparison'
                : 'Opened from a reviewed document'}
            </p>
            {source.file && (
              <p className="details__source-file">
                {source.file.name} · {source.file.label} · {source.file.sizeLabel}
              </p>
            )}
            {source.files && (
              <p className="details__source-file">
                {source.files.original?.name} → {source.files.revised?.name}
              </p>
            )}
          </div>
        )}

        {schema.groups.length === 0 && (
          <p className="details__empty">
            This document has no structured case-detail fields. Edit the text directly in the
            document; the legal assistant tools still work on it.
          </p>
        )}

        {setup?.description && (
          <details className="details__matter">
            <summary>
              Your description <DemoBadge>From setup</DemoBadge>
            </summary>
            <p>{setup.description}</p>
          </details>
        )}

        {schema.groups.map((group) => (
          <FieldGroup
            key={group.id}
            group={group}
            open={openGroups.has(group.id)}
            onToggle={toggleGroup}
            fields={fields}
            onFieldChange={onFieldChange}
            onFieldFocus={onActiveKeyChange}
            onFieldBlur={(key) => {
              if (activeKey === key) onActiveKeyChange(null);
            }}
            activeKey={activeKey}
            extractedKeys={extractedKeys}
            presentKeys={presentKeys}
            registerInput={(key, node) => {
              if (node) inputs.current.set(key, node);
              else inputs.current.delete(key);
            }}
          />
        ))}
      </div>
    </div>
  );
}
