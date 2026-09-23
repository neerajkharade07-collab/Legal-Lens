import {
  CircleCheck,
  TriangleAlert,
  CircleAlert,
  CircleDashed,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { formatRelative } from '../../utils/date';
import { cn } from '../../utils/cn';
import './IntelShared.css';

/** Grayscale status mark. Status is always also given as text. */
const STATUS = {
  pass: { icon: CircleCheck, label: 'Pass' },
  present: { icon: CircleCheck, label: 'Present' },
  warning: { icon: TriangleAlert, label: 'Warning' },
  review: { icon: TriangleAlert, label: 'Review' },
  attention: { icon: CircleAlert, label: 'Needs attention' },
  missing: { icon: CircleAlert, label: 'Missing' },
  verify: { icon: CircleDashed, label: 'Requires verification' },
};

export function StatusMark({ status, showLabel = true, className }) {
  const config = STATUS[status] ?? STATUS.verify;
  const Icon = config.icon;
  return (
    <span className={cn('status-mark', `status-mark--${status}`, className)}>
      <Icon
        size={15}
        strokeWidth={status === 'pass' || status === 'present' ? 2 : 1.75}
        aria-hidden="true"
      />
      {showLabel ? (
        <span className="status-mark__label">{config.label}</span>
      ) : (
        <span className="visually-hidden">{config.label}</span>
      )}
    </span>
  );
}

const SEVERITY = { high: 'High', medium: 'Medium', low: 'Low' };
export function SeverityLabel({ severity }) {
  return (
    <span className={cn('severity', `severity--${severity}`)}>
      {SEVERITY[severity] ?? severity}
    </span>
  );
}

/** Tool heading row with run/refresh button and freshness information. */
export function ToolHeader({ title, description, onRun, runLabel = 'Run check', state, stale }) {
  const running = state?.status === 'loading';
  const generatedAt = state?.data?.meta?.generatedAt;
  return (
    <div className="tool-header">
      <div className="tool-header__row">
        <h3 className="tool-header__title">{title}</h3>
        {onRun && (
          <Button
            size="sm"
            variant={state?.status === 'ready' ? 'secondary' : 'primary'}
            icon={RefreshCw}
            onClick={onRun}
            disabled={running}
          >
            {running ? 'Running…' : state?.status === 'ready' ? 'Re-run' : runLabel}
          </Button>
        )}
      </div>
      {description && <p className="tool-header__desc">{description}</p>}
      {generatedAt && (
        <p className={cn('tool-header__meta', stale && 'is-stale')}>
          Demo analysis · {formatRelative(generatedAt)}
          {stale && ' · document changed since this run'}
        </p>
      )}
    </div>
  );
}

export function DemoNotice({ children }) {
  return (
    <p className="demo-notice">
      <Info size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function ToolLoading({ rows = 3 }) {
  return (
    <div className="tool-loading" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, n) => (
        <div key={n} className="tool-loading__row">
          <Skeleton width="45%" />
          <Skeleton width="90%" height={10} />
          <Skeleton width="70%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function ToolError({ message, onRetry }) {
  return (
    <div className="tool-error" role="alert">
      <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <p>{message}</p>
        {onRetry && (
          <Button size="sm" variant="link" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function ToolIdle({ children, onRun, runLabel }) {
  return (
    <div className="tool-idle">
      <p>{children}</p>
      {onRun && (
        <Button size="sm" onClick={onRun}>
          {runLabel}
        </Button>
      )}
    </div>
  );
}
