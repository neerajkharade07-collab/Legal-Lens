/** FIR / Police Complaint — case detail fields. Keys are stable and referenced by the draft template. */
export const firComplaintSchema = {
  typeId: 'fir-complaint',
  groups: [
    {
      id: 'complaint',
      title: 'Complaint details',
      fields: [
        {
          key: 'policeStationName',
          label: 'Police Station Name',
          token: 'POLICE STATION NAME',
          placeholder: 'e.g. Shivajinagar Police Station',
        },
        {
          key: 'policeStationAddress',
          label: 'Police Station Address',
          token: 'POLICE STATION ADDRESS',
          type: 'textarea',
          rows: 2,
        },
      ],
    },
    {
      id: 'complainant',
      title: 'Complainant',
      fields: [
        { key: 'complainantName', label: 'Full Name', token: 'COMPLAINANT NAME' },
        {
          key: 'complainantParentName',
          label: 'Father / Mother Name',
          token: 'FATHER / MOTHER NAME',
        },
        { key: 'complainantAge', label: 'Age', token: 'AGE', type: 'number', min: 0, max: 120 },
        {
          key: 'complainantAddress',
          label: 'Address',
          token: 'COMPLAINANT ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        { key: 'complainantPhone', label: 'Phone Number', token: 'PHONE NUMBER', type: 'tel' },
        { key: 'complainantEmail', label: 'Email', token: 'EMAIL', type: 'email' },
      ],
    },
    {
      id: 'accused',
      title: 'Accused / Opposite Party',
      fields: [
        { key: 'accusedName', label: 'Name / Entity', token: 'ACCUSED NAME / ENTITY' },
        {
          key: 'accusedAddress',
          label: 'Address',
          token: 'ACCUSED ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        { key: 'accusedContact', label: 'Contact Information', token: 'ACCUSED CONTACT' },
        {
          key: 'accusedOnlineId',
          label: 'Online Profile / Identifier',
          token: 'ONLINE PROFILE / IDENTIFIER',
          placeholder: 'e.g. UPI ID, profile link, phone',
        },
      ],
    },
    {
      id: 'incident',
      title: 'Incident',
      fields: [
        { key: 'incidentDate', label: 'Incident Date', token: 'INCIDENT DATE', type: 'date' },
        { key: 'incidentTime', label: 'Incident Time', token: 'INCIDENT TIME', type: 'time' },
        { key: 'incidentLocation', label: 'Incident Location', token: 'INCIDENT LOCATION' },
        {
          key: 'amountInvolved',
          label: 'Amount Involved',
          token: 'AMOUNT INVOLVED',
          placeholder: 'e.g. ₹25,000',
        },
        {
          key: 'paymentMethod',
          label: 'Payment Method',
          token: 'PAYMENT METHOD',
          placeholder: 'e.g. UPI, bank transfer, cash',
        },
      ],
    },
    {
      id: 'facts',
      title: 'Facts',
      fields: [
        {
          key: 'incidentDescription',
          label: 'Description of Incident',
          token: 'DESCRIPTION OF INCIDENT',
          type: 'textarea',
          rows: 5,
        },
        {
          key: 'evidenceAvailable',
          label: 'Evidence Available',
          token: 'EVIDENCE AVAILABLE',
          type: 'textarea',
          rows: 3,
        },
        {
          key: 'additionalInformation',
          label: 'Additional Information',
          token: 'ADDITIONAL INFORMATION',
          type: 'textarea',
          rows: 3,
        },
      ],
    },
  ],
};
