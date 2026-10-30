import { useCallback, useMemo, useRef, useState } from 'react';
import {
  healthService,
  clauseService,
  complianceService,
  citationService,
  researchService,
  assistantService,
  reviewService,
} from '../services';
import { buildDocumentSnapshot } from '../utils/documentSnapshot';
import { hydrateFieldTokens } from '../utils/fieldTokens';
import { p, i } from '../data/draftTemplates/builders';
import { getDocumentType } from '../data/documentTypes';
import { docToText } from '../utils/textToDoc';
import { buildWorkspaceContent } from '../utils/workspaceModel';
import { clauseTextToBlocks, templateOutline, planAccept } from '../utils/aiText';
import { planClauseAccept } from '../utils/reviewText';
import { useToast } from './useToast';

/** Non-empty text case details, as sent to the AI (never placeholders or objects). */
const filledFields = (fields) =>
  Object.fromEntries(
    Object.entries(fields ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
  );

const IDLE = { status: 'idle', data: null, error: null, revision: null };
const ASSISTANT_IDLE = {
  status: 'idle',
  actionId: null,
  selection: null,
  result: null,
  error: null,
};

const RUNNERS = {
  health: (s) => healthService.runHealthCheck(s),
  clauses: (s) => clauseService.detectMissingClauses(s),
  compliance: (s) => complianceService.reviewCompliance(s),
  citations: (s) => citationService.listCitations(s),
};

/**
 * Phase 3 — account documents: real review on the CASEONE server (read-only).
 * Health, clauses and compliance use AI; citations are rule-based (no AI).
 */
const AI_RUNNERS = {
  health: (input) => reviewService.runAiReview('health', input),
  clauses: (input) => reviewService.runAiReview('clauses', input),
  compliance: (input) => reviewService.runAiReview('compliance', input),
  citations: (input) => reviewService.checkCitations(input),
};

const RESEARCH_IDLE = { status: 'idle', question: '', selection: '', result: null, error: null };

/**
 * State and actions for the Legal Intelligence panel. All analysis comes from
 * services (demo today, API later); all document changes go through the
 * editor bridge so undo/redo, field tokens and autosave keep working.
 *
 * Callbacks close over the current `bridge` / `fields` (no refs), so a tool
 * that auto-runs on mount re-runs once the editor bridge becomes available.
 */
export function useWorkspaceIntelligence({ document, workspace, bridge, onDocumentEvent }) {
  const { toast } = useToast();
  const { schema, fieldMap, fields, revision } = workspace;
  const [results, setResults] = useState({
    health: IDLE,
    clauses: IDLE,
    compliance: IDLE,
    citations: IDLE,
  });
  const [dismissedFindings, setDismissedFindings] = useState(() => new Set());
  const [dismissedClauses, setDismissedClauses] = useState(() => new Set());
  const [addedClauses, setAddedClauses] = useState(() => new Set());
  const [research, setResearch] = useState({ status: 'idle', query: '', results: [], error: null });
  const [savedResearch, setSavedResearch] = useState(() => researchService.listSaved(document.id));
  const [assistant, setAssistant] = useState(ASSISTANT_IDLE);
  // Phase 3: signed-in account document → real review; otherwise the labelled demo tools.
  const aiReview = reviewService.canUseAiReview(document.id);
  const runningTools = useRef(new Set()); // one request per tool at a time
  const [clauseDecisions, setClauseDecisions] = useState({}); // clause id → 'applied' | 'rejected'
  const [aiResearch, setAiResearch] = useState(RESEARCH_IDLE);
  const researchInFlight = useRef(false);

  const getSnapshot = useCallback(
    () =>
      buildDocumentSnapshot({
        json: bridge?.getJSON() ?? { type: 'doc', content: [] },
        fields,
        schema,
        typeId: document.typeId,
        setup: document.setup,
      }),
    [bridge, fields, schema, document.typeId, document.setup],
  );

  /** Fill labels/values into field tokens of blocks about to be shown or inserted. */
  const hydrate = useCallback(
    (blocks) => hydrateFieldTokens({ type: 'doc', content: blocks }, fieldMap, fields).content,
    [fieldMap, fields],
  );

  const run = useCallback(
    async (toolId, { quiet = false } = {}) => {
      const runner = aiReview ? AI_RUNNERS[toolId] : RUNNERS[toolId];
      if (!runner || !bridge?.isReady()) return null;
      if (runningTools.current.has(toolId)) return null; // no duplicate requests
      const startedAt = revision;
      if (!quiet)
        setResults((r) => ({ ...r, [toolId]: { ...r[toolId], status: 'loading', error: null } }));
      runningTools.current.add(toolId);
      try {
        const input = aiReview
          ? {
              documentId: document.id,
              documentText: docToText(bridge.getJSON() ?? { type: 'doc', content: [] }),
            }
          : getSnapshot();
        const data = await runner(input);
        if (toolId === 'clauses') setClauseDecisions({});
        setResults((r) => ({
          ...r,
          [toolId]: { status: 'ready', data, error: null, revision: startedAt },
        }));
        return data;
      } catch (err) {
        // Nothing is substituted for a failed review; the message says why it failed.
        setResults((r) => ({
          ...r,
          [toolId]: { ...r[toolId], status: 'error', error: err.message },
        }));
        return null;
      } finally {
        runningTools.current.delete(toolId);
      }
    },
    [aiReview, bridge, revision, getSnapshot, document.id],
  );

  const runOverview = useCallback(
    () => Promise.all([run('health'), run('clauses'), run('compliance')]),
    [run],
  );

  const isStale = useCallback(
    (toolId) => results[toolId].status === 'ready' && results[toolId].revision !== revision,
    [results, revision],
  );

  // ---------------- Health ----------------
  const dismissFinding = useCallback((id) => setDismissedFindings((s) => new Set(s).add(id)), []);
  const restoreFindings = useCallback(() => setDismissedFindings(new Set()), []);

  // ---------------- Clauses ----------------
  const addClause = useCallback(
    (clause) => {
      const ok = bridge?.insertBlocks(hydrate(clause.content), { anchors: clause.insertBefore });
      if (!ok) {
        toast({ title: 'Clause could not be added', variant: 'error' });
        return;
      }
      setAddedClauses((s) => new Set(s).add(clause.id));
      onDocumentEvent?.('clause-added', clause.name);
      toast({
        title: `Added: ${clause.name}`,
        description: 'Demo suggestion — review and edit before use. Undo is available.',
        variant: 'success',
      });
    },
    [bridge, hydrate, toast, onDocumentEvent],
  );
  const dismissClause = useCallback((id) => setDismissedClauses((s) => new Set(s).add(id)), []);

  /**
   * Phase 3 clause review: apply an AI-improved paragraph the user previewed and accepted.
   * Only if the original paragraph text is still exactly in the document; undoable; recorded as
   * an "AI edit accepted" version through the normal save flow. Never automatic.
   */
  const acceptClauseProposal = useCallback(
    (clause) => {
      const proposal = clause?.proposal;
      if (!proposal || !bridge) return;
      const plan = planClauseAccept(proposal, bridge.findTextRange(proposal.original));
      if (plan.type === 'error') {
        toast({ title: 'Not applied', description: plan.error, variant: 'error' });
        return;
      }
      const outcome = bridge.replaceRange(plan.range, plan.expected, plan.replacement);
      if (!outcome.ok) {
        toast({ title: 'Not applied', description: `${outcome.reason} Your document was not changed.`, variant: 'error' });
        return;
      }
      setClauseDecisions((d) => ({ ...d, [clause.id]: 'applied' }));
      // Version detail is limited to 200 characters by the backend.
      onDocumentEvent?.('ai-edit', `Clause review: ${clause.heading}`.slice(0, 190));
      toast({
        title: 'Improved clause applied',
        description: 'AI suggestion — review the wording and fill any [DETAIL REQUIRED]. Undo is available.',
        variant: 'success',
      });
    },
    [bridge, toast, onDocumentEvent],
  );
  const rejectClauseProposal = useCallback(
    (clause) => setClauseDecisions((d) => ({ ...d, [clause.id]: 'rejected' })),
    [],
  );

  /** Phase 3 research: a question about this document, answered by AI (not sourced). */
  const askAiResearch = useCallback(
    async (question) => {
      if (researchInFlight.current || !bridge?.isReady()) return;
      const sel = bridge.getSelection();
      const selection = sel && !sel.empty ? sel.text.slice(0, reviewService.MAX_SELECTION_LENGTH) : '';
      setAiResearch({ status: 'loading', question, selection, result: null, error: null });
      researchInFlight.current = true;
      try {
        const result = await reviewService.askResearch({
          documentId: document.id,
          question,
          selection,
          documentText: docToText(bridge.getJSON() ?? { type: 'doc', content: [] }),
        });
        setAiResearch({ status: 'ready', question, selection, result, error: null });
      } catch (err) {
        setAiResearch({ status: 'error', question, selection, result: null, error: err.message });
      } finally {
        researchInFlight.current = false;
      }
    },
    [bridge, document.id],
  );

  // ---------------- Citations ----------------
  const insertCitation = useCallback(
    (citation) => {
      if (!bridge?.insertBlocksAtCursor(hydrate(citation.insert))) return;
      toast({
        title: 'Reference placeholder inserted',
        description: 'Unverified demo placeholder — replace it with a verified reference.',
      });
      // Mark it as used immediately; a re-scan confirms against the document.
      setResults((r) =>
        r.citations.data
          ? {
              ...r,
              citations: {
                ...r.citations,
                data: {
                  ...r.citations.data,
                  citations: r.citations.data.citations.map((c) =>
                    c.id === citation.id ? { ...c, used: true } : c,
                  ),
                },
              },
            }
          : r,
      );
    },
    [bridge, hydrate, toast],
  );

  // ---------------- Research ----------------
  const searchResearch = useCallback(
    async (query) => {
      const q = query.trim();
      if (!q) return;
      setResearch({ status: 'loading', query: q, results: [], error: null });
      try {
        const data = await researchService.searchResearch(q, document.typeId);
        setResearch({
          status: 'ready',
          query: q,
          results: data.results,
          meta: data.meta,
          error: null,
        });
      } catch (err) {
        setResearch({ status: 'error', query: q, results: [], error: err.message });
      }
    },
    [document.typeId],
  );
  const saveResearch = useCallback(
    (item) => {
      setSavedResearch(researchService.saveForLater(document.id, item));
      toast({ title: 'Saved for later', description: item.title });
    },
    [document.id, toast],
  );
  const removeResearch = useCallback(
    (id) => setSavedResearch(researchService.removeSaved(document.id, id)),
    [document.id],
  );
  const addResearchNote = useCallback(
    (item) => {
      const note = [
        p(
          i(
            `[Research note (demo placeholder): ${item.title}. ${item.summary} Verify against a reliable source before relying on it.]`,
          ),
        ),
      ];
      if (bridge?.insertBlocksAtCursor(note)) {
        toast({
          title: 'Note added to draft',
          description: 'Inserted after the paragraph at your cursor.',
        });
      }
    },
    [bridge, toast],
  );

  // ---------------- Assistant ----------------
  // Signed in: real AI (proposal → accept / reject). Signed out: the labelled demo.
  const assistantActions = assistantService.getAssistantActions();
  const inFlight = useRef(false); // one assistant request at a time (no accidental duplicates)

  const runAssistant = useCallback(
    async (actionId, { instructions = '' } = {}) => {
      if (inFlight.current) return;
      const action = assistantService.getAssistantActions().find((a) => a.id === actionId);
      if (!action) return;
      const selection = bridge?.getSelection() ?? null;
      const fail = (error) =>
        setAssistant({ status: 'error', actionId, selection, result: null, error });
      if (action.ai) {
        if (!bridge?.isReady()) return fail('The editor is not ready yet.');
        if (action.kind === 'replace') {
          if (!selection || selection.empty || !selection.text.trim())
            return fail('Select some text in the document first.');
          if (!selection.singleBlock)
            return fail('Select text within a single paragraph to use this action.');
          if (selection.hasTokens) {
            return fail(
              'The selection includes linked case-detail fields. Select plain text only, so field links are not lost.',
            );
          }
        }
        const startedAt = revision;
        setAssistant({ status: 'loading', actionId, selection, result: null, error: null, revision: startedAt });
        inFlight.current = true;
        try {
          let result;
          if (action.kind === 'document') {
            const template = buildWorkspaceContent(document, fieldMap, fields);
            result = await assistantService.generateDraftProposal({
              typeId: document.typeId,
              language: document.setup?.language ?? document.language,
              description: document.setup?.description,
              fields: filledFields(fields),
              title: document.name,
              template: {
                name: document.origin?.templateName ?? getDocumentType(document.typeId)?.name ?? '',
                outline: templateOutline(template),
              },
            });
          } else {
            result = await assistantService.runAiAssist({
              documentId: document.id,
              actionId,
              selection: selection?.empty ? '' : (selection?.text ?? ''),
              instructions: instructions.trim(),
              documentText: docToText(bridge.getJSON() ?? { type: 'doc', content: [] }),
            });
            if (result.kind === 'insert') result.blocks = clauseTextToBlocks(result.proposed);
          }
          setAssistant({ status: 'ready', actionId, selection, result, error: null, revision: startedAt });
        } catch (err) {
          // Nothing in the document was changed; the message says why it failed.
          fail(err?.message || 'The AI request failed. Your document was not changed.');
        } finally {
          inFlight.current = false;
        }
        return;
      }
      if (action.kind !== 'insert') {
        if (!selection || selection.empty || !selection.text.trim())
          return fail('Select some text in the document first.');
        if (action.kind === 'replace' && !selection.singleBlock)
          return fail('Select text within a single paragraph to use this action.');
        if (action.kind === 'replace' && selection.hasTokens) {
          return fail(
            'The selection includes linked case-detail fields. Select plain text only, so field links are not lost.',
          );
        }
      }
      setAssistant({ status: 'loading', actionId, selection, result: null, error: null });
      inFlight.current = true;
      try {
        const result = await assistantService.runAssistant(actionId, {
          text: selection?.text ?? '',
          snapshot: getSnapshot(),
        });
        setAssistant({ status: 'ready', actionId, selection, result, error: null });
      } catch (err) {
        fail(err.message);
      } finally {
        inFlight.current = false;
      }
    },
    [bridge, getSnapshot, revision, document, fieldMap, fields],
  );

  /** Accept: apply the previewed proposal through the editor bridge (undoable), then save a version. */
  const acceptAssistant = useCallback(() => {
    if (!bridge) return;
    const plan = planAccept(assistant, revision);
    const label =
      assistantService.getAssistantActions().find((a) => a.id === assistant.result?.actionId)?.label ?? null;
    const isAi = assistant.result?.meta?.source === 'ai';
    const notApplied = (error) => setAssistant((a) => ({ ...a, status: 'error', error }));

    if (plan.type === 'error') return notApplied(plan.error);
    if (plan.type === 'none') return;

    if (plan.type === 'document') {
      workspace.applyGeneratedContent(plan.content).then((outcome) => {
        if (outcome?.ok === false) return; // the save hook already reported the error
        toast({
          title: 'AI draft applied',
          description:
            'Saved as a new version — the previous text is in Version history. Review every detail and fill all [DETAIL REQUIRED] placeholders.',
          variant: 'success',
        });
      });
    } else if (plan.type === 'insert') {
      if (!bridge.insertBlocksAtCursor(plan.blocks)) {
        return notApplied('Not applied: the clause could not be inserted. Your document was not changed.');
      }
      onDocumentEvent?.('ai-edit', label);
      toast({
        title: 'AI clause inserted',
        description:
          'Inserted after the paragraph at your cursor. Review it and fill any [DETAIL REQUIRED]. Undo is available.',
        variant: 'success',
      });
    } else if (plan.type === 'replace') {
      const outcome = bridge.replaceRange(plan.range, plan.expected, plan.replacement);
      if (!outcome.ok) return notApplied(`Not applied: ${outcome.reason} Run the action again.`);
      onDocumentEvent?.('ai-edit', label);
      toast({
        title: 'Change applied',
        description: isAi
          ? 'AI suggestion applied — review the wording. Undo is available.'
          : 'Sample transformation — review the wording. Undo is available.',
        variant: 'success',
      });
    } else if (plan.type === 'demo-clause') {
      if (!bridge.insertBlocksAtCursor(hydrate(plan.clause.content))) return;
      onDocumentEvent?.('clause-added', plan.clause.name);
      toast({
        title: `Inserted: ${plan.clause.name}`,
        description: 'Demo suggestion — review before use.',
        variant: 'success',
      });
    }
    setAssistant(ASSISTANT_IDLE);
  }, [assistant, bridge, hydrate, toast, onDocumentEvent, revision, workspace]);

  const rejectAssistant = useCallback(() => setAssistant(ASSISTANT_IDLE), []);

  return useMemo(
    () => ({
      ready: Boolean(bridge),
      results,
      hydrateBlocks: hydrate,
      run,
      runOverview,
      isStale,
      dismissedFindings,
      dismissFinding,
      restoreFindings,
      addedClauses,
      dismissedClauses,
      addClause,
      dismissClause,
      insertCitation,
      research,
      searchResearch,
      savedResearch,
      saveResearch,
      removeResearch,
      addResearchNote,
      suggestedTopics: researchService.getSuggestedTopics(document.typeId),
      assistant,
      runAssistant,
      acceptAssistant,
      rejectAssistant,
      assistantActions,
      selectionActions: assistantService.getSelectionActions(),
      aiReview,
      clauseDecisions,
      acceptClauseProposal,
      rejectClauseProposal,
      aiResearch,
      askAiResearch,
    }),
    [
      bridge,
      results,
      hydrate,
      run,
      runOverview,
      isStale,
      dismissedFindings,
      dismissFinding,
      restoreFindings,
      addedClauses,
      dismissedClauses,
      addClause,
      dismissClause,
      insertCitation,
      research,
      searchResearch,
      savedResearch,
      saveResearch,
      removeResearch,
      addResearchNote,
      document.typeId,
      assistant,
      runAssistant,
      acceptAssistant,
      rejectAssistant,
      assistantActions,
      aiReview,
      clauseDecisions,
      acceptClauseProposal,
      rejectClauseProposal,
      aiResearch,
      askAiResearch,
    ],
  );
}
