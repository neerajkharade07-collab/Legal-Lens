/**
 * DEMO assistant: rule-based sample transformations. No language model is
 * used. Outputs are labelled as samples in the UI and must be reviewed.
 */
const FORMAL = [
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bcan't\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bI'm\b/g, 'I am'],
  [/\bI've\b/g, 'I have'],
  [/\bit's\b/gi, 'it is'],
  [/\bthey're\b/gi, 'they are'],
  [/\bwant to\b/gi, 'wish to'],
  [/\btell\b/gi, 'inform'],
  [/\btold\b/gi, 'informed'],
  [/\ba lot of\b/gi, 'considerable'],
  [/\bbuy\b/gi, 'purchase'],
  [/\bmaybe\b/gi, 'possibly'],
];
const SIMPLE = [
  [/\bhereinafter referred to as\b/gi, 'called'],
  [/\bin accordance with\b/gi, 'following'],
  [/\bpursuant to\b/gi, 'under'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bin the event that\b/gi, 'if'],
  [/\bnotwithstanding\b/gi, 'despite'],
  [/\btherefrom\b/gi, 'from it'],
  [/\bherein\b/gi, 'in this document'],
  [/\bcommence\b/gi, 'start'],
  [/\bterminate\b/gi, 'end'],
  [/\bin view of the above\b/gi, 'because of this'],
  [/\bkindly\b/gi, 'please'],
  [/\bsolemnised\b/gi, 'held'],
];
const FILLER = [
  [/\bvery\b\s*/gi, ''],
  [/\breally\b\s*/gi, ''],
  [/\bbasically\b,?\s*/gi, ''],
  [/\s{2,}/g, ' '],
];

const apply = (text, rules) =>
  rules.reduce((t, [re, to]) => t.replace(re, (m) => matchCase(m, to)), text);
function matchCase(source, target) {
  if (!target) return target;
  return source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()
    ? target[0].toUpperCase() + target.slice(1)
    : target;
}
const finish = (text) => {
  let t = text.trim();
  if (t && /[a-z]/.test(t[0])) t = t[0].toUpperCase() + t.slice(1);
  return t;
};

/** Split sentences longer than ~30 words at "; " or ", and ". */
function splitLong(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      if (sentence.split(/\s+/).length <= 30) return sentence;
      const cut = sentence.search(/;\s|,\s+and\s/);
      if (cut < 0) return sentence;
      const head = sentence.slice(0, cut).replace(/[,;]\s*$/, '');
      const tail = sentence.slice(cut).replace(/^[;,]\s*(and\s+)?/, '');
      return `${head}. ${tail[0]?.toUpperCase() ?? ''}${tail.slice(1)}`;
    })
    .join(' ');
}

const VAGUE = [
  'etc.',
  'and/or',
  'as soon as possible',
  'reasonable',
  'approximately',
  'some',
  'various',
  'appropriate',
];
const ABSOLUTE = ['always', 'never', 'all', 'any', 'guarantee', 'certainly'];

export const ASSISTANT_ACTIONS = [
  { id: 'explain', label: 'Explain selected text', short: 'Explain', kind: 'info' },
  { id: 'rewrite', label: 'Rewrite', short: 'Rewrite', kind: 'replace' },
  { id: 'formal', label: 'Make more formal', short: 'Formalize', kind: 'replace' },
  { id: 'simplify', label: 'Simplify', short: 'Simplify', kind: 'replace' },
  { id: 'clarity', label: 'Improve clarity', short: 'Clarify', kind: 'replace' },
  { id: 'risk', label: 'Check potential risk', short: 'Check', kind: 'info' },
  { id: 'clause', label: 'Suggest clause', short: 'Clause', kind: 'insert' },
];

export function runAssistantTransform(actionId, text) {
  const original = text ?? '';
  const wordsCount = original.trim() ? original.trim().split(/\s+/).length : 0;
  switch (actionId) {
    case 'formal':
      return { proposed: finish(apply(original, FORMAL)) };
    case 'simplify':
      return { proposed: finish(apply(original, SIMPLE)) };
    case 'clarity':
      return { proposed: finish(apply(splitLong(original), FILLER)) };
    case 'rewrite':
      return { proposed: finish(apply(splitLong(apply(original, FORMAL)), FILLER)) };
    case 'explain': {
      const first = original.trim().split(/\s+/).slice(0, 24).join(' ');
      return {
        notes: [
          `This passage has ${wordsCount} word${wordsCount === 1 ? '' : 's'} and begins: “${first}${wordsCount > 24 ? '…' : ''}”.`,
          'Sample only: a connected assistant would explain the meaning and effect of this passage in plain language. This demo does not interpret the text.',
        ],
      };
    }
    case 'risk': {
      const lower = original.toLowerCase();
      const notes = [];
      const vague = VAGUE.filter((w) => new RegExp(`\\b${w.replace('.', '\\.')}`, 'i').test(lower));
      const absolute = ABSOLUTE.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower));
      if (/\[[^\]]+\]/.test(original))
        notes.push('Contains a bracketed placeholder or note that still needs final wording.');
      if (vague.length)
        notes.push(
          `Wording that may be read in more than one way: ${vague.map((w) => `“${w}”`).join(', ')}.`,
        );
      if (absolute.length)
        notes.push(
          `Absolute terms that may overstate the position: ${absolute.map((w) => `“${w}”`).join(', ')}.`,
        );
      if (original.split(/(?<=[.!?])\s+/).some((s) => s.split(/\s+/).length > 45))
        notes.push('Contains a very long sentence that may be hard to follow.');
      if (!notes.length) notes.push('No wording patterns were flagged by the demo check.');
      notes.push('Demo check of wording patterns only — it does not assess legal risk.');
      return { notes };
    }
    default:
      return { notes: ['This action is not available.'] };
  }
}
