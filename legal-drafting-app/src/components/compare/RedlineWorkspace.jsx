import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, ListChecks, Equal } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge, DemoBadge } from '../common/Badge';
import { Tabs } from '../common/Tabs';
import { ViewTabs } from '../common/ViewTabs';
import { EmptyState } from '../common/EmptyState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { RedlineView } from './RedlineView';
import { SideBySideView } from './SideBySideView';
import { CleanView } from './CleanView';
import { ChangesPanel } from './ChangesPanel';
import { cn } from '../../utils/cn';
import { scrollWithin } from '../../utils/scrollWithin';
import './RedlineWorkspace.css';

const MODES = [
  { id: 'redline', label: 'Redline' },
  { id: 'side', label: 'Side-by-Side' },
  { id: 'clean', label: 'Clean Version' },
];

const MOBILE_VIEWS = [
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'changes', label: 'Changes', icon: ListChecks },
];

export function RedlineWorkspace({ compare }) {
  const { result, mode, activeId } = compare;
  const scrollRef = useRef(null);
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  const [view, setView] = useState('document');

  // Scroll the active change into view in the document area.
  useEffect(() => {
    if (!activeId || mode === 'clean') return;
    const container = scrollRef.current;
    const el = container?.querySelector(`[data-change-id="${activeId}"]`);
    // On phones the document area is not its own scroller — fall back to the page.
    if (container && container.scrollHeight > container.clientHeight + 1)
      scrollWithin(container, el);
    else el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeId, mode, view]);

  const selectChange = (id) => {
    compare.setActiveId(id);
    if (isNarrow) setView('document');
  };

  const noChanges = result.changes.length === 0;

  return (
    <div className="rlw">
      <header className="rlw__header">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={compare.reset}>
          Compare other documents
        </Button>
        <div className="rlw__title">
          <h1>
            {compare.original.info.name} <span aria-hidden="true">→</span>{' '}
            {compare.revised.info.name}
          </h1>
          <div className="rlw__badges">
            <DemoBadge>Demo comparison — sample versions</DemoBadge>
            <Badge tone="outline">{result.summary.total} changes</Badge>
          </div>
        </div>
        <Tabs
          tabs={MODES}
          value={mode}
          onChange={compare.setMode}
          idPrefix="compare-mode"
          label="Comparison view"
          className="rlw__modes"
        />
      </header>

      <div className="rlw__subbar">
        <ul className="rlw__legend" aria-label="Legend">
          <li>
            <ins className="rl-ins">Added</ins>
          </li>
          <li>
            <del className="rl-del">Removed</del>
          </li>
          <li>
            <span className="rlw__legend-mod">Modified</span>
          </li>
        </ul>
        <p className="rlw__notice">{result.notice}</p>
      </div>

      {isNarrow && !noChanges && (
        <ViewTabs
          views={MOBILE_VIEWS}
          value={view}
          onChange={setView}
          label="Comparison panels"
          className="rlw__tabs"
        />
      )}

      {noChanges ? (
        <EmptyState
          icon={Equal}
          title="No changes found"
          description="The two versions contain the same text."
          action={<Button onClick={compare.reset}>Compare other documents</Button>}
        />
      ) : (
        <div className="rlw__body">
          <section
            ref={scrollRef}
            id="compare-mode-panel"
            role="tabpanel"
            aria-labelledby={`compare-mode-tab-${mode}`}
            className={cn('rlw__doc', isNarrow && view !== 'document' && 'is-hidden')}
          >
            {mode === 'redline' && (
              <RedlineView
                result={result}
                decisions={compare.decisions}
                activeId={activeId}
                onSelect={selectChange}
              />
            )}
            {mode === 'side' && (
              <SideBySideView
                result={result}
                decisions={compare.decisions}
                activeId={activeId}
                onSelect={selectChange}
                originalName={compare.original.info.name}
                revisedName={compare.revised.info.name}
              />
            )}
            {mode === 'clean' && <CleanView compare={compare} />}
          </section>
          <aside
            className={cn('rlw__changes', isNarrow && view !== 'changes' && 'is-hidden')}
            aria-label="Changes"
          >
            <ChangesPanel compare={{ ...compare, setActiveId: selectChange }} />
          </aside>
        </div>
      )}
    </div>
  );
}
