/**
 * Legal assistant panel header label (Phase 2, updated for Phase 3).
 *   npm run test:drafting
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { intelPanelBadge } = await import('../src/utils/intelLabels.js');
const { AI_ASSISTANT_ACTIONS, ASSISTANT_ACTIONS } = await import('../src/services/assistantService.js');
const { INTELLIGENCE_TOOLS } = await import('../src/data/intelligenceTools.js');

const ids = INTELLIGENCE_TOOLS.map((t) => t.id);

test('signed in: the AI tools (assistant, overview, health, clauses, compliance, research) are labelled AI, not Demo', () => {
  for (const id of ['assistant', 'overview', 'health', 'clauses', 'compliance', 'research']) {
    assert.ok(ids.includes(id), id);
    const b = intelPanelBadge(id, AI_ASSISTANT_ACTIONS);
    assert.equal(b.demo, false, id);
    assert.doesNotMatch(b.text, /demo/i, id);
    assert.match(b.text, /review/, id);
  }
});

test('signed in: citations are rule-based and say "not verified" (never AI, never Demo)', () => {
  const b = intelPanelBadge('citations', AI_ASSISTANT_ACTIONS);
  assert.equal(b.demo, false);
  assert.match(b.text, /Rule-based — not verified/);
});

test('signed out (Demo Mode): every tool stays "Demo", including health and the assistant', () => {
  assert.ok(ASSISTANT_ACTIONS.every((a) => !a.ai), 'demo actions are not AI');
  for (const actions of [ASSISTANT_ACTIONS, [], undefined]) {
    for (const id of ids) {
      const b = intelPanelBadge(id, actions);
      assert.equal(b.demo, true, id);
      assert.equal(b.text, 'Demo', id);
    }
  }
});
