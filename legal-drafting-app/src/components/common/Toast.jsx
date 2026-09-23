import { CircleCheck, TriangleAlert, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import './Toast.css';

const ICONS = {
  default: Info,
  success: CircleCheck,
  error: TriangleAlert,
};

export function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="toast-viewport" role="region" aria-label="Notifications">
      <ol className="toast-viewport__list">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant] ?? Info;
          return (
            <li
              key={toast.id}
              className={cn('toast', `toast--${toast.variant}`)}
              role={toast.variant === 'error' ? 'alert' : 'status'}
            >
              <Icon className="toast__icon" size={18} strokeWidth={1.75} aria-hidden="true" />
              <div className="toast__body">
                <p className="toast__title">{toast.title}</p>
                {toast.description && <p className="toast__text">{toast.description}</p>}
              </div>
              <button
                type="button"
                className="toast__close"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
