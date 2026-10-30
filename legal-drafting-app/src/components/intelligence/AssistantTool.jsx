import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ToolLoading, ToolError, DemoNotice } from './IntelShared';
import { BlockPreview } from './BlockPreview';
import { cn } from '../../utils/cn';
import './AssistantTool.css';

const excerpt = (text, n = 160) => (text.length > n ? `${text.slice(0, n)}…` : text);
const MAX_INSTRUCTIONS = 1000;

/**
 * Contextual drafting assistant: acts on the current editor selection.
 * Signed in, every action is a real AI request whose result is only a PROPOSAL:
 * the document changes only when the user presses Accept (Reject leaves it as it was).
 */
export function AssistantTool({ intel }) {
  const { assistant, assistantActions } = intel;
  const [instructions, setInstructions] = useState('');
  const action = assistantActions.find((a) => a.id === assistant.actionId);
  const result = assistant.result;
  const isAiMode = assistantActions.some((a) => a.ai);
  const isAiResult = result?.meta?.source === 'ai';
  const loading = assistant.status === 'loading';

  return (
    <div className="assistant">
      <div className="assistant__intro">
        <h3 className="assistant__title">Drafting assistant</h3>
        <p className="assistant__hint">
          {isAiMode
            ? 'Select text in the document, then choose an action — or insert a clause at your cursor, or generate a complete draft from your case details. You always see a preview first; nothing changes until you accept.'
            : 'Select text in the document, then choose an action. You can also use the bar that appears above a selection.'}
        </p>
      </div>

      {isAiMode && (
        <div className="form-field assistant__instructions">
          <label className="form-label" htmlFor="assistant-instructions">
            Instructions for the AI (optional)
          </label>
          <textarea
            id="assistant-instructions"
            className="form-input"
            rows={2}
            maxLength={MAX_INSTRUCTIONS}
            value={instructions}
            placeholder="e.g. Add a clause on the security deposit refund"
            onChange={(e) => setInstructions(e.target.value)}
            disabled={loading}
          />
        </div>
      )}

      <div className="assistant__actions" role="group" aria-label="Assistant actions">
        {assistantActions.map((a) => (
          <button
            key={a.id}
            type="button"
            className={cn('assistant__action', assistant.actionId === a.id && 'is-active')}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => intel.runAssistant(a.id, { instructions })}
            disabled={loading}
            aria-busy={loading && assistant.actionId === a.id ? true : undefined}
          >
            {a.label}
          </button>
        ))}
      </div>

      {loading && (
        <>
          {isAiMode && (
            <p className="assistant__hint" role="status">
              Asking the AI… this can take up to a minute.
            </p>
          )}
          <ToolLoading rows={2} />
        </>
      )}
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
            {isAiResult ? (
              <Badge tone="demo">AI suggestion — review before accepting</Badge>
            ) : (
              <Badge tone="demo">Sample — not AI-generated</Badge>
            )}
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

          {result.kind === 'insert' && isAiResult && result.blocks?.length > 0 && (
            <>
              <p className="intel-section-title">
                Preview clause — inserted after the paragraph at your cursor
              </p>
              <BlockPreview blocks={result.blocks} />
            </>
          )}

          {result.kind === 'insert' && !isAiResult && result.clause && (
            <>
              <p className="intel-section-title">
                Preview clause — inserted after the paragraph at your cursor
              </p>
              <BlockPreview blocks={intel.hydrateBlocks(result.clause.content)} />
            </>
          )}

          {result.kind === 'document' && (
            <>
              <p className="intel-section-title">
                Preview draft — Accept replaces the whole document text
              </p>
              <div className="assistant__draft-preview">
                <BlockPreview blocks={result.content?.content ?? []} label="Preview of the AI draft" />
              </div>
              <p className="assistant__hint">
                Your current text is kept in Version history and can be restored. Case-detail
                fields stay in the side panel, but in the new text they are written out, not linked.
              </p>
            </>
          )}

          {result.kind === 'info' && result.original && (
            <p className="assistant__quote">“{excerpt(result.original)}”</p>
          )}

          {isAiResult && (
            <ul className="assistant__notes">
              {result.placeholders > 0 && (
                <li>
                  Contains {result.placeholders} [DETAIL REQUIRED] placeholder
                  {result.placeholders === 1 ? '' : 's'} where information is missing — fill
                  {result.placeholders === 1 ? ' it' : ' them'} in before use.
                </li>
              )}
              <li>
                Written by AI from your document only. It is not legal advice and has not been
                verified — check every detail, and have important documents reviewed by a lawyer.
              </li>
            </ul>
          )}

          {!isAiResult && result.notes?.length > 0 && (
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

      {isAiMode ? (
        <DemoNotice>
          AI editing runs on the CASEONE server (Google Gemini) for your account. It uses only your
          document and case details: missing facts are marked [DETAIL REQUIRED], and suggestions
          that add laws, sections, case citations, links or numbers you did not give are rejected.
          Nothing changes until you accept, and accepted changes can be undone or restored from
          Version history.
        </DemoNotice>
      ) : (
        <DemoNotice>
          Demo assistant: rule-based sample transformations run in your browser. No AI model is
          used. Sign in to use the AI assistant. Review every change before accepting — accepted
          changes can be undone.
        </DemoNotice>
      )}
    </div>
  );
}
