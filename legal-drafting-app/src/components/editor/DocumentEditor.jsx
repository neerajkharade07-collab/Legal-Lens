import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { createEditorExtensions } from './editorExtensions';
import { FIELD_SYNC_META } from './extensions/FieldToken';
import { collectTokenKeys } from '../../utils/fieldTokens';
import { cn } from '../../utils/cn';
import './DocumentEditor.css';

/**
 * A4 legal document editor.
 *
 * - `initialContent` is used once (the editor owns the document afterwards).
 * - `displayValues` ({ key: formatted value }) is pushed into field tokens on
 *   every change; only tokens whose value differs are updated.
 * - `activeFieldKey` highlights all occurrences of a field and scrolls to the first.
 */
export function DocumentEditor({
  initialContent,
  displayValues,
  activeFieldKey,
  editable = true,
  lineHeight = 1.5,
  onReady,
  onChange,
  onTokenClick,
  onPresentKeysChange,
}) {
  const callbacks = useRef({ onChange, onTokenClick, onPresentKeysChange });
  const valuesRef = useRef(displayValues);
  const presentRef = useRef('');

  useEffect(() => {
    callbacks.current = { onChange, onTokenClick, onPresentKeysChange };
  });

  const extensions = useMemo(() => createEditorExtensions(), []);

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: 'legal-doc',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Document editor',
        spellcheck: 'true',
      },
      handleClickOn(view, pos, node) {
        if (node.type.name === 'fieldToken') {
          callbacks.current.onTokenClick?.(node.attrs.key);
        }
        return false;
      },
    },
    onCreate({ editor: instance }) {
      reportPresentKeys(instance);
    },
    onUpdate({ editor: instance, transaction }) {
      reportPresentKeys(instance);
      if (transaction.getMeta(FIELD_SYNC_META)) return;
      // A user edit (or undo) may have re-inserted a token with a stale value — resync.
      instance.commands.setFieldValues(valuesRef.current);
      callbacks.current.onChange?.(instance.getJSON());
    },
  });

  function reportPresentKeys(instance) {
    const keys = collectTokenKeys(instance.getJSON());
    const signature = [...keys].sort().join('|');
    if (signature !== presentRef.current) {
      presentRef.current = signature;
      callbacks.current.onPresentKeysChange?.(keys);
    }
  }

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);

  // Push field values into bound tokens.
  useEffect(() => {
    valuesRef.current = displayValues;
    if (editor && !editor.isDestroyed) editor.commands.setFieldValues(displayValues);
  }, [editor, displayValues]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(editable);
  }, [editor, editable]);

  // Highlight + reveal the active field's occurrences.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.highlightField(activeFieldKey ?? null);
    if (!activeFieldKey) return;
    let target = null;
    editor.state.doc.descendants((node, pos) => {
      if (target === null && node.type.name === 'fieldToken' && node.attrs.key === activeFieldKey) {
        target = pos;
      }
    });
    if (target === null) return;
    const dom = editor.view.nodeDOM(target);
    if (dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect();
      const offscreen = rect.top < 120 || rect.bottom > window.innerHeight - 40;
      if (offscreen) dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [editor, activeFieldKey]);

  return (
    <div
      className={cn('a4-page', !editable && 'is-preview')}
      style={{ '--doc-line-height': lineHeight }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
