import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { documentsService } from '../../services';
import { useDocuments } from '../../hooks/useDocuments';
import { useToast } from '../../hooks/useToast';
import { Button } from '../common/Button';

/**
 * Drafts created before accounts were connected live only in this browser.
 * This offers to copy them to the account. Local copies are never deleted.
 */
export function LocalImportBanner() {
  const { createDocument } = useDocuments();
  const { toast } = useToast();
  const [pending, setPending] = useState(() => documentsService.listLocalDocuments());
  const [importing, setImporting] = useState(false);

  if (pending.length === 0) return null;

  async function handleImport() {
    setImporting(true);
    const done = [];
    let failed = 0;
    for (const doc of pending) {
      try {
        await createDocument(doc);
        done.push(doc.id);
      } catch {
        failed += 1;
      }
    }
    documentsService.markLocalDocumentsImported(done);
    setPending(documentsService.listLocalDocuments());
    setImporting(false);
    toast({
      title: `${done.length} draft${done.length === 1 ? '' : 's'} imported`,
      description: failed
        ? `${failed} could not be imported. Try again later.`
        : 'They are now saved to your account.',
      variant: failed ? 'error' : 'success',
    });
  }

  function handleDismiss() {
    documentsService.markLocalDocumentsImported(pending.map((doc) => doc.id));
    setPending([]);
  }

  return (
    <div className="import-banner" role="region" aria-label="Drafts saved in this browser">
      <UploadCloud size={18} strokeWidth={1.75} aria-hidden="true" />
      <p className="import-banner__text">
        <strong>
          {pending.length} draft{pending.length === 1 ? '' : 's'} saved only in this browser.
        </strong>{' '}
        Import {pending.length === 1 ? 'it' : 'them'} to your account to keep version history and
        open {pending.length === 1 ? 'it' : 'them'} anywhere.
      </p>
      <div className="import-banner__actions">
        <Button size="sm" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing…' : 'Import'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={importing}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
