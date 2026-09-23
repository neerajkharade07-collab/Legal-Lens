import { ChangeText } from './ChangeText';
import { CHANGE_LABEL, isHeadingText } from './compareText';
import { cn } from '../../utils/cn';

/**
 * Original | Revised in one scrolling grid. Each row pairs corresponding
 * paragraphs, so both sides always scroll together and changes line up.
 */
export function SideBySideView({
  result,
  decisions,
  activeId,
  onSelect,
  originalName,
  revisedName,
}) {
  const byId = Object.fromEntries(result.changes.map((c) => [c.id, c]));
  return (
    <div className="sbs" role="table" aria-label="Side-by-side comparison">
      <div className="sbs__head" role="row">
        <p role="columnheader">
          <span className="sbs__label">Original</span> {originalName}
        </p>
        <p role="columnheader">
          <span className="sbs__label">Revised</span> {revisedName}
        </p>
      </div>
      {result.segments.map((seg, n) => {
        if (seg.kind === 'same') {
          const heading = isHeadingText(seg.text);
          return (
            <div key={`s${n}`} className="sbs__row" role="row">
              <p role="cell" className={cn('rl-p', heading && 'rl-h')}>
                {seg.text}
              </p>
              <p role="cell" className={cn('rl-p', heading && 'rl-h')}>
                {seg.text}
              </p>
            </div>
          );
        }
        const change = byId[seg.changeId];
        const decision = decisions[change.id];
        const heading = isHeadingText(change.revisedText || change.originalText);
        return (
          <div
            key={change.id}
            data-change-id={change.id}
            role="row"
            tabIndex={0}
            aria-label={`Change ${change.number}: ${CHANGE_LABEL[change.type]}${decision ? `, ${decision}` : ''}`}
            className={cn(
              'sbs__row',
              'sbs__row--change',
              `rl-change--${change.type}`,
              decision && `is-${decision}`,
              activeId === change.id && 'is-active',
            )}
            onClick={() => onSelect(change.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSelect(change.id);
            }}
          >
            <p
              role="cell"
              className={cn('rl-p', heading && 'rl-h', !change.originalText && 'sbs__empty')}
            >
              <span className="rl-change__num" aria-hidden="true">
                {change.number}
              </span>
              {change.originalText ? (
                <ChangeText change={change} side="original" />
              ) : (
                'Not in original'
              )}
            </p>
            <p
              role="cell"
              className={cn('rl-p', heading && 'rl-h', !change.revisedText && 'sbs__empty')}
            >
              {change.revisedText ? (
                <ChangeText change={change} side="revised" />
              ) : (
                'Removed in revision'
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
