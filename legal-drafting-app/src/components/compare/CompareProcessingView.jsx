import { COMPARE_STAGES } from '../../data/review/reviewStages';
import { ProcessingStages } from '../files/ProcessingStages';
import { Button } from '../common/Button';
import '../review/ReviewProcessingView.css';

export function CompareProcessingView({ compare }) {
  return (
    <div className="review-processing container">
      <div className="review-processing__card">
        <p className="compare-processing__files">
          <strong>{compare.original?.info.name}</strong> →{' '}
          <strong>{compare.revised?.info.name}</strong>
        </p>
        <ProcessingStages
          stages={COMPARE_STAGES}
          current={compare.stage}
          title="Comparing documents"
          note="Demo processing in your browser — nothing is uploaded."
        />
        <Button variant="ghost" size="sm" onClick={compare.cancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
