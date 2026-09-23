import {
  House,
  ShieldAlert,
  Scale,
  Stamp,
  FileText,
  Mail,
  Briefcase,
  Lock,
  Building2,
} from 'lucide-react';

const ICONS = {
  rental: House,
  complaint: ShieldAlert,
  divorce: Scale,
  affidavit: Stamp,
  notice: Mail,
  business: Briefcase,
  nda: Lock,
  property: Building2,
  general: FileText,
};

/** Resolves a document type's icon key (from data) to a line icon. */
export function DocumentTypeIcon({ name, size = 20, strokeWidth = 1.5, ...rest }) {
  const Icon = ICONS[name] ?? FileText;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}
