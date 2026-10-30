/**
 * Legal Drafting Phase 4 — insertable layout blocks (party identification, date & place,
 * signature). They are neutral layout scaffolds with bracketed placeholders for the user to fill
 * in; they do not state any legal requirement (e.g. whether witnesses or a notary are needed —
 * the user must check that for the document and jurisdiction). The finalization checklist flags
 * any placeholder left unfilled. English wording only.
 */

const p = (text, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: text ? [{ type: 'text', text }] : [] });
const bold = (text, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), content: [{ type: 'text', text, marks: [{ type: 'bold' }] }] });

export const LEGAL_BLOCKS = [
  {
    id: 'parties',
    label: 'Parties section',
    description: 'Names, parentage, age and address of two parties',
    content: () => [
      bold('BETWEEN', { textAlign: 'center' }),
      p('[NAME OF FIRST PARTY], son / daughter / wife of [NAME], aged about [AGE] years, residing at [ADDRESS] (hereinafter referred to as the "[FIRST PARTY ROLE]"),'),
      bold('AND', { textAlign: 'center' }),
      p('[NAME OF SECOND PARTY], son / daughter / wife of [NAME], aged about [AGE] years, residing at [ADDRESS] (hereinafter referred to as the "[SECOND PARTY ROLE]").'),
      p(''),
    ],
  },
  {
    id: 'date-place',
    label: 'Date and place',
    description: 'Date and place lines',
    content: () => [p('Place: [PLACE]'), p('Date: [DATE]'), p('')],
  },
  {
    id: 'signature',
    label: 'Signature block',
    description: 'Signature, name and date line for one signatory',
    content: () => [
      p(''),
      p('Signature: ______________________', { textAlign: 'right' }),
      p('Name: [NAME]', { textAlign: 'right' }),
      p('Date: [DATE]', { textAlign: 'right' }),
      p(''),
    ],
  },
  {
    id: 'two-signatures',
    label: 'Signatures of both parties',
    description: 'Signature lines for two parties',
    content: () => [
      p(''),
      p('[FIRST PARTY ROLE]'),
      p('Signature: ______________________'),
      p('Name: [NAME]'),
      p(''),
      p('[SECOND PARTY ROLE]'),
      p('Signature: ______________________'),
      p('Name: [NAME]'),
      p(''),
    ],
  },
];

export function legalBlockContent(id) {
  return LEGAL_BLOCKS.find((b) => b.id === id)?.content() ?? null;
}
