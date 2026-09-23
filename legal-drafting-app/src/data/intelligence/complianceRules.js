/**
 * DEMO compliance review rules per document type.
 *
 * These look only at document STRUCTURE and whether facts have been filled
 * in. They never decide that a law applies or is satisfied. Every statutory
 * item is returned with status 'verify' and wording such as
 * "Relevant provision — to be verified". No section numbers are used.
 *
 * status: 'present' | 'review' | 'missing' | 'verify'
 * Future: replaced by the BNS/BNSS Compliance API returning the same shape.
 */
import { hasHeading, snapshotMentions } from '../../utils/documentSnapshot';

const filled = (s, key) => Boolean(s.fieldMap[key]?.filled);
const fieldItem = (id, label, s, keys, { presentDetail, missingDetail } = {}) => {
  // Reviewed/imported documents have no field tokens: ask the user to check the text instead.
  if (!keys.some((k) => s.presentKeys.has(k))) {
    return {
      id,
      label,
      status: 'review',
      detail: 'Not linked to case details — check this in the document text.',
      location: null,
    };
  }
  const done = keys.filter((k) => filled(s, k));
  const status = done.length === keys.length ? 'present' : done.length === 0 ? 'missing' : 'review';
  const firstMissing = keys.find((k) => !filled(s, k));
  return {
    id,
    label,
    status,
    detail:
      status === 'present'
        ? (presentDetail ?? 'Provided in case details.')
        : (missingDetail ??
          `Not yet provided: ${keys
            .filter((k) => !filled(s, k))
            .map((k) => s.fieldMap[k]?.longLabel ?? k)
            .join(', ')}.`),
    location: firstMissing ? { kind: 'field', key: firstMissing } : { kind: 'token', key: keys[0] },
  };
};
const textItem = (id, label, s, phrases, presentDetail, absentDetail, status = 'review') => ({
  id,
  label,
  status: snapshotMentions(s, phrases) ? 'present' : status,
  detail: snapshotMentions(s, phrases) ? presentDetail : absentDetail,
  location: { kind: 'text', text: phrases[0] },
});
const blanksItem = (s) => {
  const blank = s.text.includes('____');
  return {
    id: 'execution-blanks',
    label: 'Signature, place and date lines',
    status: blank ? 'review' : 'present',
    detail: blank
      ? 'Blank lines remain for signature, place or date. Complete them before use.'
      : 'No blank lines detected.',
    location: blank ? { kind: 'text', text: '____' } : null,
  };
};
const verifyItem = (id, label, detail) => ({ id, label, status: 'verify', detail, location: null });

const FIR = {
  framework: { id: 'bns-bnss', title: 'BNS / BNSS review' },
  sections: (s) => [
    {
      id: 'structure',
      title: 'Document structure',
      items: [
        fieldItem('addressee', 'Addressed to the police station', s, [
          'policeStationName',
          'policeStationAddress',
        ]),
        textItem(
          'subject',
          'Subject line',
          s,
          ['Subject:'],
          'A subject line is present.',
          'No subject line found.',
        ),
        textItem(
          'signature',
          'Complainant signature block',
          s,
          ['Signature of the Complainant'],
          'A signature block is present.',
          'No signature block found.',
        ),
      ],
    },
    {
      id: 'facts',
      title: 'Required factual details',
      items: [
        fieldItem('incident', 'Incident details', s, ['incidentDate', 'incidentLocation']),
        fieldItem('complainant', 'Complainant information', s, [
          'complainantName',
          'complainantAddress',
        ]),
        fieldItem('accused', 'Opposite party details', s, ['accusedName']),
        (() => {
          const words =
            s.fieldMap.incidentDescription?.raw?.trim().split(/\s+/).filter(Boolean).length ?? 0;
          return {
            id: 'narrative',
            label: 'Facts of the complaint',
            status: words >= 30 ? 'present' : words === 0 ? 'missing' : 'review',
            detail:
              words >= 30
                ? `Narrative provided (${words} words).`
                : 'The narrative is short or missing. Describe what happened in sequence.',
            location: { kind: 'field', key: 'incidentDescription' },
          };
        })(),
        {
          id: 'evidence',
          label: 'Evidence information',
          status: filled(s, 'evidenceAvailable') ? 'review' : 'missing',
          detail: filled(s, 'evidenceAvailable')
            ? 'Evidence is listed. Check that each item can be produced when asked.'
            : 'No evidence has been listed.',
          location: { kind: 'field', key: 'evidenceAvailable' },
        },
      ],
    },
    {
      id: 'procedure',
      title: 'Procedural references',
      items: [
        textItem(
          'request',
          'Request for action',
          s,
          ['register my complaint'],
          'The complaint asks for registration and action.',
          'No request for action found.',
        ),
        textItem(
          'ack',
          'Copy / acknowledgement requested',
          s,
          ['acknowledgement'],
          'The complaint asks for a copy or acknowledgement.',
          'Consider asking for a copy or acknowledgement.',
        ),
      ],
    },
    {
      id: 'statutory',
      title: 'Potential statutory references',
      items: [
        s.setup?.useBnsFramework
          ? {
              id: 'framework',
              label: 'BNS / BNSS framework paragraph',
              status: snapshotMentions(s, ['Bharatiya Nyaya Sanhita']) ? 'verify' : 'review',
              detail: snapshotMentions(s, ['Bharatiya Nyaya Sanhita'])
                ? 'The framework is named in the draft. Whether and how it applies is not checked in this demo.'
                : 'Requested in setup but not found in the draft text.',
              location: { kind: 'text', text: 'Bharatiya Nyaya Sanhita' },
            }
          : {
              id: 'framework',
              label: 'BNS / BNSS framework',
              status: 'review',
              detail:
                'Not requested during setup. A legal professional can advise whether to reference it.',
              location: null,
            },
        verifyItem(
          'provision-1',
          'Relevant provision — to be verified',
          'No provision is suggested in demo mode. Provisions will come from a verified source.',
        ),
        verifyItem(
          'provision-2',
          'Possible statutory reference — verification required',
          'Placeholder for a future verified reference.',
        ),
      ],
    },
  ],
};

const general = (keyTerms) => ({
  framework: { id: 'general', title: 'General legal review' },
  sections: (s) =>
    [
      { id: 'parties', title: 'Parties and identification', items: keyTerms.parties(s) },
      { id: 'terms', title: 'Key terms', items: keyTerms.terms(s) },
      {
        id: 'execution',
        title: 'Execution formalities',
        items: [
          blanksItem(s),
          verifyItem(
            'execution-rules',
            'Signing, witnessing or attestation requirements',
            'Requirements depend on use and jurisdiction — to be verified.',
          ),
        ],
      },
      {
        id: 'law',
        title: 'Applicable law',
        items: [
          verifyItem(
            'law',
            'Relevant provision — to be verified',
            'No law or provision is identified in demo mode.',
          ),
        ],
      },
    ].filter((section) => section.items.length > 0),
});

const RULES = {
  'fir-complaint': FIR,
  'general-document': general({ parties: () => [], terms: () => [] }),
  'rental-agreement': general({
    parties: (s) => [
      fieldItem('landlord', 'Landlord details', s, ['landlordName', 'landlordAddress']),
      fieldItem('tenant', 'Tenant details', s, ['tenantName', 'tenantAddress']),
      fieldItem('premises', 'Premises description', s, ['propertyAddress', 'propertyType']),
    ],
    terms: (s) => [
      fieldItem('rent', 'Rent and deposit', s, ['monthlyRent', 'securityDeposit']),
      fieldItem('term', 'Term and start date', s, ['startDate', 'duration']),
      fieldItem('exit', 'Lock-in and notice', s, ['lockInPeriod', 'noticePeriod']),
      {
        id: 'dispute',
        label: 'Dispute resolution',
        status: hasHeading(s, ['dispute']) ? 'review' : 'missing',
        detail: hasHeading(s, ['dispute'])
          ? 'A section exists — check that terms have been agreed.'
          : 'No dispute resolution section found.',
        location: { kind: 'text', text: 'Dispute resolution' },
      },
    ],
  }),
  'divorce-petition': general({
    parties: (s) => [
      fieldItem('petitioner', 'Petitioner details', s, ['petitionerName', 'petitionerAddress']),
      fieldItem('respondent', 'Respondent details', s, ['respondentName', 'respondentAddress']),
    ],
    terms: (s) => [
      fieldItem('marriage', 'Marriage particulars', s, ['marriageDate', 'marriagePlace']),
      fieldItem('separation', 'Separation', s, ['separationDate']),
      fieldItem('children', 'Children', s, ['childrenDetails'], {
        missingDetail: 'Children details not stated. State “none” if applicable.',
      }),
      fieldItem('relief', 'Relief sought', s, ['reliefRequested']),
      fieldItem('court', 'Court / jurisdiction', s, ['jurisdiction']),
    ],
  }),
  affidavit: general({
    parties: (s) => [
      fieldItem('deponent', 'Deponent details', s, [
        'deponentName',
        'deponentAge',
        'deponentAddress',
      ]),
    ],
    terms: (s) => [
      fieldItem('purpose', 'Purpose', s, ['affidavitPurpose']),
      fieldItem('statement', 'Statement of facts', s, ['statementFacts']),
      fieldItem('verification', 'Verification place and date', s, ['place', 'date']),
    ],
  }),
};

export function getComplianceRules(typeId) {
  return RULES[typeId] ?? null;
}
