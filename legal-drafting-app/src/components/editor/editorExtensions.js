import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { FieldToken } from './extensions/FieldToken';

/** Minimum set of extensions for the legal document editor. */
export function createEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      strike: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    TextStyle,
    FontFamily,
    FontSize,
    Placeholder.configure({ placeholder: 'Start typing your document…' }),
    FieldToken,
  ];
}
