/** Document Health — future: Document Health API. */
import { runHealthRules } from './demo/healthRules';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

/** @param snapshot see utils/documentSnapshot.js */
export async function runHealthCheck(snapshot) {
  if (!USE_MOCKS) throw notConnected('Document Health API');
  return simulateLatency({ ...runHealthRules(snapshot), meta: demoAnalysisMeta() }, 450);
}
