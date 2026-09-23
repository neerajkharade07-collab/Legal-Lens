import { cn } from '../../utils/cn';
import './EmptyState.css';

export function EmptyState({ icon: Icon, title, description, action, compact = false, className }) {
  return (
    <div className={cn('empty-state', compact && 'empty-state--compact', className)}>
      {Icon && (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon size={20} strokeWidth={1.5} />
        </span>
      )}
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__text">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
