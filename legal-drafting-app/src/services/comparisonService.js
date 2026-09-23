/**
 * Document comparison — future: Document Comparison API.
 * compareTexts() is a real word/paragraph diff (utils/textDiff). In demo mode
 * compareDocuments() does NOT read the selected files: it compares two
 * fictional sample versions and marks the result `isSample: true`.
 */
import { DEMO_COMPARISON } from '../data/review/demoComparison';
import { COMPARE_STAGES } from '../data/review/reviewStages';
import { diffDocuments, applyDecisions } from '../utils/textDiff';
import { USE_MOCKS, demoAnalysisMeta, notConnected } from './config';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function compareTexts(originalText, revisedText) {
  return { ...diffDocuments(originalText, revisedText), meta: demoAnalysisMeta() };
}

export { applyDecisions };

export async function compareDocuments(originalFile, revisedFile, onStage = () => {}) {
  if (!USE_MOCKS) throw notConnected('Document Comparison API');
  if (!originalFile || !revisedFile) throw new Error('Select both documents to compare.');
  for (let index = 0; index < COMPARE_STAGES.length; index += 1) {
    onStage(COMPARE_STAGES[index].id, index);
    await wait(320);
  }
  const result = compareTexts(DEMO_COMPARISON.original, DEMO_COMPARISON.revised);
  return {
    original: { file: originalFile, text: DEMO_COMPARISON.original },
    revised: { file: revisedFile, text: DEMO_COMPARISON.revised },
    title: DEMO_COMPARISON.title,
    isSample: true,
    notice: 'Sample versions are compared for demonstration — the selected files were not read.',
    ...result,
  };
}
