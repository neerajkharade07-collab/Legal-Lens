/**
 * Plain text (extracted / reviewed / compared) → TipTap JSON for the editor.
 * Light, deterministic structure detection:
 *   - first short line without end punctuation → centred title (H1)
 *   - ALL-CAPS short lines, or short numbered lines ("3. Rent") → H2
 *   - lines starting with "- " or "• " → bullet list
 *   - everything else → paragraphs (one per line)
 */
const isUpper = (line) => /[A-Z]/.test(line) && line === line.toUpperCase();
const words = (line) => line.trim().split(/\s+/).length;
const endsSentence = (line) => /[.:;!?।]$/.test(line.trim());

const text = (value) => (value ? [{ type: 'text', text: value }] : undefined);
const paragraph = (value, align) => ({
  type: 'paragraph',
  ...(align ? { attrs: { textAlign: align } } : {}),
  ...(value ? { content: text(value) } : {}),
});

export function textToDoc(input = '') {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const content = [];
  let titled = false;
  let list = null;

  const flushList = () => {
    if (list) content.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (bullet) {
      list ??= { type: 'bulletList', content: [] };
      list.content.push({ type: 'listItem', content: [paragraph(bullet[1])] });
      continue;
    }
    flushList();
    if (!titled && words(line) <= 8 && !endsSentence(line)) {
      content.push({
        type: 'heading',
        attrs: { level: 1, textAlign: 'center' },
        content: text(line),
      });
      titled = true;
      continue;
    }
    titled = true;
    if (
      (isUpper(line) && words(line) <= 8) ||
      (/^\d+[.)]\s+\S/.test(line) && words(line) <= 6 && !endsSentence(line))
    ) {
      content.push({ type: 'heading', attrs: { level: 2 }, content: text(line) });
      continue;
    }
    content.push(paragraph(line, words(line) > 12 ? 'justify' : undefined));
  }
  flushList();
  return { type: 'doc', content: content.length ? content : [paragraph('')] };
}

/** TipTap JSON → plain text (one line per block). */
export function docToText(json) {
  const inline = (n) =>
    n.type === 'text'
      ? n.text
      : n.type === 'fieldToken'
        ? n.attrs?.value || `[${n.attrs?.label}]`
        : (n.content ?? []).map(inline).join('');
  const lines = [];
  const walk = (n) => {
    if (n.type === 'paragraph' || n.type === 'heading') lines.push(inline(n));
    else if (n.type === 'listItem') lines.push(`- ${(n.content ?? []).map(inline).join(' ')}`);
    else n.content?.forEach(walk);
  };
  walk(json);
  return lines.join('\n');
}
