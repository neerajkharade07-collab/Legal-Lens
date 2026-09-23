/**
 * Template Library catalogue (DEMO). These are drafting starting points only —
 * not legally valid for every situation and not reviewed for any matter.
 *
 * typeId  — a structured document type (has case-detail fields) → opens Draft Setup
 * null    — a library template without structured fields → opens directly in the editor
 *
 * Future: replaced by the Template API.
 */
export const TEMPLATE_CATEGORIES = [
  { id: 'agreements', label: 'Agreements' },
  { id: 'police-criminal', label: 'Police & Criminal' },
  { id: 'family', label: 'Family' },
  { id: 'property', label: 'Property' },
  { id: 'affidavits', label: 'Affidavits & Declarations' },
  { id: 'notices', label: 'Notices' },
  { id: 'business', label: 'Business' },
];

export const TEMPLATE_LIBRARY = [
  {
    id: 'rental-agreement',
    typeId: 'rental-agreement',
    name: 'Rental Agreement',
    categories: ['property', 'agreements'],
    icon: 'rental',
    description: 'Leave and licence / rental agreement between landlord and tenant.',
    purpose:
      'Record the terms on which residential or commercial premises are let: rent, deposit, term, lock-in, notice and responsibilities.',
    sections: [
      'Parties',
      'Premises',
      'Term',
      'Rent',
      'Security deposit',
      'Lock-in period',
      'Termination and notice',
      'Maintenance and utilities',
      'Special conditions',
      'Signatures and witnesses',
    ],
    languages: ['English'],
    structured: true,
  },
  {
    id: 'fir-complaint',
    typeId: 'fir-complaint',
    name: 'Police Complaint / FIR Draft',
    categories: ['police-criminal'],
    icon: 'complaint',
    description:
      'Written complaint to the police describing an incident, the people involved and the evidence.',
    purpose:
      'Set out the facts of an incident clearly so the complaint can be submitted to the police station concerned.',
    sections: [
      'Addressee',
      'Subject',
      'Complainant details',
      'Opposite party',
      'Incident information',
      'Facts',
      'Evidence',
      'Request',
      'Signature, place and date',
    ],
    languages: ['English'],
    structured: true,
  },
  {
    id: 'affidavit',
    typeId: 'affidavit',
    name: 'Affidavit',
    categories: ['affidavits'],
    icon: 'affidavit',
    description: 'Sworn statement of facts by a deponent with a verification clause.',
    purpose: 'State facts on affirmation for submission to an authority, institution or court.',
    sections: ['Deponent details', 'Purpose', 'Statements', 'Deponent signature', 'Verification'],
    languages: ['English'],
    structured: true,
  },
  {
    id: 'divorce-petition',
    typeId: 'divorce-petition',
    name: 'Divorce Petition',
    categories: ['family'],
    icon: 'divorce',
    description: 'Petition setting out marriage particulars, facts, grounds and the relief sought.',
    purpose:
      'Present the facts of the marriage and separation and the relief requested, in a neutral petition structure.',
    sections: [
      'Court',
      'Parties',
      'Marriage',
      'Residence',
      'Separation',
      'Children',
      'Facts and grounds',
      'Jurisdiction',
      'Prayer',
      'Verification',
    ],
    languages: ['English'],
    structured: true,
  },
  {
    id: 'legal-notice',
    typeId: null,
    name: 'Legal Notice',
    categories: ['notices'],
    icon: 'notice',
    description:
      'Formal notice setting out a grievance and the action requested from the addressee.',
    purpose:
      'Put the other party on notice of a grievance and ask for a specific action within a stated time.',
    sections: [
      'Addressee',
      'Subject',
      'Background',
      'Grievance',
      'Demand',
      'Consequence of non-compliance',
      'Sender',
    ],
    languages: ['English'],
    structured: false,
  },
  {
    id: 'employment-agreement',
    typeId: null,
    name: 'Employment Agreement',
    categories: ['business', 'agreements'],
    icon: 'business',
    description:
      'Terms of employment: role, probation, compensation, confidentiality and termination.',
    purpose: 'Record the main terms agreed between an employer and an employee.',
    sections: [
      'Parties',
      'Appointment',
      'Duties',
      'Probation',
      'Compensation',
      'Working hours and leave',
      'Confidentiality',
      'Termination',
      'Governing terms',
      'Signatures',
    ],
    languages: ['English'],
    structured: false,
  },
  {
    id: 'non-disclosure-agreement',
    typeId: null,
    name: 'Non-Disclosure Agreement',
    categories: ['business', 'agreements'],
    icon: 'nda',
    description: 'Mutual agreement to keep shared business information confidential.',
    purpose: 'Protect non-public information shared between two parties for a stated purpose.',
    sections: [
      'Parties',
      'Purpose',
      'Confidential information',
      'Obligations',
      'Exclusions',
      'Term',
      'Return of information',
      'Remedies and governing terms',
      'Signatures',
    ],
    languages: ['English'],
    structured: false,
  },
  {
    id: 'property-sale-agreement',
    typeId: null,
    name: 'Property Agreement (Agreement for Sale)',
    categories: ['property', 'agreements'],
    icon: 'property',
    description:
      'Agreement recording the sale of a property: consideration, title, possession and execution.',
    purpose:
      'Record the terms agreed between a seller and a purchaser before the sale is completed.',
    sections: [
      'Parties',
      'Property',
      'Consideration',
      'Title and documents',
      'Possession',
      'Execution and registration',
      'Default',
      'Signatures and witnesses',
    ],
    languages: ['English'],
    structured: false,
  },
];

/** Shown on every template card and preview. */
export const TEMPLATE_STATUS_LABEL = 'Demo template · v1';
export const TEMPLATE_DISCLAIMER = 'Drafting template — requires review for your specific matter.';
