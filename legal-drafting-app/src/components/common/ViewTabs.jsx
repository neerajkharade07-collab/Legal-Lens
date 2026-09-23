import { cn } from '../../utils/cn';
import './ViewTabs.css';

/**
 * Segmented switcher between views (used for phone layouts of Review/Compare).
 * views: [{ id, label, icon?, count? }]
 */
export function ViewTabs({ views, value, onChange, label, className }) {
  return (
    <nav className={cn('view-tabs', className)} aria-label={label}>
      {views.map((view) => {
        const Icon = view.icon;
        const active = value === view.id;
        return (
          <button
            key={view.id}
            type="button"
            className={cn('view-tabs__btn', active && 'is-active')}
            aria-current={active ? 'true' : undefined}
            onClick={() => onChange(view.id)}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
            {view.label}
            {view.count !== undefined && <span className="view-tabs__count">{view.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
