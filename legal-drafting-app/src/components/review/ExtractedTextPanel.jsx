import { useState } from 'react';
import { Copy, PencilLine, RotateCcw, Check, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useToast } from '../../hooks/useToast';
import { copyText } from '../../utils/clipboard';
import { cn } from '../../utils/cn';

/** Center panel: editable extracted text on an A4-style page. */
export function ExtractedTextPanel({ review, textareaRef }) {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const { extraction } = review;
  const lang = extraction?.language ?? 'en';

  const handleCopy = async () => {
    const ok = await copyText(review.text);
    toast(
      ok
        ? { title: 'Text copied', variant: 'success', duration: 2000 }
        : {
            title: 'Copy failed',
            description: 'Select the text and copy it manually.',
            variant: 'error',
          },
    );
  };

  return (
    <div className="extracted">
      <div className="extracted__toolbar">
        <div className="extracted__title">
          <h2>Extracted text</h2>
          <Badge tone="demo">
            {extraction?.method === 'demo-ocr'
              ? 'Demo OCR — sample text'
              : 'Demo extraction — sample text'}
          </Badge>
        </div>
        <div className="extracted__actions">
          <Button
            size="sm"
            variant={editing ? 'primary' : 'secondary'}
            icon={editing ? Check : PencilLine}
            onClick={() => {
              setEditing((v) => !v);
              if (!editing) requestAnimationFrame(() => textareaRef.current?.focus());
            }}
            aria-pressed={editing}
          >
            {editing ? 'Done editing' : 'Edit Text'}
          </Button>
          <Button size="sm" variant="secondary" icon={Copy} onClick={handleCopy}>
            Copy Text
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={review.resetText}>
            Reset Demo Text
          </Button>
        </div>
      </div>

      {review.textChanged && (
        <div className="extracted__changed" role="status">
          <span>The text has changed since the last review.</span>
          <Button size="sm" icon={RefreshCw} onClick={review.rerun}>
            Re-run review
          </Button>
        </div>
      )}

      <div className="extracted__canvas">
        <div className={cn('extracted__page', editing && 'is-editing')}>
          <label htmlFor="extracted-text" className="visually-hidden">
            Extracted text
          </label>
          <textarea
            id="extracted-text"
            ref={textareaRef}
            lang={lang}
            value={review.text}
            readOnly={!editing}
            onChange={(e) => review.setText(e.target.value)}
            spellCheck={editing}
          />
        </div>
        <p className="extracted__note">
          {editing
            ? 'Correct any extraction mistakes, then re-run the review.'
            : 'Read-only. Choose “Edit Text” to correct extraction mistakes.'}
        </p>
      </div>
    </div>
  );
}
