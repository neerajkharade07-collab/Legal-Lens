/** DEMO preliminary structure for an affidavit. Not an authoritative legal document. */
import { doc, p, pJustify, pRight, h1, h2, f, i, blank, LINE } from './builders';

export function buildAffidavit() {
  return doc(
    h1('Affidavit'),
    pJustify(
      'I, ',
      f('deponentName'),
      ', aged ',
      f('deponentAge'),
      ' years, son/daughter/spouse of ',
      f('deponentRelation'),
      ', by occupation ',
      f('deponentOccupation'),
      ', residing at ',
      f('deponentAddress'),
      ', do hereby solemnly affirm and declare as under:',
    ),
    pJustify(
      '1. That I am the deponent herein and am fully conversant with the facts stated below.',
    ),
    pJustify('2. That this affidavit is made for the purpose of ', f('affidavitPurpose'), '.'),
    pJustify('3. That ', f('statementFacts')),
    pJustify(
      '4. That the statements made above are true and correct to the best of my knowledge and belief, and nothing material has been concealed therefrom.',
    ),
    blank(),
    pRight(LINE),
    pRight('Deponent'),
    pRight(f('deponentName')),
    blank(),
    h2('Verification'),
    pJustify(
      'Verified at ',
      f('place'),
      ' on ',
      f('date'),
      ' that the contents of the above affidavit are true and correct to the best of my knowledge and belief. ',
      f('verificationDetails'),
    ),
    blank(),
    pRight(LINE),
    pRight('Deponent'),
    blank(),
    p(i('[Attestation / notarisation details, if required, to be added.]')),
  );
}
