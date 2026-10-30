/**
 * Phase 3 — pure decisions for the review tools (testable without an editor).
 */

/**
 * What "Accept" on an improved clause should do.
 * `hit` is editorBridge.findTextRange(proposal.original): { from, to, text } or null.
 *   { type: 'replace', range, expected, replacement }  apply (only if the text is unchanged)
 *   { type: 'error', error }                            refuse — the document is NOT changed
 */
export function planClauseAccept(proposal, hit) {
  if (!proposal?.original || !proposal?.text) {
    return { type: 'error', error: 'There is no improved wording to apply.' };
  }
  if (!hit || hit.text !== proposal.original) {
    return {
      type: 'error',
      error: 'The original text has changed or is no longer in the document. Run the clause review again.',
    };
  }
  return { type: 'replace', range: { from: hit.from, to: hit.to }, expected: hit.text, replacement: proposal.text };
}
