/**
 * Local version history — future: Versions API.
 *
 * Stored per document under `legal-lens:versions:v1:<docId>` as an array of
 * snapshots (oldest first). Versions are created at meaningful events only
 * (manual save, clause added, assistant edit accepted, major edit, regenerate,
 * restore) —
 * never per keystroke. Identical consecutive snapshots are skipped.
 */
import { readStorage, writeStorage, removeStorage, STORAGE_KEYS } from '../utils/storage';
import { createId } from '../utils/id';

export const MAX_VERSIONS = 40;

export const VERSION_REASONS = {
  created: 'Initial version',
  'manual-save': 'Manual save',
  'clause-added': 'Clause added',
  'ai-edit': 'AI edit accepted',
  'major-edit': 'Major edit',
  regenerated: 'Regenerated from template',
  restored: 'Restored',
};

function buildLabel(reason, detail) {
  if (reason === 'restored') return detail ? `Restored from ${detail}` : 'Restored';
  const base = VERSION_REASONS[reason] ?? reason;
  return detail ? `${base}: ${detail}` : base;
}

/** Plain-text length of TipTap JSON (field tokens count by their value/label). */
export function contentTextLength(node) {
  if (!node) return 0;
  if (node.type === 'text') return node.text?.length ?? 0;
  if (node.type === 'fieldToken')
    return String(node.attrs?.value || node.attrs?.label || '').length;
  return (node.content ?? []).reduce((sum, child) => sum + contentTextLength(child), 0);
}

export const MAJOR_CHANGE_CHARS = 400;

/** A "major change": the text grew or shrank by MAJOR_CHANGE_CHARS or more since the last version. */
export function isMajorChange(previousContent, nextContent, threshold = MAJOR_CHANGE_CHARS) {
  if (!previousContent) return false;
  return Math.abs(contentTextLength(nextContent) - contentTextLength(previousContent)) >= threshold;
}

const keyFor = (docId) => `${STORAGE_KEYS.versionsPrefix}${docId}`;

export function listVersions(docId) {
  const list = readStorage(keyFor(docId), []);
  return Array.isArray(list) ? list : [];
}

const fingerprint = (v) => JSON.stringify([v.content, v.fields, v.formatting]);

/**
 * @param {string} docId
 * @param {{ reason: keyof VERSION_REASONS, detail?: string, content, fields, formatting, force?: boolean }} snapshot
 * @returns {{ versions: object[], created: object|null }}
 */
export function recordVersion(
  docId,
  { reason, detail, content, fields, formatting, force = false },
) {
  const versions = listVersions(docId);
  const last = versions[versions.length - 1];
  const candidate = { content, fields: fields ?? {}, formatting: formatting ?? {} };
  if (!force && last && fingerprint(last) === fingerprint(candidate)) {
    return { versions, created: null };
  }
  const number = (last?.number ?? 0) + 1;
  const version = {
    id: createId('ver'),
    number,
    createdAt: new Date().toISOString(),
    reason,
    label: buildLabel(reason, detail),
    ...candidate,
  };
  // Keep the newest MAX_VERSIONS; numbering continues so labels stay stable.
  const next = [...versions, version].slice(-MAX_VERSIONS);
  const ok = writeStorage(keyFor(docId), next);
  return { versions: ok ? next : versions, created: ok ? version : null };
}

export function getVersion(docId, versionId) {
  return listVersions(docId).find((v) => v.id === versionId) ?? null;
}

export function deleteVersions(docId) {
  return removeStorage(keyFor(docId));
}
