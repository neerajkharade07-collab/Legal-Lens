/**
 * DEMO comparison versions. The compare flow does not read the selected files;
 * it compares these two fictional versions and says so in the UI. The diff
 * itself (utils/textDiff.js) is real and works on any text.
 */
export const DEMO_COMPARISON = {
  title: 'Sample leave and licence agreement — version 1 vs version 2',
  original: `LEAVE AND LICENCE AGREEMENT
This Leave and Licence Agreement is made at Pune between Mr. Suresh Patil (the Licensor) and Ms. Kavya Nair (the Licensee).
1. PREMISES
The Licensor grants leave and licence of Flat 402, Green Park Society, Baner, Pune to the Licensee.
2. TERM
The licence shall be for a period of 11 months commencing from 1 October 2026.
3. LICENCE FEE
The Licensee shall pay a monthly licence fee of Rs. 20,000 on or before the 5th day of each month.
4. DEPOSIT
The Licensee shall pay a deposit of Rs. 60,000.
5. PETS
The Licensee shall not keep pets in the premises.
6. TERMINATION
Either party may terminate this agreement by giving notice.
7. MAINTENANCE
Society maintenance charges shall be paid by the Licensor.
IN WITNESS WHEREOF the parties have signed this agreement.
LICENSOR ____________________
LICENSEE ____________________`,
  revised: `LEAVE AND LICENCE AGREEMENT
This Leave and Licence Agreement is made at Pune between Mr. Suresh Patil (the Licensor) and Ms. Kavya Nair (the Licensee).
1. PREMISES
The Licensor grants leave and licence of Flat 402, Green Park Society, Baner, Pune, together with one covered parking space, to the Licensee.
2. TERM
The licence shall be for a period of 11 months commencing from 1 October 2026.
3. LICENCE FEE
The Licensee shall pay a monthly licence fee of Rs. 22,000 on or before the 7th day of each month.
4. DEPOSIT
The Licensee shall pay an interest-free refundable deposit of Rs. 1,00,000.
6. TERMINATION
Either party may terminate this agreement by giving one month's written notice.
7. MAINTENANCE
Society maintenance charges shall be paid by the Licensor. Electricity charges shall be paid by the Licensee.
8. LOCK-IN PERIOD
Neither party shall terminate this agreement during the first 6 months, except by mutual consent.
IN WITNESS WHEREOF the parties have signed this agreement.
LICENSOR ____________________
LICENSEE ____________________`,
};
