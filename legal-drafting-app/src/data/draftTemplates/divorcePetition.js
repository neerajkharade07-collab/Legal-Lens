/**
 * DEMO preliminary structure for a divorce petition. Neutral wording; no
 * statute is named — the applicable law is left as a verification placeholder.
 */
import {
  doc,
  p,
  pJustify,
  pCenter,
  pRight,
  h1,
  h2,
  h2Center,
  f,
  b,
  i,
  blank,
  LINE,
} from './builders';

export function buildDivorcePetition() {
  return doc(
    h1('Before the ', f('jurisdiction')),
    pCenter('Petition No. ', LINE),
    blank(),
    p(b('IN THE MATTER OF:')),
    pJustify(f('petitionerName'), ', residing at ', f('petitionerAddress')),
    pRight(b('… Petitioner')),
    pCenter(b('VERSUS')),
    pJustify(f('respondentName'), ', residing at ', f('respondentAddress')),
    pRight(b('… Respondent')),
    blank(),
    h2Center('Petition for dissolution of marriage'),
    p('The Petitioner above named respectfully submits as follows:'),
    h2('1. Marriage'),
    pJustify(
      'The marriage between the Petitioner and the Respondent was solemnised on ',
      f('marriageDate'),
      ' at ',
      f('marriagePlace'),
      '.',
    ),
    h2('2. Residence'),
    pJustify('The Petitioner presently resides at ', f('currentAddress'), '.'),
    h2('3. Separation'),
    pJustify(
      'The Petitioner and the Respondent have been living separately since ',
      f('separationDate'),
      '.',
    ),
    h2('4. Children'),
    pJustify(f('childrenDetails')),
    h2('5. Facts and grounds'),
    pJustify(f('caseContext')),
    h2('6. Additional facts'),
    pJustify(f('additionalFacts')),
    h2('7. Jurisdiction'),
    pJustify(
      'The Petitioner submits that this Court has jurisdiction to entertain and try this petition. ',
      i('[Basis of jurisdiction to be stated and verified.]'),
    ),
    h2('8. Applicable law'),
    pJustify(
      i(
        '[The enactment and provisions under which this petition is filed are to be identified and verified by a qualified legal professional.]',
      ),
    ),
    h2('Prayer'),
    pJustify(
      'In view of the facts stated above, the Petitioner respectfully prays that this Court may be pleased to grant the following relief: ',
      f('reliefRequested'),
      '; and pass such other and further orders as this Court may deem fit in the interest of justice.',
    ),
    blank(),
    p(b('Place: '), LINE),
    p(b('Date: '), LINE),
    pRight(LINE),
    pRight('Petitioner'),
    pRight(f('petitionerName')),
    blank(),
    h2('Verification'),
    pJustify(
      'I, ',
      f('petitionerName'),
      ', the Petitioner above named, do hereby verify that the contents of the above petition are true and correct to the best of my knowledge and belief, and that nothing material has been concealed.',
    ),
    pJustify('Verified at ', LINE, ' on ', LINE, '.'),
    pRight(LINE),
    pRight('Petitioner'),
  );
}
