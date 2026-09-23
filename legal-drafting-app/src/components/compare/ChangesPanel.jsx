import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { CHANGE_LABEL } from './compareText';
import { cn } from '../../utils/cn';
import { scrollWithin } from '../../utils/scrollWithin';

const excerpt = (text, n = 140) => (text.length > n ? `${text.slice(0, n)}…` : text);

function ChangeCard({ change, decision, active, onSelect, onDecide }) {
  return (
    <li
      data-card-id={change.id}
      className={cn(
        'change-card',
        `change-card--${change.type}`,
        active && 'is-active',
        decision && `is-${decision}`,
      )}
    >
      <button
        type="button"
        className="change-card__select"
        onClick={() => onSelect(change.id)}
        aria-current={active ? 'true' : undefined}
      >
        <span className="change-card__top">
          <span className="change-card__num">Change {change.number}</span>
          <span className={cn('change-card__type', `is-${change.type}`)}>
            {CHANGE_LABEL[change.type]}
          </span>
        </span>
        <span className="change-card__section">{change.section}</span>
        {change.originalText && (
          <span className="change-card__text">
            <span className="change-card__label">Original</span>
            <span className="change-card__orig">{excerpt(change.originalText)}</span>
          </span>
        )}
        {change.revisedText && (
          <span className="change-card__text">
            <span className="change-card__label">Revised</span>
            <span className="change-card__rev">{excerpt(change.revisedText)}</span>
          </span>
        )}
      </button>
      <div className="change-card__actions">
        <Button
          size="sm"
          variant={decision === 'accepted' ? 'primary' : 'secondary'}
          icon={Check}
          aria-pressed={decision === 'accepted'}
          onClick={() => onDecide(change.id, 'accepted')}
        >
          {decision === 'accepted' ? 'Accepted' : 'Accept'}
        </Button>
        <Button
          size="sm"
          variant={decision === 'rejected' ? 'primary' : 'secondary'}
          icon={X}
          aria-pressed={decision === 'rejected'}
          onClick={() => onDecide(change.id, 'rejected')}
        >
          {decision === 'rejected' ? 'Rejected' : 'Reject'}
        </Button>
      </div>
    </li>
  );
}

/** Right panel: navigable list of changes with accept / reject. */
export function ChangesPanel({ compare }) {
  const listRef = useRef(null);
  const { changes, activeId, activeIndex, decisions, counts, result } = compare;

  useEffect(() => {
    const list = listRef.current;
    const card = list?.querySelector(`[data-card-id="${activeId}"]`);
    if (list && list.scrollHeight > list.clientHeight + 1)
      scrollWithin(list, card, { align: 'nearest' });
  }, [activeId]);

  return (
    <div className="changes">
      <div className="changes__head">
        <h2 className="changes__title">Changes</h2>
        <div className="changes__summary">
          <Badge tone="outline">{result.summary.added} added</Badge>
          <Badge tone="outline">{result.summary.removed} removed</Badge>
          <Badge tone="outline">{result.summary.modified} modified</Badge>
        </div>
        <div className="changes__nav">
          <Button
            size="sm"
            variant="secondary"
            icon={ChevronLeft}
            onClick={() => compare.step(-1)}
            aria-label="Previous change"
          />
          <p className="changes__position" aria-live="polite">
            Change {changes.length ? activeIndex + 1 : 0} of {changes.length}
          </p>
          <Button
            size="sm"
            variant="secondary"
            icon={ChevronRight}
            onClick={() => compare.step(1)}
            aria-label="Next change"
          />
        </div>
        <div className="changes__bulk">
          <Button
            size="sm"
            variant="secondary"
            icon={Check}
            onClick={() => compare.decideAll('accepted')}
          >
            Accept All
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={X}
            onClick={() => compare.decideAll('rejected')}
          >
            Reject All
          </Button>
        </div>
        <p className="changes__progress">
          {counts.accepted} accepted · {counts.rejected} rejected · {counts.pending} pending
        </p>
      </div>
      <ul ref={listRef} className="changes__list">
        {changes.map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            decision={decisions[change.id]}
            active={change.id === activeId}
            onSelect={compare.setActiveId}
            onDecide={compare.decide}
          />
        ))}
      </ul>
    </div>
  );
}
