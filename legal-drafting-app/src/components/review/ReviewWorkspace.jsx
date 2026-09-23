import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, ClipboardList, ListChecks } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge, DemoBadge } from '../common/Badge';
import { ViewTabs } from '../common/ViewTabs';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useToast } from '../../hooks/useToast';
import { ReviewFileInfo } from './ReviewFileInfo';
import { ExtractedTextPanel } from './ExtractedTextPanel';
import { ReviewFindingsPanel } from './ReviewFindingsPanel';
import { cn } from '../../utils/cn';
import './ReviewWorkspace.css';

const MOBILE_VIEWS = [
  { id: 'file', label: 'File', icon: ClipboardList },
  { id: 'text', label: 'Text', icon: FileText },
  { id: 'findings', label: 'Findings', icon: ListChecks },
];

/** Three-panel review layout: file info · extracted text · findings. */
export function ReviewWorkspace({ review }) {
  const textareaRef = useRef(null);
  const isNarrow = useMediaQuery('(max-width: 1023px)');
  const [view, setView] = useState('text');
  const { toast } = useToast();

  /** Select `query` in the extracted text and scroll it into view. */
  const selectInText = useCallback(
    (query) => {
      const area = textareaRef.current;
      if (!area || !query) return;
      const index = area.value.toLowerCase().indexOf(query.toLowerCase());
      if (index < 0) {
        toast({ title: 'Text not found', description: 'It may have been edited.' });
        return;
      }
      area.focus({ preventScroll: true });
      area.setSelectionRange(index, index + query.length);
      const line = area.value.slice(0, index).split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 24;
      area.scrollTop = Math.max(0, line * lineHeight - area.clientHeight / 3);
      area.closest('.extracted__canvas')?.scrollTo({ top: 0 });
    },
    [toast],
  );

  const nav = useMemo(() => {
    const go = (query) => {
      if (isNarrow) setView('text');
      setTimeout(() => selectInText(query), isNarrow ? 60 : 0);
    };
    return { goToText: go, goToToken: go, goToField: () => {} };
  }, [isNarrow, selectInText]);

  const show = (id) => !isNarrow || view === id;

  return (
    <div className="rw">
      <header className="rw__header">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={review.reset}>
          Review another document
        </Button>
        <div className="rw__title">
          <h1>{review.selected.info.name}</h1>
          <div className="rw__badges">
            <Badge tone="outline">{review.typeName}</Badge>
            <DemoBadge>Demo review</DemoBadge>
            <Badge tone="demo">Requires verification</Badge>
          </div>
        </div>
        <Button iconRight={ArrowRight} onClick={review.openInEditor}>
          Open in Drafting Editor
        </Button>
      </header>

      {isNarrow && (
        <ViewTabs
          views={MOBILE_VIEWS}
          value={view}
          onChange={setView}
          label="Review views"
          className="rw__tabs"
        />
      )}

      <div className="rw__body">
        <aside
          className={cn('rw__file', !show('file') && 'is-hidden')}
          aria-label="Uploaded document"
        >
          <ReviewFileInfo review={review} />
        </aside>
        <section
          className={cn('rw__text', !show('text') && 'is-hidden')}
          aria-label="Extracted text"
        >
          <ExtractedTextPanel review={review} textareaRef={textareaRef} />
        </section>
        <aside
          className={cn('rw__findings', !show('findings') && 'is-hidden')}
          aria-label="Review findings"
        >
          <ReviewFindingsPanel review={review} nav={nav} />
        </aside>
      </div>
    </div>
  );
}
