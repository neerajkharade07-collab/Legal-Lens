/**
 * Tiny helpers that produce TipTap/ProseMirror JSON, so templates read like
 * documents instead of nested objects. Field tokens carry only a stable key;
 * labels and values are filled in by utils/fieldTokens.js.
 */

const flatten = (parts) =>
  parts
    .flat(Infinity)
    .filter((part) => part !== null && part !== undefined && part !== false && part !== '')
    .map((part) => (typeof part === 'string' ? { type: 'text', text: part } : part));

export const f = (key) => ({ type: 'fieldToken', attrs: { key } });

const marked = (mark) => (value) => ({ type: 'text', text: value, marks: [{ type: mark }] });
export const b = marked('bold');
export const i = marked('italic');
export const u = marked('underline');

const block =
  (type, attrs) =>
  (...content) => {
    const inline = flatten(content);
    return { type, ...(attrs ? { attrs } : {}), ...(inline.length ? { content: inline } : {}) };
  };

export const p = block('paragraph');
export const pCenter = block('paragraph', { textAlign: 'center' });
export const pRight = block('paragraph', { textAlign: 'right' });
export const pJustify = block('paragraph', { textAlign: 'justify' });
export const h1 = block('heading', { level: 1, textAlign: 'center' });
export const h2 = block('heading', { level: 2 });
export const h2Center = block('heading', { level: 2, textAlign: 'center' });
export const blank = () => ({ type: 'paragraph' });

const list =
  (type) =>
  (...items) => ({
    type,
    content: items.map((item) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: flatten([item]) }],
    })),
  });
export const ul = list('bulletList');
export const ol = list('orderedList');

export const doc = (...blocks) => ({ type: 'doc', content: blocks.flat().filter(Boolean) });

/** A short line for handwritten entries (dates, signatures) — plain, unbound text. */
export const LINE = '____________________';
