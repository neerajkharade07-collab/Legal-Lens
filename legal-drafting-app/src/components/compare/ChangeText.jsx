/** Inline redline for one change: word-level for modifications, whole text otherwise. */
export function ChangeText({ change, side = 'both' }) {
  if (change.type === 'added') {
    return side === 'original' ? null : <ins className="rl-ins">{change.revisedText}</ins>;
  }
  if (change.type === 'removed') {
    return side === 'revised' ? null : <del className="rl-del">{change.originalText}</del>;
  }
  return change.words.map((part, n) => {
    if (part.op === 'equal') return <span key={n}>{part.text}</span>;
    if (part.op === 'delete')
      return side === 'revised' ? null : (
        <del key={n} className="rl-del">
          {part.text}
        </del>
      );
    return side === 'original' ? null : (
      <ins key={n} className="rl-ins">
        {part.text}
      </ins>
    );
  });
}
