/**
 * Greedy block pagination for the court-ready preview.
 * @param {{ height: number, keepWithNext?: boolean }[]} blocks measured block heights (px)
 * @param {number} capacity usable content height of one page (px)
 * @returns {number[][]} block indices per page
 *
 * - Headings (keepWithNext) are moved to the next page rather than left alone
 *   at the bottom of a page.
 * - A block taller than a page gets a page of its own (print lets it flow).
 */
export function paginateBlocks(blocks, capacity) {
  const pages = [];
  let current = [];
  let used = 0;

  const newPage = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };

  blocks.forEach((block, index) => {
    const h = Math.max(0, block.height || 0);
    if (used + h > capacity && current.length) {
      // Carry trailing keep-with-next blocks (headings) to the new page.
      const carry = [];
      while (current.length > 1 && blocks[current[current.length - 1]].keepWithNext) {
        carry.unshift(current.pop());
      }
      newPage();
      carry.forEach((i) => {
        current.push(i);
        used += Math.max(0, blocks[i].height || 0);
      });
    }
    current.push(index);
    used += h;
  });
  if (current.length || pages.length === 0) pages.push(current);
  return pages;
}
