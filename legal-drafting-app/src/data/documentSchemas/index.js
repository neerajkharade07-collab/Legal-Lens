/**
 * Registry of case-detail schemas by document type.
 * Adding a document type = add a schema file + a template file and register both.
 */
import { firComplaintSchema } from './firComplaint';
import { rentalAgreementSchema } from './rentalAgreement';
import { divorcePetitionSchema } from './divorcePetition';
import { affidavitSchema } from './affidavit';
import { generalDocumentSchema } from './generalDocument';

const SCHEMAS = {
  [firComplaintSchema.typeId]: firComplaintSchema,
  [rentalAgreementSchema.typeId]: rentalAgreementSchema,
  [divorcePetitionSchema.typeId]: divorcePetitionSchema,
  [affidavitSchema.typeId]: affidavitSchema,
  [generalDocumentSchema.typeId]: generalDocumentSchema,
};

export function getDocumentSchema(typeId) {
  return SCHEMAS[typeId] ?? null;
}

/** Flat list of fields with their group id. */
export function getSchemaFields(schema) {
  return schema
    ? schema.groups.flatMap((group) => group.fields.map((f) => ({ ...f, groupId: group.id })))
    : [];
}

/** Field lookup by key. */
export function getFieldMap(schema) {
  return Object.fromEntries(getSchemaFields(schema).map((f) => [f.key, f]));
}
