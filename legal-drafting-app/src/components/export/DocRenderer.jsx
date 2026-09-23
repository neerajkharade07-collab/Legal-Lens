/**
 * Read-only rendering of TipTap JSON for the court-ready preview and print.
 * Mirrors the editor's document typography; field tokens render as their value,
 * or — when empty — as a blank line or their bracketed label.
 */

function textStyleOf(marks) {
  const style = {};
  for (const mark of marks ?? []) {
    if (mark.type === 'textStyle') {
      if (mark.attrs?.fontFamily) style.fontFamily = mark.attrs.fontFamily;
      if (mark.attrs?.fontSize) style.fontSize = mark.attrs.fontSize;
    }
  }
  return Object.keys(style).length ? style : undefined;
}

function Inline({ nodes, placeholders }) {
  return (nodes ?? []).map((node, n) => {
    if (node.type === 'hardBreak') return <br key={n} />;
    if (node.type === 'fieldToken') {
      const { value, label, key } = node.attrs ?? {};
      if (value) return <span key={n}>{value}</span>;
      return placeholders === 'label' ? (
        <span key={n} className="cr-token-label">
          [{label || key}]
        </span>
      ) : (
        <span key={n} className="cr-blank" aria-label={`Blank: ${label || key}`} />
      );
    }
    if (node.type !== 'text') return null;
    const types = (node.marks ?? []).map((m) => m.type);
    let el = node.text;
    if (types.includes('underline')) el = <u>{el}</u>;
    if (types.includes('italic')) el = <em>{el}</em>;
    if (types.includes('bold')) el = <strong>{el}</strong>;
    return (
      <span key={n} style={textStyleOf(node.marks)}>
        {el}
      </span>
    );
  });
}

const alignClass = (node) => {
  const a = node.attrs?.textAlign;
  return a && a !== 'left' ? `cr-align-${a}` : undefined;
};

function Block({ node, placeholders }) {
  const inline = <Inline nodes={node.content} placeholders={placeholders} />;
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(node.attrs?.level ?? 2, 1), 3);
      const Tag = `h${level}`;
      return <Tag className={alignClass(node)}>{inline}</Tag>;
    }
    case 'paragraph':
      return <p className={alignClass(node)}>{inline}</p>;
    case 'bulletList':
    case 'orderedList': {
      const List = node.type === 'bulletList' ? 'ul' : 'ol';
      return (
        <List start={node.attrs?.start > 1 ? node.attrs.start : undefined}>
          {(node.content ?? []).map((item, n) => (
            <li key={n}>
              {(item.content ?? []).map((child, c) => (
                <Block key={c} node={child} placeholders={placeholders} />
              ))}
            </li>
          ))}
        </List>
      );
    }
    default:
      return node.content ? <div>{inline}</div> : null;
  }
}

/** Renders the given top-level blocks. `startIndex` keeps data-block numbering global. */
export function DocBlocks({ blocks, placeholders = 'blank', startIndex = 0 }) {
  return blocks.map((node, n) => (
    <div key={startIndex + n} className="cr-block" data-block={startIndex + n}>
      <Block node={node} placeholders={placeholders} />
    </div>
  ));
}
