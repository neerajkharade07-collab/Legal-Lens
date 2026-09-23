import { REVIEW_STAGES } from '../../data/review/reviewStages';
import { ProcessingStages } from '../files/ProcessingStages';
import { FileUpload } from '../files/FileUpload';
import { Button } from '../common/Button';
import './ReviewProcessingView.css';

export function ReviewProcessingView({ review }) {
  const stages = REVIEW_STAGES.map((s) => ({
    ...s,
    label: review.ocr && s.ocrLabel ? s.ocrLabel : s.label,
  }));
  return (
    <div className="review-processing container">
      <div className="review-processing__card">
        <FileUpload
          value={review.selected}
          onChange={() => {}}
          onRemove={() => {}}
          status="processing"
        />
        <ProcessingStages
          stages={stages}
          current={review.stage}
          title="Reviewing document"
          note="Demo processing in your browser — nothing is uploaded."
        />
        <Button variant="ghost" size="sm" onClick={review.cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
