/**
 * DEMO drafting template: agreement for sale of property. Neutral structure;
 * stamp duty / registration requirements are left as verification notes.
 */
import { doc, p, pJustify, pCenter, h1, h2, ol, b, i, blank, LINE } from './builders';

export function buildPropertyAgreement() {
  return doc(
    h1('Agreement for Sale'),
    pJustify('This Agreement for Sale is made at [place] on [date].'),
    pCenter(b('BETWEEN')),
    pJustify('[Name of seller], residing at [address] (the “Seller”);'),
    pCenter(b('AND')),
    pJustify('[Name of purchaser], residing at [address] (the “Purchaser”).'),
    h2('1. Property'),
    pJustify(
      'The Seller agrees to sell, and the Purchaser agrees to purchase, the property described as [description, survey / flat number, area and address] (the “Property”).',
    ),
    h2('2. Consideration'),
    pJustify('The total consideration is [amount], payable as follows:'),
    ol('[Amount] on signing of this Agreement.', '[Amount] on or before [date / event].'),
    h2('3. Title and documents'),
    pJustify(
      'The Seller states that the Property is free from encumbrances except [details, if any], and shall provide copies of [list of title documents].',
    ),
    h2('4. Possession'),
    pJustify(
      'Possession shall be handed over on [date / event], subject to payment of the full consideration.',
    ),
    h2('5. Execution and registration'),
    pJustify(
      i(
        '[Stamp duty, registration and other execution requirements to be identified and verified. Responsibility for costs: to be agreed.]',
      ),
    ),
    h2('6. Default'),
    pJustify('[Consequences if either party fails to perform, to be agreed by the parties.]'),
    blank(),
    p(b('Seller'), '  ', LINE),
    p(b('Purchaser'), '  ', LINE),
    blank(),
    p(b('WITNESSES')),
    p('1. ', LINE),
    p('2. ', LINE),
  );
}
