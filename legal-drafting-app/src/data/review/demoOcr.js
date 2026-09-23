/**
 * DEMO extraction / OCR text. This is NOT read from the user's file — it is
 * fictional sample text chosen by file name and language, labelled as such in
 * the UI. Samples deliberately contain structural issues (placeholders, blank
 * signature lines, mixed date formats) so the demo review has something to show.
 */

export const DEMO_EXTRACTION_SAMPLES = {
  'rental-agreement': {
    id: 'sample-rental',
    title: 'Sample leave and licence agreement',
    text: `LEAVE AND LICENCE AGREEMENT
This Leave and Licence Agreement is made at Pune on 01/10/2026 between:
Mr. Suresh Patil, residing at Flat 7, Lakeview Society, Aundh, Pune, hereinafter called the Licensor;
AND
Ms. Kavya Nair, residing at [TENANT ADDRESS], hereinafter called the Licensee.
1. PREMISES
The Licensor agrees to grant leave and licence of the premises at Flat 402, Green Park Society, Baner, Pune to the Licensee.
2. TERM
The licence shall be for a period of 11 months commencing from 1 October 2026.
3. LICENCE FEE
The Licensee shall pay a monthly licence fee of Rs. 22,000 on or before the 5th day of each month.
4. DEPOSIT
The Licensee shall pay an interest-free refundable deposit of Rs. 1,00,000.
5. TERMINATION
Either party may terminate this agreement by giving notice.
6. MAINTENANCE
Society maintenance charges shall be paid by the Licensor. Electricity charges shall be paid by the Licensee as per actual consumption etc.
IN WITNESS WHEREOF the parties have signed this agreement on the date mentioned above.
LICENSOR ____________________
LICENSEE ____________________
WITNESSES
1. ____________________
2. ____________________`,
  },
  'fir-complaint': {
    id: 'sample-complaint',
    title: 'Sample police complaint',
    text: `To,
The Station House Officer,
Kothrud Police Station, Pune
Subject: Complaint regarding online payment fraud
Respected Sir/Madam,
I, Anil Joshi, residing at ____________________, wish to report that on 12/08/2026 I paid Rs. 25,000 through UPI to a seller named Rohit Verma for a used laptop.
After receiving the payment on 12 August 2026, the seller stopped responding to my calls and blocked my number.
I have screenshots of the chat and the UPI transaction reference.
I request you to kindly register my complaint and take appropriate action.
Yours faithfully,
Signature: ____________________
Name: Anil Joshi
Date: ____________`,
  },
  'divorce-petition': {
    id: 'sample-petition',
    title: 'Sample petition',
    text: `BEFORE THE [COURT NAME]
Petition No. ______ of 2026
IN THE MATTER OF:
Mr. Rahul Kulkarni, residing at Kothrud, Pune ... Petitioner
VERSUS
Mrs. Neha Kulkarni, residing at [RESPONDENT ADDRESS] ... Respondent
PETITION FOR DISSOLUTION OF MARRIAGE
1. The marriage between the parties was solemnised on 14/02/2018 at Nagpur.
2. The parties have been living separately since March 2024.
3. The parties have one son aged 5 years.
PRAYER
The Petitioner prays that this Court may be pleased to grant the relief sought.
Place: ______
Date: ______
PETITIONER ____________________`,
  },
  affidavit: {
    id: 'sample-affidavit',
    title: 'Sample affidavit',
    text: `AFFIDAVIT
I, Priya Deshpande, aged 34 years, residing at [DEPONENT ADDRESS], do hereby solemnly affirm and declare as under:
1. That I am the deponent herein and am fully conversant with the facts stated below.
2. That I have changed my residence to Wakad, Pune with effect from 1 June 2026.
3. That this affidavit is made for updating my address in bank records.
DEPONENT ____________________
VERIFICATION
Verified at Pune on 05/06/2026 that the contents of the above affidavit are true and correct to the best of my knowledge and belief.
DEPONENT ____________________`,
  },
};

/** Short, clearly labelled Devanagari samples for the Hindi / Marathi OCR demo. */
export const DEMO_DEVANAGARI_SAMPLES = {
  hi: {
    id: 'sample-hi',
    title: 'नमूना पाठ (हिन्दी) — शपथ पत्र',
    text: `शपथ पत्र (नमूना पाठ)
मैं, [नाम], आयु [आयु] वर्ष, निवासी [पता], शपथपूर्वक कथन करता/करती हूँ कि:
1. मैं इस शपथ पत्र का अभिसाक्षी हूँ और इसमें लिखे तथ्यों से परिचित हूँ।
2. मेरा वर्तमान पता ____________________ है।
3. उपरोक्त कथन मेरी जानकारी और विश्वास के अनुसार सत्य हैं।
स्थान: __________
दिनांक: __________
अभिसाक्षी ____________________`,
  },
  mr: {
    id: 'sample-mr',
    title: 'नमुना मजकूर (मराठी) — प्रतिज्ञापत्र',
    text: `प्रतिज्ञापत्र (नमुना मजकूर)
मी, [नाव], वय [वय] वर्षे, राहणार [पत्ता], प्रतिज्ञेवर असे लिहून देतो/देते की:
1. मी या प्रतिज्ञापत्राचा प्रतिज्ञापत्रकर्ता असून मला यातील सर्व तथ्यांची माहिती आहे.
2. माझा सध्याचा पत्ता ____________________ आहे.
3. वरील मजकूर माझ्या माहितीप्रमाणे व समजुतीप्रमाणे खरा आहे.
ठिकाण: __________
दिनांक: __________
प्रतिज्ञापत्रकर्ता ____________________`,
  },
};

/** File-name keywords used ONLY to pick which demo sample to show. */
export const SAMPLE_FILENAME_HINTS = [
  { typeId: 'fir-complaint', words: ['fir', 'complaint', 'police'] },
  { typeId: 'divorce-petition', words: ['divorce', 'petition', 'marriage'] },
  { typeId: 'affidavit', words: ['affidavit', 'declaration'] },
  {
    typeId: 'rental-agreement',
    words: ['rent', 'lease', 'licence', 'license', 'tenancy', 'agreement'],
  },
];
