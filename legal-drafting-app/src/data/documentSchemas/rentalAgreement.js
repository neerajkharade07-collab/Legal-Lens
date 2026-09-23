/** Rental Agreement — case detail fields. */
export const rentalAgreementSchema = {
  typeId: 'rental-agreement',
  groups: [
    {
      id: 'landlord',
      title: 'Landlord',
      fields: [
        { key: 'landlordName', label: 'Full Name', token: 'LANDLORD NAME' },
        {
          key: 'landlordAddress',
          label: 'Address',
          token: 'LANDLORD ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        { key: 'landlordContact', label: 'Contact', token: 'LANDLORD CONTACT' },
      ],
    },
    {
      id: 'tenant',
      title: 'Tenant',
      fields: [
        { key: 'tenantName', label: 'Full Name', token: 'TENANT NAME' },
        {
          key: 'tenantAddress',
          label: 'Address',
          token: 'TENANT ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        { key: 'tenantContact', label: 'Contact', token: 'TENANT CONTACT' },
      ],
    },
    {
      id: 'property',
      title: 'Property',
      fields: [
        {
          key: 'propertyAddress',
          label: 'Property Address',
          token: 'PROPERTY ADDRESS',
          type: 'textarea',
          rows: 2,
        },
        {
          key: 'propertyType',
          label: 'Property Type',
          token: 'PROPERTY TYPE',
          placeholder: 'e.g. 2 BHK flat, shop',
        },
      ],
    },
    {
      id: 'financial',
      title: 'Financial terms',
      fields: [
        {
          key: 'monthlyRent',
          label: 'Monthly Rent',
          token: 'MONTHLY RENT',
          placeholder: 'e.g. ₹22,000',
        },
        {
          key: 'securityDeposit',
          label: 'Security Deposit',
          token: 'SECURITY DEPOSIT',
          placeholder: 'e.g. ₹1,00,000',
        },
        {
          key: 'paymentDueDate',
          label: 'Payment Due Date',
          token: 'PAYMENT DUE DATE',
          placeholder: 'e.g. 5th of every month',
        },
      ],
    },
    {
      id: 'agreement',
      title: 'Agreement',
      fields: [
        { key: 'startDate', label: 'Start Date', token: 'START DATE', type: 'date' },
        { key: 'duration', label: 'Duration', token: 'DURATION', placeholder: 'e.g. 11 months' },
        {
          key: 'lockInPeriod',
          label: 'Lock-in Period',
          token: 'LOCK-IN PERIOD',
          placeholder: 'e.g. 6 months',
        },
        {
          key: 'noticePeriod',
          label: 'Notice Period',
          token: 'NOTICE PERIOD',
          placeholder: 'e.g. 1 month',
        },
      ],
    },
    {
      id: 'responsibilities',
      title: 'Responsibilities',
      fields: [
        {
          key: 'maintenanceResponsibility',
          label: 'Maintenance Responsibility',
          token: 'MAINTENANCE RESPONSIBILITY',
          type: 'textarea',
          rows: 2,
        },
        {
          key: 'utilityResponsibility',
          label: 'Utility Responsibility',
          token: 'UTILITY RESPONSIBILITY',
          type: 'textarea',
          rows: 2,
        },
      ],
    },
    {
      id: 'other',
      title: 'Other',
      fields: [
        {
          key: 'specialConditions',
          label: 'Special Conditions',
          token: 'SPECIAL CONDITIONS',
          type: 'textarea',
          rows: 3,
        },
      ],
    },
  ],
};
