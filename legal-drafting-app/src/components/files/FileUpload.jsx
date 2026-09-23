import { useId, useRef, useState } from 'react';
import { Upload, FileText, FileImage, X, RefreshCw, CircleCheck } from 'lucide-react';
import { ACCEPT_ATTRIBUTE, validateFile } from '../../utils/fileValidation';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { cn } from '../../utils/cn';
import './FileUpload.css';

const STATUS_LABEL = { ready: 'Ready', processing: 'Processing…', completed: 'Reviewed' };

/**
 * Drag-and-drop / browse file picker. Files stay in the browser — nothing is
 * uploaded. Validates type and size; reports { file, info } to the parent.
 * States: empty · dragging · selected · processing · completed · error
 */
export function FileUpload({
  label,
  hint,
  value,
  onChange,
  onRemove,
  status = 'ready',
  disabled = false,
  compact = false,
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const accept = (fileList) => {
    const files = [...(fileList ?? [])];
    if (!files.length) return;
    const result = validateFile(files[0]);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(
      files.length > 1 ? `Only one file can be used here — “${files[0].name}” was selected.` : null,
    );
    onChange({ file: files[0], info: result.info });
  };

  const openPicker = () => inputRef.current?.click();

  const dragProps = disabled
    ? {}
    : {
        onDragEnter: (e) => {
          e.preventDefault();
          depth.current += 1;
          setDragging(true);
        },
        onDragOver: (e) => e.preventDefault(),
        onDragLeave: (e) => {
          e.preventDefault();
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDragging(false);
        },
        onDrop: (e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          accept(e.dataTransfer.files);
        },
      };

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={ACCEPT_ATTRIBUTE}
      className="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        accept(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (value?.info) {
    const { info } = value;
    const Icon = info.kind === 'image' ? FileImage : FileText;
    return (
      <div className={cn('file-upload', 'has-file', compact && 'is-compact')} {...dragProps}>
        {label && <p className="file-upload__label">{label}</p>}
        <div className={cn('file-card', dragging && 'is-dragging')}>
          <span className="file-card__icon" aria-hidden="true">
            <Icon size={22} strokeWidth={1.5} />
          </span>
          <div className="file-card__text">
            <p className="file-card__name" title={info.name}>
              {info.name}
            </p>
            <p className="file-card__meta">
              {info.label} · {info.sizeLabel}
            </p>
          </div>
          <Badge
            tone={status === 'completed' ? 'neutral' : 'outline'}
            icon={status === 'completed' ? CircleCheck : undefined}
          >
            {STATUS_LABEL[status] ?? 'Ready'}
          </Badge>
          {status !== 'processing' && (
            <div className="file-card__actions">
              <Button
                size="sm"
                variant="ghost"
                icon={RefreshCw}
                onClick={openPicker}
                disabled={disabled}
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                onClick={() => {
                  setError(null);
                  onRemove();
                }}
                disabled={disabled}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="file-upload__error" role="alert">
            {error}
          </p>
        )}
        {input}
      </div>
    );
  }

  return (
    <div className={cn('file-upload', compact && 'is-compact')}>
      {label && <p className="file-upload__label">{label}</p>}
      <div
        className={cn(
          'dropzone',
          dragging && 'is-dragging',
          error && 'has-error',
          disabled && 'is-disabled',
        )}
        {...dragProps}
      >
        <span className="dropzone__icon" aria-hidden="true">
          <Upload size={22} strokeWidth={1.5} />
        </span>
        <p className="dropzone__title">
          {dragging ? 'Drop the file to select it' : 'Drag & drop document'}
        </p>
        <p className="dropzone__or">or</p>
        <Button
          variant="secondary"
          onClick={openPicker}
          disabled={disabled}
          aria-describedby={error ? errorId : undefined}
        >
          Browse Files
        </Button>
        <p className="dropzone__hint">{hint ?? 'PDF, DOCX, JPG, JPEG or PNG · up to 25 MB'}</p>
      </div>
      {error && (
        <p id={errorId} className="file-upload__error" role="alert">
          {error}
        </p>
      )}
      {input}
    </div>
  );
}
