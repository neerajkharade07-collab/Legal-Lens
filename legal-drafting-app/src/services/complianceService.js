/** Compliance review — future: BNS/BNSS Compliance API (verified sources only). */
import { getComplianceRules } from '../data/intelligence/complianceRules';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

/**
 * @returns {{ framework:{id,title}, status:'requires_verification', sections:{id,title,items:{id,label,status,detail,location}[]}[], meta }}
 */
export async function reviewCompliance(snapshot) {
  if (!USE_MOCKS) throw notConnected('Compliance API');
  const rules = getComplianceRules(snapshot.typeId);
  if (!rules)
    return simulateLatency({
      framework: null,
      status: 'requires_verification',
      sections: [],
      meta: demoAnalysisMeta(),
    });
  return simulateLatency(
    {
      framework: rules.framework,
      status: 'requires_verification',
      sections: rules.sections(snapshot),
      meta: demoAnalysisMeta(),
    },
    500,
  );
}
