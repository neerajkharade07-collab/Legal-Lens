/**
 * Registry of DEMO drafting templates.
 *
 * - By document type (structured types with field schemas).
 * - By library template id (templates without structured fields, e.g. a
 *   legal notice) — used when `context.templateId` is given.
 *
 * Future: replaced by the Draft Generation / Template API, which should return
 * the same TipTap JSON shape with `fieldToken` nodes referencing schema keys.
 */
import { buildFirComplaint } from './firComplaint';
import { buildRentalAgreement } from './rentalAgreement';
import { buildDivorcePetition } from './divorcePetition';
import { buildAffidavit } from './affidavit';
import { buildLegalNotice } from './legalNotice';
import { buildEmploymentAgreement } from './employmentAgreement';
import { buildNonDisclosureAgreement } from './nonDisclosureAgreement';
import { buildPropertyAgreement } from './propertyAgreement';

const TEMPLATES = {
  'fir-complaint': buildFirComplaint,
  'rental-agreement': buildRentalAgreement,
  'divorce-petition': buildDivorcePetition,
  affidavit: buildAffidavit,
};

const LIBRARY_TEMPLATES = {
  'legal-notice': buildLegalNotice,
  'employment-agreement': buildEmploymentAgreement,
  'non-disclosure-agreement': buildNonDisclosureAgreement,
  'property-sale-agreement': buildPropertyAgreement,
};

export function hasLibraryTemplate(templateId) {
  return Boolean(LIBRARY_TEMPLATES[templateId]);
}

export function buildDraftTemplate(typeId, context = {}) {
  const build = LIBRARY_TEMPLATES[context.templateId] ?? TEMPLATES[typeId];
  return build ? build(context) : { type: 'doc', content: [{ type: 'paragraph' }] };
}
