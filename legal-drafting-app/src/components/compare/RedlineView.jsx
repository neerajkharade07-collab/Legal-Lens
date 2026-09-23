import { ChangeText } from './ChangeText';
import { CHANGE_LABEL, isHeadingText } from './compareText';
import { cn } from '../../utils/cn';

function Decided({ change, decision }) {
  const text = decision === 'accepted' ? change.revisedText : change.originalText;
  if (!text)
    return (
      <span className="rl-gone">
        {decision === 'accepted' ? 'Removal accepted' : 'Addition rejected'}
      </span>
    );
  return <span>{text}</span>;
}

/** Single-document redline: additions, removals and word-level modifications inline. */
export function RedlineView({ result, decisions, activeId, onSelect }) {
  const byId = Object.fromEntries(result.changes.map((c) => [c.id, c]));
  return (
    <article className="rl-page" aria-label="Redline document">
      {result.segments.map((seg, n) => {
        if (seg.kind === 'same') {
          return (
            <p key={`s${n}`} className={cn('rl-p', isHeadingText(seg.text) && 'rl-h')}>
              {seg.text}
            </p>
          );
        }
        const change = byId[seg.changeId];
        const decision = decisions[change.id];
        const heading = isHeadingText(change.revisedText || change.originalText);
        return (
          <div
            key={change.id}
            data-change-id={change.id}
            role="button"
            tabIndex={0}
            aria-label={`Change ${change.number}: ${CHANGE_LABEL[change.type]}${decision ? `, ${decision}` : ''}`}
            aria-current={activeId === change.id ? 'true' : undefined}
            className={cn(
              'rl-change',
              `rl-change--${change.type}`,
              decision && `is-${decision}`,
              activeId === change.id && 'is-active',
            )}
            onClick={() => onSelect(change.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(change.id);
              }
            }}
          >
            <span className="rl-change__num" aria-hidden="true">
              {change.number}
            </span>
            <p className={cn('rl-p', heading && 'rl-h')}>
              {decision ? (
                <Decided change={change} decision={decision} />
              ) : (
                <ChangeText change={change} />
              )}
            </p>
          </div>
        );
      })}
    </article>
  );
}
