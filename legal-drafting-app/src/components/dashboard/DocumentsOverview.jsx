import { useMemo, useState } from 'react';
import { FileText, RotateCcw, Plus } from 'lucide-react';
import { useDocuments } from '../../hooks/useDocuments';
import { Tabs } from '../common/Tabs';
import { Button } from '../common/Button';
import { DemoBadge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common/Skeleton';
import { DocumentRow } from './DocumentRow';
import './DocumentsOverview.css';

const MAX_ROWS = 5;
const WEEK = 7 * 24 * 60 * 60 * 1000;

const byDate = (field) => (a, b) => new Date(b[field]) - new Date(a[field]);

const VIEWS = {
  recent: {
    label: 'Recent documents',
    timeField: 'createdAt',
    select: (docs) => [...docs].sort(byDate('createdAt')),
    empty: 'No documents yet',
  },
  drafts: {
    label: 'Drafts',
    timeField: 'updatedAt',
    select: (docs) => docs.filter((d) => d.status === 'draft').sort(byDate('updatedAt')),
    empty: 'No drafts in progress',
  },
  edited: {
    label: 'Recently edited',
    timeField: 'updatedAt',
    select: (docs, now) =>
      docs.filter((d) => now - new Date(d.updatedAt).getTime() < WEEK).sort(byDate('updatedAt')),
    empty: 'Nothing edited in the last 7 days',
  },
};

export function DocumentsOverview({ onCreateNew }) {
  const { documents, status, error, reload } = useDocuments();
  const [view, setView] = useState('edited');
  const [now] = useState(() => Date.now());

  const lists = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(VIEWS).map(([id, config]) => [id, config.select(documents, now)]),
      ),
    [documents, now],
  );

  const tabs = Object.entries(VIEWS).map(([id, config]) => ({
    id,
    label: config.label,
    count: status === 'ready' ? lists[id].length : undefined,
  }));

  const rows = lists[view].slice(0, MAX_ROWS);
  const hasSamples = documents.some((doc) => doc.isSample);

  return (
    <section className="panel docs-overview" aria-labelledby="docs-overview-title">
      <header className="panel__header">
        <div className="panel__heading">
          <h2 id="docs-overview-title" className="panel__title">
            Your documents
          </h2>
          {hasSamples && <DemoBadge>Sample documents</DemoBadge>}
        </div>
        <Button variant="link" size="sm" to="/documents">
          View all
        </Button>
      </header>

      <Tabs
        tabs={tabs}
        value={view}
        onChange={setView}
        idPrefix="docs-overview"
        label="Document views"
        className="docs-overview__tabs"
      />

      <div
        id="docs-overview-panel"
        role="tabpanel"
        aria-labelledby={`docs-overview-tab-${view}`}
        aria-busy={status === 'loading'}
        className="docs-overview__body"
      >
        {status === 'loading' && (
          <ul className="docs-overview__skeleton" aria-label="Loading documents">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton width={36} height={36} />
                <div>
                  <Skeleton width="60%" />
                  <Skeleton width="35%" height={10} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {status === 'error' && (
          <EmptyState
            compact
            icon={RotateCcw}
            title="Documents could not be loaded"
            description={error}
            action={
              <Button variant="secondary" size="sm" icon={RotateCcw} onClick={reload}>
                Try again
              </Button>
            }
          />
        )}

        {status === 'ready' && rows.length === 0 && (
          <EmptyState
            compact
            icon={FileText}
            title={VIEWS[view].empty}
            description="Start a new draft and it will appear here."
            action={
              <Button size="sm" icon={Plus} onClick={onCreateNew}>
                Create New Draft
              </Button>
            }
          />
        )}

        {status === 'ready' && rows.length > 0 && (
          <ul className="docs-overview__list">
            {rows.map((doc) => (
              <DocumentRow key={doc.id} document={doc} timeField={VIEWS[view].timeField} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
