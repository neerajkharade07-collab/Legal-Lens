import { Check, X } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ToolLoading, ToolError, DemoNotice } from './IntelShared';
import { BlockPreview } from './BlockPreview';
import { cn } from '../../utils/cn';
import './AssistantTool.css';

const excerpt = (text, n = 160) => (text.length > n ? `${text.slice(0, n)}…` : text);

/** Contextual drafting assistant: acts on the current editor selection. */
export function AssistantTool({ intel }) {
  const { assistant, assistantActions } = intel;
  const action = assistantActions.find((a) => a.id === assistant.actionId);
  const result = assistant.result;

  return (
    <div className="assistant">
      <div className="assistant__intro">
        <h3 className="assistant__title">Drafting assistant</h3>
        <p className="assistant__hint">
          Select text in the document, then choose an action. You can also use the bar that appears
          above a selection.
        </p>
      </div>

      <div className="assistant__actions" role="group" aria-label="Assistant actions">
        {assistantActions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={cn('assistant__action', assistant.actionId === a.id && 'is-active')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => intel.runAssistant(a.id)}
            disabled={assistant.status === 'loading'}
          >
            {a.label}
          </button>
        ))}
      </div>

      {assistant.status === 'loading' && <ToolLoading rows={2} />}
      {assistant.status === 'error' && <ToolError message={assistant.error} />}

      {assistant.status === 'ready' && result && (
        <section
          className="assistant__result"
          aria-labelledby="assistant-result-title"
          aria-live="polite"
        >
          <div className="assistant__result-head">
            <p id="assistant-result-title" className="assistant__result-title">
              {action?.label}
            </p>
            <Badge tone="demo">Sample — not AI-generated</Badge>
          </div>

          {result.kind === 'replace' && (
            <>
              <p className="intel-section-title">Preview change</p>
              <div className="assistant__diff">
                <p className="assistant__diff-label">Original</p>
                <p className="assistant__original">{excerpt(result.original, 600)}</p>
                <p className="assistant__diff-label">Proposed</p>
                <p className="assistant__proposed">
                  {result.changed ? result.proposed : 'No change proposed.'}
                </p>
              </div>
            </>
          )}

          {result.kind === 'insert' && result.clause && (
            <>
              <p className="intel-section-title">
                Preview clause — inserted after the paragraph at your cursor
              </p>
              <BlockPreview blocks={intel.hydrateBlocks(result.clause.content)} />
            </>
          )}

          {result.kind === 'info' && result.original && (
            <p className="assistant__quote">“{excerpt(result.original)}”</p>
          )}

          {result.notes?.length > 0 && (
            <ul className="assistant__notes">
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}

          <div className="assistant__decision">
            {result.kind !== 'info' && (
              <Button
                size="sm"
                icon={Check}
                onClick={intel.acceptAssistant}
                disabled={!result.changed}
              >
                Accept
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={X} onClick={intel.rejectAssistant}>
              {result.kind === 'info' ? 'Dismiss' : 'Reject'}
            </Button>
          </div>
        </section>
      )}

      <DemoNotice>
        Demo assistant: rule-based sample transformations run in your browser. No AI model is used.
        Review every change before accepting — accepted changes can be undone.
      </DemoNotice>
    </div>
  );
}
