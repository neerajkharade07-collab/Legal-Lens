import { FileText, FileImage, Lock } from 'lucide-react';
import { DOCUMENT_TYPES, HIDDEN_DOCUMENT_TYPES } from '../../data/documentTypes';
import { OCR_LANGUAGES } from '../../services/ocrService';
import { formatDate } from '../../utils/date';
import { DemoNotice } from '../intelligence/IntelShared';

const TYPE_OPTIONS = [...DOCUMENT_TYPES, ...HIDDEN_DOCUMENT_TYPES];

/** Left panel: uploaded file metadata + review settings. */
export function ReviewFileInfo({ review }) {
  const { info } = review.selected;
  const { extraction } = review;
  const Icon = info.kind === 'image' ? FileImage : FileText;
  const language = OCR_LANGUAGES.find((l) => l.id === extraction?.language) ?? OCR_LANGUAGES[0];
  const words = review.text.trim() ? review.text.trim().split(/\s+/).length : 0;

  return (
    <div className="review-info">
      <div className="review-info__file">
        <span className="review-info__icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.5} />
        </span>
        <div>
          <p className="review-info__name" title={info.name}>
            {info.name}
          </p>
          <p className="review-info__meta">
            {info.label} · {info.sizeLabel}
          </p>
        </div>
      </div>

      <dl className="review-info__list">
        <div>
          <dt>File type</dt>
          <dd>{info.label}</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{info.sizeLabel}</dd>
        </div>
        {info.lastModified && (
          <div>
            <dt>Last modified</dt>
            <dd>{formatDate(info.lastModified)}</dd>
          </div>
        )}
        <div>
          <dt>Language</dt>
          <dd>
            {language.label}
            {language.nativeLabel !== language.label && (
              <span lang={language.id}> · {language.nativeLabel}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Text source</dt>
          <dd>
            {extraction?.method === 'demo-ocr'
              ? 'Demo OCR (simulated)'
              : 'Demo text extraction (simulated)'}
          </dd>
        </div>
        <div>
          <dt>Words</dt>
          <dd>{words}</dd>
        </div>
      </dl>

      <div className="review-info__type">
        <label htmlFor="review-type" className="setup-label">
          Review checks for
        </label>
        <select
          id="review-type"
          value={review.typeId}
          onChange={(e) => review.changeType(e.target.value)}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <p className="setup-help">
          Suggested from keywords in the text (demo). Change it to apply different checks.
        </p>
      </div>

      <DemoNotice>{extraction?.notice ?? 'Sample text for demonstration.'}</DemoNotice>

      <p className="review-privacy">
        <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
        Processed locally in this demo — not uploaded to a server.
      </p>
    </div>
  );
}
