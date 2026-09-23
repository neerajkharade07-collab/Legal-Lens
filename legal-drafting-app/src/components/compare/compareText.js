/** Presentation helpers for the redline views. */
export const CHANGE_LABEL = { added: 'Added', removed: 'Removed', modified: 'Modified' };

/** Headings in the plain-text documents: ALL-CAPS lines or short numbered lines. */
export function isHeadingText(text = '') {
  const words = text.trim().split(/\s+/).length;
  return (
    (/[A-Z]/.test(text) && text === text.toUpperCase() && words <= 8) ||
    (/^\d+[.)]\s+\S/.test(text) && words <= 6 && !/[.:;]$/.test(text))
  );
}
