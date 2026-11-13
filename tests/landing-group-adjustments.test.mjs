import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGroupAdjustments, normalizePercent } from '../public/landing/group-adjustments.js';
import { calculateEstimateTotals } from '../src/utils/estimate-adjustment.js';

test('independent discounts and markups keep equipment unchanged', () => {
  const result = applyGroupAdjustments(
    { materials: 20000, works: 10000, equipment: 5000 },
    { materials: -10, works: 5, equipment: 0 },
  );
  assert.deepEqual(result.groups, { materials: 18000, works: 10500, equipment: 5000 });
  assert.deepEqual(result.adjustments, { materials: -2000, works: 500, equipment: 0 });
  assert.equal(result.total, 33500);
});

test('removing every adjustment restores the original estimate', () => {
  const bases = { materials: 22580, works: 24000, equipment: 7200 };
  const adjusted = applyGroupAdjustments(bases, { materials: -100, works: 1000, equipment: 12.5 });
  assert.deepEqual(adjusted.groups, { materials: 0, works: 264000, equipment: 8100 });
  const reset = applyGroupAdjustments(bases, { materials: 0, works: 0, equipment: 0 });
  assert.deepEqual(reset.groups, bases);
  assert.equal(reset.total, 53780);
});

test('decimal input supports comma, whitespace, limits and invalid-value recovery', () => {
  assert.equal(normalizePercent(' −10 ', 5), 5);
  assert.equal(normalizePercent(' -12,5 ', 5), -12.5);
  assert.equal(normalizePercent('', 5), 0);
  assert.equal(normalizePercent('-', 5), 5);
  assert.equal(normalizePercent('abc', 5), 5);
  assert.equal(normalizePercent('-120'), -100);
  assert.equal(normalizePercent('2000'), 1000);
});

test('demo totals match application rounding for uniform and independent rates', () => {
  const bases = [
    { materials: 0.05, works: 0.05, equipment: 0.05 },
    { materials: 10080, works: 9300, equipment: 0 },
    { materials: 22580, works: 24000, equipment: 7200 },
    { materials: 0, works: 0, equipment: 0 },
  ];
  const scenarios = [
    { materials: 10, works: 10, equipment: 10 },
    { materials: -10, works: -10, equipment: -10 },
    { materials: -12.5, works: 5.25, equipment: 0 },
    { materials: -100, works: 1000, equipment: 0.005 },
  ];
  for (const base of bases) {
    for (const rates of scenarios) {
      const result = applyGroupAdjustments(base, rates);
      const actual = calculateEstimateTotals(base.materials, base.works, {
        scope: 'all', rates: { mats: rates.materials, works: rates.works, equipment: rates.equipment },
      }, base.equipment);
      assert.equal(result.total, actual.adjustedTotal, JSON.stringify({ base, rates }));
      assert.equal(Math.round(Object.values(result.groups).reduce((sum, amount) => sum + amount, 0) * 100) / 100, result.total);
    }
  }
});
