/**
 * Legal Drafting Phase 3 — real review views for ACCOUNT documents, shown inside the existing
 * intelligence panel tools (Overview, Health, Clauses, Compliance, Citations, Research).
 *
 * - AI results come from the CASEONE server; nothing here invents or substitutes a result.
 * - No scores: findings are counted by severity.
 * - AI reviews run only when the user presses Run (each uses one AI request); citations are
 *   rule-based and run automatically.
 * - The only change to the document is an improved clause the user previewed and accepted.
 */
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Check, X, ExternalLink, Search } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { SeverityLabel, ToolHeader, ToolLoading, ToolError, ToolIdle, DemoNotice } from './IntelShared';
import './AiReview.css';

const isAi = (state) => state?.data?.meta?.source === 'ai';
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

const HEALTH_CATEGORY = {
  missing_information: 'Missing information',
  incomplete_clause: 'Incomplete clause',
  contradiction: 'Contradiction',
  unclear_wording: 'Unclear wording',
  missing_detail: 'Missing date, amount or party detail',
  drafting_risk: 'Drafting risk',
  inconsistent_terminology: 'Inconsistent terminology',
};

function Counts({ counts }) {
  if (!counts) return null;
  const parts = ['high', 'medium', 'low'].map((s) => `${counts[s] ?? 0} ${s}`);
  return <p className="ai-review__counts">{parts.join(' · ')}</p>;
}

function Removed({ meta }) {
  if (!meta?.removedUnverifiable) return null;
  return (
    <DemoNotice>
      {meta.removedUnverifiable} item{meta.removedUnverifiable === 1 ? ' was' : 's were'} removed because the AI
      referred to laws, cases, links or numbers that are not in your document.
    </DemoNotice>
  );
}

function Locate({ location, nav, label = 'Go to text' }) {
  if (!location) return null;
  if (!location.found) return <p className="intel-card__meta">Location not found in the document.</p>;
  return (
    <Button size="sm" variant="secondary" onClick={() => nav.goToText(location.quote)}>
      {label}
    </Button>
  );
}

function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="ai-review__list">
      <p className="ai-review__list-title">{title}</p>
      <ul>
        {items.map((t, n) => (
          <li key={`${n}-${t}`}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function ExternalSource({ source }) {
  if (!source?.url) return null;
  return (
    <a className="ai-review__source" href={source.url} target="_blank" rel="noopener noreferrer">
      <ExternalLink size={13} strokeWidth={1.75} aria-hidden="true" />
      {source.label}
    </a>
  );
}

const AI_LIMITS =
  'AI review of this document only — not a legal opinion. It may miss problems or be wrong; check every point yourself or with a lawyer.';

// ---------------------------------------------------------------- Document Health

function HealthFinding({ finding, nav, onDismiss }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="intel-card">
      <div className="intel-card__top">
        <SeverityLabel severity={finding.severity} />
        <span className="intel-card__meta">{HEALTH_CATEGORY[finding.category] ?? 'Finding'}</span>
      </div>
      <p className="intel-card__title">{finding.title}</p>
      <p className="finding__action">
        <span>Suggested action:</span> {finding.suggestion}
      </p>
      {open && <p className="intel-card__text">{finding.explanation}</p>}
      <div className="intel-card__actions">
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Hide explanation' : 'Why?'}
        </Button>
        <Locate location={finding.location} nav={nav} />
        <Button size="sm" variant="ghost" onClick={() => onDismiss(finding.id)}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}

export function AiHealth({ intel, nav }) {
  const state = intel.results.health;
  const data = isAi(state) ? state.data : null;
  const findings = (data?.findings ?? [])
    .filter((f) => !intel.dismissedFindings.has(f.id))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const dismissed = (data?.findings ?? []).length - findings.length;
  return (
    <div className="ai-review">
      <ToolHeader
        title="Document Health"
        description="AI review for missing information, incomplete or contradictory clauses, unclear wording, missing dates, amounts or party details, inconsistent terms and drafting risks."
        onRun={() => intel.run('health')}
        runLabel="Run AI review"
        state={data ? state : { status: state.status === 'ready' ? 'idle' : state.status }}
        stale={data && intel.isStale('health')}
      />
      {state.status === 'loading' && <ToolLoading />}
      {state.status === 'error' && <ToolError message={state.error} onRetry={() => intel.run('health')} />}
      {!data && state.status !== 'loading' && state.status !== 'error' && (
        <ToolIdle onRun={() => intel.run('health')} runLabel="Run AI review">
          Reviews the current text, including unsaved edits. Uses one AI request; nothing is changed or saved.
        </ToolIdle>
      )}
      {data && (
        <>
          <Counts counts={data.counts} />
          {findings.length === 0 ? (
            <p className="ai-review__empty">
              {dismissed ? 'All findings dismissed.' : 'The AI reported no problems. This does not mean the document is complete or valid.'}
            </p>
          ) : (
            <ul className="intel-list">
              {findings.map((f) => (
                <HealthFinding key={f.id} finding={f} nav={nav} onDismiss={intel.dismissFinding} />
              ))}
            </ul>
          )}
          {dismissed > 0 && (
            <Button size="sm" variant="link" onClick={intel.restoreFindings}>
              Show {dismissed} dismissed finding{dismissed === 1 ? '' : 's'}
            </Button>
          )}
          <Removed meta={data.meta} />
          <DemoNotice>{AI_LIMITS}</DemoNotice>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Clause Review

function ClauseCard({ clause, intel, nav }) {
  const [preview, setPreview] = useState(false);
  const decision = intel.clauseDecisions[clause.id];
  const proposal = clause.proposal;
  return (
    <li className="intel-card">
      <div className="intel-card__top">
        <p className="intel-card__title">{clause.heading}</p>
        {decision === 'applied' && <Badge tone="neutral">Applied</Badge>}
      </div>
      <p className="intel-card__text">{clause.explanation}</p>
      <List title="Risks or ambiguities" items={clause.risks} />
      <List title="Missing information" items={clause.missingInformation} />
      {clause.suggestion && (
        <p className="finding__action">
          <span>Suggestion:</span> {clause.suggestion}
        </p>
      )}
      {proposal && preview && !decision && (
        <div className="ai-review__proposal" aria-label="Preview of the improved wording">
          <p className="ai-review__list-title">Current text</p>
          <p className="ai-review__quote">{proposal.original}</p>
          <p className="ai-review__list-title">Improved wording (AI suggestion)</p>
          <p className="ai-review__quote ai-review__quote--new">{proposal.text}</p>
          <div className="intel-card__actions">
            <Button size="sm" icon={Check} onClick={() => intel.acceptClauseProposal(clause)}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" icon={X} onClick={() => intel.rejectClauseProposal(clause)}>
              Reject
            </Button>
          </div>
        </div>
      )}
      <div className="intel-card__actions">
        {proposal && !decision && (
          <Button
            size="sm"
            variant="secondary"
            icon={preview ? EyeOff : Eye}
            onClick={() => setPreview((v) => !v)}
            aria-expanded={preview}
          >
            {preview ? 'Hide improved wording' : 'Preview improved wording'}
          </Button>
        )}
        <Locate location={clause.location} nav={nav} label="Locate" />
      </div>
      {decision === 'rejected' && <p className="intel-card__meta">Suggestion rejected — the document was not changed.</p>}
    </li>
  );
}

export function AiClauses({ intel, nav, documentTypeName }) {
  const state = intel.results.clauses;
  const data = isAi(state) ? state.data : null;
  return (
    <div className="ai-review">
      <ToolHeader
        title="Clause Review"
        description={`AI explanation of each clause in this ${documentTypeName ?? 'document'}, with risks, missing information and suggested improvements.`}
        onRun={() => intel.run('clauses')}
        runLabel="Review clauses"
        state={data ? state : { status: state.status === 'ready' ? 'idle' : state.status }}
        stale={data && intel.isStale('clauses')}
      />
      {state.status === 'loading' && <ToolLoading />}
      {state.status === 'error' && <ToolError message={state.error} onRetry={() => intel.run('clauses')} />}
      {!data && state.status !== 'loading' && state.status !== 'error' && (
        <ToolIdle onRun={() => intel.run('clauses')} runLabel="Review clauses">
          Uses one AI request. Improved wording is only shown as a preview — your document changes only if you accept it.
        </ToolIdle>
      )}
      {data && (
        <>
          {data.clauses.length === 0 ? (
            <p className="ai-review__empty">The AI did not identify separate clauses in this text.</p>
          ) : (
            <ul className="intel-list">
              {data.clauses.map((c) => (
                <ClauseCard key={c.id} clause={c} intel={intel} nav={nav} />
              ))}
            </ul>
          )}
          <Removed meta={data.meta} />
          <DemoNotice>{AI_LIMITS} Accepted wording is saved as a new version and can be undone.</DemoNotice>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Compliance Review

export function AiCompliance({ intel, nav }) {
  const state = intel.results.compliance;
  const data = isAi(state) ? state.data : null;
  return (
    <div className="ai-review">
      <ToolHeader
        title="Compliance Review"
        description="Indian legal formalities and particulars to check for this type of document."
        onRun={() => intel.run('compliance')}
        runLabel="Run compliance review"
        state={data ? state : { status: state.status === 'ready' ? 'idle' : state.status }}
        stale={data && intel.isStale('compliance')}
      />
      {state.status === 'loading' && <ToolLoading />}
      {state.status === 'error' && <ToolError message={state.error} onRetry={() => intel.run('compliance')} />}
      {!data && state.status !== 'loading' && state.status !== 'error' && (
        <ToolIdle onRun={() => intel.run('compliance')} runLabel="Run compliance review">
          Uses one AI request. Statutory checkpoints come from CASEONE’s curated list; AI observations are shown separately.
        </ToolIdle>
      )}
      {data && (
        <>
          {(data.documentType || data.context) && (
            <p className="intel-card__text">
              {data.documentType && <strong>{data.documentType}. </strong>}
              {data.context}
            </p>
          )}

          <p className="intel-section-title">Statutory checkpoints ({data.checkpoints.length})</p>
          {data.checkpoints.length === 0 ? (
            <p className="ai-review__empty">CASEONE has no curated statutory checkpoints for this document type yet.</p>
          ) : (
            <ul className="intel-list">
              {data.checkpoints.map((c) => (
                <li key={c.id} className="intel-card">
                  <div className="intel-card__badges">
                    <Badge tone="outline">Statutory provision</Badge>
                    <Badge tone="neutral">{c.mentionedInDocument ? 'Mentioned in document' : 'Not mentioned in document'}</Badge>
                  </div>
                  <p className="intel-card__title">{c.title}</p>
                  <p className="intel-card__text">{c.requirement}</p>
                  <p className="intel-card__meta">
                    Source: {c.source.act}, {c.source.provision}
                  </p>
                  <p className="finding__action">
                    <span>Verify:</span> {c.verify}
                  </p>
                  <ExternalSource source={c.source} />
                </li>
              ))}
            </ul>
          )}
          <p className="intel-card__meta">
            “Mentioned in document” is a keyword check only — it does not mean the requirement is met.
          </p>

          <p className="intel-section-title">AI observations — verify ({data.observations.length})</p>
          <Counts counts={data.counts} />
          {data.observations.length === 0 ? (
            <p className="ai-review__empty">No AI observations.</p>
          ) : (
            <ul className="intel-list">
              {data.observations.map((o) => (
                <li key={o.id} className="intel-card">
                  <div className="intel-card__top">
                    <SeverityLabel severity={o.severity} />
                    <Badge tone="demo">AI observation</Badge>
                  </div>
                  <p className="intel-card__title">{o.title}</p>
                  <p className="intel-card__text">{o.concern}</p>
                  {o.whyItMatters && <p className="intel-card__text">Why it matters: {o.whyItMatters}</p>}
                  <p className="finding__action">
                    <span>Verify or correct:</span> {o.whatToVerify}
                  </p>
                  <div className="intel-card__actions">
                    <Locate location={o.location} nav={nav} label="Locate" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Removed meta={data.meta} />
          <DemoNotice>{data.limitations}</DemoNotice>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Citations

const CITATION_STATUS = {
  verified: { label: 'Act title verified', tone: 'neutral' },
  unverified: { label: 'Unverified', tone: 'outline' },
  potentially_incorrect: { label: 'Potentially incorrect', tone: 'inverse' },
};

export function AiCitations({ intel, nav }) {
  const state = intel.results.citations;
  const { run } = intel;
  const data = state?.data?.meta?.source === 'rules' ? state.data : null;
  useEffect(() => {
    if (state.status === 'idle') run('citations');
  }, [state.status, run]);
  return (
    <div className="ai-review">
      <ToolHeader
        title="Citations"
        description="Legal references found in this document, with the checks that can be done without a legal database."
        onRun={() => run('citations')}
        runLabel="Scan references"
        state={data ? state : { status: state.status === 'ready' ? 'idle' : state.status }}
        stale={data && intel.isStale('citations')}
      />
      {state.status === 'loading' && !data && <ToolLoading />}
      {state.status === 'error' && <ToolError message={state.error} onRetry={() => run('citations')} />}
      {data && (
        <>
          <p className="ai-review__counts">
            {data.counts.verified} Act title verified · {data.counts.unverified} unverified ·{' '}
            {data.counts.potentially_incorrect} potentially incorrect
          </p>
          {data.citations.length === 0 ? (
            <p className="ai-review__empty">No legal references were found in this document.</p>
          ) : (
            <ul className="intel-list">
              {data.citations.map((c) => (
                <li key={c.id} className="intel-card">
                  <div className="intel-card__badges">
                    <Badge tone={CITATION_STATUS[c.status].tone}>{CITATION_STATUS[c.status].label}</Badge>
                    <span className="intel-card__meta">{c.type === 'case' ? 'Case citation' : c.type === 'act' ? 'Act' : 'Section'}</span>
                  </div>
                  <p className="intel-card__title">{c.text}</p>
                  <p className="intel-card__text">{c.reason}</p>
                  <ExternalSource source={c.source} />
                  <div className="intel-card__actions">
                    <Button size="sm" variant="secondary" onClick={() => nav.goToText(c.text)}>
                      Locate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data.notes.length > 0 && <List title="Consistency" items={data.notes} />}
          <DemoNotice>{data.limitations}</DemoNotice>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Research

export function AiResearch({ intel }) {
  const research = intel.aiResearch;
  const [question, setQuestion] = useState('');
  const loading = research.status === 'loading';
  const result = research.status === 'ready' ? research.result : null;
  const submit = (event) => {
    event.preventDefault();
    if (question.trim().length >= 3 && !loading) intel.askAiResearch(question.trim());
  };
  return (
    <div className="ai-review">
      <div className="tool-header">
        <h3 className="tool-header__title">Research</h3>
        <p className="tool-header__desc">
          Ask about a legal concept in this document. Select text in the document first to ask about that passage.
        </p>
      </div>
      <form className="ai-review__ask" onSubmit={submit}>
        <label htmlFor="ai-research-q" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="ai-research-q"
          className="ai-review__textarea"
          rows={3}
          maxLength={1000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What does a leave and licence agreement mean?"
        />
        <Button type="submit" size="sm" icon={Search} disabled={loading || question.trim().length < 3}>
          {loading ? 'Asking…' : 'Ask'}
        </Button>
      </form>
      {loading && <ToolLoading rows={2} />}
      {research.status === 'error' && <ToolError message={research.error} onRetry={() => intel.askAiResearch(research.question)} />}
      {result && (
        <div className="intel-card">
          <div className="intel-card__badges">
            <Badge tone="demo">AI explanation — not sourced</Badge>
          </div>
          <p className="intel-card__meta">Question: {research.question}</p>
          {research.selection && <p className="intel-card__meta">About the selected text.</p>}
          {result.answer.split(/\n+/).map((para, n) => (
            <p key={`${n}-${para.slice(0, 20)}`} className="intel-card__text">
              {para}
            </p>
          ))}
          <List title="Key points" items={result.keyPoints} />
          {result.terms.length > 0 && (
            <div className="ai-review__list">
              <p className="ai-review__list-title">Terms</p>
              <dl className="ai-review__terms">
                {result.terms.map((t, n) => (
                  <div key={`${n}-${t.term}`}>
                    <dt>{t.term}</dt>
                    <dd>{t.meaning}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <List title="Verify" items={result.toVerify} />
          {result.officialTexts.length > 0 && (
            <div className="ai-review__list">
              <p className="ai-review__list-title">Official text of Acts mentioned</p>
              {result.officialTexts.map((s) => (
                <ExternalSource key={s.act} source={s} />
              ))}
            </div>
          )}
        </div>
      )}
      <DemoNotice>
        {result?.limitations ??
          'AI explanations are based on your document only. No live legal research source is connected, so no judgments or case law are provided. Not legal advice.'}
      </DemoNotice>
    </div>
  );
}

// ---------------------------------------------------------------- Overview

export function AiOverview({ intel, onOpenTool }) {
  const { health, clauses, compliance, citations } = intel.results;
  const h = isAi(health) ? health.data : null;
  const k = isAi(clauses) ? clauses.data : null;
  const c = isAi(compliance) ? compliance.data : null;
  const r = citations?.data?.meta?.source === 'rules' ? citations.data : null;
  const rows = [
    {
      id: 'health',
      label: 'Document Health',
      value: h ? `${h.findings.length} finding${h.findings.length === 1 ? '' : 's'} (${h.counts.high} high)` : 'Not run yet',
    },
    {
      id: 'clauses',
      label: 'Clause Review',
      value: k
        ? `${k.clauses.length} clause${k.clauses.length === 1 ? '' : 's'}, ${k.clauses.filter((x) => x.proposal).length} with improved wording`
        : 'Not run yet',
    },
    {
      id: 'compliance',
      label: 'Compliance Review',
      value: c ? `${c.checkpoints.length} statutory checkpoint${c.checkpoints.length === 1 ? '' : 's'}, ${c.observations.length} AI observation${c.observations.length === 1 ? '' : 's'}` : 'Not run yet',
    },
    {
      id: 'citations',
      label: 'Citations',
      value: r ? `${r.citations.length} reference${r.citations.length === 1 ? '' : 's'}, ${r.counts.potentially_incorrect} potentially incorrect` : 'Not run yet',
    },
  ];
  return (
    <div className="ai-review">
      <div className="tool-header">
        <h3 className="tool-header__title">Overview</h3>
        <p className="tool-header__desc">Results of the reviews you have run on this document.</p>
      </div>
      <ul className="intel-list">
        {rows.map((row) => (
          <li key={row.id} className="intel-card ai-review__row">
            <div>
              <p className="intel-card__title">{row.label}</p>
              <p className="intel-card__meta">{row.value}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onOpenTool(row.id)}>
              Open
            </Button>
          </li>
        ))}
      </ul>
      <DemoNotice>
        Each AI review uses one AI request and runs only when you choose. None of them is a legal opinion.
      </DemoNotice>
    </div>
  );
}
