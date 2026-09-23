/**
 * Sample documents used to seed the demo workspace.
 * All names, places and details are fictional and for demonstration only.
 * Dates are generated relative to "now" so the demo never looks stale.
 */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const SAMPLES = [
  {
    id: 'doc-rental-baner',
    name: 'Leave and Licence Agreement — Flat 402, Baner',
    typeId: 'rental-agreement',
    status: 'draft',
    createdAgo: 3 * DAY,
    editedAgo: 2 * HOUR,
    progress: 68,
  },
  {
    id: 'doc-fir-upi',
    name: 'Complaint — Online Payment Fraud',
    typeId: 'fir-complaint',
    status: 'draft',
    createdAgo: 2 * DAY,
    editedAgo: 20 * HOUR,
    progress: 45,
  },
  {
    id: 'doc-affidavit-address',
    name: 'Affidavit for Change of Address',
    typeId: 'affidavit',
    status: 'completed',
    createdAgo: 6 * DAY,
    editedAgo: 3 * DAY,
    progress: 100,
  },
  {
    id: 'doc-divorce-mutual',
    name: 'Divorce Petition — Mutual Consent (Draft 2)',
    typeId: 'divorce-petition',
    status: 'draft',
    createdAgo: 12 * DAY,
    editedAgo: 5 * DAY,
    progress: 30,
  },
  {
    id: 'doc-affidavit-name',
    name: 'Affidavit for Name Correction',
    typeId: 'affidavit',
    status: 'reviewed',
    createdAgo: 15 * DAY,
    editedAgo: 9 * DAY,
    progress: 100,
  },
  {
    id: 'doc-rental-kothrud',
    name: 'Shop Premises Rental Agreement — Kothrud',
    typeId: 'rental-agreement',
    status: 'completed',
    createdAgo: 24 * DAY,
    editedAgo: 14 * DAY,
    progress: 100,
  },
  {
    id: 'doc-fir-vehicle',
    name: 'Complaint — Theft of Two-Wheeler',
    typeId: 'fir-complaint',
    status: 'reviewed',
    createdAgo: 30 * DAY,
    editedAgo: 21 * DAY,
    progress: 100,
  },
];

export function createDemoDocuments(now = Date.now()) {
  return SAMPLES.map(({ createdAgo, editedAgo, ...doc }) => ({
    ...doc,
    isSample: true,
    createdAt: new Date(now - createdAgo).toISOString(),
    updatedAt: new Date(now - editedAgo).toISOString(),
  }));
}
