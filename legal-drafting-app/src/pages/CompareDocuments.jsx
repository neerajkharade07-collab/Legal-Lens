import { TriangleAlert } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useComparison } from '../hooks/useComparison';
import { CompareUploadView } from '../components/compare/CompareUploadView';
import { CompareProcessingView } from '../components/compare/CompareProcessingView';
import { RedlineWorkspace } from '../components/compare/RedlineWorkspace';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';

/** Compare Documents: two files → (demo) comparison → redline workspace. */
export default function CompareDocuments() {
  useDocumentTitle('Compare Documents');
  const compare = useComparison();

  if (compare.phase === 'comparing') return <CompareProcessingView compare={compare} />;
  if (compare.phase === 'ready' && compare.result) return <RedlineWorkspace compare={compare} />;
  if (compare.phase === 'error') {
    return (
      <div className="container">
        <EmptyState
          icon={TriangleAlert}
          title="Comparison failed"
          description={compare.error ?? 'The documents could not be compared.'}
          action={
            <>
              <Button onClick={compare.compare}>Try again</Button>
              <Button variant="secondary" onClick={compare.reset}>
                Choose other files
              </Button>
            </>
          }
        />
      </div>
    );
  }
  return <CompareUploadView compare={compare} />;
}
