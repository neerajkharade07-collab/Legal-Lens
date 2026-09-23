import { useEffect, useRef, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import './SelectionActions.css';

const SELECTION_ACTIONS = [
  { id: 'explain', label: 'Explain' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'formal', label: 'Formalize' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'risk', label: 'Check' },
];

const MENU_HEIGHT = 36;

/**
 * Floating action bar shown above a non-empty text selection in the editor.
 * Built on editor events + view.coordsAtPos (no extra dependency). Buttons use
 * onMouseDown preventDefault so the editor keeps its selection and focus.
 * It never changes the document itself — it hands the selection to `onAction`.
 */
export function SelectionActions({ editor, onAction }) {
  const [position, setPosition] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!editor) return undefined;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const { selection } = editor.state;
        const isText = !selection.empty && !selection.node; // not a NodeSelection (e.g. a field token)
        if (!editor.isEditable || !isText || !editor.view.hasFocus()) {
          setPosition(null);
          return;
        }
        const start = editor.view.coordsAtPos(selection.from);
        const end = editor.view.coordsAtPos(selection.to);
        const top = Math.min(start.top, end.top) - MENU_HEIGHT - 8;
        const width = menuRef.current?.offsetWidth ?? 360;
        const center = (start.left + end.right) / 2;
        const left = Math.max(8, Math.min(center - width / 2, window.innerWidth - width - 8));
        // Keep it below the sticky chrome; flip under the selection if needed.
        const flipped = top < 120;
        setPosition({ top: flipped ? Math.max(start.bottom, end.bottom) + 8 : top, left });
      });
    };
    const hide = () => {
      // Let a click on the menu itself run first.
      setTimeout(() => {
        if (!editor.isDestroyed && !editor.view.hasFocus()) setPosition(null);
      }, 120);
    };

    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    editor.on('blur', hide);
    editor.on('update', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      editor.off('selectionUpdate', update);
      editor.off('focus', update);
      editor.off('blur', hide);
      editor.off('update', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editor]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="selection-actions"
      style={{ top: position.top, left: position.left }}
      role="toolbar"
      aria-label="Actions for selected text"
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="selection-actions__label" aria-hidden="true">
        <MessageSquareText size={14} strokeWidth={1.75} />
      </span>
      {SELECTION_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          className="selection-actions__btn"
          onClick={() => onAction(action.id)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
