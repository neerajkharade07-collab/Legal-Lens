/**
 * Review an existing document — future: Document Review API.
 * Reuses the Step 5 demo intelligence (health rules, clause catalog,
 * compliance checklist) on text converted to the editor's JSON shape, plus
 * text-specific structural rules. Every result is demo / requires verification.
 */
import { getDocumentSchema } from '../data/documentSchemas';
import { DOCUMENT_TYPE_KEYWORDS } from '../data/review/documentTypeKeywords';
import { REVIEW_STAGES } from '../data/review/reviewStages';
import { buildDocumentSnapshot } from '../utils/documentSnapshot';
import { textToDoc } from '../utils/textToDoc';
import { runHealthRules, summarizeHealth } from './demo/healthRules';
import { runReviewRules } from './demo/reviewRules';
import { detectMissingClauses } from './clauseService';
import { reviewCompliance } from './complianceService';
import { extractText } from './ocrService';
import { USE_MOCKS, demoAnalysisMeta, notConnected } from './config';

const STAGE_MS = 380;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Suggest a document type from keywords (demo). Returns 'general-document' when unsure. */
export function suggestDocumentType(text) {
  const lower = text.toLowerCase();
  let best = { typeId: 'general-document', score: 1 };
  for (const [typeId, words] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    const score = words.filter((w) => lower.includes(w)).length;
    if (score > best.score) best = { typeId, score };
  }
  return best.typeId;
}

export function buildTextSnapshot(text, typeId) {
  return buildDocumentSnapshot({
    json: textToDoc(text),
    fields: {},
    schema: getDocumentSchema(typeId) ?? getDocumentSchema('general-document'),
    typeId,
    setup: null,
  });
}

/** Review plain text. @returns {{ health, clauses, compliance, typeId, wordCount, meta }} */
export async function reviewText({ text, typeId }) {
  if (!USE_MOCKS) throw notConnected('Document Review API');
  const snapshot = buildTextSnapshot(text, typeId);
  const base = runHealthRules(snapshot).findings;
  const extra = runReviewRules(text);
  // Avoid reporting blank signature lines twice.
  const merged = extra.some((f) => f.id === 'review:signature')
    ? base.filter((f) => f.id !== 'formatting:blank-lines')
    : base;
  const health = { ...summarizeHealth([...extra, ...merged]), meta: demoAnalysisMeta() };
  const [clauses, compliance] = await Promise.all([
    detectMissingClauses(snapshot),
    reviewCompliance(snapshot),
  ]);
  return {
    health,
    clauses,
    compliance,
    typeId,
    wordCount: snapshot.wordCount,
    meta: demoAnalysisMeta(),
  };
}

/**
 * Full demo pipeline with progress callbacks.
 * @param fileInfo  validated file info
 * @param options   { language, ocr }
 * @param onStage   (stageId, index) => void
 */
export async function runReviewPipeline(fileInfo, options, onStage = () => {}) {
  if (!USE_MOCKS) throw notConnected('Document Review API');
  const step = async (index) => {
    onStage(REVIEW_STAGES[index].id, index);
    await wait(STAGE_MS);
  };
  await step(0);
  onStage(REVIEW_STAGES[1].id, 1);
  const extraction = await extractText(fileInfo, options);
  const typeId = suggestDocumentType(extraction.text);
  await step(2);
  await step(3);
  onStage(REVIEW_STAGES[4].id, 4);
  const review = await reviewText({ text: extraction.text, typeId });
  return { extraction, typeId, review };
}
