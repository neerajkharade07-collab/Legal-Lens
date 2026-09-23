import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { getDocumentType } from '../../data/documentTypes';
import { getStatus } from '../../data/documentStatuses';
import { DocumentTypeIcon } from '../common/DocumentTypeIcon';
import { Badge } from '../common/Badge';
import { formatRelative } from '../../utils/date';
import './DocumentRow.css';

export function DocumentRow({ document, timeField = 'updatedAt' }) {
  const type = getDocumentType(document.typeId);
  const status = getStatus(document.status);
  const timeLabel = timeField === 'createdAt' ? 'Created' : 'Edited';
  const href = `/draft/${document.id}`;

  return (
    <li className="doc-row">
      <span className="doc-row__icon" aria-hidden="true">
        <DocumentTypeIcon name={type?.icon} size={18} />
      </span>

      <div className="doc-row__main">
        <Link to={href} className="doc-row__name">
          {document.name}
        </Link>
        <p className="doc-row__meta">
          <span>{type?.name ?? 'Document'}</span>
          <span aria-hidden="true">·</span>
          <span>
            {timeLabel} {formatRelative(document[timeField])}
          </span>
        </p>
      </div>

      {document.status === 'draft' && typeof document.progress === 'number' && (
        <div className="doc-row__progress" aria-label={`${document.progress}% of fields completed`}>
          <span className="doc-row__progress-bar">
            <span style={{ width: `${document.progress}%` }} />
          </span>
          <span className="doc-row__progress-text">{document.progress}%</span>
        </div>
      )}

      <Badge tone={status.tone} className="doc-row__status">
        {status.label}
      </Badge>

      <Link to={href} className="doc-row__open" aria-label={`Open ${document.name}`}>
        <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </li>
  );
}
