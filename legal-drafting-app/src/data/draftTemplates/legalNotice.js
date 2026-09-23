/**
 * DEMO drafting template: legal notice. Neutral structure with bracketed
 * placeholders — no statute, period or legal consequence is asserted.
 */
import { doc, p, pJustify, pRight, h1, h2, b, i, blank, LINE } from './builders';

export function buildLegalNotice() {
  return doc(
    h1('Legal Notice'),
    p(b('Date: '), LINE),
    blank(),
    p('To,'),
    p('[Name of the addressee]'),
    p('[Address of the addressee]'),
    blank(),
    pJustify(b('Subject: '), 'Notice regarding [short description of the matter].'),
    blank(),
    p('Sir/Madam,'),
    pJustify(
      'Under instructions from and on behalf of my client, [name of client], residing at [address of client], I hereby serve you with the following notice:',
    ),
    h2('1. Background'),
    pJustify(
      '[Describe the relationship between the parties and the relevant background facts in date order.]',
    ),
    h2('2. Grievance'),
    pJustify(
      '[Describe what the addressee did or failed to do, with dates, amounts and references to documents.]',
    ),
    h2('3. Demand'),
    pJustify(
      'You are hereby called upon to [state the action required] within [number] days of receipt of this notice.',
    ),
    h2('4. Consequence of non-compliance'),
    pJustify(
      'If you fail to comply, my client may take such steps as may be advised, without further reference to you. ',
      i(
        '[Any specific remedy or proceeding to be identified and verified by a qualified legal professional.]',
      ),
    ),
    blank(),
    pJustify('A copy of this notice has been retained in my office for record and further action.'),
    blank(),
    pRight(LINE),
    pRight('[Name of advocate / sender]'),
    pRight('[Address and contact details]'),
  );
}
