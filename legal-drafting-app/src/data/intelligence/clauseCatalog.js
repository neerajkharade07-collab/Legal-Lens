/**
 * DEMO clause suggestions per document type.
 * Neutral sample wording with bracketed placeholders — no statutory claims,
 * no legal requirements asserted. `detect` phrases decide whether a similar
 * section already appears in the draft; `insertBefore` names the block the
 * clause is inserted in front of (falls back to the end of the document).
 * Future: replaced by the Missing Clause API.
 */
import { h2, p, pJustify, ol, ul, i, f } from '../draftTemplates/builders';

export const CLAUSE_CATALOG = {
  'fir-complaint': [
    {
      id: 'fir-annexures',
      name: 'Evidence / annexure reference',
      why: 'Listing each document you will attach makes it easier to refer to specific items of evidence.',
      priority: 'high',
      detect: ['annexure', 'list of documents', 'enclosure'],
      insertBefore: ['Thanking you'],
      content: [
        h2('List of documents / annexures'),
        p('The following documents are enclosed with this complaint:'),
        ol('[Annexure A — description of document]', '[Annexure B — description of document]'),
      ],
    },
    {
      id: 'fir-jurisdiction',
      name: 'Jurisdiction',
      why: 'States why the complaint is being made to this police station, for example where the incident took place.',
      priority: 'medium',
      detect: ['jurisdiction'],
      insertBefore: ['Thanking you'],
      content: [
        h2('Jurisdiction'),
        pJustify(
          'The incident described above took place at ',
          f('incidentLocation'),
          ', which, to the best of my knowledge, falls within the area of this police station. ',
          i('[Confirm the correct police station for the place of incident.]'),
        ),
      ],
    },
    {
      id: 'fir-declaration',
      name: 'Declaration',
      why: 'A short statement that the facts are true to the best of the complainant’s knowledge is commonly included.',
      priority: 'medium',
      detect: ['i declare', 'declaration'],
      insertBefore: ['Thanking you'],
      content: [
        h2('Declaration'),
        pJustify(
          'I declare that the facts stated in this complaint are true and correct to the best of my knowledge and belief.',
        ),
      ],
    },
    {
      id: 'fir-chronology',
      name: 'Chronology of events',
      why: 'A dated sequence helps the reader follow what happened and when.',
      priority: 'low',
      detect: ['chronology', 'timeline'],
      insertBefore: ['5. Evidence available', 'Evidence available'],
      content: [h2('Chronology of events'), ul('[Date] — [event]', '[Date] — [event]')],
    },
  ],

  'rental-agreement': [
    {
      id: 'rent-dispute',
      name: 'Dispute resolution',
      why: 'Sets out how the parties will try to resolve disagreements before escalating them.',
      priority: 'medium',
      detect: ['dispute'],
      insertBefore: ['IN WITNESS WHEREOF'],
      content: [
        h2('Dispute resolution'),
        pJustify(i('[Dispute resolution terms, if any, to be agreed by the Parties.]')),
      ],
    },
    {
      id: 'rent-inspection',
      name: 'Inspection and entry',
      why: 'Clarifies when the landlord may visit the premises and how much notice is given.',
      priority: 'medium',
      detect: ['inspect', 'entry'],
      insertBefore: ['IN WITNESS WHEREOF'],
      content: [
        h2('Inspection and entry'),
        pJustify(
          'The Landlord may inspect the Premises at a reasonable time after giving the Tenant ',
          i('[notice, e.g. 24 hours]'),
          ' prior notice.',
        ),
      ],
    },
    {
      id: 'rent-alterations',
      name: 'Repairs and alterations',
      why: 'Separates day-to-day repairs from structural changes, which usually need consent.',
      priority: 'medium',
      detect: ['alteration', 'repairs'],
      insertBefore: ['IN WITNESS WHEREOF'],
      content: [
        h2('Repairs and alterations'),
        pJustify(
          'The Tenant shall not make structural alterations to the Premises without the Landlord’s prior written consent. ',
          i('[Responsibility for major and minor repairs to be agreed.]'),
        ),
      ],
    },
    {
      id: 'rent-handover',
      name: 'Handover and inventory',
      why: 'Records what is provided with the premises so its condition can be compared at the end.',
      priority: 'low',
      detect: ['inventory', 'fixtures and fittings'],
      insertBefore: ['IN WITNESS WHEREOF'],
      content: [
        h2('Handover and inventory'),
        pJustify(
          'A list of fixtures and fittings provided with the Premises is attached as ',
          i('[Annexure A]'),
          '. The Tenant shall return them in the same condition, subject to normal wear and tear.',
        ),
      ],
    },
    {
      id: 'rent-stamp',
      name: 'Stamp duty and registration costs',
      why: 'Records which party bears execution costs. Whether registration is needed should be checked separately.',
      priority: 'low',
      detect: ['stamp duty', 'registration'],
      insertBefore: ['IN WITNESS WHEREOF'],
      content: [
        h2('Stamp duty and registration costs'),
        pJustify(
          i(
            '[Responsibility for stamp duty and registration charges, if applicable, to be agreed between the Parties. Requirements to be verified.]',
          ),
        ),
      ],
    },
  ],

  'divorce-petition': [
    {
      id: 'div-proceedings',
      name: 'Previous proceedings',
      why: 'Petitions commonly state whether any other proceedings between the parties exist.',
      priority: 'high',
      detect: ['previous proceedings', 'pending proceedings', 'other proceedings'],
      insertBefore: ['Prayer'],
      content: [
        h2('Previous proceedings'),
        pJustify(
          i(
            '[Details of any previous or pending proceedings between the Parties, or a statement that there are none.]',
          ),
        ),
      ],
    },
    {
      id: 'div-jurisdiction',
      name: 'Jurisdiction',
      why: 'Explains why this court is the appropriate court to hear the petition.',
      priority: 'high',
      detect: ['jurisdiction'],
      insertBefore: ['Prayer'],
      content: [
        h2('Jurisdiction'),
        pJustify(i('[Basis on which this Court has jurisdiction — to be stated and verified.]')),
      ],
    },
    {
      id: 'div-settlement',
      name: 'Settlement or mediation efforts',
      why: 'Records any attempts at reconciliation or settlement, where relevant.',
      priority: 'medium',
      detect: ['mediation', 'reconciliation', 'settlement'],
      insertBefore: ['Prayer'],
      content: [
        h2('Settlement or mediation efforts'),
        pJustify(
          i('[Details of any attempts at reconciliation, mediation or settlement, if applicable.]'),
        ),
      ],
    },
    {
      id: 'div-documents',
      name: 'List of documents',
      why: 'Identifies the documents relied on so they can be referred to consistently.',
      priority: 'low',
      detect: ['list of documents', 'annexure'],
      insertBefore: ['Prayer'],
      content: [
        h2('List of documents'),
        ol('[Proof of marriage, if available]', '[Other documents relied upon]'),
      ],
    },
  ],

  affidavit: [
    {
      id: 'aff-identity',
      name: 'Identity details',
      why: 'Many recipients expect the deponent’s identity document to be referred to.',
      priority: 'medium',
      detect: ['identity document', 'identity'],
      insertBefore: ['4. That the statements'],
      content: [
        pJustify(
          '[ ]. That my identity is established by ',
          i('[type of identity document]'),
          ', a copy of which is annexed as ',
          i('[Annexure A]'),
          '.',
        ),
      ],
    },
    {
      id: 'aff-undertaking',
      name: 'Undertaking to produce originals',
      why: 'Confirms that original documents can be shown if requested.',
      priority: 'low',
      detect: ['undertake'],
      insertBefore: ['4. That the statements'],
      content: [
        pJustify(
          '[ ]. That I undertake to produce the original documents referred to above, if required.',
        ),
      ],
    },
    {
      id: 'aff-affirmation',
      name: 'Solemn affirmation',
      why: 'The opening affirmation identifies the statement as made on oath or affirmation.',
      priority: 'high',
      detect: ['solemnly affirm'],
      insertBefore: ['1. That I am'],
      content: [pJustify('I do hereby solemnly affirm and declare as under:')],
    },
    {
      id: 'aff-annexures',
      name: 'Annexures',
      why: 'Lists documents attached to the affidavit so each can be identified.',
      priority: 'low',
      detect: ['annexure'],
      insertBefore: ['Verification'],
      content: [h2('Annexures'), ol('[Annexure A — description]')],
    },
  ],
};

CLAUSE_CATALOG['general-document'] = [
  {
    id: 'gen-signature',
    name: 'Signature block',
    why: 'A clear place for each party to sign, with names printed below.',
    priority: 'medium',
    detect: ['signature', 'signed by'],
    insertBefore: [],
    content: [
      h2('Signatures'),
      p('[Name of party] — signature: ____________________'),
      p('[Name of party] — signature: ____________________'),
    ],
  },
  {
    id: 'gen-place-date',
    name: 'Place and date',
    why: 'Records where and when the document was signed.',
    priority: 'low',
    detect: ['place:', 'date:', 'dated'],
    insertBefore: [],
    content: [p('Place: ____________________'), p('Date: ____________________')],
  },
];

export function getClauseCatalog(typeId) {
  return CLAUSE_CATALOG[typeId] ?? [];
}
