/**
 * Legal Drafting Phase 4 — SHA-256 of a TipTap document as stable JSON (sorted keys).
 * The SAME algorithm as the backend's documentFinalizeService.savedContentHash(), so the server
 * can confirm that the version being finalized is exactly the content the user just saved.
 */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    // Keys whose value is undefined are skipped, as JSON (and the database) drops them.
    return `{${Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** @returns {Promise<string>} lowercase hex digest */
export async function contentHash(content) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('This browser cannot verify the saved version (secure context required). Open the site over https or localhost.');
  const bytes = new TextEncoder().encode(stableStringify(content ?? {}));
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
