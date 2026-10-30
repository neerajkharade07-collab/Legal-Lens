/**
 * Honest labels for where a draft came from (Phase 1 compatibility fix).
 *
 * The workspace used to call EVERY draft a "Preliminary demo draft", including
 * AI drafts and template drafts saved to a CASEONE account. "Demo" is now used
 * only for what really is Demo Mode: drafts kept only in this browser (guest,
 * ids "local-…"). Every label still says the draft must be reviewed.
 * The demo analysis tools (health, overview, assistant) keep their own "Demo"
 * labels — they are still simulated.
 */
import { isGuestId } from '../services/config';

/**
 * Short notice shown above the document and in the print preview.
 * A browser-only draft is ALWAYS Demo Mode — checked first, whatever its
 * generation data says (Demo Mode has no AI, so an "ai" source there could only
 * come from copied or tampered browser data and must not be shown as real).
 */
export function draftNotice(doc) {
  if (isGuestId(doc?.id)) return 'Preliminary demo draft — review before use';
  const source = doc?.generation?.source;
  if (source === 'ai') return 'AI draft — review every detail before use';
  if (source === 'template' || source === 'demo') return 'Template draft — review before use';
  return 'Draft — review before use';
}

/**
 * Note under the document when a non-English language was chosen.
 * Template drafts (account or Demo Mode) are written in English for now; an AI
 * draft is written by the AI in the chosen language.
 * @returns {string} sentence after "Draft language: …"
 */
export function draftLanguageNote(doc) {
  if (isGuestId(doc?.id)) return 'Demo drafts are prepared in English for now.';
  const source = doc?.generation?.source;
  if (source === 'ai') return 'Written by the AI in this language — check the wording carefully.';
  return 'Template drafts are prepared in English for now.';
}

/**
 * Origin badge in the workspace header, or null for none.
 * A browser-only draft is ALWAYS "Demo Mode draft" — checked first, whatever its
 * generation source. Account documents keep the existing texts.
 */
export function draftOriginBadge(doc) {
  if (isGuestId(doc?.id)) return 'Demo Mode draft';
  const source = doc?.generation?.source;
  if (source === 'template' || source === 'demo') return 'Preliminary template draft';
  if (source === 'ai') return 'AI draft — review every detail';
  return null;
}
