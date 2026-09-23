/** Suggested research topics per document type (topics only — no content claims). */
export const RESEARCH_TOPICS = {
  'general-document': [
    'Document structure',
    'Execution and signatures',
    'Applicable law',
    'Dispute resolution',
  ],
  'fir-complaint': [
    'Online payment fraud',
    'Electronic evidence',
    'Police complaint procedure',
    'Jurisdiction',
  ],
  'rental-agreement': [
    'Security deposit refund',
    'Lock-in and notice periods',
    'Registration of rental agreements',
    'Landlord entry and inspection',
  ],
  'divorce-petition': [
    'Divorce by mutual consent',
    'Child custody arrangements',
    'Maintenance',
    'Court jurisdiction',
  ],
  affidavit: [
    'Affidavit format',
    'Notarisation and attestation',
    'Change of address declarations',
    'Verification clauses',
  ],
};

export function getResearchTopics(typeId) {
  return RESEARCH_TOPICS[typeId] ?? [];
}
