import { useEffect, useState } from 'react';
import { DemoBadge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  StatusMark,
  SeverityLabel,
  ToolHeader,
  ToolLoading,
  ToolError,
  DemoNotice,
} from './IntelShared';
import { cn } from '../../utils/cn';
import './HealthTool.css';

const CATEGORY_LABEL = {
  completeness: 'Completeness',
  consistency: 'Consistency',
  formatting: 'Formatting',
  clarity: 'Clarity',
  placeholders: 'Placeholders',
  risks: 'Potential risks',
};
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function FindingCard({ finding, nav, onDismiss, locateLabel }) {
  const loc = finding.location;
  const fieldKey = loc?.kind === 'field' || loc?.kind === 'token' ? loc.key : null;
  const canLocate = loc && (loc.kind === 'text' || loc.inDocument);
  return (
    <li className="intel-card finding">
      <div className="intel-card__top">
        <SeverityLabel severity={finding.severity} />
        <span className="intel-card__meta">{CATEGORY_LABEL[finding.category]}</span>
      </div>
      <p className="intel-card__title">{finding.title}</p>
      <p className="intel-card__text">{finding.explanation}</p>
      {loc?.label && (
        <p className="intel-card__meta">
          Location: {loc.kind === 'text' ? 'document text' : `${loc.label}`}
        </p>
      )}
      <p className="finding__action">
        <span>Suggested action:</span> {finding.suggestedAction}
      </p>
      <div className="intel-card__actions">
        {fieldKey && (
          <Button size="sm" variant="secondary" onClick={() => nav.goToField(fieldKey)}>
            Go to field
          </Button>
        )}
        {canLocate && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (loc.kind === 'text' ? nav.goToText(loc.text) : nav.goToToken(loc.key))}
          >
            {locateLabel}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDismiss(finding.id)}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

export function HealthTool({ intel, nav, locateLabel = 'Go to document' }) {
  const state = intel.results.health;
  const { run } = intel;
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (state.status === 'idle') run('health');
  }, [state.status, run]);

  const data = state.data;
  const active = (data?.findings ?? [])
    .filter((f) => !intel.dismissedFindings.has(f.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const shown = filter === 'all' ? active : active.filter((f) => f.category === filter);
  const dismissedCount = (data?.findings ?? []).length - active.length;

  return (
    <div className="health">
      <ToolHeader
        title="Document Health"
        description="Checks structure, completeness and consistency of the draft."
        onRun={() => run('health')}
        runLabel="Run health check"
        state={state}
        stale={intel.isStale('health')}
      />

      {state.status === 'loading' && !data && <ToolLoading />}
      {state.status === 'error' && (
        <ToolError message={state.error} onRetry={() => run('health')} />
      )}

      {data && (
        <>
          <div className="health__score">
            <p className="health__number">
              {data.score}
              <span>/100</span>
            </p>
            <DemoBadge>Demo analysis</DemoBadge>
          </div>

          <ul className="health__categories" aria-label="Categories">
            {data.categories.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cn('health__category', filter === c.id && 'is-active')}
                  onClick={() => setFilter(filter === c.id ? 'all' : c.id)}
                  aria-pressed={filter === c.id}
                >
                  <span className="health__category-name">{c.label}</span>
                  <StatusMark status={c.status} />
                </button>
              </li>
            ))}
          </ul>

          <div className="health__list-head">
            <p className="intel-section-title">
              {filter === 'all' ? 'All findings' : CATEGORY_LABEL[filter]} ({shown.length})
            </p>
            {filter !== 'all' && (
              <Button size="sm" variant="link" onClick={() => setFilter('all')}>
                Show all
              </Button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="health__empty">No findings in this category.</p>
          ) : (
            <ul className="intel-list">
              {shown.map((f) => (
                <FindingCard
                  key={f.id}
                  finding={f}
                  nav={nav}
                  onDismiss={intel.dismissFinding}
                  locateLabel={locateLabel}
                />
              ))}
            </ul>
          )}

          {dismissedCount > 0 && (
            <Button size="sm" variant="link" onClick={intel.restoreFindings}>
              Show {dismissedCount} dismissed finding{dismissedCount === 1 ? '' : 's'}
            </Button>
          )}

          <DemoNotice>
            Demo analysis of document structure only. It does not assess the legal merits, validity
            or sufficiency of the document.
          </DemoNotice>
        </>
      )}
    </div>
  );
}
