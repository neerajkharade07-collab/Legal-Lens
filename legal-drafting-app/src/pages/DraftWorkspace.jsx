import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileX, CloudOff } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { PageLoader } from '../components/common/PageLoader';
import { DraftWorkspaceView } from '../components/workspace/DraftWorkspaceView';
import { getDocumentSchema } from '../data/documentSchemas';

/** Opens a saved document: the full content is fetched from the server on open. */
export default function DraftWorkspace() {
  const { docId } = useParams();
  const { getDocument, loadDocument } = useDocuments();
  const { status: authStatus } = useAuth();
  const [state, setState] = useState({ status: 'loading', error: null, attempt: 0 });
  // The document as it was opened. It stays on screen if the session changes (e.g. it
  // ended): unsaved edits are never thrown away, and saving reports honestly where it fails.
  const [opened, setOpened] = useState(null);
  const listed = getDocument(docId);
  const doc = listed?.workspace ? listed : opened?.id === docId ? opened : listed;
  useDocumentTitle(doc?.name ?? 'Draft workspace');

  const attempt = state.attempt;
  useEffect(() => {
    // Wait until we know where documents live. Server unreachable / session ended: keep
    // what is on screen (nothing is re-loaded from, or saved to, the wrong place).
    if (authStatus !== 'authenticated' && authStatus !== 'anonymous') return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    loadDocument(docId).then(
      (full) => {
        if (cancelled) return;
        setOpened(full);
        setState((s) => ({ ...s, status: 'ready' }));
      },
      (err) =>
        !cancelled &&
        setState((s) => ({
          ...s,
          status: err?.status === 404 || err?.status === 422 ? 'missing' : 'error',
          error: err?.message,
        })),
    );
    return () => {
      cancelled = true;
    };
  }, [docId, loadDocument, attempt, authStatus]);

  if (state.status === 'loading' && !doc?.workspace) return <PageLoader />;

  if (state.status === 'error' && !doc?.workspace) {
    return (
      <div className="container">
        <EmptyState
          icon={CloudOff}
          title="Could not open this document"
          description={state.error}
          action={
            <Button
              variant="secondary"
              onClick={() => setState((s) => ({ ...s, attempt: s.attempt + 1 }))}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (!doc?.workspace || !getDocumentSchema(doc.typeId)) {
    return (
      <div className="container">
        <EmptyState
          icon={FileX}
          title="Document not found"
          description="This document may have been deleted, or the link is incorrect."
          action={
            <Button to="/documents" variant="secondary">
              Go to My Documents
            </Button>
          }
        />
      </div>
    );
  }

  // Keyed by id so switching documents starts a fresh workspace.
  return <DraftWorkspaceView key={doc.id} document={doc} />;
}
