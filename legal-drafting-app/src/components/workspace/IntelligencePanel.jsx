import { PanelRightClose } from 'lucide-react';
import { INTELLIGENCE_TOOLS } from '../../data/intelligenceTools';
import { TOOL_ICONS } from './toolIcons';
import { Tabs } from '../common/Tabs';
import { DemoBadge } from '../common/Badge';
import { OverviewTool } from '../intelligence/OverviewTool';
import { HealthTool } from '../intelligence/HealthTool';
import { ClausesTool } from '../intelligence/ClausesTool';
import { ComplianceTool } from '../intelligence/ComplianceTool';
import { CitationsTool } from '../intelligence/CitationsTool';
import { ResearchTool } from '../intelligence/ResearchTool';
import { AssistantTool } from '../intelligence/AssistantTool';
import { cn } from '../../utils/cn';
import './IntelligencePanel.css';

/**
 * Right panel: Legal Intelligence tools. State lives in useWorkspaceIntelligence
 * (so results survive collapsing); document changes go through `nav`/`intel`.
 */
export function IntelligencePanel({
  activeTool,
  onToolChange,
  onCollapse,
  documentTypeName,
  intel,
  nav,
}) {
  const tool = INTELLIGENCE_TOOLS.find((t) => t.id === activeTool) ?? INTELLIGENCE_TOOLS[0];
  const props = { intel, nav, documentTypeName, onOpenTool: onToolChange };

  return (
    <div className="intel">
      <div className="intel__head">
        <h2 className="intel__title">Legal assistant</h2>
        <DemoBadge>Demo</DemoBadge>
        {onCollapse && (
          <button
            type="button"
            className="panel-icon-btn intel__collapse"
            onClick={onCollapse}
            aria-label="Collapse legal assistant panel"
          >
            <PanelRightClose size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      <Tabs
        tabs={INTELLIGENCE_TOOLS.map((t) => ({ id: t.id, label: t.label }))}
        value={tool.id}
        onChange={onToolChange}
        idPrefix="intel"
        label="Legal assistant tools"
        className="intel__tabs"
      />
      <div
        id="intel-panel"
        role="tabpanel"
        aria-labelledby={`intel-tab-${tool.id}`}
        className="intel__body"
      >
        {tool.id === 'overview' && <OverviewTool {...props} />}
        {tool.id === 'health' && <HealthTool {...props} />}
        {tool.id === 'clauses' && <ClausesTool {...props} />}
        {tool.id === 'compliance' && <ComplianceTool {...props} />}
        {tool.id === 'citations' && <CitationsTool {...props} />}
        {tool.id === 'research' && <ResearchTool {...props} />}
        {tool.id === 'assistant' && <AssistantTool {...props} />}
      </div>
    </div>
  );
}

/** Collapsed rail: one icon per tool; clicking expands the panel on that tool. */
export function IntelligenceRail({ activeTool, onSelect }) {
  return (
    <div
      className="intel-rail"
      role="toolbar"
      aria-label="Legal assistant tools"
      aria-orientation="vertical"
    >
      {INTELLIGENCE_TOOLS.map((t) => {
        const Icon = TOOL_ICONS[t.icon];
        return (
          <button
            key={t.id}
            type="button"
            className={cn('intel-rail__btn', activeTool === t.id && 'is-active')}
            onClick={() => onSelect(t.id)}
            aria-label={`Open ${t.title}`}
            title={t.title}
          >
            <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
