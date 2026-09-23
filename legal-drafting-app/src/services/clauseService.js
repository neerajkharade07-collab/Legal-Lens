/** Missing clauses — future: Missing Clause API. */
import { getClauseCatalog } from '../data/intelligence/clauseCatalog';
import { snapshotMentions } from '../utils/documentSnapshot';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

/**
 * @returns {{ suggestions: {id,name,why,priority,status:'possibly_missing'|'present',content,insertBefore}[], meta }}
 */
export async function detectMissingClauses(snapshot) {
  if (!USE_MOCKS) throw notConnected('Missing Clause API');
  const suggestions = getClauseCatalog(snapshot.typeId).map((clause) => ({
    ...clause,
    status: snapshotMentions(snapshot, clause.detect) ? 'present' : 'possibly_missing',
  }));
  return simulateLatency({ suggestions, meta: demoAnalysisMeta() }, 400);
}
