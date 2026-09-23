/** Divorce Petition — case detail fields (neutral wording). */
export const divorcePetitionSchema = {
  typeId: 'divorce-petition',
  groups: [
    {
      id: 'petitioner',
      title: 'Petitioner',
      fields: [
        { key: 'petitionerName', label: 'Full Name', token: 'PETITIONER NAME' },
        {
          key: 'petitionerAddress',
          label: 'Address',
          token: 'PETITIONER ADDRESS',
          type: 'textarea',
          rows: 2,
        },
      ],
    },
    {
      id: 'respondent',
      title: 'Respondent',
      fields: [
        { key: 'respondentName', label: 'Full Name', token: 'RESPONDENT NAME' },
        {
          key: 'respondentAddress',
          label: 'Address',
          token: 'RESPONDENT ADDRESS',
          type: 'textarea',
          rows: 2,
        },
      ],
    },
    {
      id: 'marriage',
      title: 'Marriage',
      fields: [
        { key: 'marriageDate', label: 'Marriage Date', token: 'DATE OF MARRIAGE', type: 'date' },
        { key: 'marriagePlace', label: 'Marriage Place', token: 'PLACE OF MARRIAGE' },
      ],
    },
    {
      id: 'case',
      title: 'Case',
      fields: [
        {
          key: 'currentAddress',
          label: 'Current Address',
          token: 'CURRENT ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        {
          key: 'jurisdiction',
          label: 'Jurisdiction',
          token: 'COURT / JURISDICTION',
          placeholder: 'e.g. Family Court, Pune',
        },
        {
          key: 'separationDate',
          label: 'Separation Date',
          token: 'DATE OF SEPARATION',
          placeholder: 'Date or month and year',
        },
        {
          key: 'childrenDetails',
          label: 'Children Details',
          token: 'DETAILS OF CHILDREN',
          type: 'textarea',
          rows: 2,
        },
        {
          key: 'caseContext',
          label: 'Case Context / Grounds',
          token: 'CASE CONTEXT / GROUNDS',
          type: 'textarea',
          rows: 5,
        },
        {
          key: 'reliefRequested',
          label: 'Relief Requested',
          token: 'RELIEF REQUESTED',
          type: 'textarea',
          rows: 3,
        },
        {
          key: 'additionalFacts',
          label: 'Additional Facts',
          token: 'ADDITIONAL FACTS',
          type: 'textarea',
          rows: 3,
        },
      ],
    },
  ],
};
