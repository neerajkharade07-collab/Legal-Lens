import { TriangleAlert } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDocumentReview } from '../hooks/useDocumentReview';
import { ReviewUploadView } from '../components/review/ReviewUploadView';
import { ReviewProcessingView } from '../components/review/ReviewProcessingView';
import { ReviewWorkspace } from '../components/review/ReviewWorkspace';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';

/** Review an existing document: select → (demo) processing → review workspace. */
export default function ReviewDocument() {
  useDocumentTitle('Review Existing Document');
  const review = useDocumentReview();

  if (review.phase === 'processing') return <ReviewProcessingView review={review} />;
  if (review.phase === 'review') return <ReviewWorkspace review={review} />;
  if (review.phase === 'error') {
    return (
      <div className="container">
        <EmptyState
          icon={TriangleAlert}
          title="Processing failed"
          description={review.error ?? 'The document could not be processed.'}
          action={
            <>
              <Button onClick={review.start}>Try again</Button>
              <Button variant="secondary" onClick={review.reset}>
                Choose another file
              </Button>
            </>
          }
        />
      </div>
    );
  }
  return <ReviewUploadView review={review} />;
}
