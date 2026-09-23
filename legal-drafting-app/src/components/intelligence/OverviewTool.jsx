import { useEffect } from 'react';
import { Activity, ListPlus, ShieldCheck, ArrowRight } from 'lucide-react';
import { DemoBadge, Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { StatusMark, DemoNotice, ToolLoading, ToolError } from './IntelShared';
import './OverviewTool.css';

/** Summary of the latest demo review, with shortcuts into each tool. */
export function OverviewTool({ intel, onOpenTool, documentTypeName }) {
  const { health, clauses, compliance } = intel.results;
  const { runOverview } = intel;
  const neverRun =
    health.status === 'idle' && clauses.status === 'idle' && compliance.status === 'idle';

  useEffect(() => {
    if (neverRun) runOverview();
  }, [neverRun, runOverview]);

  if (health.status === 'loading' && !health.data) return <ToolLoading rows={3} />;
  if (health.status === 'error') return <ToolError message={health.error} onRetry={runOverview} />;

  const findings = (health.data?.findings ?? []).filter((f) => !intel.dismissedFindings.has(f.id));
  const incomplete = findings.filter((f) => f.category === 'completeness').length;
  const placeholders = findings.filter((f) => f.category === 'placeholders').length;
  const otherHealth = findings.length - incomplete - placeholders;
  const missingClauses = (clauses.data?.suggestions ?? []).filter(
    (s) =>
      s.status === 'possibly_missing' &&
      !intel.addedClauses.has(s.id) &&
      !intel.dismissedClauses.has(s.id),
  ).length;
  const complianceItems = (compliance.data?.sections ?? []).flatMap((s) => s.items);
  const complianceOpen = complianceItems.filter((i) => i.status !== 'present').length;
  const totalIssues = findings.length + missingClauses + (complianceOpen ? 1 : 0);
  const stale = intel.isStale('health');

  return (
    <div className="overview">
      <section className="overview__score" aria-labelledby="overview-score-title">
        <div className="overview__score-head">
          <p id="overview-score-title" className="overview__label">
            Document health
          </p>
          <DemoBadge>Demo analysis</DemoBadge>
        </div>
        <p className="overview__number">
          {health.data?.score ?? '—'}
          <span> / 100</span>
        </p>
        <div className="overview__bar" aria-hidden="true">
          <span style={{ width: `${health.data?.score ?? 0}%` }} />
        </div>
        <p className="overview__sub">
          Structure and completeness of this {documentTypeName ?? 'draft'} — not a legal assessment.
          {stale && ' The document has changed since this check.'}
        </p>
      </section>

      <section aria-labelledby="overview-issues-title">
        <h4 id="overview-issues-title" className="overview__issues-title">
          {totalIssues} issue{totalIssues === 1 ? '' : 's'} found
        </h4>
        <ul className="overview__issues">
          <li>
            <StatusMark status={incomplete ? 'attention' : 'pass'} showLabel={false} />
            {incomplete
              ? `${incomplete} incomplete field finding${incomplete === 1 ? '' : 's'}`
              : 'Key fields completed'}
          </li>
          <li>
            <StatusMark status={placeholders ? 'warning' : 'pass'} showLabel={false} />
            {placeholders
              ? `${placeholders} unresolved placeholder${placeholders === 1 ? '' : 's'}`
              : 'No unresolved placeholders'}
          </li>
          {otherHealth > 0 && (
            <li>
              <StatusMark status="warning" showLabel={false} />
              {otherHealth} other health finding{otherHealth === 1 ? '' : 's'}
            </li>
          )}
          <li>
            <StatusMark status={missingClauses ? 'warning' : 'pass'} showLabel={false} />
            {clauses.status === 'ready'
              ? missingClauses
                ? `${missingClauses} possible missing clause${missingClauses === 1 ? '' : 's'}`
                : 'No suggested clauses outstanding'
              : 'Checking clauses…'}
          </li>
          <li>
            <StatusMark status="verify" showLabel={false} />
            Compliance review required
            <Badge tone="demo">Requires verification</Badge>
          </li>
        </ul>
      </section>

      <section className="overview__actions" aria-label="Quick actions">
        <Button
          variant="secondary"
          size="sm"
          icon={Activity}
          iconRight={ArrowRight}
          fullWidth
          onClick={() => {
            intel.run('health');
            onOpenTool('health');
          }}
        >
          Run Health Check
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={ListPlus}
          iconRight={ArrowRight}
          fullWidth
          onClick={() => onOpenTool('clauses')}
        >
          Review Missing Clauses
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={ShieldCheck}
          iconRight={ArrowRight}
          fullWidth
          onClick={() => {
            intel.run('compliance');
            onOpenTool('compliance');
          }}
        >
          Check Compliance
        </Button>
      </section>

      <DemoNotice>
        All review results are generated by built-in demo rules in your browser. No legal AI or
        backend has analysed this document. Results require verification.
      </DemoNotice>
    </div>
  );
}
