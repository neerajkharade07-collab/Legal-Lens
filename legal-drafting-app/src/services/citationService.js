/** Citations — future: Citation Verification API. Demo returns placeholders only. */
import { getCitationCatalog } from '../data/intelligence/citationCatalog';
import { snapshotMentions } from '../utils/documentSnapshot';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

/**
 * verification: 'unverified' | 'verified' (only ever 'unverified' in demo)
 * sourceStatus: 'requires_source' | 'source_linked'
 */
export async function listCitations(snapshot) {
  if (!USE_MOCKS) throw notConnected('Citation API');
  const citations = getCitationCatalog(snapshot.typeId).map((c) => ({
    ...c,
    verification: 'unverified',
    sourceStatus: 'requires_source',
    isDemo: true,
    used: snapshotMentions(snapshot, c.match),
  }));
  return simulateLatency({ citations, meta: demoAnalysisMeta() }, 300);
}

/** Verification is not possible without a verified source backend. */
export async function verifyCitation() {
  if (!USE_MOCKS) throw notConnected('Citation Verification API');
  return simulateLatency(
    {
      verified: false,
      reason: 'Verified source integration will be connected to the backend.',
      meta: demoAnalysisMeta(),
    },
    250,
  );
}
