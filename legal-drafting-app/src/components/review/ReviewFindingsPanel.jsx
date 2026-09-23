import { useState } from 'react';
import { Tabs } from '../common/Tabs';
import { DemoBadge } from '../common/Badge';
import { ToolError, ToolLoading } from '../intelligence/IntelShared';
import { HealthTool } from '../intelligence/HealthTool';
import { ClausesTool } from '../intelligence/ClausesTool';
import { ComplianceTool } from '../intelligence/ComplianceTool';
import { ReviewSummary } from './ReviewSummary';
import '../workspace/IntelligencePanel.css';

const TOOLS = [
  { id: 'summary', label: 'Summary' },
  { id: 'health', label: 'Health' },
  { id: 'clauses', label: 'Clauses' },
  { id: 'compliance', label: 'Compliance' },
];

/** Right panel: review findings, reusing the Step 5 tool components. */
export function ReviewFindingsPanel({ review, nav }) {
  const [tool, setTool] = useState('summary');
  const { intel } = review;
  const props = { intel, nav, documentTypeName: review.typeName, onOpenTool: setTool };

  return (
    <div className="intel">
      <div className="intel__head">
        <h2 className="intel__title">Review findings</h2>
        <DemoBadge>Demo</DemoBadge>
      </div>
      <Tabs
        tabs={TOOLS}
        value={tool}
        onChange={setTool}
        idPrefix="review-tools"
        label="Review tools"
        className="intel__tabs"
      />
      <div
        id="review-tools-panel"
        role="tabpanel"
        aria-labelledby={`review-tools-tab-${tool}`}
        className="intel__body"
      >
        {review.review.status === 'loading' && !review.review.data && <ToolLoading />}
        {review.review.status === 'error' && (
          <ToolError message={review.review.error} onRetry={review.rerun} />
        )}
        {review.review.data && (
          <>
            {tool === 'summary' && <ReviewSummary {...props} />}
            {tool === 'health' && <HealthTool {...props} locateLabel="Go to issue" />}
            {tool === 'clauses' && <ClausesTool {...props} />}
            {tool === 'compliance' && <ComplianceTool {...props} />}
          </>
        )}
      </div>
    </div>
  );
}
