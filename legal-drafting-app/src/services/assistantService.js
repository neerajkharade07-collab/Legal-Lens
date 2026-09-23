/** Drafting assistant — future: AI Draft Modification API. Demo uses rule-based samples. */
import { ASSISTANT_ACTIONS, runAssistantTransform } from './demo/assistantTransforms';
import { getClauseCatalog } from '../data/intelligence/clauseCatalog';
import { snapshotMentions } from '../utils/documentSnapshot';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

export { ASSISTANT_ACTIONS };

/**
 * @param {string} actionId
 * @param {{ text:string, snapshot:object }} input
 * @returns {{ actionId, kind:'replace'|'info'|'insert', original, proposed?, notes?, clause?, changed, meta }}
 */
export async function runAssistant(actionId, { text, snapshot }) {
  if (!USE_MOCKS) throw notConnected('AI Draft Modification API');
  const action = ASSISTANT_ACTIONS.find((a) => a.id === actionId);
  if (!action) throw new Error('Unknown assistant action.');

  if (action.kind === 'insert') {
    const clause =
      getClauseCatalog(snapshot.typeId).find((c) => !snapshotMentions(snapshot, c.detect)) ??
      getClauseCatalog(snapshot.typeId)[0] ??
      null;
    return simulateLatency(
      {
        actionId,
        kind: 'insert',
        original: text ?? '',
        clause,
        notes: clause
          ? [`Sample clause: ${clause.name}. ${clause.why}`]
          : ['No sample clause available for this document type.'],
        changed: Boolean(clause),
        meta: demoAnalysisMeta(),
      },
      500,
    );
  }

  const out = runAssistantTransform(actionId, text);
  const changed =
    action.kind === 'replace' && out.proposed !== undefined && out.proposed !== (text ?? '').trim();
  return simulateLatency(
    {
      actionId,
      kind: action.kind,
      original: text ?? '',
      proposed: out.proposed,
      notes:
        out.notes ??
        (action.kind === 'replace' && !changed
          ? ['The demo rules found nothing to change in this selection.']
          : []),
      changed,
      meta: demoAnalysisMeta(),
    },
    550,
  );
}
