/** DEMO drafting template: employment agreement (neutral structure, placeholders only). */
import { doc, p, pJustify, pCenter, h1, h2, b, i, blank, LINE } from './builders';

export function buildEmploymentAgreement() {
  return doc(
    h1('Employment Agreement'),
    pJustify('This Employment Agreement (the “Agreement”) is made at [place] on [date].'),
    pCenter(b('BETWEEN')),
    pJustify('[Name of employer], having its office at [address] (the “Employer”);'),
    pCenter(b('AND')),
    pJustify('[Name of employee], residing at [address] (the “Employee”).'),
    h2('1. Appointment'),
    pJustify(
      'The Employer appoints the Employee as [designation] with effect from [joining date].',
    ),
    h2('2. Duties'),
    pJustify(
      'The Employee shall perform the duties described in [Annexure A / job description] and such other reasonable duties as may be assigned.',
    ),
    h2('3. Probation'),
    pJustify(
      'The Employee shall be on probation for [period], after which the appointment may be confirmed in writing.',
    ),
    h2('4. Compensation'),
    pJustify(
      'The Employee shall receive a gross monthly salary of [amount], payable on or before [day] of each month, subject to applicable deductions.',
    ),
    h2('5. Working hours and leave'),
    pJustify('[Working hours, weekly off and leave entitlement to be stated.]'),
    h2('6. Confidentiality'),
    pJustify(
      'The Employee shall keep confidential all non-public information of the Employer during and after employment, except as required by law.',
    ),
    h2('7. Termination'),
    pJustify(
      'Either party may terminate this Agreement by giving [notice period] written notice, or salary in lieu of notice where agreed.',
    ),
    h2('8. Governing terms'),
    pJustify(
      i(
        '[Governing law, applicable employment rules and dispute resolution terms to be identified and verified.]',
      ),
    ),
    blank(),
    p(b('For the Employer'), '  ', LINE),
    p(b('Employee'), '  ', LINE),
  );
}
