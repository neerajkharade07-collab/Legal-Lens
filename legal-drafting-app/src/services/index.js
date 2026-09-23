/**
 * Service layer entry point. Anything that will come from a backend (documents,
 * generated drafts, analysis, research…) is requested through these services;
 * data/ only holds static UI configuration and mock fixtures.
 * Services for later steps (health, clauses, compliance, citations, research,
 * OCR, comparison, limitation, export) will be added alongside.
 */
export * as documentsService from './documentsService';
export * as authService from './authService';
export * as templatesService from './templatesService';
export * as draftingService from './draftingService';
export * as healthService from './healthService';
export * as clauseService from './clauseService';
export * as complianceService from './complianceService';
export * as citationService from './citationService';
export * as researchService from './researchService';
export * as assistantService from './assistantService';
export * as ocrService from './ocrService';
export * as documentReviewService from './documentReviewService';
export * as comparisonService from './comparisonService';
export * as documentStorageService from './documentStorageService';
export * as versionService from './versionService';
export * as limitationService from './limitationService';
export * as exportService from './exportService';
export { USE_MOCKS, DEMO_META } from './config';
