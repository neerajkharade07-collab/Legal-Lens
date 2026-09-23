/**
 * Document types supported by the Legal Drafting Assistant.
 *
 * This is presentation metadata only. Field schemas and draft bodies are added
 * in later steps (data/documentTemplates.js). `icon` is a key resolved by
 * components/common/DocumentTypeIcon so the data stays UI-agnostic and can be
 * replaced by a Template API response later.
 */
export const DOCUMENT_TYPES = [
  {
    id: 'rental-agreement',
    name: 'Rental Agreement',
    shortName: 'Rental',
    category: 'Property',
    icon: 'rental',
    description:
      'Leave and licence or rental agreement between landlord and tenant covering rent, deposit, lock-in and notice terms.',
    sections: ['Parties', 'Premises', 'Rent & deposit', 'Term & exit'],
  },
  {
    id: 'fir-complaint',
    name: 'FIR / Police Complaint',
    shortName: 'Police Complaint',
    category: 'Criminal',
    icon: 'complaint',
    description:
      'Written complaint to the police setting out the incident, people involved, dates, amounts and available evidence.',
    sections: ['Complainant', 'Accused', 'Incident', 'Evidence'],
  },
  {
    id: 'divorce-petition',
    name: 'Divorce Petition',
    shortName: 'Divorce',
    category: 'Family',
    icon: 'divorce',
    description:
      'Petition before the family court with marriage particulars, facts of the case, grounds and the relief sought.',
    sections: ['Parties', 'Marriage', 'Facts', 'Relief'],
  },
  {
    id: 'affidavit',
    name: 'Affidavit',
    shortName: 'Affidavit',
    category: 'General',
    icon: 'affidavit',
    description:
      'Sworn statement of facts by a deponent, with verification, for courts, authorities or institutions.',
    sections: ['Deponent', 'Statement', 'Verification'],
  },
];

/**
 * Types that exist for documents opened from Review / Compare but are not
 * offered on the dashboard or in Draft Setup.
 */
export const HIDDEN_DOCUMENT_TYPES = [
  {
    id: 'general-document',
    name: 'General document',
    shortName: 'Document',
    category: 'General',
    icon: 'general',
    description: 'A document opened from a review or comparison, without a structured template.',
    sections: [],
  },
];

export const DOCUMENT_TYPE_MAP = Object.fromEntries(
  [...DOCUMENT_TYPES, ...HIDDEN_DOCUMENT_TYPES].map((type) => [type.id, type]),
);

export function getDocumentType(id) {
  return DOCUMENT_TYPE_MAP[id] ?? null;
}
