/**
 * Copy text with the async Clipboard API. Resolves true on success.
 * (No deprecated execCommand fallback — callers tell the user to copy manually.)
 */
export async function copyText(text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
