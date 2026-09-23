import { ClipboardList, FileText, MessageSquareText } from 'lucide-react';
import { cn } from '../../utils/cn';
import './WorkspaceMobileNav.css';

const VIEWS = [
  { id: 'details', label: 'Details', icon: ClipboardList },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'assistant', label: 'Assistant', icon: MessageSquareText },
];

/** Phone layout: one workspace view at a time. */
export function WorkspaceMobileNav({ value, onChange, detailsCount }) {
  return (
    <nav className="ws-mobile-nav" aria-label="Workspace views">
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const active = value === view.id;
        return (
          <button
            key={view.id}
            type="button"
            className={cn('ws-mobile-nav__btn', active && 'is-active')}
            aria-current={active ? 'true' : undefined}
            onClick={() => onChange(view.id)}
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {view.label}
            {view.id === 'details' && detailsCount && (
              <span className="ws-mobile-nav__count">{detailsCount}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
