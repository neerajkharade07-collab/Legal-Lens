/**
 * Helpers for AI drafting results (Phase 2). Pure functions, no editor access.
 */

const textNode = (value) => (value ? [{ type: 'text', text: value }] : undefined);

/**
 * A clause returned by the AI ("Heading\nClause text…") → TipTap blocks:
 * the first line becomes a level-2 heading, every other non-empty line a paragraph.
 */
export function clauseTextToBlocks(text) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const [heading, ...rest] = lines;
  const blocks = [{ type: 'heading', attrs: { level: 2 }, content: textNode(heading.replace(/^#+\s*/, '')) }];
  rest.forEach((line) =>
    blocks.push({
      type: 'paragraph',
      ...(line.split(/\s+/).length > 12 ? { attrs: { textAlign: 'justify' } } : {}),
      content: textNode(line),
    }),
  );
  return blocks;
}

const inlineText = (node) =>
  node.type === 'text'
    ? node.text
    : node.type === 'fieldToken'
      ? ''
      : (node.content ?? []).map(inlineText).join('');

/**
 * Section headings of a template document (TipTap JSON), in order — sent to the AI
 * so a generated draft follows the selected CASEONE template's structure.
 * Field placeholders are left out; at most 40 headings of 120 characters.
 */
export function templateOutline(json) {
  const out = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === 'heading') {
      const text = inlineText(node).replace(/\s+/g, ' ').trim();
      if (text && !out.includes(text)) out.push(text.slice(0, 120));
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  walk(json);
  return out.slice(0, 40);
}

/** Number of "[DETAIL REQUIRED]" placeholders in a text. */
export function countPlaceholders(text) {
  return (String(text ?? '').match(/\[DETAIL REQUIRED\]/g) ?? []).length;
}

/**
 * What "Accept" should do with the assistant's previewed result — a pure decision,
 * so the rules are testable without an editor:
 *   { type: 'replace', range, expected, replacement }  replace the selection (only if unchanged)
 *   { type: 'insert', blocks }                          insert an AI clause at the cursor
 *   { type: 'document', content }                       replace the whole text with an AI draft
 *   { type: 'demo-clause', clause }                     Demo Mode sample clause
 *   { type: 'error', error }                            refuse (the document is NOT changed)
 *   { type: 'none' }                                    nothing to apply
 * `revision` is the workspace edit counter now; a full AI draft generated before
 * later edits is refused, so those edits are never silently thrown away.
 */
export function planAccept(assistant, revision) {
  const result = assistant?.result;
  if (!result || !result.changed) return { type: 'none' };
  const isAi = result.meta?.source === 'ai';
  if (isAi && result.kind === 'document') {
    if (assistant.revision !== revision) {
      return {
        type: 'error',
        error:
          'Not applied: the document changed after this draft was generated, so your newer edits would be lost. Generate the draft again.',
      };
    }
    if (!result.content?.content?.length) {
      return { type: 'error', error: 'Not applied: the AI draft is empty. Your document was not changed.' };
    }
    return { type: 'document', content: result.content };
  }
  if (isAi && result.kind === 'insert') {
    if (!result.blocks?.length) {
      return { type: 'error', error: 'Not applied: the clause could not be inserted. Your document was not changed.' };
    }
    return { type: 'insert', blocks: result.blocks };
  }
  if (result.kind === 'replace') {
    const selection = assistant.selection;
    if (!selection || selection.empty) {
      return { type: 'error', error: 'Not applied: the selection is no longer available. Run the action again.' };
    }
    return { type: 'replace', range: { from: selection.from, to: selection.to }, expected: selection.text, replacement: result.proposed };
  }
  if (result.kind === 'insert' && result.clause) return { type: 'demo-clause', clause: result.clause };
  return { type: 'none' };
}
