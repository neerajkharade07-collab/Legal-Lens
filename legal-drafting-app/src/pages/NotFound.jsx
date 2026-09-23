import { Compass } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="container">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={<Button to="/">Back to dashboard</Button>}
      />
    </div>
  );
}
