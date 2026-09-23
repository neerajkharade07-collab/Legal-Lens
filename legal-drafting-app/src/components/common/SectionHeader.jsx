import { cn } from '../../utils/cn';
import './SectionHeader.css';

export function SectionHeader({ eyebrow, title, description, actions, id, className }) {
  return (
    <div className={cn('section-header', className)}>
      <div className="section-header__text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={id} className="section-header__title">
          {title}
        </h2>
        {description && <p className="section-header__desc">{description}</p>}
      </div>
      {actions && <div className="section-header__actions">{actions}</div>}
    </div>
  );
}
