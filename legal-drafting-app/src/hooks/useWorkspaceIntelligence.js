import { useCallback, useMemo, useState } from 'react';
import {
  healthService,
  clauseService,
  complianceService,
  citationService,
  researchService,
  assistantService,
} from '../services';
import { buildDocumentSnapshot } from '../utils/documentSnapshot';
import { hydrateFieldTokens } from '../utils/fieldTokens';
import { p, i } from '../data/draftTemplates/builders';
import { useToast } from './useToast';

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
      const runner = RUNNERS[toolId];
      if (!runner || !bridge?.isReady()) return null;
      const startedAt = revision;
      if (!quiet)
        setResults((r) => ({ ...r, [toolId]: { ...r[toolId], status: 'loading', error: null } }));
      try {
        const data = await runner(getSnapshot());
        setResults((r) => ({
          ...r,
          [toolId]: { status: 'ready', data, error: null, revision: startedAt },
        }));
        return data;
      } catch (err) {
        setResults((r) => ({
          ...r,
          [toolId]: { ...r[toolId], status: 'error', error: err.message },
        }));
        return null;
      }
    },
    [bridge, revision, getSnapshot],
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
  const runAssistant = useCallback(
    async (actionId) => {
      const action = assistantService.ASSISTANT_ACTIONS.find((a) => a.id === actionId);
      if (!action) return;
      const selection = bridge?.getSelection() ?? null;
      const fail = (error) =>
        setAssistant({ status: 'error', actionId, selection, result: null, error });
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
      try {
        const result = await assistantService.runAssistant(actionId, {
          text: selection?.text ?? '',
          snapshot: getSnapshot(),
        });
        setAssistant({ status: 'ready', actionId, selection, result, error: null });
      } catch (err) {
        fail(err.message);
      }
    },
    [bridge, getSnapshot],
  );

  const acceptAssistant = useCallback(() => {
    const { result, selection } = assistant;
    if (!result || !bridge) return;
    if (result.kind === 'replace' && result.changed) {
      const outcome = bridge.replaceRange(selection, selection.text, result.proposed);
      if (!outcome.ok) {
        setAssistant((a) => ({
          ...a,
          status: 'error',
          error: `Not applied: ${outcome.reason} Run the action again.`,
        }));
        return;
      }
      onDocumentEvent?.(
        'ai-edit',
        assistantService.ASSISTANT_ACTIONS.find((a) => a.id === result.actionId)?.label ?? null,
      );
      toast({
        title: 'Change applied',
        description: 'Sample transformation — review the wording. Undo is available.',
        variant: 'success',
      });
    } else if (result.kind === 'insert' && result.clause) {
      if (!bridge.insertBlocksAtCursor(hydrate(result.clause.content))) return;
      onDocumentEvent?.('clause-added', result.clause.name);
      toast({
        title: `Inserted: ${result.clause.name}`,
        description: 'Demo suggestion — review before use.',
        variant: 'success',
      });
    }
    setAssistant(ASSISTANT_IDLE);
  }, [assistant, bridge, hydrate, toast, onDocumentEvent]);

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
      assistantActions: assistantService.ASSISTANT_ACTIONS,
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
    ],
  );
}
