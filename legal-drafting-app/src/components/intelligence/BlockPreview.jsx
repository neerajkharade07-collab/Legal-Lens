/** Read-only rendering of TipTap JSON blocks (for previews in the panel). */
function Inline({ nodes }) {
  return (nodes ?? []).map((node, n) => {
    if (node.type === 'fieldToken') {
      const { value, label } = node.attrs ?? {};
      return (
        <span key={n} className={value ? 'block-preview__token' : 'block-preview__token is-empty'}>
          {value || `[${label || node.attrs?.key}]`}
        </span>
      );
    }
    if (node.type !== 'text') return null;
    const marks = (node.marks ?? []).map((m) => m.type);
    let el = node.text;
    if (marks.includes('bold')) el = <strong>{el}</strong>;
    if (marks.includes('italic')) el = <em>{el}</em>;
    if (marks.includes('underline')) el = <u>{el}</u>;
    return <span key={n}>{el}</span>;
  });
}

function Block({ node }) {
  if (node.type === 'heading')
    return (
      <p className="block-preview__heading">
        <Inline nodes={node.content} />
      </p>
    );
  if (node.type === 'paragraph')
    return (
      <p>
        <Inline nodes={node.content} />
      </p>
    );
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const List = node.type === 'bulletList' ? 'ul' : 'ol';
    return (
      <List>
        {node.content?.map((item, n) => (
          <li key={n}>
            {item.content?.map((child, m) => (
              <Block key={m} node={child} />
            ))}
          </li>
        ))}
      </List>
    );
  }
  return null;
}

export function BlockPreview({ blocks, label = 'Preview' }) {
  return (
    <div className="block-preview" aria-label={label}>
      {blocks.map((node, n) => (
        <Block key={n} node={node} />
      ))}
    </div>
  );
}
