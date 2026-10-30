/**
 * Legal Drafting Phase 4 — page breaks stay backward compatible with the Phase 3 editor.
 * Builds the real TipTap schemas (needs the app's node_modules, like `npm run build`).
 *   npm run test:drafting
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import { createEditorExtensions } from '../src/components/editor/editorExtensions.js';

const DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'AFFIDAVIT' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Page one text.' }] },
    { type: 'paragraph', attrs: { pageBreakBefore: true }, content: [{ type: 'text', text: 'Page two text.' }] },
    { type: 'heading', attrs: { level: 2, pageBreakBefore: true }, content: [{ type: 'text', text: 'Schedule' }] },
  ],
};
const text = (node) => node.textContent;

test('Phase 4 editor keeps page breaks through a load / save round trip', () => {
  const schema = getSchema(createEditorExtensions());
  const json = schema.nodeFromJSON(DOC).toJSON();
  assert.equal(json.content[2].attrs.pageBreakBefore, true);
  assert.equal(json.content[3].attrs.pageBreakBefore, true);
  assert.equal(json.content[1].attrs.pageBreakBefore, null, 'ordinary paragraphs unchanged');
});

test('an editor WITHOUT the page-break extension (Phase 3) still loads the whole document', () => {
  const phase3 = createEditorExtensions().filter((e) => e.name !== 'pageBreak');
  assert.equal(phase3.length, createEditorExtensions().length - 1);
  const schema = getSchema(phase3);
  const phase4Nodes = Object.keys(getSchema(createEditorExtensions()).nodes).sort();
  assert.deepEqual(phase4Nodes, Object.keys(schema.nodes).sort(), 'Phase 4 adds no node types an older editor would not know');
  const node = schema.nodeFromJSON(DOC); // must not throw (an unknown node type would)
  assert.equal(text(node), 'AFFIDAVITPage one text.Page two text.Schedule', 'no text is lost');
  assert.equal(node.toJSON().content[2].attrs.pageBreakBefore, undefined, 'the attribute is simply ignored');
});
