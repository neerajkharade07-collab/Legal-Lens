/**
 * Header badge of the Legal assistant panel.
 *
 * Signed out (Demo Mode) every tool is simulated → "Demo".
 * Signed in (customer / lawyer, account document) — Phase 2 + Phase 3:
 *  - Assistant, Overview, Health, Clauses, Compliance and Research are real AI on the CASEONE
 *    server → an AI label that asks the user to review every result;
 *  - Citations is a rule-based check without a legal database → "Rule-based — not verified".
 * `assistantActions` are the actions offered this session (AI ones have `ai: true`), which
 * tells whether the session is signed in.
 * @returns {{ demo: boolean, text: string, title: string }}
 */
const AI_TOOLS = ['overview', 'health', 'clauses', 'compliance', 'research', 'assistant'];

export function intelPanelBadge(toolId, assistantActions) {
  const signedIn = (assistantActions ?? []).some((a) => a.ai);
  if (signedIn && AI_TOOLS.includes(toolId)) {
    return {
      demo: false,
      text: 'AI — review every result',
      title: 'Real AI (Google Gemini via the CASEONE server). Results are not legal advice: review every result before relying on it.',
    };
  }
  if (signedIn && toolId === 'citations') {
    return {
      demo: false,
      text: 'Rule-based — not verified',
      title: 'References are extracted and checked by rules. No legal database is connected, so sections and case citations are not verified.',
    };
  }
  return {
    demo: true,
    text: 'Demo',
    title: 'Demo analysis: simulated results in your browser, not legal advice.',
  };
}
