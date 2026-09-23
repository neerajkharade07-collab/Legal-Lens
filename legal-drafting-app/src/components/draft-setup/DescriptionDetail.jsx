import { Check } from 'lucide-react';
import { DETAIL_LEVELS } from '../../utils/descriptionAnalysis';
import { cn } from '../../utils/cn';
import './DescriptionDetail.css';

const SEGMENTS = DETAIL_LEVELS.slice(1); // basic, some, good, detailed

function hintFor(analysis) {
  if (analysis.words === 0) {
    return 'Mention who is involved, what happened, when and where, any amounts, and what records you have.';
  }
  const missing = analysis.results.filter((r) => !r.found).map((r) => r.label.toLowerCase());
  if (missing.length === 0) {
    return 'The main kinds of detail are covered. You can add or correct anything in the workspace.';
  }
  const list =
    missing.length > 1 ? `${missing.slice(0, -1).join(', ')} or ${missing.at(-1)}` : missing[0];
  return `If you have them, consider adding: ${list}.`;
}

/**
 * Writing aid showing which kinds of detail the description mentions.
 * Purely informational — it makes no legal assessment.
 */
export function DescriptionDetail({ analysis, id }) {
  const activeIndex = SEGMENTS.findIndex((s) => s.id === analysis.level.id);

  return (
    <section className="detail" aria-labelledby={`${id}-title`}>
      <div className="detail__head">
        <p id={`${id}-title`} className="detail__title">
          Description detail
        </p>
        <p className="detail__level" aria-live="polite">
          {analysis.level.label}
        </p>
      </div>

      <div
        className="detail__meter"
        role="meter"
        aria-label="Description detail"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={analysis.score}
        aria-valuetext={analysis.level.label}
      >
        {SEGMENTS.map((segment, index) => (
          <span
            key={segment.id}
            className={cn('detail__segment', index <= activeIndex && 'is-on')}
          />
        ))}
      </div>

      <ul className="detail__checks" aria-label="Kinds of detail mentioned">
        {analysis.results.map((item) => (
          <li key={item.id} className={cn('detail__check', item.found && 'is-found')}>
            <span className="detail__check-mark" aria-hidden="true">
              {item.found && <Check size={10} strokeWidth={3} />}
            </span>
            {item.label}
            <span className="visually-hidden">
              {item.found ? ' — mentioned' : ' — not yet mentioned'}
            </span>
          </li>
        ))}
      </ul>

      <p className="detail__hint">{hintFor(analysis)}</p>
      <p className="detail__note">
        Checks only which kinds of detail your description mentions. It is not a legal assessment of
        the matter.
      </p>
    </section>
  );
}
