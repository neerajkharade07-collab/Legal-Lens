import { ChevronRight } from 'lucide-react';
import { DemoBadge, Badge } from '../common/Badge';
import { StatusMark, DemoNotice } from '../intelligence/IntelShared';
import '../intelligence/OverviewTool.css';

/** Review summary: the six review categories with counts, linking into each tool. */
export function ReviewSummary({ intel, onOpenTool }) {
  const health = intel.results.health.data;
  const clauses = intel.results.clauses.data;
  const compliance = intel.results.compliance.data;
  if (!health) return null;

  const findings = health.findings.filter((f) => !intel.dismissedFindings.has(f.id));
  const count = (...cats) => findings.filter((f) => cats.includes(f.category)).length;
  const missingInfo = count('completeness', 'placeholders');
  const formatting = count('formatting');
  const risks = count('risks', 'consistency', 'clarity');
  const missingClauses = (clauses?.suggestions ?? []).filter(
    (s) =>
      s.status === 'possibly_missing' &&
      !intel.addedClauses.has(s.id) &&
      !intel.dismissedClauses.has(s.id),
  ).length;
  const complianceOpen = (compliance?.sections ?? [])
    .flatMap((s) => s.items)
    .filter((i) => i.status !== 'present').length;

  const rows = [
    {
      id: 'missing',
      label: 'Missing information',
      value: missingInfo,
      tool: 'health',
      status: missingInfo ? 'attention' : 'pass',
    },
    {
      id: 'clauses',
      label: 'Possible missing clauses',
      value: missingClauses,
      tool: 'clauses',
      status: missingClauses ? 'warning' : 'pass',
    },
    {
      id: 'formatting',
      label: 'Formatting issues',
      value: formatting,
      tool: 'health',
      status: formatting ? 'warning' : 'pass',
    },
    {
      id: 'risks',
      label: 'Potential risks',
      value: risks,
      tool: 'health',
      status: risks ? 'warning' : 'pass',
    },
    {
      id: 'compliance',
      label: 'Compliance review',
      value: complianceOpen,
      tool: 'compliance',
      status: 'verify',
    },
  ];

  return (
    <div className="overview">
      <section className="overview__score" aria-labelledby="review-score-title">
        <div className="overview__score-head">
          <p id="review-score-title" className="overview__label">
            Document health
          </p>
          <DemoBadge>Demo analysis</DemoBadge>
        </div>
        <p className="overview__number">
          {health.score}
          <span> / 100</span>
        </p>
        <div className="overview__bar" aria-hidden="true">
          <span style={{ width: `${health.score}%` }} />
        </div>
        <p className="overview__sub">
          Structure and completeness of the extracted text — not a legal assessment.
        </p>
      </section>

      <ul className="review-summary__rows">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="review-summary__row"
              onClick={() => onOpenTool(row.tool)}
            >
              <StatusMark status={row.status} showLabel={false} />
              <span className="review-summary__label">{row.label}</span>
              {row.id === 'compliance' ? (
                <Badge tone="demo">Requires verification</Badge>
              ) : (
                <span className="review-summary__count">{row.value}</span>
              )}
              <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <DemoNotice>
        Demo review of sample text. It does not state whether the document is legally valid or
        enforceable. Every result requires verification by a qualified legal professional.
      </DemoNotice>
    </div>
  );
}
