import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateAdjustmentVisibility, setEstimateAdjustmentVisibility, normalizeEstimateExportOptions, ESTIMATE_COLUMN_IDS } from '../src/utils/estimate-export-options.js';

test('new and unversioned estimate settings start with every column enabled', () => {
  for (const previous of [undefined, {}, { type: 'rooms', cols: { photo: false, price: false } }]) {
    const before = JSON.stringify(previous);
    const next = normalizeEstimateExportOptions(previous);
    assert.deepEqual(Object.keys(next.cols), ESTIMATE_COLUMN_IDS);
    assert.ok(Object.values(next.cols).every(value => value === true));
    assert.equal(next.columnsDefaultsVersion, 1);
    if (previous?.type) assert.equal(next.type, previous.type);
    assert.equal(JSON.stringify(previous), before);
  }
});

test('manual exclusions made after migration remain disabled on reopening', () => {
  const initial = normalizeEstimateExportOptions({ cols: { photo: false } });
  const edited = { ...initial, cols: { ...initial.cols, photo: false, price: false }, showAdjustment: false };
  const reopened = normalizeEstimateExportOptions(JSON.parse(JSON.stringify(edited)));
  assert.equal(reopened.cols.photo, false);
  assert.equal(reopened.cols.price, false);
  assert.equal(reopened.cols.total, true);
  assert.equal(reopened.showAdjustment, false);
});

test('group display flags inherit the legacy setting and preserve other settings', () => {
  const original = { showAdjustment: false, other: 'preserved' };
  const next = setEstimateAdjustmentVisibility(original, 'works', true);
  assert.deepEqual(estimateAdjustmentVisibility(next), { mats: false, works: true, equipment: false });
  assert.deepEqual(original, { showAdjustment: false, other: 'preserved' });
  assert.equal(next.other, 'preserved');
  assert.deepEqual(estimateAdjustmentVisibility(setEstimateAdjustmentVisibility(next, 'mats', true)), { mats: true, works: true, equipment: false });
  assert.deepEqual(estimateAdjustmentVisibility(setEstimateAdjustmentVisibility(next, 'all', true)), { mats: true, works: true, equipment: true });
  assert.deepEqual(estimateAdjustmentVisibility(), { mats: true, works: true, equipment: true });
});
