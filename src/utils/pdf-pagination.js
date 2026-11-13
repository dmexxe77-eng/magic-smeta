/** Keep an opt-in section heading with the table header and first body row,
 * or with the following paragraph when that section has no rows.
 */
export function keepWithNextRanges(headings, toRange, textLines = () => []) {
  return Array.from(headings).flatMap(heading => {
    const next = heading.nextElementSibling;
    if (!next) return [];
    const end = next.querySelector('tbody tr') || next;
    const lines = textLines(end);
    return [{ top: toRange(heading).top, bottom: lines.length ? lines[Math.min(1, lines.length - 1)].bottom : toRange(end).bottom }];
  });
}

/** Keep an opt-in footer and the document's bottom frame with its last body
 * block, so a final table row can move instead of leaving a footer-only page.
 */
export function keepWithPreviousRanges(footers, toRange, textLines = () => []) {
  return Array.from(footers).flatMap(footer => {
    const previous = footer.previousElementSibling;
    if (!previous) return [];
    const blocks = Array.from(previous.querySelectorAll('tr, .no-split, p'));
    let last = blocks.at(-1) || previous;
    while (last.matches?.('[data-pdf-summary]') && last.previousElementSibling) last = last.previousElementSibling;
    const group = last.closest?.('.no-split');
    if (group && (group === previous || previous.contains(group))) last = group;
    const parent = footer.parentElement;
    const end = parent?.lastElementChild === footer ? parent : footer;
    const lines = textLines(last);
    return [{ top: lines.length ? lines[Math.max(0, lines.length - 2)].top : toRange(last).top, bottom: toRange(end).bottom }];
  });
}

/** Measure painted text lines, merging inline fragments on the same line. */
export function pdfTextLines(element, toRange) {
  if (!element.matches?.('p,td,.contract-requisites>div') || !element.textContent?.trim()) return [];
  const range = element.ownerDocument.createRange();
  const walker = element.ownerDocument.createTreeWalker(element, 4);
  const rects = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    rects.push(...range.getClientRects());
  }
  const paintedRects = rects.filter(rect => rect.width > 0 && rect.height > 0).sort((a, b) => a.top - b.top);
  const lines = [];
  for (const rect of paintedRects) {
    const previous = lines.at(-1);
    if (previous && rect.top < previous.bottom - 1) {
      previous.left = Math.min(previous.left, rect.left);
      previous.right = Math.max(previous.right, rect.right);
      previous.top = Math.min(previous.top, rect.top);
      previous.bottom = Math.max(previous.bottom, rect.bottom);
    } else lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
  }
  return lines.map(rect => toRange({ getBoundingClientRect: () => rect }));
}

/** Shared constraints keep preview and exported PDF on the same boundaries. */
export function collectPdfAvoidRanges(root, toRange) {
  const cache = new Map();
  const textLines = element => {
    if (!cache.has(element)) cache.set(element, pdfTextLines(element, toRange));
    return cache.get(element);
  };
  const textRanges = [...root.querySelectorAll('p,td,.contract-requisites>div')].flatMap(element => {
    const lines = textLines(element);
    if (lines.length < 2) return lines;
    return [...lines, { top: lines[0].top, bottom: lines[1].bottom }, { top: lines.at(-2).top, bottom: lines.at(-1).bottom }];
  });
  return [
    ...[...root.querySelectorAll('.no-split,table tr')].map(toRange),
    ...textRanges,
    ...keepWithNextRanges(root.querySelectorAll('[data-pdf-keep-with-next]'), toRange, textLines),
    ...keepWithPreviousRanges(root.querySelectorAll('[data-pdf-keep-with-previous]'), toRange, textLines),
  ];
}

/** A root document marker includes its own frame, beyond any nested content markers. */
export function pdfContentEnd(root, toRange) {
  const markers = [...root.querySelectorAll('[data-pdf-content-end]')];
  if (root.matches('[data-pdf-content-end]')) markers.push(root);
  return markers.length ? Math.max(...markers.map(element => toRange(element).bottom)) : undefined;
}

/** Plan raster slices without splitting blocks that fit on a page.
 * Explicit section breaks take precedence over a containing no-split block.
 */
export function paginatePdf({ height, pageHeight, avoidRanges = [], breakBefore = [], contentEnd, edgeTolerance = 0 }) {
  if (!Number.isFinite(height) || height < 0 || !Number.isFinite(pageHeight) || pageHeight < 1) {
    throw new RangeError("Invalid PDF page dimensions");
  }
  // A renderer may identify its final content edge to exclude trailing paper
  // padding. Never infer that a short final slice contains only whitespace.
  const total = Math.ceil(Number.isFinite(contentEnd) && contentEnd > 0 ? Math.min(height, contentEnd) : height);
  const capacity = Math.floor(pageHeight);
  // DOM bounds rounded outward may make touching rows overlap by one raster
  // pixel. Opt in to ignoring that rounding edge, never a larger real overlap.
  const tolerance = Number.isFinite(edgeTolerance) ? Math.min(1, Math.max(0, edgeTolerance)) : 0;
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
        const crossing = ranges.filter(range => range.top >= top && range.top < bottom && range.bottom > bottom + tolerance);
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
