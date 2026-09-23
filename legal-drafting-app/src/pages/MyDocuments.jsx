import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilePlus2, FolderOpen, LayoutTemplate, Search, SearchX, X } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDocuments } from '../hooks/useDocuments';
import { useDraftSetup } from '../hooks/useDraftSetup';
import { useToast } from '../hooks/useToast';
import { documentStorageService } from '../services';
import { DOCUMENT_TYPES, getDocumentType } from '../data/documentTypes';
import { DOCUMENT_STATUSES, getStatus } from '../data/documentStatuses';
import { Tabs } from '../components/common/Tabs';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { DocumentListItem } from '../components/documents/DocumentListItem';
import { RenameDialog } from '../components/documents/RenameDialog';
import { DocumentPreviewModal } from '../components/documents/DocumentPreviewModal';
import { LocalImportBanner } from '../components/documents/LocalImportBanner';
import '../components/documents/Documents.css';
import './MyDocuments.css';
import { SAVE_LOCATION } from '../services/config';

const STATUS_TABS = ['all', 'draft', 'needs-review', 'reviewed', 'completed'];
const TYPE_OPTIONS = [
  ...DOCUMENT_TYPES.map((t) => ({ id: t.id, label: t.name })),
  { id: 'general-document', label: 'General / template document' },
];
const typeName = (id) => getDocumentType(id)?.name ?? '';

/** My Documents: every locally saved document, with search, filters and actions. */
export default function MyDocuments() {
  useDocumentTitle('My Documents');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openDraftSetup } = useDraftSetup();
  const {
    documents,
    status: loadStatus,
    error,
    reload,
    updateDocument,
    deleteDocument,
    renameDocument,
    duplicateDocument,
    loadDocument,
  } = useDocuments();

  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState('all');
  const [statusTab, setStatusTab] = useState('all');
  const [sort, setSort] = useState('edited');
  const [renaming, setRenaming] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const beforeStatus = useMemo(
    () => documentStorageService.queryDocuments(documents, { query, typeId, sort, typeName }),
    [documents, query, typeId, sort],
  );
  const results = useMemo(
    () => (statusTab === 'all' ? beforeStatus : beforeStatus.filter((d) => d.status === statusTab)),
    [beforeStatus, statusTab],
  );

  const tabs = STATUS_TABS.map((id) => ({
    id,
    label: id === 'all' ? 'All' : DOCUMENT_STATUSES[id].label,
    count:
      loadStatus === 'ready'
        ? id === 'all'
          ? beforeStatus.length
          : beforeStatus.filter((d) => d.status === id).length
        : undefined,
  }));

  const filtersActive = Boolean(query.trim()) || typeId !== 'all' || statusTab !== 'all';
  const clearFilters = () => {
    setQuery('');
    setTypeId('all');
    setStatusTab('all');
  };

  function handleAction(action, doc, extra) {
    if (action === 'open') navigate(`/draft/${doc.id}`);
    if (action === 'rename') setRenaming(doc);
    if (action === 'delete') setDeleting(doc);
    if (action === 'preview') {
      // Lists hold summaries; the preview needs the full document.
      loadDocument(doc.id).then(setPreviewing, (err) =>
        toast({ title: 'Could not load the preview', description: err.message, variant: 'error' }),
      );
    }
    if (action === 'duplicate') {
      duplicateDocument(doc.id).then(
        (copy) =>
          toast({ title: 'Document duplicated', description: copy.name, variant: 'success' }),
        (err) =>
          toast({ title: 'Could not duplicate', description: err.message, variant: 'error' }),
      );
    }
    if (action === 'status') {
      updateDocument(doc.id, { status: extra }).then(
        () =>
          toast({
            title: `Marked as ${getStatus(extra).label}`,
            description: doc.name,
            duration: 2500,
          }),
        (err) => {
          toast({ title: 'Status not saved', description: err.message, variant: 'error' });
          reload();
        },
      );
    }
  }

  async function confirmDelete() {
    const doc = deleting;
    setDeleting(null);
    try {
      await deleteDocument(doc.id);
      toast({ title: 'Document deleted', description: doc.name });
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'error' });
    }
  }

  return (
    <div className="mydocs container">
      <header className="mydocs__head">
        <div>
          <p className="eyebrow">Library</p>
          <h1 className="mydocs__title">My Documents</h1>
          <p className="mydocs__lead">
            Drafts, template documents, reviewed documents and comparison results saved to your
            account.
          </p>
        </div>
        <div className="mydocs__cta">
          <Button variant="secondary" icon={LayoutTemplate} to="/templates">
            Browse templates
          </Button>
          <Button icon={FilePlus2} onClick={() => openDraftSetup()}>
            Create draft
          </Button>
        </div>
      </header>

      <div className="mydocs__toolbar">
        <div className="mydocs__search">
          <label htmlFor="doc-search" className="visually-hidden">
            Search documents
          </label>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            id="doc-search"
            type="search"
            className="form-input"
            placeholder="Search by title, type or source…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="mydocs__clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="mydocs__selects">
          <div className="form-field">
            <label htmlFor="doc-type-filter" className="visually-hidden">
              Document type
            </label>
            <select
              id="doc-type-filter"
              className="form-select"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="all">All document types</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="doc-sort" className="visually-hidden">
              Sort documents
            </label>
            <select
              id="doc-sort"
              className="form-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {documentStorageService.SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        value={statusTab}
        onChange={setStatusTab}
        idPrefix="mydocs"
        label="Filter by status"
        className="mydocs__tabs"
      />

      {loadStatus === 'ready' && <LocalImportBanner />}

      <section
        id="mydocs-panel"
        role="tabpanel"
        aria-labelledby={`mydocs-tab-${statusTab}`}
        className="mydocs__panel"
      >
        {loadStatus === 'loading' && (
          <div className="mydocs__loading" aria-busy="true" aria-label="Loading documents">
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} height={56} />
            ))}
          </div>
        )}

        {loadStatus === 'error' && (
          <EmptyState
            icon={FolderOpen}
            title="Could not load your documents"
            description={error}
            action={
              <Button variant="secondary" onClick={reload}>
                Try again
              </Button>
            }
          />
        )}

        {loadStatus === 'ready' && documents.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description={`Create a draft or start from a template. Documents are saved ${SAVE_LOCATION}.`}
            action={
              <div className="mydocs__empty-actions">
                <Button icon={FilePlus2} onClick={() => openDraftSetup()}>
                  Create draft
                </Button>
                <Button variant="secondary" icon={LayoutTemplate} to="/templates">
                  Browse templates
                </Button>
              </div>
            }
          />
        )}

        {loadStatus === 'ready' && documents.length > 0 && results.length === 0 && (
          <EmptyState
            icon={SearchX}
            title="No documents match"
            description="Try a different search term, type or status."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        )}

        {loadStatus === 'ready' && results.length > 0 && (
          <>
            <p className="mydocs__count" aria-live="polite">
              {results.length} document{results.length === 1 ? '' : 's'}
              {filtersActive ? ' match your filters' : ''}
            </p>
            <div className="doc-list__head" aria-hidden="true">
              <span />
              <span>Title</span>
              <span>Last edited</span>
              <span>Status</span>
              <span />
            </div>
            <ul className="doc-list" aria-label="Documents">
              {results.map((doc) => (
                <DocumentListItem key={doc.id} document={doc} onAction={handleAction} />
              ))}
            </ul>
          </>
        )}
      </section>

      <RenameDialog
        document={renaming}
        onRename={(name) => {
          const message = renameDocument(renaming.id, name);
          if (!message)
            toast({ title: 'Document renamed', description: name.trim(), duration: 2500 });
          return message;
        }}
        onClose={() => setRenaming(null)}
      />
      <DocumentPreviewModal document={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        tone="danger"
        title="Delete this document?"
        description={
          <p>
            <strong>{deleting?.name}</strong> and its version history will be removed from this
            browser. This cannot be undone.
          </p>
        }
        confirmLabel="Delete document"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
