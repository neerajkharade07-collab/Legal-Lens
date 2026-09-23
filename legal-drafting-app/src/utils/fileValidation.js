/**
 * Frontend-only file checks for Review / Compare. Files are never uploaded.
 */
export const ACCEPTED_FILE_TYPES = [
  { ext: 'pdf', label: 'PDF', mime: ['application/pdf'], kind: 'pdf' },
  {
    ext: 'docx',
    label: 'DOCX',
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    kind: 'docx',
  },
  { ext: 'jpg', label: 'JPG', mime: ['image/jpeg'], kind: 'image' },
  { ext: 'jpeg', label: 'JPEG', mime: ['image/jpeg'], kind: 'image' },
  { ext: 'png', label: 'PNG', mime: ['image/png'], kind: 'image' },
];

export const ACCEPT_ATTRIBUTE = ACCEPTED_FILE_TYPES.map((t) => `.${t.ext}`).join(',');
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function extensionOf(name = '') {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : '';
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @returns {{ ok: true, info } | { ok: false, error }}
 * info: { name, ext, label, kind: 'pdf'|'docx'|'image', size, sizeLabel, mime, lastModified }
 */
export function validateFile(file) {
  if (!file) return { ok: false, error: 'No file was selected.' };
  const ext = extensionOf(file.name);
  const type = ACCEPTED_FILE_TYPES.find((t) => t.ext === ext);
  if (!type) {
    return {
      ok: false,
      error: ext
        ? `.${ext.toUpperCase()} files are not supported. Use PDF, DOCX, JPG, JPEG or PNG.`
        : 'This file has no extension. Use PDF, DOCX, JPG, JPEG or PNG.',
    };
  }
  if (file.type && !type.mime.includes(file.type) && file.type !== 'application/octet-stream') {
    return { ok: false, error: `The file “${file.name}” does not look like a ${type.label} file.` };
  }
  if (file.size === 0) return { ok: false, error: 'This file is empty.' };
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `This file is ${formatBytes(file.size)}. The limit in this demo is ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }
  return {
    ok: true,
    info: {
      name: file.name,
      ext,
      label: type.label,
      kind: type.kind,
      size: file.size,
      sizeLabel: formatBytes(file.size),
      mime: file.type || type.mime[0],
      lastModified: file.lastModified ?? null,
    },
  };
}
