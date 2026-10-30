/**
 * Legal Drafting Phase 4 — page breaks in TipTap JSON (see components/editor/extensions/PageBreak.js).
 * A page break is the attribute `pageBreakBefore: true` on a paragraph or heading.
 */
/** True when a TipTap JSON block (or the first paragraph inside a list) starts a new page. */
export function startsNewPage(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.attrs?.pageBreakBefore === true) return true;
  if (node.type === 'bulletList' || node.type === 'orderedList') return startsNewPage(node.content?.[0]);
  if (node.type === 'listItem') return startsNewPage(node.content?.[0]);
  return false;
}
