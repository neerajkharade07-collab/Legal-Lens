/**
 * DEMO export: downloads the current draft as a Word-compatible HTML document
 * (.doc). Full PDF/DOCX export with court formatting comes with the Export API.
 */
function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

export function downloadAsWordHtml({ title, html, lineHeight = 1.5 }) {
  const safeTitle = escapeHtml(title || 'Legal Lens draft');
  const documentHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 25mm; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: ${lineHeight}; }
  h1 { font-size: 15pt; text-transform: uppercase; letter-spacing: 0.08em; }
  h2 { font-size: 12.5pt; }
  [data-empty="true"] { color: #777; }
</style></head><body>${html}</body></html>`;
  const blob = new Blob(['﻿', documentHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${
    (title || 'draft')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'draft'
  }.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
