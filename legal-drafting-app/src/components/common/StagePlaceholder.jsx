import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from './Button';
import { Badge } from './Badge';
import './StagePlaceholder.css';

/**
 * Temporary page used for routes whose screens are scheduled for a later
 * build step. Keeps navigation honest (no dead links, no fake screens).
 */
export function StagePlaceholder({ eyebrow, title, description, step, planned = [], children }) {
  return (
    <section className="stage container" aria-labelledby="stage-title">
      <div className="stage__card">
        <span className="stage__icon" aria-hidden="true">
          <Construction size={22} strokeWidth={1.5} />
        </span>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id="stage-title" className="stage__title">
          {title}
        </h1>
        {description && <p className="stage__desc">{description}</p>}
        {step && (
          <Badge tone="outline" className="stage__badge">
            Scheduled for build step {step}
          </Badge>
        )}
        {children}
        {planned.length > 0 && (
          <div className="stage__planned">
            <p className="stage__planned-title">What this screen will include</p>
            <ul>
              {planned.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <Button variant="secondary" icon={ArrowLeft} to="/">
          Back to dashboard
        </Button>
      </div>
    </section>
  );
}
