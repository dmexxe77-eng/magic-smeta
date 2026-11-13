import test from 'node:test';
import assert from 'node:assert/strict';
import { keepWithNextRanges, keepWithPreviousRanges, pdfTextLines, collectPdfAvoidRanges, pdfContentEnd, paginatePdf } from '../src/utils/pdf-pagination.js';

test('slices cover the entire canvas once, including the last partial page', () => {
  assert.deepEqual(paginatePdf({ height: 250, pageHeight: 100 }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 200 }, { top: 200, bottom: 250 },
  ]);
  assert.deepEqual(paginatePdf({ height: 0, pageHeight: 100 }), []);
});

test('drawing appendix and each room can start a page at explicit markers', () => {
  assert.deepEqual(paginatePdf({ height: 370, pageHeight: 100, breakBefore: [240, 75] }), [
    { top: 0, bottom: 75 }, { top: 75, bottom: 175 }, { top: 175, bottom: 240 },
    { top: 240, bottom: 340 }, { top: 340, bottom: 370 },
  ]);
});

test('duplicate, current-page and end markers never create empty pages', () => {
  assert.deepEqual(paginatePdf({ height: 250, pageHeight: 100, breakBefore: [0, 0, 100, 100, 200, 250, 400, -20, NaN] }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 200 }, { top: 200, bottom: 250 },
  ]);
});

test('keeps a drawing pair intact even when it starts near the top of a page', () => {
  assert.deepEqual(paginatePdf({ height: 175, pageHeight: 100, avoidRanges: [{ top: 20, bottom: 115 }] }), [
    { top: 0, bottom: 20 }, { top: 20, bottom: 120 }, { top: 120, bottom: 175 },
  ]);
});

test('nested and overlapping blocks are reconsidered after moving a boundary', () => {
  assert.deepEqual(paginatePdf({ height: 180, pageHeight: 100, avoidRanges: [
    { top: 70, bottom: 130 }, { top: 40, bottom: 100 }, { top: 40, bottom: 135 },
  ] }), [
    { top: 0, bottom: 40 }, { top: 40, bottom: 140 }, { top: 140, bottom: 180 },
  ]);
});

test('a block exactly one page high stays together and boundary-aligned rows do not move', () => {
  assert.deepEqual(paginatePdf({ height: 230, pageHeight: 100, avoidRanges: [
    { top: 0, bottom: 30 }, { top: 30, bottom: 130 }, { top: 130, bottom: 230 },
  ] }), [
    { top: 0, bottom: 30 }, { top: 30, bottom: 130 }, { top: 130, bottom: 230 },
  ]);
});

test('overlarge wrappers can split while their fitting child rows stay intact', () => {
  assert.deepEqual(paginatePdf({ height: 250, pageHeight: 100, avoidRanges: [
    { top: 0, bottom: 250 }, { top: 80, bottom: 120 }, { top: 160, bottom: 210 },
  ] }), [
    { top: 0, bottom: 80 }, { top: 80, bottom: 160 }, { top: 160, bottom: 250 },
  ]);
});

test('impossible overlapping constraints still make progress without losing pixels', () => {
  assert.deepEqual(paginatePdf({ height: 150, pageHeight: 100, avoidRanges: [
    { top: 0, bottom: 90 }, { top: 80, bottom: 140 },
  ] }), [{ top: 0, bottom: 100 }, { top: 100, bottom: 150 }]);
});

test('explicit breaks take precedence over containing blocks', () => {
  assert.deepEqual(paginatePdf({ height: 140, pageHeight: 100, breakBefore: [50], avoidRanges: [{ top: 10, bottom: 90 }] }), [
    { top: 0, bottom: 50 }, { top: 50, bottom: 140 },
  ]);
});

test('fractional and out-of-range bounds normalize consistently', () => {
  assert.deepEqual(paginatePdf({ height: 100.2, pageHeight: 50.8, breakBefore: [30.9], avoidRanges: [
    { top: NaN, bottom: 100 }, { top: 90, bottom: 80 }, { top: 45.5, bottom: 85.1 },
  ] }), [{ top: 0, bottom: 30 }, { top: 30, bottom: 45 }, { top: 45, bottom: 95 }, { top: 95, bottom: 101 }]);
  assert.throws(() => paginatePdf({ height: 10, pageHeight: 0 }), RangeError);
  assert.throws(() => paginatePdf({ height: Infinity, pageHeight: 100 }), RangeError);
});

test('an explicit final content edge excludes trailing padding that would create a blank page', () => {
  assert.deepEqual(paginatePdf({ height: 330, pageHeight: 100, contentEnd: 300 }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 200 }, { top: 200, bottom: 300 },
  ]);
  assert.deepEqual(paginatePdf({ height: 330, pageHeight: 100, contentEnd: 295, breakBefore: [330] }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 200 }, { top: 200, bottom: 295 },
  ]);
});

test('short final pages with real content are retained and invalid content edges do not crop', () => {
  assert.deepEqual(paginatePdf({ height: 330, pageHeight: 100, contentEnd: 300.2 }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 200 }, { top: 200, bottom: 300 }, { top: 300, bottom: 301 },
  ]);
  const full = [{ top: 0, bottom: 100 }, { top: 100, bottom: 101 }];
  for (const contentEnd of [undefined, NaN, Infinity, -1, 0, 1000]) {
    assert.deepEqual(paginatePdf({ height: 101, pageHeight: 100, contentEnd }), full);
  }
});

test('marked headings stay with table headers and the first body row, not the whole table', () => {
  const firstRow = { range: { top: 95, bottom: 125 } };
  const table = { range: { top: 85, bottom: 230 }, querySelector: selector => selector === 'tbody tr' ? firstRow : null };
  const heading = { range: { top: 70, bottom: 80 }, nextElementSibling: table };
  const keepRanges = keepWithNextRanges([heading], element => element.range);
  assert.deepEqual(keepRanges, [{ top: 70, bottom: 125 }]);
  assert.deepEqual(paginatePdf({ height: 230, pageHeight: 100, avoidRanges: [
    heading.range, { top: 85, bottom: 95 }, firstRow.range, ...keepRanges,
  ] }), [
    { top: 0, bottom: 70 }, { top: 70, bottom: 170 }, { top: 170, bottom: 230 },
  ]);
});

test('empty sections keep their heading with the empty note and unmarked documents add no constraints', () => {
  const note = { range: { top: 90, bottom: 115 }, querySelector: () => null };
  const heading = { range: { top: 75, bottom: 85 }, nextElementSibling: note };
  const keepRanges = keepWithNextRanges([heading], element => element.range);
  assert.deepEqual(paginatePdf({ height: 140, pageHeight: 100, avoidRanges: keepRanges }), [
    { top: 0, bottom: 75 }, { top: 75, bottom: 140 },
  ]);
  assert.deepEqual(keepWithNextRanges([], element => element.range), []);
  assert.deepEqual(keepWithNextRanges([{ range: { top: 0, bottom: 20 } }], element => element.range), []);
});

test('an appendix footer and bottom frame move with the last estimate row instead of making a footer-only page', () => {
  const row = { range: { top: 85, bottom: 95 } };
  const table = { range: { top: 20, bottom: 95 }, querySelectorAll: () => [row] };
  const article = { range: { top: 0, bottom: 130 } };
  const footer = { range: { top: 100, bottom: 106 }, previousElementSibling: table, parentElement: article };
  article.lastElementChild = footer;
  const ranges = keepWithPreviousRanges([footer], element => element.range);
  assert.deepEqual(ranges, [{ top: 85, bottom: 130 }]);
  assert.deepEqual(paginatePdf({ height: 220, pageHeight: 100, breakBefore: [130], avoidRanges: [row.range, ...ranges] }), [
    { top: 0, bottom: 85 }, { top: 85, bottom: 130 }, { top: 130, bottom: 220 },
  ]);
});

test('footer constraints leave an exactly fitting page intact and keep explicit next-appendix breaks', () => {
  const row = { range: { top: 85, bottom: 90 } };
  const table = { querySelectorAll: () => [row] };
  const article = { range: { top: 0, bottom: 100 } };
  const footer = { range: { top: 92, bottom: 97 }, previousElementSibling: table, parentElement: article };
  article.lastElementChild = footer;
  assert.deepEqual(paginatePdf({ height: 175, pageHeight: 100, breakBefore: [100], avoidRanges: keepWithPreviousRanges([footer], element => element.range) }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 175 },
  ]);
});

test('a footer keeps the containing no-split tail intact rather than only its last paragraph', () => {
  const group = { range: { top: 75, bottom: 95 } };
  const paragraph = { range: { top: 88, bottom: 95 }, closest: () => group };
  const previous = { querySelectorAll: () => [group, paragraph], contains: element => element === group };
  const article = { range: { top: 0, bottom: 130 } };
  const footer = { range: { top: 100, bottom: 106 }, previousElementSibling: previous, parentElement: article };
  article.lastElementChild = footer;
  assert.deepEqual(keepWithPreviousRanges([footer], element => element.range), [{ top: 75, bottom: 130 }]);
});

test('an overlarge footer tail still makes progress without cropping or swallowing the next section', () => {
  const previous = { range: { top: 70, bottom: 95 }, querySelectorAll: () => [] };
  const article = { range: { top: 0, bottom: 180 } };
  const footer = { range: { top: 100, bottom: 150 }, previousElementSibling: previous, parentElement: article };
  article.lastElementChild = footer;
  assert.deepEqual(paginatePdf({ height: 250, pageHeight: 100, breakBefore: [180], avoidRanges: keepWithPreviousRanges([footer], element => element.range) }), [
    { top: 0, bottom: 100 }, { top: 100, bottom: 180 }, { top: 180, bottom: 250 },
  ]);
  assert.deepEqual(keepWithPreviousRanges([], element => element.range), []);
  assert.deepEqual(keepWithPreviousRanges([{ range: { top: 0, bottom: 10 } }], element => element.range), []);
});

test('one raster pixel of outward row rounding does not move a whole estimate before its footer', () => {
  const rows = Array.from({ length: 34 }, (_, index) => ({ top: 20.5 + index * 25, bottom: 20.5 + (index + 1) * 25 }));
  const footerTail = { top: rows.at(-1).top, bottom: 940 };
  assert.deepEqual(paginatePdf({ height: 1700, pageHeight: 900, breakBefore: [940], avoidRanges: [...rows, footerTail], edgeTolerance: 1 }), [
    { top: 0, bottom: 845 }, { top: 845, bottom: 940 }, { top: 940, bottom: 1700 },
  ]);
});

test('raster tolerance does not weaken a real two-pixel overlap or a nested keep-together block', () => {
  assert.deepEqual(paginatePdf({ height: 150, pageHeight: 100, avoidRanges: [{ top: 80, bottom: 102 }], edgeTolerance: 1 }), [
    { top: 0, bottom: 80 }, { top: 80, bottom: 150 },
  ]);
  assert.deepEqual(paginatePdf({ height: 180, pageHeight: 100, avoidRanges: [
    { top: 70, bottom: 130 }, { top: 40, bottom: 100 }, { top: 40, bottom: 135 },
  ], edgeTolerance: 1 }), [
    { top: 0, bottom: 40 }, { top: 40, bottom: 140 }, { top: 140, bottom: 180 },
  ]);
});

test('the last line item stays with all summary rows and the document footer', () => {
  const line = { range: { top: 70, bottom: 80 } };
  const subtotal = { range: { top: 80, bottom: 90 }, matches: () => true, previousElementSibling: line };
  const total = { range: { top: 90, bottom: 98 }, matches: () => true, previousElementSibling: subtotal };
  const table = { querySelectorAll: () => [line, subtotal, total] };
  const article = { range: { top: 0, bottom: 124 } };
  const footer = { previousElementSibling: table, parentElement: article };
  article.lastElementChild = footer;
  const ranges = keepWithPreviousRanges([footer], element => element.range);
  assert.deepEqual(ranges, [{ top: 70, bottom: 124 }]);
  assert.deepEqual(paginatePdf({ height: 124, pageHeight: 100, avoidRanges: ranges }), [{ top: 0, bottom: 70 }, { top: 70, bottom: 124 }]);
});

test('a marked root retains its bottom frame beyond nested footer markers', () => {
  const footer = { range: { top: 80, bottom: 100 } };
  const root = { range: { top: 0, bottom: 125 }, matches: () => true, querySelectorAll: () => [footer] };
  assert.equal(pdfContentEnd(root, element => element.range), 125);
  root.matches = () => false;
  assert.equal(pdfContentEnd(root, element => element.range), 100);
  root.querySelectorAll = () => [];
  assert.equal(pdfContentEnd(root, element => element.range), undefined);
});

function paragraphFixture(rectGroups) {
  const nodes = rectGroups.map(rects => ({ textContent: 'Текст', rects }));
  let current;
  return {
    textContent: 'Текст', matches: () => true,
    ownerDocument: {
      createTreeWalker: () => { let index = 0; return { nextNode: () => nodes[index++] || null }; },
      createRange: () => ({ selectNodeContents: node => { current = node; }, getClientRects: () => current.rects }),
    },
  };
}
const textRect = (top, bottom, left = 0, right = 80) => ({ top, bottom, left, right, width: right - left, height: bottom - top });
const measuredRange = element => { const rect = element.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; };

test('painted text fragments merge by line without treating nested block boxes as a whole paragraph', () => {
  const paragraph = paragraphFixture([
    [textRect(60, 68, 0, 30), textRect(72, 80)],
    [textRect(61, 68, 32, 80), textRect(84, 92)],
  ]);
  assert.deepEqual(pdfTextLines(paragraph, measuredRange), [{ top: 60, bottom: 68 }, { top: 72, bottom: 80 }, { top: 84, bottom: 92 }]);
});

test('paragraph pagination preserves painted lines and two-line starts and endings', () => {
  const paragraph = paragraphFixture([Array.from({ length: 8 }, (_, index) => textRect(12 + index * 12, 20 + index * 12))]);
  const root = { querySelectorAll: selector => selector === 'p,td,.contract-requisites>div' ? [paragraph] : [] };
  const avoidRanges = collectPdfAvoidRanges(root, measuredRange);
  const slices = paginatePdf({ height: 104, pageHeight: 50, avoidRanges });
  assert.deepEqual(slices, [{ top: 0, bottom: 48 }, { top: 48, bottom: 84 }, { top: 84, bottom: 104 }]);
  for (const line of pdfTextLines(paragraph, measuredRange)) {
    assert.ok(slices.some(slice => line.top >= slice.top && line.bottom <= slice.bottom), 'every complete line is retained on one page');
  }
});

test('a heading keeps two opening lines while long text remains free to continue on later pages', () => {
  const paragraph = { querySelector: () => null, range: { top: 85, bottom: 240 } };
  const heading = { range: { top: 70, bottom: 80 }, nextElementSibling: paragraph };
  const lines = [{ top: 85, bottom: 94 }, { top: 97, bottom: 106 }, { top: 109, bottom: 118 }];
  const range = element => element.range;
  const avoidRanges = keepWithNextRanges([heading], range, () => lines);
  assert.deepEqual(avoidRanges, [{ top: 70, bottom: 106 }]);
  assert.equal(paginatePdf({ height: 240, pageHeight: 100, avoidRanges })[0].bottom, 70);
});

test('closing requisites move with two final text lines rather than becoming a page alone', () => {
  const paragraph = { range: { top: 20, bottom: 90 }, querySelectorAll: () => [] };
  const closing = { range: { top: 95, bottom: 125 }, previousElementSibling: paragraph };
  const avoidRanges = keepWithPreviousRanges([closing], element => element.range, element => element === paragraph ? [
    { top: 60, bottom: 68 }, { top: 72, bottom: 80 }, { top: 84, bottom: 90 },
  ] : []);
  assert.deepEqual(avoidRanges, [{ top: 72, bottom: 125 }]);
  assert.deepEqual(paginatePdf({ height: 125, pageHeight: 100, avoidRanges }), [{ top: 0, bottom: 72 }, { top: 72, bottom: 125 }]);
});
