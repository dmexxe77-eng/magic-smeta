import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateAdjustmentVisibility, setEstimateAdjustmentVisibility } from '../src/utils/estimate-export-options.js';

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
