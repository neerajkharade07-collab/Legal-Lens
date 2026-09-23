import { useEffect, useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { ToolHeader, ToolLoading, ToolError, DemoNotice } from './IntelShared';
import { SourceNoticeModal } from './SourceNoticeModal';
import './CitationsTool.css';

export function CitationsTool({ intel, nav }) {
  const state = intel.results.citations;
  const { run } = intel;
  const [sourceFor, setSourceFor] = useState(null);

  useEffect(() => {
    if (state.status === 'idle') run('citations');
  }, [state.status, run]);

  const citations = state.data?.citations ?? [];

  return (
    <div className="citations">
      <ToolHeader
        title="Citations"
        description="References in this draft and their verification status."
        onRun={() => run('citations')}
        runLabel="Scan references"
        state={state}
        stale={intel.isStale('citations')}
      />
      <DemoNotice>
        Demo placeholders only. These are not real citations — no case names, section numbers,
        decisions or links are provided until verified sources are connected.
      </DemoNotice>

      {state.status === 'loading' && !state.data && <ToolLoading />}
      {state.status === 'error' && (
        <ToolError message={state.error} onRetry={() => run('citations')} />
      )}

      {state.data && (
        <ul className="intel-list">
          {citations.map((c) => (
            <li key={c.id} className="intel-card">
              <p className="intel-card__title">{c.title}</p>
              <p className="intel-card__meta">Type: {c.type}</p>
              <div className="intel-card__badges">
                <Badge tone="outline">Unverified</Badge>
                <Badge tone="outline">Requires source</Badge>
                <Badge tone="demo">Demo</Badge>
              </div>
              <p className="citations__usage">
                <span className={c.used ? 'is-used' : ''}>
                  {c.used ? 'Used in document' : 'Not used in document'}
                </span>
              </p>
              <div className="intel-card__actions">
                {c.used ? (
                  <Button size="sm" variant="secondary" onClick={() => nav.goToText(c.match[0])}>
                    Locate in document
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => intel.insertCitation(c)}>
                    Insert placeholder
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSourceFor(c.title)}>
                  Verify source
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SourceNoticeModal
        open={Boolean(sourceFor)}
        subject={sourceFor}
        onClose={() => setSourceFor(null)}
      />
    </div>
  );
}
