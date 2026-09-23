/**
 * DEMO preliminary structure for an FIR / police complaint.
 * Not an authoritative legal document. No provisions are cited; where the user
 * asked for the BNS/BNSS framework, a clearly marked placeholder is inserted.
 */
import { doc, p, pJustify, pRight, h1, h2, ul, f, b, i, blank, LINE } from './builders';

export function buildFirComplaint({ setup } = {}) {
  const frameworkSection = setup?.useBnsFramework
    ? [
        h2('6. Applicable legal framework'),
        pJustify(
          'The complainant requests that the matter be examined under the applicable provisions of the Bharatiya Nyaya Sanhita, 2023 and dealt with in accordance with the procedure under the Bharatiya Nagarik Suraksha Sanhita, 2023.',
        ),
        p(
          i(
            '[Specific provisions to be identified and verified by a qualified legal professional.]',
          ),
        ),
      ]
    : [];
  const requestNumber = setup?.useBnsFramework ? '7' : '6';

  return doc(
    p('To,'),
    p('The Station House Officer,'),
    p(f('policeStationName')),
    p(f('policeStationAddress')),
    blank(),
    h1('Complaint'),
    pJustify(
      b('Subject: '),
      'Complaint regarding an incident on ',
      f('incidentDate'),
      ' involving ',
      f('accusedName'),
      '.',
    ),
    blank(),
    p('Respected Sir/Madam,'),
    h2('1. Complainant details'),
    pJustify(
      'I, ',
      f('complainantName'),
      ', son/daughter of ',
      f('complainantParentName'),
      ', aged ',
      f('complainantAge'),
      ' years, residing at ',
      f('complainantAddress'),
      ' (phone: ',
      f('complainantPhone'),
      '; email: ',
      f('complainantEmail'),
      '), respectfully submit this complaint for your kind consideration.',
    ),
    h2('2. Details of the opposite party'),
    ul(
      ['Name / entity: ', f('accusedName')],
      ['Address: ', f('accusedAddress')],
      ['Contact information: ', f('accusedContact')],
      ['Online profile / identifier: ', f('accusedOnlineId')],
    ),
    h2('3. Incident information'),
    ul(
      ['Date of incident: ', f('incidentDate')],
      ['Time of incident: ', f('incidentTime')],
      ['Place of incident: ', f('incidentLocation')],
      ['Amount involved: ', f('amountInvolved')],
      ['Mode of payment: ', f('paymentMethod')],
    ),
    h2('4. Facts of the complaint'),
    pJustify(f('incidentDescription')),
    pJustify(f('additionalInformation')),
    h2('5. Evidence available'),
    pJustify(f('evidenceAvailable')),
    pJustify(
      'I am willing to produce the above material and to cooperate with the investigation as and when required.',
    ),
    ...frameworkSection,
    h2(`${requestNumber}. Request`),
    pJustify(
      'In view of the above, I request you to kindly register my complaint, inquire into the matter and take appropriate action in accordance with law. I also request that a copy of the complaint / acknowledgement be provided to me.',
    ),
    blank(),
    p('Thanking you,'),
    p('Yours faithfully,'),
    blank(),
    pRight(LINE),
    pRight('Signature of the Complainant'),
    pRight(f('complainantName')),
    blank(),
    p(b('Place: '), LINE),
    p(b('Date: '), LINE),
  );
}
