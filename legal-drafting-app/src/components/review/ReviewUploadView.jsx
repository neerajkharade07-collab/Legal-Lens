import { ArrowRight, Lock, ScanText } from 'lucide-react';
import { OCR_LANGUAGES } from '../../services/ocrService';
import { FileUpload } from '../files/FileUpload';
import { Button } from '../common/Button';
import { DemoNotice } from '../intelligence/IntelShared';
import { cn } from '../../utils/cn';
import './ReviewUploadView.css';

const CHECKS = [
  'Document structure and headings',
  'Missing information and unresolved placeholders',
  'Blank signature, place and date lines',
  'Date formatting and wording consistency',
  'Possible missing clauses for the document type',
  'A compliance checklist that requires verification',
];

export function ReviewUploadView({ review }) {
  const { selected, isImage } = review;
  return (
    <div className="review-upload container">
      <header className="review-upload__head">
        <p className="eyebrow">Review</p>
        <h1 className="review-upload__title">Review an Existing Document</h1>
        <p className="review-upload__lead">
          Upload a legal document to inspect its structure, completeness and potential issues.
        </p>
      </header>

      <div className="review-upload__grid">
        <section className="review-upload__main" aria-label="Select a document">
          <FileUpload value={selected} onChange={review.selectFile} onRemove={review.removeFile} />

          {selected && (
            <div className="review-options">
              <fieldset className="review-options__group">
                <legend className="setup-label">Document language</legend>
                <div className="lang-choice">
                  {OCR_LANGUAGES.map((lang) => (
                    <label
                      key={lang.id}
                      className={cn(
                        'lang-choice__option',
                        review.language === lang.id && 'is-selected',
                      )}
                    >
                      <input
                        type="radio"
                        name="review-language"
                        value={lang.id}
                        checked={review.language === lang.id}
                        onChange={() => review.setLanguage(lang.id)}
                        className="visually-hidden"
                      />
                      <span>{lang.label}</span>
                      {lang.nativeLabel !== lang.label && (
                        <span className="lang-choice__native" lang={lang.id}>
                          {lang.nativeLabel}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                {review.language !== 'en' && (
                  <p className="setup-help">
                    Devanagari text extraction (Hindi / Marathi) — demo interface.
                  </p>
                )}
              </fieldset>

              {selected.info.kind !== 'docx' && (
                <label className={cn('ocr-option', isImage && 'is-locked')}>
                  <input
                    type="checkbox"
                    checked={review.ocr}
                    disabled={isImage}
                    onChange={(e) => review.setOcrChoice(e.target.checked)}
                  />
                  <ScanText size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <span className="ocr-option__title">Extract text from scanned document</span>
                    <span className="ocr-option__help">
                      {isImage
                        ? 'Images always need text extraction.'
                        : 'Use this for scanned PDFs without selectable text.'}{' '}
                      OCR language: {OCR_LANGUAGES.find((l) => l.id === review.language)?.label}.
                    </span>
                  </span>
                </label>
              )}

              <Button
                size="lg"
                iconRight={ArrowRight}
                onClick={review.start}
                className="review-options__cta"
              >
                Review Document
              </Button>
            </div>
          )}

          <p className="review-privacy">
            <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
            Documents are processed locally in this demo and are not uploaded to a server.
          </p>
        </section>

        <aside className="review-upload__aside" aria-label="What the review checks">
          <p className="review-upload__aside-title">What the review checks</p>
          <ul>
            {CHECKS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <DemoNotice>
            Demo: text extraction and OCR are simulated. The review shows fictional sample text —
            your file&rsquo;s contents are not read. Findings are demo analysis and require
            verification.
          </DemoNotice>
        </aside>
      </div>
    </div>
  );
}
