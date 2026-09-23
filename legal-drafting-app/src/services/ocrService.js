/**
 * Text extraction / OCR — future: OCR API (e.g. a server-side OCR engine).
 *
 * DEMO: the selected file is NOT read. A fictional sample text is returned,
 * chosen by file name (and language for Hindi/Marathi), and labelled as a
 * sample so the UI never presents it as real OCR output.
 */
import {
  DEMO_EXTRACTION_SAMPLES,
  DEMO_DEVANAGARI_SAMPLES,
  SAMPLE_FILENAME_HINTS,
} from '../data/review/demoOcr';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

export const OCR_LANGUAGES = [
  { id: 'en', label: 'English', nativeLabel: 'English', script: 'Latin' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', script: 'Devanagari' },
  { id: 'mr', label: 'Marathi', nativeLabel: 'मराठी', script: 'Devanagari' },
];

function pickSample(fileName = '', language = 'en') {
  if (DEMO_DEVANAGARI_SAMPLES[language]) return DEMO_DEVANAGARI_SAMPLES[language];
  const lower = fileName.toLowerCase();
  const hint = SAMPLE_FILENAME_HINTS.find((h) => h.words.some((w) => lower.includes(w)));
  return DEMO_EXTRACTION_SAMPLES[hint?.typeId ?? 'rental-agreement'];
}

/**
 * @param {{ name, kind }} fileInfo from utils/fileValidation
 * @param {{ language: 'en'|'hi'|'mr', ocr: boolean }} options
 */
export async function extractText(fileInfo, { language = 'en', ocr = false } = {}) {
  if (!USE_MOCKS) throw notConnected('OCR API');
  const sample = pickSample(fileInfo?.name, language);
  return simulateLatency(
    {
      text: sample.text,
      sampleId: sample.id,
      sampleTitle: sample.title,
      method: ocr ? 'demo-ocr' : 'demo-extraction',
      language,
      isSample: true,
      notice: 'Sample text for demonstration — it was not read from your file.',
      meta: demoAnalysisMeta(),
    },
    300,
  );
}

/** The sample text for a given extraction (used by "Reset demo text"). */
export function getSampleText(sampleId) {
  const all = [
    ...Object.values(DEMO_EXTRACTION_SAMPLES),
    ...Object.values(DEMO_DEVANAGARI_SAMPLES),
  ];
  return all.find((s) => s.id === sampleId)?.text ?? '';
}
