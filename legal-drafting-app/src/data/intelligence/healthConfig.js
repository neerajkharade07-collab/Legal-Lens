/**
 * Per-type configuration for the DEMO document health check.
 * keyFields    — fields whose absence is reported as high severity
 * dateChecks   — a date field compared with dates written in free-text fields
 * amountChecks — an amount field compared with amounts written in free-text fields
 * minWords     — free-text fields that read as thin below a word count
 * periodChecks — "shorter must not exceed longer" month comparisons
 */
export const HEALTH_CONFIG = {
  'fir-complaint': {
    keyFields: [
      'policeStationName',
      'complainantName',
      'complainantAddress',
      'incidentDate',
      'incidentLocation',
      'incidentDescription',
    ],
    dateChecks: [{ field: 'incidentDate', in: ['incidentDescription', 'additionalInformation'] }],
    amountChecks: [
      { field: 'amountInvolved', in: ['incidentDescription', 'additionalInformation'] },
    ],
    minWords: [{ field: 'incidentDescription', words: 30 }],
    periodChecks: [],
  },
  'rental-agreement': {
    keyFields: [
      'landlordName',
      'tenantName',
      'propertyAddress',
      'monthlyRent',
      'startDate',
      'duration',
    ],
    dateChecks: [{ field: 'startDate', in: ['specialConditions'] }],
    amountChecks: [{ field: 'monthlyRent', in: ['specialConditions'] }],
    minWords: [],
    periodChecks: [
      { shorter: 'lockInPeriod', longer: 'duration' },
      { shorter: 'noticePeriod', longer: 'duration' },
    ],
  },
  'divorce-petition': {
    keyFields: [
      'petitionerName',
      'respondentName',
      'marriageDate',
      'marriagePlace',
      'jurisdiction',
      'reliefRequested',
    ],
    dateChecks: [{ field: 'marriageDate', in: ['caseContext', 'additionalFacts'] }],
    amountChecks: [],
    minWords: [{ field: 'caseContext', words: 30 }],
    periodChecks: [],
  },
  affidavit: {
    keyFields: [
      'deponentName',
      'deponentAddress',
      'affidavitPurpose',
      'statementFacts',
      'place',
      'date',
    ],
    dateChecks: [],
    amountChecks: [],
    minWords: [{ field: 'statementFacts', words: 15 }],
    periodChecks: [],
  },
};

export function getHealthConfig(typeId) {
  return (
    HEALTH_CONFIG[typeId] ?? {
      keyFields: [],
      dateChecks: [],
      amountChecks: [],
      minWords: [],
      periodChecks: [],
    }
  );
}
