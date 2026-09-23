/**
 * Per-document-type configuration for the Draft Setup flow.
 *
 * `checks` lists which kinds of factual detail the description-detail
 * indicator looks for (ids resolve in utils/descriptionAnalysis.js), with
 * document-specific labels. These are writing prompts only — not legal
 * requirements and not an assessment of the matter.
 *
 * All example text is fictional.
 */
export const DRAFT_SETUP_CONFIG = {
  'rental-agreement': {
    placeholder:
      'Describe the property, the landlord and tenant, rent, deposit, start date, duration and any special terms.\n\nExample: I want to rent out my 2 BHK flat in Baner, Pune for 11 months from 1 October 2026. Rent is ₹22,000 per month…',
    sample:
      'I want to rent out my 2 BHK flat at Flat 402, Green Park Society, Baner, Pune to Mr. Arjun Mehta for 11 months starting 1 October 2026. The monthly rent is ₹22,000 and the security deposit is ₹1,00,000, refundable at the end of the term. There should be a 6 month lock-in period and a 1 month notice period. The tenant will pay the electricity bill and society maintenance will be paid by me.',
    checks: [
      { id: 'people', label: 'Landlord and tenant' },
      { id: 'property', label: 'Property details' },
      { id: 'locations', label: 'Address or location' },
      { id: 'amounts', label: 'Rent and deposit' },
      { id: 'dates', label: 'Start date or duration' },
      { id: 'terms', label: 'Notice, lock-in or maintenance' },
    ],
  },
  'fir-complaint': {
    placeholder:
      'Describe what happened, important dates, people involved, amounts, evidence and what document you need.\n\nExample: I made an online payment of ₹25,000 to a person for a product, but after receiving the money they stopped responding…',
    sample:
      'On 12 August 2026 I made an online payment of ₹25,000 through UPI to a person named Rohit Verma, who was selling a used laptop on an online marketplace. After receiving the money he stopped responding to my calls and WhatsApp messages and later blocked my number. I made the payment from my home in Kothrud, Pune. I have screenshots of the listing, our chat and the UPI transaction reference. I want to file a complaint with the police.',
    checks: [
      { id: 'people', label: 'People involved' },
      { id: 'dates', label: 'Dates or times' },
      { id: 'locations', label: 'Location' },
      { id: 'amounts', label: 'Amounts' },
      { id: 'events', label: 'Sequence of events' },
      { id: 'evidence', label: 'Available evidence' },
    ],
  },
  'divorce-petition': {
    placeholder:
      'Describe both parties, when and where you were married, where you live now, whether you have children, when you separated and what you are seeking.\n\nExample: We were married on 14 February 2018 in Nagpur and have been living separately since March 2024…',
    sample:
      'My wife and I were married on 14 February 2018 in Nagpur under Hindu rites. We have been living separately since March 2024 and both of us agree to a divorce by mutual consent. We have one son, aged 5, who lives with me in Pune. We have agreed that I will have custody and that she will have regular visitation. There are no pending financial claims between us.',
    checks: [
      { id: 'people', label: 'Both parties' },
      { id: 'marriage', label: 'Marriage details' },
      { id: 'dates', label: 'Marriage or separation dates' },
      { id: 'locations', label: 'Place of marriage or residence' },
      { id: 'children', label: 'Children (or none)' },
      { id: 'relief', label: 'What you are seeking' },
    ],
  },
  affidavit: {
    placeholder:
      'Describe who is making the statement, what the affidavit is for, the facts to be stated, and the place and date.\n\nExample: I need an affidavit for change of address. I moved from Andheri, Mumbai to Wakad, Pune on 1 June 2026…',
    sample:
      'I, Priya Deshpande, aged 34, working as a software engineer, need an affidavit for change of address to update my bank and PAN records. I moved from Andheri West, Mumbai to Flat 12, Silver Oak Residency, Wakad, Pune on 1 June 2026. I have my new rental agreement and electricity bill as proof of the new address. The affidavit will be signed in Pune.',
    checks: [
      { id: 'people', label: 'Deponent details' },
      { id: 'purpose', label: 'Purpose of affidavit' },
      { id: 'events', label: 'Facts to be stated' },
      { id: 'locations', label: 'Place or address' },
      { id: 'dates', label: 'Relevant dates' },
      { id: 'evidence', label: 'Supporting documents' },
    ],
  },
};

export const MIN_DESCRIPTION_LENGTH = 20;

export function getDraftSetupConfig(typeId) {
  return DRAFT_SETUP_CONFIG[typeId] ?? null;
}
