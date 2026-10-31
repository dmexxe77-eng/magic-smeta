import test from 'node:test';
import assert from 'node:assert/strict';
import { keepWithNextRanges, paginatePdf } from '../src/utils/pdf-pagination.js';

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
