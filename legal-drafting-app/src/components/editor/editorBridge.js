/**
 * Editor bridge — the ONLY place the review tools touch the TipTap editor.
 * Uses core TipTap commands and ProseMirror state APIs only.
 *
 * Positions inside a textblock map 1:1 to characters because every inline
 * leaf (field tokens, hard breaks) is rendered as a single placeholder char.
 */
const LEAF = '￼';

function textblockText(node) {
  return node.textBetween(0, node.content.size, undefined, () => LEAF);
}

/** First occurrence of `query` inside a single textblock → { from, to } or null. */
function findText(doc, query) {
  if (!query) return null;
  const needle = query.toLowerCase();
  let hit = null;
  doc.descendants((node, pos) => {
    if (hit) return false;
    if (!node.isTextblock) return true;
    const index = textblockText(node).toLowerCase().indexOf(needle);
    if (index >= 0) hit = { from: pos + 1 + index, to: pos + 1 + index + query.length };
    return false;
  });
  return hit;
}

function findTokenPos(doc, key) {
  let found = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type.name === 'fieldToken' && node.attrs.key === key) found = pos;
    return true;
  });
  return found;
}

/** Top-level block whose text starts with one of the anchors → its start position. */
function findTopLevelAnchor(doc, anchors) {
  for (const anchor of anchors ?? []) {
    const wanted = anchor.toLowerCase();
    let found = null;
    doc.forEach((node, offset) => {
      if (found !== null) return;
      if (node.textContent.trim().toLowerCase().startsWith(wanted)) found = offset;
    });
    if (found !== null) return found;
  }
  return null;
}

export function createEditorBridge(editor) {
  const alive = () => editor && !editor.isDestroyed;

  const reveal = (from, to) => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setTextSelection({ from, to })
      .scrollIntoView()
      .run();
  };

  return {
    isReady: alive,

    getJSON: () => (alive() ? editor.getJSON() : null),

    /** Current selection as plain text + safety info. */
    getSelection() {
      if (!alive()) return null;
      const { from, to, empty, $from, $to } = editor.state.selection;
      if (empty) return { from, to, empty: true, text: '', hasTokens: false, singleBlock: true };
      const singleBlock = $from.sameParent($to) && $from.parent.isTextblock;
      let hasTokens = false;
      editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.type.name === 'fieldToken') hasTokens = true;
      });
      const text = editor.state.doc.textBetween(from, to, '\n', (leaf) =>
        leaf.type.name === 'fieldToken' ? leaf.attrs.value || `[${leaf.attrs.label}]` : '',
      );
      return { from, to, empty: false, text, hasTokens, singleBlock };
    },

    /** Select and scroll to the first match of `text`. Returns true when found. */
    locateText(text) {
      if (!alive()) return false;
      const hit = findText(editor.state.doc, text);
      if (!hit) return false;
      reveal(hit.from, hit.to);
      return true;
    },

    /** Select and scroll to the first token bound to `key`. */
    locateToken(key) {
      if (!alive()) return false;
      const pos = findTokenPos(editor.state.doc, key);
      if (pos === null) return false;
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setNodeSelection(pos)
        .scrollIntoView()
        .run();
      return true;
    },

    /**
     * Insert TipTap JSON blocks before the first top-level block starting with
     * one of `anchors` (or at the end). Selects the start of the insertion.
     */
    insertBlocks(blocks, { anchors } = {}) {
      if (!alive()) return false;
      const { doc } = editor.state;
      const anchorPos = findTopLevelAnchor(doc, anchors);
      const at = anchorPos ?? doc.content.size;
      const ok = editor.chain().insertContentAt(at, blocks).run();
      if (ok) {
        const inside = Math.min(at + 1, editor.state.doc.content.size);
        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .setTextSelection(inside)
          .scrollIntoView()
          .run();
      }
      return ok;
    },

    /** Insert blocks after the block containing the cursor (or at the end). */
    insertBlocksAtCursor(blocks) {
      if (!alive()) return false;
      const { selection, doc } = editor.state;
      const $to = selection.$to;
      const at = $to.depth >= 1 ? $to.after(1) : doc.content.size;
      const ok = editor.chain().insertContentAt(at, blocks).run();
      if (ok) {
        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .setTextSelection(Math.min(at + 1, editor.state.doc.content.size))
          .scrollIntoView()
          .run();
      }
      return ok;
    },

    /**
     * Replace plain text in [from, to] only if it still equals `expected`
     * (guards against the document changing between preview and accept).
     * Keeps the marks at the start of the range. Undoable.
     */
    replaceRange({ from, to }, expected, replacement) {
      if (!alive()) return { ok: false, reason: 'Editor not ready.' };
      const { doc } = editor.state;
      if (to > doc.content.size) return { ok: false, reason: 'The document has changed.' };
      let hasTokens = false;
      doc.nodesBetween(from, to, (node) => {
        if (node.type.name === 'fieldToken') hasTokens = true;
      });
      if (hasTokens) return { ok: false, reason: 'The selection contains linked fields.' };
      if (doc.textBetween(from, to, '\n') !== expected) {
        return { ok: false, reason: 'The selected text has changed since the preview.' };
      }
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .command(({ tr }) => {
          tr.insertText(replacement, from, to);
          return true;
        })
        .setTextSelection({ from, to: from + replacement.length })
        .scrollIntoView()
        .run();
      return { ok: true };
    },
  };
}
