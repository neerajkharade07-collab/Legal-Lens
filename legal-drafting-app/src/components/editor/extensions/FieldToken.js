/**
 * FieldToken — inline, atomic TipTap node bound to a case-detail field.
 *
 *   <span class="field-token" data-field-key="policeStationName">Shivajinagar Police Station</span>
 *
 * The node stores a stable `key`, a placeholder `label` and the current
 * display `value`. `setFieldValues` updates only token nodes whose value
 * differs; nothing else in the document is touched, and those updates are
 * excluded from undo history (the source of truth is the field panel).
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const FIELD_SYNC_META = 'fieldTokenSync';
export const fieldHighlightKey = new PluginKey('fieldTokenHighlight');

function highlightPlugin() {
  return new Plugin({
    key: fieldHighlightKey,
    state: {
      init: () => null,
      apply(tr, previous) {
        const meta = tr.getMeta(fieldHighlightKey);
        return meta === undefined ? previous : meta;
      },
    },
    props: {
      decorations(state) {
        const activeKey = fieldHighlightKey.getState(state);
        if (!activeKey) return null;
        const decorations = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'fieldToken' && node.attrs.key === activeKey) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, { class: 'is-highlighted' }),
            );
          }
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export const FieldToken = Node.create({
  name: 'fieldToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-field-key'),
        renderHTML: (attrs) => ({ 'data-field-key': attrs.key }),
      },
      label: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-field-label') ?? '',
        renderHTML: (attrs) => ({ 'data-field-label': attrs.label }),
      },
      value: {
        default: '',
        parseHTML: (el) => (el.getAttribute('data-empty') === 'true' ? '' : (el.textContent ?? '')),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field-key]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const empty = !node.attrs.value;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'field-token',
        'data-empty': empty ? 'true' : 'false',
        title: empty ? `Empty field: ${node.attrs.label}` : undefined,
      }),
      empty ? `[${node.attrs.label}]` : node.attrs.value,
    ];
  },

  renderText({ node }) {
    return node.attrs.value || `[${node.attrs.label}]`;
  },

  addCommands() {
    return {
      /** values: { [key]: displayValue } — only listed keys are touched. */
      setFieldValues:
        (values) =>
        ({ tr, state, dispatch }) => {
          let changed = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return;
            const { key } = node.attrs;
            if (!Object.prototype.hasOwnProperty.call(values, key)) return;
            const next = values[key] ?? '';
            if (node.attrs.value !== next) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, value: next });
              changed = true;
            }
          });
          if (!changed) return false;
          if (dispatch) {
            tr.setMeta('addToHistory', false);
            tr.setMeta(FIELD_SYNC_META, true);
          }
          return true;
        },

      highlightField:
        (key) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(fieldHighlightKey, key ?? null);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [highlightPlugin()];
  },
});
