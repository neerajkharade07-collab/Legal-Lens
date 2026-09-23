/**
 * DEMO reference placeholders per document type. These are deliberately NOT
 * real citations: no case names, section numbers, court decisions or URLs.
 * `match` phrases detect whether the placeholder is used in the draft.
 * Future: replaced by the Citation Verification API.
 */
import { p, i } from '../draftTemplates/builders';

const sampleAuthority = {
  id: 'sample-authority',
  title: 'Sample legal authority — not a real citation',
  type: 'Case law placeholder',
  match: ['Sample legal authority'],
  insert: [
    p(i('[Sample legal authority — not a real citation. Replace with a verified authority.]')),
  ],
};

export const CITATION_CATALOG = {
  'fir-complaint': [
    {
      id: 'bns',
      title: 'Relevant provision — Bharatiya Nyaya Sanhita, 2023 (section to be verified)',
      type: 'Statutory reference',
      match: ['Bharatiya Nyaya Sanhita'],
      insert: [
        p(
          i(
            '[Relevant provision — Bharatiya Nyaya Sanhita, 2023; section to be identified and verified.]',
          ),
        ),
      ],
    },
    {
      id: 'bnss',
      title: 'Procedure — Bharatiya Nagarik Suraksha Sanhita, 2023 (provision to be verified)',
      type: 'Procedural reference',
      match: ['Bharatiya Nagarik Suraksha Sanhita'],
      insert: [
        p(
          i(
            '[Relevant procedural provision — Bharatiya Nagarik Suraksha Sanhita, 2023; to be identified and verified.]',
          ),
        ),
      ],
    },
    sampleAuthority,
  ],
  'rental-agreement': [
    {
      id: 'tenancy-law',
      title: 'Relevant provision — applicable rent / tenancy law (to be identified and verified)',
      type: 'Statutory reference',
      match: ['tenancy law'],
      insert: [
        p(
          i('[Relevant provision — applicable rent / tenancy law; to be identified and verified.]'),
        ),
      ],
    },
    sampleAuthority,
  ],
  'divorce-petition': [
    {
      id: 'personal-law',
      title: 'Applicable law — enactment and provision to be identified and verified',
      type: 'Statutory reference',
      match: ['enactment and provisions under which'],
      insert: [p(i('[Applicable enactment and provision — to be identified and verified.]'))],
    },
    sampleAuthority,
  ],
  affidavit: [
    {
      id: 'affidavit-rules',
      title: 'Relevant rule on affidavits — source verification required',
      type: 'Rule reference',
      match: ['rule on affidavits'],
      insert: [p(i('[Relevant rule on affidavits — source verification required.]'))],
    },
    sampleAuthority,
  ],
};

export function getCitationCatalog(typeId) {
  return CITATION_CATALOG[typeId] ?? [sampleAuthority];
}
