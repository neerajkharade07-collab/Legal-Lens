import { useMemo, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { BlockPreview } from '../intelligence/BlockPreview';
import { getDocumentType } from '../../data/documentTypes';
import { getStatus } from '../../data/documentStatuses';
import { documentStorageService } from '../../services';
import { createInitialWorkspace } from '../../utils/workspaceModel';
import { formatDate } from '../../utils/date';
import '../intelligence/IntelShared.css';
import './Documents.css';

/** Read-only preview of a stored document (nothing is saved). */
export function DocumentPreviewModal({ document: doc, onClose }) {
  const openRef = useRef(null);
  const content = useMemo(() => (doc ? createInitialWorkspace(doc).content : null), [doc]);
  if (!doc) return null;
  const type = getDocumentType(doc.typeId);
  const status = getStatus(doc.status);
  const origin = documentStorageService.getDocumentOrigin(doc);

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      labelledBy="doc-preview-title"
      initialFocusRef={openRef}
      className="doc-preview"
    >
      <header className="doc-preview__header">
        <div className="doc-preview__heading">
          <p className="eyebrow">Preview · read-only</p>
          <h2 id="doc-preview-title" className="doc-preview__title">
            {doc.name}
          </h2>
          <p className="doc-preview__meta">
            {type?.name ?? 'Document'} · {origin.label} · Last edited {formatDate(doc.updatedAt)}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
        <ModalCloseButton onClick={onClose} />
      </header>
      <div className="doc-preview__body">
        <BlockPreview blocks={content?.content ?? []} label={`Contents of ${doc.name}`} />
      </div>
      <footer className="doc-preview__footer">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button ref={openRef} to={`/draft/${doc.id}`} iconRight={ArrowUpRight}>
          Open in workspace
        </Button>
      </footer>
    </Modal>
  );
}
