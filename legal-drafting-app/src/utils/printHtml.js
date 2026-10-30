/**
 * Legal Drafting Phase 4 — the print / PDF document.
 *
 * Builds a standalone, script-free HTML page from the TipTap JSON (the user's actual content —
 * nothing else). The browser's own print engine paginates it on A4 with the chosen margins, so
 * long paragraphs flow across pages and nothing is clipped; "Save as PDF" then writes a real,
 * text-based PDF with correct Hindi / Marathi shaping (the browser lays the text out).
 *
 * Every text is HTML-escaped and only whitelisted style values are copied, so document content
 * can never inject markup or scripts. Page numbers use CSS page-margin boxes (supported in
 * current Chrome / Edge; other browsers simply print without them).
 */

export const PRINT_MARGINS = {
  standard: { top: 25, right: 25, bottom: 25, left: 25 },
  narrow: { top: 19, right: 19, bottom: 19, left: 19 },
  binding: { top: 25, right: 20, bottom: 25, left: 38 },
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
/** For CSS strings in content: "…". `<` and `>` are CSS-escaped so "</style>" can never close the style element. */
const cssString = (s) =>
  `"${String(s ?? '')
    .slice(0, 120)
    .replace(/[\\"]/g, '\\$&')
    .replace(/[\n\r\f]/g, ' ')
    .replace(/</g, '\\3c ')
    .replace(/>/g, '\\3e ')}"`;

const SAFE_FAMILY = /^[\w "',.-]{1,120}$/;
const SAFE_SIZE = /^\d{1,2}(?:\.\d)?(?:pt|px)$/;
const ALIGN = new Set(['left', 'center', 'right', 'justify']);
const BLANK = '<span class="blank" aria-label="blank"></span>';

function inline(nodes, opts) {
  return (nodes ?? [])
    .map((node) => {
      if (!node || typeof node !== 'object') return '';
      if (node.type === 'hardBreak') return '<br>';
      if (node.type === 'fieldToken') {
        const value = String(node.attrs?.value ?? '');
        if (value) return escapeHtml(value);
        return opts.placeholders === 'label' ? `[${escapeHtml(node.attrs?.label || node.attrs?.key || 'FIELD')}]` : BLANK;
      }
      if (node.type !== 'text') return escapeHtml(plain(node));
      let html = escapeHtml(node.text ?? '');
      const marks = Array.isArray(node.marks) ? node.marks : [];
      const style = [];
      marks.forEach((m) => {
        if (m?.type === 'textStyle') {
          if (m.attrs?.fontFamily && SAFE_FAMILY.test(m.attrs.fontFamily)) style.push(`font-family:${m.attrs.fontFamily.replace(/"/g, "'")}`);
          if (m.attrs?.fontSize && SAFE_SIZE.test(m.attrs.fontSize)) style.push(`font-size:${m.attrs.fontSize}`);
        }
      });
      if (marks.some((m) => m?.type === 'underline')) html = `<u>${html}</u>`;
      if (marks.some((m) => m?.type === 'italic')) html = `<em>${html}</em>`;
      if (marks.some((m) => m?.type === 'bold')) html = `<strong>${html}</strong>`;
      return style.length ? `<span style="${style.join(';')}">${html}</span>` : html;
    })
    .join('');
}

function plain(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'fieldToken') return node.attrs?.value ?? '';
  return (node.content ?? []).map(plain).join(' ');
}

const alignAttr = (node) => {
  const a = node.attrs?.textAlign;
  const classes = [a && ALIGN.has(a) && a !== 'left' ? `a-${a}` : '', node.attrs?.pageBreakBefore === true ? 'pb' : '']
    .filter(Boolean)
    .join(' ');
  return classes ? ` class="${classes}"` : '';
};

function block(node, opts) {
  if (!node || typeof node !== 'object') return '';
  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 3);
      return `<h${level}${alignAttr(node)}>${inline(node.content, opts)}</h${level}>`;
    }
    case 'paragraph': {
      const body = inline(node.content, opts);
      return `<p${alignAttr(node)}>${body || '&nbsp;'}</p>`;
    }
    case 'bulletList':
    case 'orderedList': {
      const tag = node.type === 'bulletList' ? 'ul' : 'ol';
      const start = node.type === 'orderedList' && Number(node.attrs?.start) > 1 ? ` start="${Number(node.attrs.start)}"` : '';
      const items = (node.content ?? [])
        .map((item) => `<li>${(item?.content ?? []).map((c) => block(c, opts)).join('')}</li>`)
        .join('');
      return `<${tag}${start}>${items}</${tag}>`;
    }
    case 'pageBreak':
      return '<div class="page-break" aria-hidden="true"></div>';
    default:
      if (Array.isArray(node.content) && node.content.some((c) => c && !['text', 'hardBreak', 'fieldToken'].includes(c.type))) {
        return node.content.map((c) => block(c, opts)).join('');
      }
      return plain(node).trim() ? `<p>${escapeHtml(plain(node))}</p>` : '';
  }
}

/**
 * @param {object} content TipTap JSON
 * @param {{ title?: string, options?: { margins?, fontSize?, lineSpacing?, placeholders?, pageNumbers?, footerTitle? } }} input
 * @returns {string} complete HTML document (no scripts)
 */
export function buildPrintHtml(content, { title = 'Document', options = {} } = {}) {
  const m = PRINT_MARGINS[options.margins] ?? PRINT_MARGINS.standard;
  const fontSize = [12, 13, 14].includes(Number(options.fontSize)) ? Number(options.fontSize) : 12;
  const line = [1, 1.15, 1.5, 2].includes(Number(options.lineSpacing)) ? Number(options.lineSpacing) : 1.5;
  const opts = { placeholders: options.placeholders === 'label' ? 'label' : 'blank' };
  const body = (content?.content ?? []).map((n) => block(n, opts)).join('\n');
  const pageNumbers = options.pageNumbers !== false;
  const footerTitle = options.footerTitle !== false;
  const marginBoxes = [
    pageNumbers ? `@bottom-right { content: "Page " counter(page) " of " counter(pages); font: 9pt "Times New Roman", serif; color: #444; }` : '',
    footerTitle ? `@bottom-left { content: ${cssString(title)}; font: 9pt "Times New Roman", serif; color: #444; }` : '',
  ].join(' ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; ${marginBoxes} }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #000; background: #fff; font-family: "Times New Roman", Times, "Nirmala UI", "Noto Serif Devanagari", "Noto Sans Devanagari", Mangal, serif; font-size: ${fontSize}pt; line-height: ${line}; overflow-wrap: break-word; }
h1, h2, h3 { font-weight: bold; line-height: 1.3; margin: 1em 0 0.5em; break-after: avoid; page-break-after: avoid; }
h1 { font-size: ${fontSize + 4}pt; } h2 { font-size: ${fontSize + 2}pt; } h3 { font-size: ${fontSize + 1}pt; }
p { margin: 0 0 0.6em; orphans: 3; widows: 3; }
ol, ul { margin: 0 0 0.6em; padding-left: 2em; } li > p { margin-bottom: 0.3em; }
ol ol { list-style-type: lower-alpha; } ol ol ol { list-style-type: lower-roman; }
.a-center { text-align: center; } .a-right { text-align: right; } .a-justify { text-align: justify; }
.blank { display: inline-block; min-width: 9em; border-bottom: 1px solid #000; height: 1em; vertical-align: baseline; }
.page-break { break-after: page; page-break-after: always; height: 0; }
.pb { break-before: page; page-break-before: always; }
strong { font-weight: bold; } em { font-style: italic; } u { text-decoration: underline; }
@media screen { body { max-width: 160mm; margin: 24px auto; padding: 0 16px; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Opens the browser print dialog for the given HTML only (a hidden frame — no application
 * chrome). The frame's document title is the default PDF file name in most browsers.
 * @returns {Promise<void>} resolves when the dialog was opened
 */
export function printHtmlDocument(html, { doc = globalThis.document } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const frame = doc.createElement('iframe');
      frame.setAttribute('title', 'Print document');
      frame.setAttribute('aria-hidden', 'true');
      // No scripts can run inside the frame; the parent may only call print().
      frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      const cleanup = () => setTimeout(() => frame.remove(), 1000);
      frame.onload = () => {
        try {
          const win = frame.contentWindow;
          win.addEventListener?.('afterprint', cleanup);
          win.focus();
          win.print();
          setTimeout(cleanup, 60000);
          resolve();
        } catch (err) {
          frame.remove();
          reject(err);
        }
      };
      frame.srcdoc = html;
      doc.body.appendChild(frame);
    } catch (err) {
      reject(err);
    }
  });
}
