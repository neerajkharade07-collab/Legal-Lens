/** Affidavit — case detail fields. */
export const affidavitSchema = {
  typeId: 'affidavit',
  groups: [
    {
      id: 'deponent',
      title: 'Deponent',
      fields: [
        { key: 'deponentName', label: 'Full Name', token: 'DEPONENT NAME' },
        { key: 'deponentAge', label: 'Age', token: 'AGE', type: 'number', min: 0, max: 120 },
        { key: 'deponentRelation', label: 'Parent / Spouse Name', token: 'PARENT / SPOUSE NAME' },
        {
          key: 'deponentAddress',
          label: 'Address',
          token: 'DEPONENT ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        { key: 'deponentOccupation', label: 'Occupation', token: 'OCCUPATION' },
      ],
    },
    {
      id: 'affidavit',
      title: 'Affidavit',
      fields: [
        { key: 'affidavitPurpose', label: 'Purpose', token: 'PURPOSE OF AFFIDAVIT' },
        {
          key: 'statementFacts',
          label: 'Statement / Facts',
          token: 'STATEMENT OF FACTS',
          type: 'textarea',
          rows: 5,
        },
        { key: 'place', label: 'Place', token: 'PLACE' },
        { key: 'date', label: 'Date', token: 'DATE', type: 'date' },
        {
          key: 'verificationDetails',
          label: 'Verification Details',
          token: 'VERIFICATION DETAILS',
          type: 'textarea',
          rows: 2,
          placeholder: 'e.g. verified at Pune on the date above',
        },
      ],
    },
  ],
};
