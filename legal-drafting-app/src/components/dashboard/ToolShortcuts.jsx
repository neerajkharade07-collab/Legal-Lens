import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DASHBOARD_TOOLS } from '../../data/dashboardTools';
import { NAV_ICONS } from '../layout/navIcons';
import { SectionHeader } from '../common/SectionHeader';
import './ToolShortcuts.css';

export function ToolShortcuts() {
  return (
    <section className="tools" aria-labelledby="tools-title">
      <div className="container">
        <SectionHeader
          id="tools-title"
          eyebrow="More tools"
          title="Review, compare and plan"
          description="Work with documents you already have, not only new drafts."
        />
        <ul className="tools__grid">
          {DASHBOARD_TOOLS.map((tool) => {
            const Icon = NAV_ICONS[tool.icon];
            return (
              <li key={tool.id}>
                <Link to={tool.to} className="tool-card">
                  <span className="tool-card__icon" aria-hidden="true">
                    {Icon && <Icon size={20} strokeWidth={1.5} />}
                  </span>
                  <span className="tool-card__title">{tool.title}</span>
                  <span className="tool-card__desc">{tool.description}</span>
                  <span className="tool-card__cta">
                    {tool.cta}
                    <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
