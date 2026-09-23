import { useEffect, useState } from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { StatusMark, ToolHeader, ToolLoading, ToolError, DemoNotice } from './IntelShared';
import { BlockPreview } from './BlockPreview';
import './ClausesTool.css';

const PRIORITY = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };

function ClauseCard({ clause, added, intel, nav }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const present = clause.status === 'present' || added;
  const statusText = added
    ? 'Added to draft'
    : clause.status === 'present'
      ? 'Similar section found'
      : 'Possible missing section';
  const locateText =
    clause.content.find((b) => b.type === 'heading')?.content?.[0]?.text ?? clause.detect[0];

  return (
    <li className="intel-card clause">
      <div className="intel-card__top">
        <p className="intel-card__title">{clause.name}</p>
        <StatusMark status={present ? 'present' : 'warning'} showLabel={false} />
      </div>
      <div className="intel-card__badges">
        <Badge tone={present ? 'neutral' : 'outline'}>{statusText}</Badge>
        <Badge tone="demo">{PRIORITY[clause.priority]}</Badge>
      </div>
      <p className="intel-card__text">{clause.why}</p>
      {previewOpen && (
        <BlockPreview
          blocks={intel.hydrateBlocks(clause.content)}
          label={`Preview of ${clause.name}`}
        />
      )}
      <div className="intel-card__actions">
        <Button
          size="sm"
          variant="secondary"
          icon={previewOpen ? EyeOff : Eye}
          onClick={() => setPreviewOpen((v) => !v)}
          aria-expanded={previewOpen}
        >
          {previewOpen ? 'Hide preview' : 'Preview clause'}
        </Button>
        {!present && (
          <Button size="sm" icon={Plus} onClick={() => intel.addClause(clause)}>
            Add to Draft
          </Button>
        )}
        {present && (
          <Button size="sm" variant="secondary" onClick={() => nav.goToText(locateText)}>
            Locate
          </Button>
        )}
        {!present && (
          <Button size="sm" variant="ghost" onClick={() => intel.dismissClause(clause.id)}>
            Dismiss
          </Button>
        )}
      </div>
    </li>
  );
}

export function ClausesTool({ intel, nav, documentTypeName }) {
  const state = intel.results.clauses;
  const { run } = intel;

  useEffect(() => {
    if (state.status === 'idle') run('clauses');
  }, [state.status, run]);

  const suggestions = (state.data?.suggestions ?? []).filter(
    (s) => !intel.dismissedClauses.has(s.id),
  );
  const missing = suggestions.filter(
    (s) => s.status === 'possibly_missing' && !intel.addedClauses.has(s.id),
  );
  const present = suggestions.filter((s) => s.status === 'present' || intel.addedClauses.has(s.id));

  return (
    <div className="clauses">
      <ToolHeader
        title="Missing Clauses"
        description={`Sections commonly found in a ${documentTypeName ?? 'document'} of this kind.`}
        onRun={() => run('clauses')}
        runLabel="Check clauses"
        state={state}
      />
      <DemoNotice>
        Demo suggestion — review before use. Sample wording only; it does not state any legal
        requirement.
      </DemoNotice>

      {state.status === 'loading' && !state.data && <ToolLoading />}
      {state.status === 'error' && (
        <ToolError message={state.error} onRetry={() => run('clauses')} />
      )}

      {state.data && (
        <>
          <p className="intel-section-title">Possibly missing ({missing.length})</p>
          {missing.length ? (
            <ul className="intel-list">
              {missing.map((c) => (
                <ClauseCard key={c.id} clause={c} added={false} intel={intel} nav={nav} />
              ))}
            </ul>
          ) : (
            <p className="clauses__empty">No suggested sections outstanding.</p>
          )}
          {present.length > 0 && (
            <>
              <p className="intel-section-title">Already in draft ({present.length})</p>
              <ul className="intel-list">
                {present.map((c) => (
                  <ClauseCard
                    key={c.id}
                    clause={c}
                    added={intel.addedClauses.has(c.id)}
                    intel={intel}
                    nav={nav}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
