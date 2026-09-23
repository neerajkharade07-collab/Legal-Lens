import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Copy,
  Eye,
  MoreHorizontal,
  PencilLine,
  Trash2,
  CircleDot,
} from 'lucide-react';
import { getDocumentType } from '../../data/documentTypes';
import { getStatus, SETTABLE_STATUSES } from '../../data/documentStatuses';
import { documentStorageService } from '../../services';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { Badge, DemoBadge } from '../common/Badge';
import { DropdownMenu } from '../common/DropdownMenu';
import { formatDate, formatRelative } from '../../utils/date';

/** One document: a table-like row on desktop, a card on mobile (CSS only). */
export function DocumentListItem({ document: doc, onAction }) {
  const type = getDocumentType(doc.typeId);
  const status = getStatus(doc.status);
  const origin = documentStorageService.getDocumentOrigin(doc);
  const language = documentStorageService.getDocumentLanguage(doc);
  const href = `/draft/${doc.id}`;
  const typeLabel =
    doc.typeId === 'general-document' && origin.templateName
      ? origin.templateName
      : (type?.name ?? 'Document');

  const items = [
    { id: 'open', label: 'Open', icon: ArrowUpRight, onSelect: () => onAction('open', doc) },
    { id: 'preview', label: 'Preview', icon: Eye, onSelect: () => onAction('preview', doc) },
    { id: 'rename', label: 'Rename', icon: PencilLine, onSelect: () => onAction('rename', doc) },
    { id: 'duplicate', label: 'Duplicate', icon: Copy, onSelect: () => onAction('duplicate', doc) },
    ...SETTABLE_STATUSES.filter((id) => id !== doc.status).map((id) => ({
      id: `status-${id}`,
      label: `Mark as ${getStatus(id).label}`,
      icon: CircleDot,
      onSelect: () => onAction('status', doc, id),
    })),
    { id: 'delete', label: 'Delete…', icon: Trash2, onSelect: () => onAction('delete', doc) },
  ];

  return (
    <li className="doc-item">
      <span className="doc-item__icon" aria-hidden="true">
        <DocumentTypeIcon name={type?.icon} size={18} />
      </span>

      <div className="doc-item__main">
        <Link to={href} className="doc-item__name">
          {doc.name}
        </Link>
        <p className="doc-item__meta">
          <span>{typeLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{origin.label}</span>
          {language && (
            <>
              <span aria-hidden="true">·</span>
              <span>{language}</span>
            </>
          )}
          {doc.isSample && <DemoBadge className="doc-item__sample">Sample</DemoBadge>}
        </p>
      </div>

      <p className="doc-item__edited">
        <span className="doc-item__label">Last edited </span>
        <time dateTime={doc.updatedAt} title={formatDate(doc.updatedAt)}>
          {formatRelative(doc.updatedAt)}
        </time>
      </p>

      <div className="doc-item__status">
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="doc-item__actions">
        <Link to={href} className="btn btn--secondary btn--sm" aria-label={`Open ${doc.name}`}>
          <span className="btn__label">Open</span>
        </Link>
        <DropdownMenu
          icon={MoreHorizontal}
          items={items}
          buttonLabel={`More actions for ${doc.name}`}
          buttonClassName="doc-item__more"
        />
      </div>
    </li>
  );
}
