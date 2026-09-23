/**
 * DEMO limitation configuration.
 *
 * IMPORTANT: no real limitation periods are configured here. Matter types are
 * recorded for context only (`verifiedRule: null`). The calculator uses either
 * a clearly labelled illustrative demo period or a period the user enters
 * after verifying it. A future backend can attach verified rules per matter
 * type (period, counting method, exclusions, source) without UI changes.
 */
export const MATTER_TYPES = [
  { id: 'civil-suit', label: 'Civil suit / claim', verifiedRule: null },
  { id: 'appeal', label: 'Appeal', verifiedRule: null },
  { id: 'review-revision', label: 'Review or revision application', verifiedRule: null },
  { id: 'consumer-complaint', label: 'Consumer complaint', verifiedRule: null },
  { id: 'notice-reply', label: 'Reply to a notice', verifiedRule: null },
  { id: 'other', label: 'Other proceeding', verifiedRule: null },
];

/** Illustrative value used only to demonstrate the calculator. Not a legal period. */
export const DEMO_PERIOD = { value: 90, unit: 'days' };

export const PERIOD_UNITS = [
  { id: 'days', label: 'Days' },
  { id: 'months', label: 'Months' },
  { id: 'years', label: 'Years' },
];

export const LIMITATION_WARNING =
  'Limitation periods depend on the applicable law, proceeding and facts. Verify the applicable period before relying on this calculation.';

/** Counting convention used by the demo engine (itself subject to verification). */
export const DEMO_COUNTING_NOTE =
  'Demo counting method: the period is added to the event date (the event day itself is not counted), then any excluded days are added. Holidays and court closures are not considered.';
