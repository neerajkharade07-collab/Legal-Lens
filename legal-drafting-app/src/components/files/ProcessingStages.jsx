import { CircleCheck, Circle } from 'lucide-react';
import { cn } from '../../utils/cn';
import './ProcessingStages.css';

/** Step list + progress bar for demo processing. `current` is the active stage index. */
export function ProcessingStages({ stages, current, title, note }) {
  const percent = Math.round((Math.min(current, stages.length) / stages.length) * 100);
  return (
    <div className="processing" role="status" aria-live="polite">
      <p className="processing__title">{title}</p>
      <div
        className="processing__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progress"
      >
        <span style={{ width: `${Math.max(percent, 6)}%` }} />
      </div>
      <ol className="processing__list">
        {stages.map((stage, index) => {
          const state = index < current ? 'done' : index === current ? 'active' : 'pending';
          return (
            <li key={stage.id} className={cn('processing__item', `is-${state}`)}>
              {state === 'done' && <CircleCheck size={16} strokeWidth={2} aria-hidden="true" />}
              {state === 'active' && <span className="processing__spinner" aria-hidden="true" />}
              {state === 'pending' && <Circle size={16} strokeWidth={1.5} aria-hidden="true" />}
              <span>{stage.label}</span>
              <span className="visually-hidden">
                {state === 'done' ? ' — done' : state === 'active' ? ' — in progress' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      {note && <p className="processing__note">{note}</p>}
    </div>
  );
}
