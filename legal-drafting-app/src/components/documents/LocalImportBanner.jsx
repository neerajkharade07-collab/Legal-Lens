import { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { documentsService } from '../../services';
import { useAuth } from '../../hooks/useAuth';
import { useDocuments } from '../../hooks/useDocuments';
import { useToast } from '../../hooks/useToast';
import { Button } from '../common/Button';
import { ConfirmDialog } from '../common/ConfirmDialog';

const HIDE_KEY = 'legal-drafting:import-banner-hidden';

/**
 * Drafts made while signed out (Demo Mode) — or by the first version of this app —
 * live only in this browser. Signed-in customers and lawyers are offered to COPY
 * them to their account, after confirming.
 *
 *  - Non-destructive: browser copies are never changed or deleted; nothing in the
 *    account is ever overwritten (each draft becomes a new account document).
 *  - Duplicate- and retry-safe: the server imports each browser draft at most once
 *    (POST /api/documents/import with the browser id), so pressing Import again
 *    after a failure or on another tab never creates a second copy.
 *  - Honest: each draft is reported as imported, already imported or failed.
 */
export function LocalImportBanner() {
  const { status: authStatus, user } = useAuth();
  const { reload } = useDocuments();
  const { toast } = useToast();
  const userId = authStatus === 'authenticated' ? user?.id : null;
  const [pending, setPending] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return window.sessionStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setPending(userId ? documentsService.listBrowserDrafts(userId) : []);
  }, [userId]);

  if (!userId || hidden || pending.length === 0) return null;

  async function handleImport() {
    setConfirming(false);
    setImporting(true);
    let imported = 0;
    let already = 0;
    let failed = 0;
    let lastError = null;
    for (const item of pending) {
      try {
        const result = await documentsService.importBrowserDraft(userId, item);
        if (result.alreadyImported) already += 1;
        else imported += 1;
      } catch (err) {
        failed += 1;
        lastError = err;
        if (err?.status === 401) break; // session ended: stop, nothing else can succeed
      }
    }
    setPending(documentsService.listBrowserDrafts(userId));
    setImporting(false);
    if (imported || already) reload();
    const parts = [];
    if (imported) parts.push(`${imported} copied to your account`);
    if (already) parts.push(`${already} already in your account (not copied again)`);
    if (failed) parts.push(`${failed} not imported${lastError?.message ? ` — ${lastError.message}` : ''}`);
    toast({
      title: failed ? 'Import not complete' : 'Import complete',
      description: `${parts.join('; ')}. The copies in this browser were not changed.${failed ? ' You can press Import again — nothing will be duplicated.' : ''}`,
      variant: failed ? 'error' : 'success',
    });
  }

  function handleHide() {
    try {
      window.sessionStorage.setItem(HIDE_KEY, '1');
    } catch {
      /* storage blocked: hide for this page view only */
    }
    setHidden(true);
  }

  const count = pending.length;
  const plural = count === 1 ? '' : 's';

  return (
    <>
      <div className="import-banner" role="region" aria-label="Drafts saved in this browser">
        <UploadCloud size={18} strokeWidth={1.75} aria-hidden="true" />
        <p className="import-banner__text">
          <strong>
            {count} draft{plural} saved only in this browser.
          </strong>{' '}
          Copy {count === 1 ? 'it' : 'them'} to your account to keep version history and open{' '}
          {count === 1 ? 'it' : 'them'} anywhere.
        </p>
        <div className="import-banner__actions">
          <Button size="sm" onClick={() => setConfirming(true)} disabled={importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleHide} disabled={importing}>
            Not now
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Copy ${count} browser draft${plural} to your account?`}
        description={
          <>
            <p>
              {pending
                .slice(0, 5)
                .map((item) => item.name)
                .join(', ')}
              {count > 5 ? ` and ${count - 5} more` : ''}
            </p>
            <p>
              Each draft becomes a new document in your account. Nothing already in your account is
              changed, and the copies in this browser are kept. Drafts that were already imported
              are not copied again.
            </p>
          </>
        }
        confirmLabel={`Import ${count} draft${plural}`}
        onConfirm={handleImport}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
