import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentReviewService, ocrService } from '../services';
import { getDocumentSchema, getFieldMap } from '../data/documentSchemas';
import { getDocumentType } from '../data/documentTypes';
import { hydrateFieldTokens } from '../utils/fieldTokens';
import { docToText } from '../utils/textToDoc';
import { buildReviewedDocumentPayload } from '../utils/reviewedDocument';
import { useDocuments } from './useDocuments';
import { useToast } from './useToast';
import { SAVE_LOCATION } from '../services/config';

const IDLE_REVIEW = { status: 'idle', data: null, error: null };

/**
 * Review Existing Document: file selection → demo processing → review workspace.
 * phase: 'select' | 'processing' | 'review' | 'error'
 *
 * `intel` mirrors the shape the Step 5 tools expect (results / run / dismiss /
 * addClause …) so HealthTool, ClausesTool and ComplianceTool are reused as-is.
 */
export function useDocumentReview() {
  const { createDocument } = useDocuments();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('select');
  const [selected, setSelected] = useState(null); // { file, info }
  const [language, setLanguage] = useState('en');
  const [ocrChoice, setOcrChoice] = useState(false);
  const [stage, setStage] = useState(0);
  const [extraction, setExtraction] = useState(null);
  const [text, setText] = useState('');
  const [reviewedText, setReviewedText] = useState('');
  const [typeId, setTypeId] = useState('general-document');
  const [review, setReview] = useState(IDLE_REVIEW);
  const [error, setError] = useState(null);
  const [dismissedFindings, setDismissedFindings] = useState(() => new Set());
  const [dismissedClauses, setDismissedClauses] = useState(() => new Set());
  const [addedClauses, setAddedClauses] = useState(() => new Set());
  const runId = useRef(0);

  const isImage = selected?.info.kind === 'image';
  const ocr = isImage || (selected?.info.kind === 'pdf' && ocrChoice);

  const selectFile = useCallback((value) => {
    setSelected(value);
    setError(null);
    if (value?.info.kind === 'docx') setOcrChoice(false);
  }, []);

  const removeFile = useCallback(() => setSelected(null), []);

  const runReview = useCallback(async (nextText, nextType) => {
    setReview((r) => ({ ...r, status: 'loading', error: null }));
    try {
      const data = await documentReviewService.reviewText({ text: nextText, typeId: nextType });
      setReview({ status: 'ready', data, error: null });
      setReviewedText(nextText);
    } catch (err) {
      setReview({ status: 'error', data: null, error: err.message });
    }
  }, []);

  const start = useCallback(async () => {
    if (!selected) return;
    const id = (runId.current += 1);
    setPhase('processing');
    setStage(0);
    setError(null);
    try {
      const out = await documentReviewService.runReviewPipeline(
        selected.info,
        { language, ocr },
        (_, index) => {
          if (runId.current === id) setStage(index);
        },
      );
      if (runId.current !== id) return;
      setStage(5);
      setExtraction(out.extraction);
      setText(out.extraction.text);
      setReviewedText(out.extraction.text);
      setTypeId(out.typeId);
      setReview({ status: 'ready', data: out.review, error: null });
      setDismissedFindings(new Set());
      setDismissedClauses(new Set());
      setAddedClauses(new Set());
      setPhase('review');
    } catch (err) {
      if (runId.current !== id) return;
      setError(err instanceof Error ? err.message : 'The document could not be processed.');
      setPhase('error');
    }
  }, [selected, language, ocr]);

  const cancel = useCallback(() => {
    runId.current += 1;
    setPhase('select');
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    setPhase('select');
    setSelected(null);
    setExtraction(null);
    setText('');
    setReview(IDLE_REVIEW);
    setError(null);
  }, []);

  const changeType = useCallback(
    (nextType) => {
      setTypeId(nextType);
      setAddedClauses(new Set());
      runReview(text, nextType);
    },
    [runReview, text],
  );

  const resetText = useCallback(() => {
    if (!extraction) return;
    const sample = ocrService.getSampleText(extraction.sampleId) || extraction.text;
    setText(sample);
    runReview(sample, typeId);
  }, [extraction, runReview, typeId]);

  const openInEditor = useCallback(() => {
    if (!selected) return;
    const payload = buildReviewedDocumentPayload({
      text,
      typeId,
      name: `Review — ${selected.info.name}`,
      source: 'reviewed-document',
      sourceFile: { ...selected.info, reviewedAt: new Date().toISOString() },
      review: {
        language,
        method: extraction?.method ?? 'demo-extraction',
        isSample: extraction?.isSample ?? true,
        score: review.data?.health.score ?? null,
        reviewedAt: new Date().toISOString(),
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
  }, [selected, text, typeId, language, extraction, review.data, createDocument, toast, navigate]);

  // ---------- Adapter for the Step 5 tools ----------
  const fieldMap = useMemo(() => getFieldMap(getDocumentSchema(typeId)), [typeId]);
  const hydrate = useCallback(
    (blocks) => hydrateFieldTokens({ type: 'doc', content: blocks }, fieldMap, {}).content,
    [fieldMap],
  );
  const textChanged = review.status === 'ready' && text !== reviewedText;

  const intel = useMemo(() => {
    const result = (key) => ({
      status: review.status === 'idle' ? 'ready' : review.status,
      data: review.data?.[key] ?? null,
      error: review.error,
    });
    return {
      ready: true,
      results: {
        health: result('health'),
        clauses: result('clauses'),
        compliance: result('compliance'),
      },
      run: () => runReview(text, typeId),
      runOverview: () => runReview(text, typeId),
      isStale: () => textChanged,
      hydrateBlocks: hydrate,
      dismissedFindings,
      dismissFinding: (id) => setDismissedFindings((s) => new Set(s).add(id)),
      restoreFindings: () => setDismissedFindings(new Set()),
      addedClauses,
      dismissedClauses,
      dismissClause: (id) => setDismissedClauses((s) => new Set(s).add(id)),
      addClause: (clause) => {
        const addition = docToText({ type: 'doc', content: hydrate(clause.content) });
        setText((t) => `${t.trimEnd()}\n${addition}`);
        setAddedClauses((s) => new Set(s).add(clause.id));
        toast({
          title: `Added: ${clause.name}`,
          description: 'Appended to the extracted text. Demo suggestion — review before use.',
          variant: 'success',
        });
      },
    };
  }, [
    review,
    runReview,
    text,
    typeId,
    textChanged,
    hydrate,
    dismissedFindings,
    addedClauses,
    dismissedClauses,
    toast,
  ]);

  return {
    phase,
    selected,
    selectFile,
    removeFile,
    language,
    setLanguage,
    isImage,
    ocr,
    ocrChoice,
    setOcrChoice,
    start,
    cancel,
    reset,
    stage,
    extraction,
    error,
    text,
    setText,
    resetText,
    textChanged,
    rerun: () => runReview(text, typeId),
    typeId,
    typeName: getDocumentType(typeId)?.name ?? 'Document',
    changeType,
    review,
    intel,
    openInEditor,
  };
}
