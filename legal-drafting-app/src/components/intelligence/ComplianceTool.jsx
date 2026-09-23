import { useEffect } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { StatusMark, ToolHeader, ToolLoading, ToolError, DemoNotice } from './IntelShared';
import './ComplianceTool.css';

function ItemAction({ item, nav }) {
  const loc = item.location;
  if (!loc) return null;
  if (loc.kind === 'field') {
    return (
      <Button size="sm" variant="link" onClick={() => nav.goToField(loc.key)}>
        Go to field
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="link"
      onClick={() => (loc.kind === 'token' ? nav.goToToken(loc.key) : nav.goToText(loc.text))}
    >
      Locate
    </Button>
  );
}

export function ComplianceTool({ intel, nav }) {
  const state = intel.results.compliance;
  const { run } = intel;

  useEffect(() => {
    if (state.status === 'idle') run('compliance');
  }, [state.status, run]);

  const data = state.data;
  const items = (data?.sections ?? []).flatMap((s) => s.items);
  const count = (status) => items.filter((i) => i.status === status).length;

  return (
    <div className="compliance">
      <ToolHeader
        title={data?.framework?.title ?? 'Compliance'}
        description="Checks document structure and factual details against a review checklist."
        onRun={() => run('compliance')}
        runLabel="Check compliance"
        state={state}
        stale={intel.isStale('compliance')}
      />
      <div className="compliance__status">
        <span>Status</span>
        <Badge tone="outline">Requires verification</Badge>
        <Badge tone="demo">Demo compliance check</Badge>
      </div>

      {state.status === 'loading' && !data && <ToolLoading />}
      {state.status === 'error' && (
        <ToolError message={state.error} onRetry={() => run('compliance')} />
      )}

      {data && (
        <>
          <dl className="compliance__summary">
            <div>
              <dt>Present</dt>
              <dd>{count('present')}</dd>
            </div>
            <div>
              <dt>Review</dt>
              <dd>{count('review')}</dd>
            </div>
            <div>
              <dt>Missing</dt>
              <dd>{count('missing')}</dd>
            </div>
            <div>
              <dt>To verify</dt>
              <dd>{count('verify')}</dd>
            </div>
          </dl>

          {data.sections.map((section) => (
            <section
              key={section.id}
              className="compliance__section"
              aria-labelledby={`cs-${section.id}`}
            >
              <h4 id={`cs-${section.id}`} className="intel-section-title">
                {section.title}
              </h4>
              <ul className="compliance__items">
                {section.items.map((item) => (
                  <li key={item.id} className="compliance__item">
                    <div className="compliance__item-top">
                      <span className="compliance__item-label">{item.label}</span>
                      <StatusMark status={item.status} />
                    </div>
                    <p className="compliance__item-detail">{item.detail}</p>
                    <ItemAction item={item} nav={nav} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <DemoNotice>
            Demo compliance check. It does not identify, apply or confirm any legal provision, and
            no section numbers are suggested. Statutory references will only come from a verified
            source and must be checked by a qualified legal professional.
          </DemoNotice>
        </>
      )}
    </div>
  );
}
