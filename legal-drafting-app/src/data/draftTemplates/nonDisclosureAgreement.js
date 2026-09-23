/** DEMO drafting template: mutual non-disclosure agreement (neutral structure, placeholders only). */
import { doc, p, pJustify, pCenter, h1, h2, ul, b, i, blank, LINE } from './builders';

export function buildNonDisclosureAgreement() {
  return doc(
    h1('Non-Disclosure Agreement'),
    pJustify('This Non-Disclosure Agreement (the “Agreement”) is made on [date].'),
    pCenter(b('BETWEEN')),
    pJustify('[Name of first party], [address] (the “First Party”);'),
    pCenter(b('AND')),
    pJustify('[Name of second party], [address] (the “Second Party”).'),
    h2('1. Purpose'),
    pJustify(
      'The parties wish to share information for the purpose of [describe the purpose] (the “Purpose”).',
    ),
    h2('2. Confidential Information'),
    pJustify(
      '“Confidential Information” means any non-public information disclosed by one party to the other in connection with the Purpose, whether written, oral or electronic, including [examples].',
    ),
    h2('3. Obligations'),
    ul(
      'Use Confidential Information only for the Purpose.',
      'Not disclose it to any third party without prior written consent.',
      'Protect it with at least reasonable care.',
    ),
    h2('4. Exclusions'),
    pJustify(
      'These obligations do not apply to information that is publicly available, already known to the recipient, independently developed, or required to be disclosed by law.',
    ),
    h2('5. Term'),
    pJustify(
      'This Agreement remains in force for [period] from the date above, and the confidentiality obligations continue for [period] thereafter.',
    ),
    h2('6. Return of information'),
    pJustify(
      'On request, each party shall return or destroy the other party’s Confidential Information.',
    ),
    h2('7. Remedies and governing terms'),
    pJustify(
      i('[Remedies, governing law and dispute resolution terms to be agreed and verified.]'),
    ),
    blank(),
    p(b('First Party'), '  ', LINE),
    p(b('Second Party'), '  ', LINE),
  );
}
