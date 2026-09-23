/**
 * Scroll `element` into view inside `container` only — unlike
 * element.scrollIntoView(), this never scrolls the page itself.
 * align: 'center' | 'nearest'
 */
export function scrollWithin(container, element, { align = 'center', behavior = 'smooth' } = {}) {
  if (!container || !element) return;
  const c = container.getBoundingClientRect();
  const e = element.getBoundingClientRect();
  const offset = e.top - c.top + container.scrollTop;
  let top;
  if (align === 'nearest') {
    if (e.top >= c.top && e.bottom <= c.bottom) return;
    top = e.top < c.top ? offset - 8 : offset - container.clientHeight + e.height + 8;
  } else {
    top = offset - container.clientHeight / 2 + e.height / 2;
  }
  container.scrollTo({ top: Math.max(0, top), behavior });
}
