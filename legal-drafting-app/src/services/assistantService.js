/**
 * Drafting assistant.
 *
 *  - Signed in (account documents): REAL AI editing through the CASEONE backend
 *    (POST /api/drafting/assist, Google Gemini on the server) — Rewrite, Simplify,
 *    Expand, Improve language, Insert clause — plus "Generate draft with AI"
 *    (POST /api/drafting/preview). Every result is a proposal: nothing is saved
 *    or changed until the user accepts it in the editor. Failures are reported;
 *    there is never a demo or sample substitute for a failed AI call.
 *  - Signed out (Demo Mode): the existing rule-based demo transformations, clearly
 *    labelled "Sample — not AI-generated" (no AI is available in Demo Mode).
 */
import { ASSISTANT_ACTIONS, runAssistantTransform } from './demo/assistantTransforms';
import { getClauseCatalog } from '../data/intelligence/clauseCatalog';
import { snapshotMentions } from '../utils/documentSnapshot';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency, getStorageMode } from './config';
import { apiRequest } from './apiClient';
import { toApiType, toApiLanguage } from './documentMapper';

export { ASSISTANT_ACTIONS };

/** The real AI actions (account documents only). ids are the backend's action names. */
export const AI_ASSISTANT_ACTIONS = [
  { id: 'rewrite', label: 'Rewrite', short: 'Rewrite', kind: 'replace', ai: true },
  { id: 'simplify', label: 'Simplify', short: 'Simplify', kind: 'replace', ai: true },
  { id: 'expand', label: 'Expand', short: 'Expand', kind: 'replace', ai: true },
  { id: 'improve', label: 'Improve language', short: 'Improve', kind: 'replace', ai: true },
  { id: 'insert_clause', label: 'Insert clause', short: 'Clause', kind: 'insert', ai: true },
  { id: 'generate_draft', label: 'Generate draft with AI', short: 'Generate', kind: 'document', ai: true },
];

/** Actions for the current session: real AI when signed in, the labelled demo otherwise. */
export function getAssistantActions() {
  return getStorageMode() === 'account' ? AI_ASSISTANT_ACTIONS : ASSISTANT_ACTIONS;
}

/** Actions shown in the floating bar above a text selection. */
export function getSelectionActions() {
  return getStorageMode() === 'account'
    ? AI_ASSISTANT_ACTIONS.filter((a) => a.kind === 'replace')
    : ASSISTANT_ACTIONS.filter((a) => ['explain', 'rewrite', 'formal', 'simplify', 'risk'].includes(a.id));
}

export const MAX_SELECTION_LENGTH = 8000;
export const MAX_INSTRUCTIONS_LENGTH = 1000;
export const MAX_DOCUMENT_TEXT_LENGTH = 60000;

/**
 * One AI editing action on an account document (POST /api/drafting/assist).
 * Rejects with the server's honest message on any failure.
 * @returns {Promise<{ actionId, kind, original, proposed, changed, placeholders, notes, meta }>}
 */
export async function runAiAssist({ documentId, actionId, selection = '', instructions = '', documentText = '' }) {
  if (getStorageMode() !== 'account') {
    throw new Error('AI editing needs a signed-in CASEONE customer or lawyer account.');
  }
  if (selection.length > MAX_SELECTION_LENGTH) {
    throw new Error(`The selection is too long for one AI edit (limit ${MAX_SELECTION_LENGTH.toLocaleString('en-IN')} characters). Select a shorter passage.`);
  }
  if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    throw new Error(`Instructions are too long (limit ${MAX_INSTRUCTIONS_LENGTH} characters).`);
  }
  if (documentText.length > MAX_DOCUMENT_TEXT_LENGTH) {
    throw new Error('This document is too long for AI editing in one request.');
  }
  const json = await apiRequest('/drafting/assist', {
    method: 'POST',
    body: { documentId, action: actionId, selection, instructions, documentText },
  });
  const d = json.data;
  return {
    actionId,
    kind: d.kind,
    original: selection,
    proposed: d.proposal,
    changed: Boolean(d.changed),
    placeholders: d.placeholders ?? 0,
    notes: [],
    meta: { source: 'ai', provider: d.aiProvider, model: d.model, requiresReview: true },
  };
}

/**
 * A complete new draft for an existing document, written by the AI from its case
 * details and description and following the selected template's sections
 * (POST /api/drafting/preview — nothing is saved by the server).
 * @returns {Promise<{ actionId, kind: 'document', content, plainText, placeholders, changed, meta }>}
 */
export async function generateDraftProposal({ typeId, language, description, fields, title, template }) {
  if (getStorageMode() !== 'account') {
    throw new Error('AI drafting needs a signed-in CASEONE customer or lawyer account.');
  }
  const json = await apiRequest('/drafting/preview', {
    method: 'POST',
    body: {
      documentType: toApiType(typeId),
      language: toApiLanguage(language),
      matterDescription: description || '',
      structuredData: fields ?? {},
      ...(title ? { title } : {}),
      ...(template ? { template } : {}),
    },
  });
  const d = json.data;
  return {
    actionId: 'generate_draft',
    kind: 'document',
    original: '',
    content: d.content,
    plainText: d.plainText,
    placeholders: (String(d.plainText).match(/\[DETAIL REQUIRED\]/g) ?? []).length,
    changed: true,
    notes: [],
    meta: { source: 'ai', requiresReview: true },
  };
}

/**
 * DEMO (signed out only): rule-based sample transformations, no AI.
 * @param {string} actionId
 * @param {{ text:string, snapshot:object }} input
 * @returns {{ actionId, kind:'replace'|'info'|'insert', original, proposed?, notes?, clause?, changed, meta }}
 */
export async function runAssistant(actionId, { text, snapshot }) {
  if (!USE_MOCKS) throw notConnected('AI Draft Modification API');
  const action = ASSISTANT_ACTIONS.find((a) => a.id === actionId);
  if (!action) throw new Error('Unknown assistant action.');

  if (action.kind === 'insert') {
    const clause =
      getClauseCatalog(snapshot.typeId).find((c) => !snapshotMentions(snapshot, c.detect)) ??
      getClauseCatalog(snapshot.typeId)[0] ??
      null;
    return simulateLatency(
      {
        actionId,
        kind: 'insert',
        original: text ?? '',
        clause,
        notes: clause
          ? [`Sample clause: ${clause.name}. ${clause.why}`]
          : ['No sample clause available for this document type.'],
        changed: Boolean(clause),
        meta: demoAnalysisMeta(),
      },
      500,
    );
  }

  const out = runAssistantTransform(actionId, text);
  const changed =
    action.kind === 'replace' && out.proposed !== undefined && out.proposed !== (text ?? '').trim();
  return simulateLatency(
    {
      actionId,
      kind: action.kind,
      original: text ?? '',
      proposed: out.proposed,
      notes:
        out.notes ??
        (action.kind === 'replace' && !changed
          ? ['The demo rules found nothing to change in this selection.']
          : []),
      changed,
      meta: demoAnalysisMeta(),
    },
    550,
  );
}
