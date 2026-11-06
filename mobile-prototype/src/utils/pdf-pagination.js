/** Keep an opt-in section heading with the table header and first body row,
 * or with the following paragraph when that section has no rows.
 */
export function keepWithNextRanges(headings, toRange) {
  return Array.from(headings).flatMap(heading => {
    const next = heading.nextElementSibling;
    if (!next) return [];
    const end = next.querySelector('tbody tr') || next;
    return [{ top: toRange(heading).top, bottom: toRange(end).bottom }];
  });
}

/** Plan raster slices without splitting blocks that fit on a page.
 * Explicit section breaks take precedence over a containing no-split block.
 */
export function paginatePdf({ height, pageHeight, avoidRanges = [], breakBefore = [], contentEnd }) {
  if (!Number.isFinite(height) || height < 0 || !Number.isFinite(pageHeight) || pageHeight < 1) {
    throw new RangeError("Invalid PDF page dimensions");
  }
  // A renderer may identify its final content edge to exclude trailing paper
  // padding. Never infer that a short final slice contains only whitespace.
  const total = Math.ceil(Number.isFinite(contentEnd) && contentEnd > 0 ? Math.min(height, contentEnd) : height);
  const capacity = Math.floor(pageHeight);
  const ranges = avoidRanges
    .filter(range => Number.isFinite(range.top) && Number.isFinite(range.bottom))
    .map(range => ({ top: Math.max(0, Math.floor(range.top)), bottom: Math.min(total, Math.ceil(range.bottom)) }))
    .filter(range => range.bottom > range.top && range.bottom - range.top <= capacity);
  const breaks = [...new Set(breakBefore.filter(Number.isFinite).map(Math.floor))]
    .filter(top => top > 0 && top < total)
    .sort((a, b) => a - b);
  const slices = [];
  let top = 0;
  let breakIndex = 0;
  while (top < total) {
    while (breakIndex < breaks.length && breaks[breakIndex] <= top) breakIndex++;
    const forcedEnd = breaks[breakIndex] ?? total;
    const targetEnd = Math.min(top + capacity, total, forcedEnd);
    let bottom = targetEnd;
    if (targetEnd !== forcedEnd) {
      // Moving before one row can enter an enclosing block. Repeat until the
      // boundary is clear, or fall back if overlapping blocks cannot all fit.
      while (true) {
        const crossing = ranges.filter(range => range.top >= top && range.top < bottom && range.bottom > bottom);
        if (!crossing.length) break;
        const previous = crossing.reduce((earliest, range) => Math.min(earliest, range.top), bottom);
        if (previous <= top) { bottom = targetEnd; break; }
        bottom = previous;
      }
    }
    slices.push({ top, bottom });
    top = bottom;
  }
  return slices;
}
