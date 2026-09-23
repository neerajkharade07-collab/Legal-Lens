/**
 * Builds the document record for a reviewed / compared text so it opens in the
 * existing Draft Workspace (TipTap) — no second editor. The original file
 * metadata is kept on the record.
 */
import { textToDoc } from './textToDoc';
import { DEFAULT_FORMATTING } from '../data/editorOptions';
import { WORKSPACE_VERSION } from './workspaceModel';

/**
 * @param {{ text, typeId, name, source: 'reviewed-document'|'compared-document', sourceFile?, sourceFiles?, review? }} input
 */
export function buildReviewedDocumentPayload({
  text,
  typeId,
  name,
  source,
  sourceFile = null,
  sourceFiles = null,
  review = null,
  status = source === 'compared-document' ? 'needs-review' : 'reviewed',
}) {
  const now = new Date().toISOString();
  return {
    name,
    typeId,
    status,
    progress: 0,
    source,
    origin: { kind: source === 'compared-document' ? 'comparison' : 'review' },
    sourceFile,
    sourceFiles,
    review,
    workspace: {
      version: WORKSPACE_VERSION,
      fields: {},
      content: textToDoc(text),
      formatting: { ...DEFAULT_FORMATTING },
      extraction: { source: 'demo', values: {} },
      savedAt: now,
    },
  };
}
