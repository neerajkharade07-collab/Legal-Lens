import { GitCompareArrows, Lock } from 'lucide-react';
import { FileUpload } from '../files/FileUpload';
import { Button } from '../common/Button';
import { DemoNotice } from '../intelligence/IntelShared';
import './CompareUploadView.css';

export function CompareUploadView({ compare }) {
  const missing = [];
  if (!compare.original) missing.push('Select the original document.');
  if (!compare.revised) missing.push('Select the revised document.');

  return (
    <div className="compare-upload container">
      <header className="compare-upload__head">
        <p className="eyebrow">Compare</p>
        <h1 className="compare-upload__title">Compare Documents</h1>
        <p className="compare-upload__lead">
          Compare two versions of a document and review what changed.
        </p>
      </header>

      <div className="compare-upload__grid">
        <FileUpload
          label="Original Document"
          value={compare.original}
          onChange={compare.setOriginal}
          onRemove={() => compare.setOriginal(null)}
          compact
        />
        <FileUpload
          label="Revised Document"
          value={compare.revised}
          onChange={compare.setRevised}
          onRemove={() => compare.setRevised(null)}
          compact
        />
      </div>

      <div className="compare-upload__actions">
        <Button
          size="lg"
          icon={GitCompareArrows}
          onClick={compare.compare}
          aria-describedby="compare-missing"
        >
          Compare Documents
        </Button>
        <div
          id="compare-missing"
          className="compare-upload__missing"
          role={compare.attempted ? 'alert' : undefined}
        >
          {missing.length > 0 &&
            (compare.attempted ? (
              missing.map((m) => <p key={m}>{m}</p>)
            ) : (
              <p className="is-muted">Select both documents to compare.</p>
            ))}
        </div>
      </div>

      <DemoNotice>
        Demo comparison: two fictional sample versions are compared so you can explore the redline
        tools — the selected files are not read. The comparison engine itself is real and will run
        on extracted text once document processing is connected.
      </DemoNotice>

      <p className="review-privacy">
        <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
        Documents are processed locally in this demo and are not uploaded to a server.
      </p>
    </div>
  );
}
