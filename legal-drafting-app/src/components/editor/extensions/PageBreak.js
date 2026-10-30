/**
 * PageBreak — "start this paragraph / heading on a new page".
 *
 * Stored as an attribute on the existing paragraph and heading nodes:
 *   { type: 'paragraph', attrs: { pageBreakBefore: true }, content: [...] }
 *   <p data-page-break-before="true">…</p>
 *
 * Why an attribute and not a new node type: documents stay readable by every earlier version of
 * the editor. An older editor simply ignores the unknown attribute and shows the paragraph; an
 * unknown NODE type would make it load the document as empty. Print / PDF turn it into CSS
 * `break-before: page`, and the Word export into Word's own "page break before".
 */
import { Extension } from '@tiptap/core';

const TYPES = ['paragraph', 'heading'];

export const PageBreak = Extension.create({
  name: 'pageBreak',

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          pageBreakBefore: {
            default: null,
            keepOnSplit: false, // Enter after it does not create another page break
            parseHTML: (el) => (el.getAttribute('data-page-break-before') === 'true' ? true : null),
            renderHTML: (attrs) => (attrs.pageBreakBefore ? { 'data-page-break-before': 'true' } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      /**
       * At the cursor: an empty block (or one that already has a break) toggles its break;
       * otherwise the block is split at the cursor and the text after it starts a new page.
       */
      togglePageBreak:
        () =>
        ({ state, chain }) => {
          const { $from } = state.selection;
          const node = $from.parent;
          if (!TYPES.includes(node.type.name)) return false;
          if (node.attrs.pageBreakBefore || node.content.size === 0) {
            return chain()
              .updateAttributes(node.type.name, { pageBreakBefore: node.attrs.pageBreakBefore ? null : true })
              .run();
          }
          return chain()
            .splitBlock()
            .command(({ tr, state: s }) => {
              const parent = s.selection.$from.parent;
              const pos = s.selection.$from.before();
              tr.setNodeMarkup(pos, undefined, { ...parent.attrs, pageBreakBefore: true });
              return true;
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.togglePageBreak() };
  },
});
