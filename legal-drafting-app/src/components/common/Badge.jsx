import { cn } from '../../utils/cn';
import './Badge.css';

/**
 * Small status label. Color is never the only signal — text is always present.
 * tone: neutral | outline | success | warning | danger | inverse | demo
 */
export function Badge({ tone = 'neutral', icon: Icon, className, children, ...rest }) {
  return (
    <span className={cn('badge', `badge--${tone}`, className)} {...rest}>
      {Icon && <Icon size={12} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Honest marker for sample / unverified demo content. */
export function DemoBadge({ children = 'Demo data', ...rest }) {
  return (
    <Badge tone="demo" {...rest}>
      {children}
    </Badge>
  );
}
