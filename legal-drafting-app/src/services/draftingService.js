/**
 * Drafting service — builds the draft record from the Draft Setup answers.
 *
 * This does not generate legal text: the workspace builds the structured
 * template draft from this record, and DraftSetupProvider saves it through the
 * documents API. AI-written drafts use documentsService.generateAiDraft()
 * (POST /api/drafting/generate) instead.
 */
import { getDocumentType } from '../data/documentTypes';
import { getLanguage } from '../data/draftLanguages';
import { defaultDocumentTitle } from '../utils/defaultTitle';
import { DEMO_META } from './config';

/**
 * @param {{ typeId:string, description:string, language:string, useBnsFramework:boolean|null,
 *           source?:string, descriptionDetail?:object }} input
 * @returns {Promise<object>} document payload (without id — the store assigns it)
 */
export async function generatePreliminaryDraft(input) {
  const type = getDocumentType(input.typeId);
  if (!type) throw new Error('Unknown document type.');
  if (!input.description?.trim()) throw new Error('A description is required.');

  const now = new Date();
  const fromTemplate = input.source === 'template';
  const payload = {
    name: defaultDocumentTitle(type, input.description, now),
    typeId: type.id,
    status: 'draft',
    progress: 0,
    origin: fromTemplate
      ? {
          kind: 'template',
          templateId: input.templateId ?? type.id,
          templateName: input.templateName ?? type.name,
        }
      : { kind: 'draft' },
    setup: {
      description: input.description.trim(),
      language: getLanguage(input.language).id,
      // Only meaningful for FIR / Police Complaint; null elsewhere.
      useBnsFramework: type.id === 'fir-complaint' ? Boolean(input.useBnsFramework) : null,
      source: input.source ?? 'unknown',
      descriptionDetail: input.descriptionDetail ?? null,
    },
    generation: {
      ...DEMO_META,
      status: 'preliminary',
      generatedAt: now.toISOString(),
    },
  };

  return payload;
}
