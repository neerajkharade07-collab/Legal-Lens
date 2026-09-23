import { useEditorState } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
} from 'lucide-react';
import { FONT_FAMILIES, FONT_SIZES, LINE_SPACINGS } from '../../data/editorOptions';
import { cn } from '../../utils/cn';
import './EditorToolbar.css';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

function ToolbarButton({ icon, label, shortcut, active, disabled, onClick }) {
  const Icon = icon;
  return (
    <button
      type="button"
      className={cn('tb-btn', active && 'is-active')}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} // keep editor selection
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

const Divider = () => <span className="tb-divider" aria-hidden="true" />;

export function EditorToolbar({ editor, lineHeight, onLineHeightChange, disabled }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const style = e.getAttributes('textStyle');
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        align: ['center', 'right', 'justify'].find((a) => e.isActive({ textAlign: a })) ?? 'left',
        fontFamily: style.fontFamily ?? null,
        fontSize: style.fontSize ?? null,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  if (!editor || !state) return <div className="toolbar" aria-hidden="true" />;

  const chain = () => editor.chain().focus();
  const familyId = FONT_FAMILIES.find((f) => f.value === state.fontFamily)?.id ?? 'default';
  const sizeId = FONT_SIZES.find((s) => s.value === state.fontSize)?.id ?? 'default';

  return (
    <div
      className={cn('toolbar', disabled && 'is-disabled')}
      role="toolbar"
      aria-label="Formatting"
    >
      <div className="tb-group">
        <ToolbarButton
          icon={Undo2}
          label="Undo"
          shortcut={`${mod}+Z`}
          disabled={disabled || !state.canUndo}
          onClick={() => chain().undo().run()}
        />
        <ToolbarButton
          icon={Redo2}
          label="Redo"
          shortcut={isMac ? '⌘+Shift+Z' : 'Ctrl+Y'}
          disabled={disabled || !state.canRedo}
          onClick={() => chain().redo().run()}
        />
      </div>
      <Divider />
      <div className="tb-group">
        <label className="tb-select tb-select--font">
          <span className="visually-hidden">Font</span>
          <select
            value={familyId}
            disabled={disabled}
            onChange={(event) => {
              const option = FONT_FAMILIES.find((f) => f.id === event.target.value);
              if (option?.value) chain().setFontFamily(option.value).run();
              else chain().unsetFontFamily().run();
            }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id === 'default' ? 'Font' : f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="tb-select tb-select--size">
          <span className="visually-hidden">Font size</span>
          <select
            value={sizeId}
            disabled={disabled}
            onChange={(event) => {
              const option = FONT_SIZES.find((s) => s.id === event.target.value);
              if (option?.value) chain().setFontSize(option.value).run();
              else chain().unsetFontSize().run();
            }}
          >
            {FONT_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === 'default' ? '12 pt' : `${s.label} pt`}
              </option>
            ))}
          </select>
        </label>
        <label className="tb-select tb-select--spacing" title="Line spacing (whole document)">
          <span className="visually-hidden">Line spacing</span>
          <select
            value={String(lineHeight)}
            disabled={disabled}
            onChange={(event) => onLineHeightChange(Number(event.target.value))}
          >
            {LINE_SPACINGS.map((s) => (
              <option key={s.id} value={String(s.value)}>
                ↕ {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Divider />
      <div className="tb-group">
        <ToolbarButton
          icon={Bold}
          label="Bold"
          shortcut={`${mod}+B`}
          active={state.bold}
          disabled={disabled}
          onClick={() => chain().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          shortcut={`${mod}+I`}
          active={state.italic}
          disabled={disabled}
          onClick={() => chain().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Underline}
          label="Underline"
          shortcut={`${mod}+U`}
          active={state.underline}
          disabled={disabled}
          onClick={() => chain().toggleUnderline().run()}
        />
      </div>
      <Divider />
      <div className="tb-group">
        <ToolbarButton
          icon={Heading1}
          label="Heading 1"
          active={state.h1}
          disabled={disabled}
          onClick={() => chain().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          icon={Heading2}
          label="Heading 2"
          active={state.h2}
          disabled={disabled}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        />
      </div>
      <Divider />
      <div className="tb-group">
        <ToolbarButton
          icon={List}
          label="Bulleted list"
          active={state.bullet}
          disabled={disabled}
          onClick={() => chain().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Numbered list"
          active={state.ordered}
          disabled={disabled}
          onClick={() => chain().toggleOrderedList().run()}
        />
      </div>
      <Divider />
      <div className="tb-group">
        <ToolbarButton
          icon={AlignLeft}
          label="Align left"
          active={state.align === 'left'}
          disabled={disabled}
          onClick={() => chain().setTextAlign('left').run()}
        />
        <ToolbarButton
          icon={AlignCenter}
          label="Align center"
          active={state.align === 'center'}
          disabled={disabled}
          onClick={() => chain().setTextAlign('center').run()}
        />
        <ToolbarButton
          icon={AlignRight}
          label="Align right"
          active={state.align === 'right'}
          disabled={disabled}
          onClick={() => chain().setTextAlign('right').run()}
        />
        <ToolbarButton
          icon={AlignJustify}
          label="Justify"
          active={state.align === 'justify'}
          disabled={disabled}
          onClick={() => chain().setTextAlign('justify').run()}
        />
      </div>
    </div>
  );
}
