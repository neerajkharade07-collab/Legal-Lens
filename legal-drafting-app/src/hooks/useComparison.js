import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { comparisonService, documentReviewService } from '../services';
import { buildReviewedDocumentPayload } from '../utils/reviewedDocument';
import { useDocuments } from './useDocuments';
import { useToast } from './useToast';
import { SAVE_LOCATION } from '../services/config';

/**
 * Compare Documents: two files → (demo) comparison → redline workspace.
 * phase: 'select' | 'comparing' | 'ready' | 'error'
 * decisions: { [changeId]: 'accepted' | 'rejected' } (absent = pending)
 */
export function useComparison() {
  const { createDocument } = useDocuments();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('select');
  const [original, setOriginal] = useState(null);
  const [revised, setRevised] = useState(null);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [mode, setMode] = useState('redline');
  const [attempted, setAttempted] = useState(false);
  const runId = useRef(0);

  const compare = useCallback(async () => {
    setAttempted(true);
    if (!original || !revised) return;
    const id = (runId.current += 1);
    setPhase('comparing');
    setStage(0);
    setError(null);
    try {
      const out = await comparisonService.compareDocuments(
        original.info,
        revised.info,
        (_, index) => {
          if (runId.current === id) setStage(index);
        },
      );
      if (runId.current !== id) return;
      setResult(out);
      setDecisions({});
      setActiveId(out.changes[0]?.id ?? null);
      setMode('redline');
      setPhase('ready');
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : 'The documents could not be compared.');
      setPhase('error');
    }
  }, [original, revised]);

  const cancel = useCallback(() => {
    runId.current += 1;
    setPhase('select');
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setPhase('select');
    setResult(null);
    setDecisions({});
    setError(null);
    setAttempted(false);
  }, []);

  const decide = useCallback((changeId, decision) => {
    setDecisions((d) => {
      const next = { ...d };
      if (!decision || next[changeId] === decision) delete next[changeId];
      else next[changeId] = decision;
      return next;
    });
  }, []);

  const decideAll = useCallback(
    (decision) => {
      if (!result) return;
      setDecisions(Object.fromEntries(result.changes.map((c) => [c.id, decision])));
      toast({
        title: decision === 'accepted' ? 'All changes accepted' : 'All changes rejected',
        duration: 2000,
      });
    },
    [result, toast],
  );

  const changes = useMemo(() => result?.changes ?? [], [result]);
  const activeIndex = Math.max(
    0,
    changes.findIndex((c) => c.id === activeId),
  );
  const counts = useMemo(() => {
    const decided = Object.values(decisions);
    return {
      accepted: decided.filter((d) => d === 'accepted').length,
      rejected: decided.filter((d) => d === 'rejected').length,
      pending: changes.length - decided.length,
    };
  }, [decisions, changes.length]);

  const cleanText = useMemo(
    () => (result ? comparisonService.applyDecisions(result, decisions) : ''),
    [result, decisions],
  );

  const step = useCallback(
    (delta) => {
      if (!changes.length) return;
      const next = changes[(activeIndex + delta + changes.length) % changes.length];
      setActiveId(next.id);
    },
    [changes, activeIndex],
  );

  const openInEditor = useCallback(() => {
    if (!result) return;
    const payload = buildReviewedDocumentPayload({
      text: cleanText,
      typeId: documentReviewService.suggestDocumentType(cleanText),
      name: `Comparison result — ${revised?.info.name ?? 'revised document'}`,
      source: 'compared-document',
      sourceFiles: { original: original?.info ?? null, revised: revised?.info ?? null },
      review: {
        comparedAt: new Date().toISOString(),
        isSample: result.isSample,
        ...counts,
        total: changes.length,
      },
    });
    createDocument(payload).then(
      (doc) => {
        toast({
          title: 'Opened in the drafting editor',
          description: `Saved ${SAVE_LOCATION}.`,
          variant: 'success',
        });
        navigate(`/draft/${doc.id}`);
      },
      (err) =>
        toast({
          title: 'Could not open in the editor',
          description: err.message,
          variant: 'error',
        }),
    );
  }, [
    result,
    cleanText,
    revised,
    original,
    counts,
    changes.length,
    createDocument,
    toast,
    navigate,
  ]);

  return {
    phase,
    original,
    setOriginal,
    revised,
    setRevised,
    attempted,
    stage,
    compare,
    cancel,
    reset,
    error,
    result,
    changes,
    decisions,
    decide,
    decideAll,
    counts,
    activeId,
    activeIndex,
    setActiveId,
    step,
    mode,
    setMode,
    cleanText,
    openInEditor,
  };
}
