import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { normalizeEstimateAdjustment, calculateEstimateTotals, adjustmentLabel } from '../src/utils/estimate-adjustment.js';

test('projects without a saved adjustment retain their base total', () => {
  assert.deepEqual(normalizeEstimateAdjustment(), { percent: 0, scope: 'all' });
  assert.deepEqual(calculateEstimateTotals(100, 200), {
    materialsTotal: 100, worksTotal: 200, equipmentTotal: 0, baseTotal: 300,
    adjustedTotal: 300, adjustmentAmount: 0, percent: 0, scope: 'all',
    adjustments: [], hasAdjustment: false,
  });
});

test('the PDF total is reproduced by applying 10 percent to works only', () => {
  const actual = calculateEstimateTotals(1808118, 2243016.45, { percent: 10, scope: 'works' });
  assert.equal(actual.baseTotal, 4051134.45);
  assert.equal(actual.adjustmentAmount, 224301.65);
  assert.equal(actual.adjustedTotal, 4275436.10);
  assert.equal(actual.materialsTotal, 1808118);
  assert.equal(actual.worksTotal, 2243016.45);
});

test('whole-estimate and material adjustments use only their chosen base', () => {
  assert.equal(calculateEstimateTotals(1808118, 2243016.45, { percent: 10, scope: 'all' }).adjustedTotal, 4456247.90);
  assert.equal(calculateEstimateTotals(1808118, 2243016.45, { percent: 10, scope: 'mats' }).adjustedTotal, 4231946.25);
});

test('discounts and decimal percentages preserve cent precision', () => {
  assert.equal(calculateEstimateTotals(100, 200, { percent: -15, scope: 'works' }).adjustedTotal, 270);
  assert.equal(calculateEstimateTotals(100, 200, { percent: -100, scope: 'mats' }).adjustedTotal, 200);
  assert.equal(calculateEstimateTotals(0, 123.45, { percent: 2.5, scope: 'works' }).adjustmentAmount, 3.09);
  assert.equal(calculateEstimateTotals(0, 1.005).worksTotal, 1.01);
  assert.equal(calculateEstimateTotals(0.1, 0.2).baseTotal, 0.3);
});

test('normalization rejects invalid percentages and bounds valid ones', () => {
  for (const percent of [NaN, Infinity, -Infinity, '10', null, undefined]) {
    assert.deepEqual(normalizeEstimateAdjustment({ percent, scope: 'works' }), { percent: 0, scope: 'works' });
  }
  assert.deepEqual(normalizeEstimateAdjustment({ percent: -200, scope: 'mats' }), { percent: -100, scope: 'mats' });
  assert.deepEqual(normalizeEstimateAdjustment({ percent: 2000, scope: 'wrong' }), { percent: 1000, scope: 'all' });
  assert.deepEqual(normalizeEstimateAdjustment(null), { percent: 0, scope: 'all' });
  assert.equal(calculateEstimateTotals(NaN, Infinity).baseTotal, 0);
});

test('the saved adjustment round trips without changing its source or another project', () => {
  const source = { percent: 10, scope: 'works' };
  const saved = JSON.parse(JSON.stringify({ estimateAdjustment: source }));
  assert.equal(calculateEstimateTotals(100, 200, saved.estimateAdjustment).adjustedTotal, 320);
  assert.equal(calculateEstimateTotals(100, 200).adjustedTotal, 300);
  assert.deepEqual(source, { percent: 10, scope: 'works' });
});

test('project storage preserves the adjustment alongside saved quantities', async () => {
  const bundle = await build({
    stdin: { contents: 'export { sanitizeOrdersForStorage } from "./src/data/presets.js";', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', globalName: 'app', platform: 'node', loader: { '.js': 'jsx' }, logLevel: 'error',
  });
  const context = vm.createContext({ console, setTimeout, clearTimeout });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const project = {
    id: 'markup-project', rooms: [],
    estimateAdjustment: { percent: 10, scope: 'works' },
    estimateEdits: { '["total","works","installation"]': { q: 15 } },
  };
  const restored = JSON.parse(JSON.stringify(context.app.sanitizeOrdersForStorage([project])))[0];
  assert.deepEqual(restored.estimateAdjustment, project.estimateAdjustment);
  assert.deepEqual(restored.estimateEdits, project.estimateEdits);
  assert.equal(calculateEstimateTotals(100, 200, restored.estimateAdjustment).adjustedTotal, 320);
});

test('labels state both the percentage and the affected part of the estimate', () => {
  assert.equal(adjustmentLabel({ percent: 10, scope: 'works' }), 'Наценка на работы +10%');
  assert.equal(adjustmentLabel({ percent: 10, scope: 'mats' }), 'Наценка на материалы +10%');
  assert.equal(adjustmentLabel({ percent: 10, scope: 'all' }), 'Наценка на всю смету +10%');
  assert.equal(adjustmentLabel({ percent: -2.5, scope: 'mats' }), 'Скидка на материалы −2,5%');
  assert.equal(adjustmentLabel({ percent: 0, scope: 'works' }), 'Без корректировки');
  assert.equal(adjustmentLabel({ percent: 10, scope: 'equipment' }), 'Наценка на оборудование +10%');
});

test('equipment is a separate adjustment base and remains part of the whole estimate', () => {
  const all = calculateEstimateTotals(100, 200, { percent: 10, scope: 'all' }, 300);
  assert.equal(all.baseTotal, 600);
  assert.equal(all.equipmentTotal, 300);
  assert.equal(all.adjustedTotal, 660);
  assert.equal(calculateEstimateTotals(100, 200, { percent: 10, scope: 'equipment' }, 300).adjustedTotal, 630);
  assert.equal(calculateEstimateTotals(100, 200, { percent: 10, scope: 'works' }, 300).adjustedTotal, 620);
  assert.equal(calculateEstimateTotals(100, 200, { percent: -100, scope: 'equipment' }, 300).adjustedTotal, 300);
});

test('independent group discounts and markup combine once and keep all base totals', () => {
  const rates = { mats: -5, works: 10, equipment: -10 };
  const result = calculateEstimateTotals(10000, 20000, { scope: 'mats', rates }, 5000);
  assert.equal(result.baseTotal, 35000);
  assert.equal(result.adjustmentAmount, 1000);
  assert.equal(result.adjustedTotal, 36000);
  assert.equal(result.hasAdjustment, true);
  assert.deepEqual(result.adjustments.map(({ scope, percent, amount }) => [scope, percent, amount]), [
    ['mats', -5, -500], ['works', 10, 2000], ['equipment', -10, -500],
  ]);
  assert.deepEqual(rates, { mats: -5, works: 10, equipment: -10 });
});

test('opposite adjustments remain disclosed even when they cancel each other out', () => {
  const result = calculateEstimateTotals(100, 100, { scope: 'equipment', rates: { mats: -10, works: 10, equipment: 0 } });
  assert.equal(result.adjustedTotal, 200);
  assert.equal(result.adjustmentAmount, 0);
  assert.equal(result.hasAdjustment, true);
  assert.equal(result.adjustments.length, 2);
  assert.match(adjustmentLabel(result), /Скидка на материалы −10%.*Наценка на работы \+10%/);
});

test('group updates migrate old settings and never move or duplicate another group rate', async () => {
  const { updateEstimateAdjustment } = await import('../src/utils/estimate-adjustment.js');
  const migrated = updateEstimateAdjustment({ scope: 'works', percent: 10 }, { scope: 'mats' });
  assert.deepEqual(migrated.rates, { mats: 0, works: 10, equipment: 0 });
  assert.equal(migrated.percent, 0);
  const changed = updateEstimateAdjustment(migrated, { percent: -5 });
  assert.deepEqual(changed.rates, { mats: -5, works: 10, equipment: 0 });
  const all = updateEstimateAdjustment(changed, { scope: 'all', percent: 5 });
  assert.deepEqual(all.rates, { mats: 5, works: 5, equipment: 5 });
  const selected = updateEstimateAdjustment(all, { scope: 'equipment' });
  assert.equal(selected.percent, 5);
  assert.equal(calculateEstimateTotals(.05, .05, all, .05).adjustedTotal,
    calculateEstimateTotals(.05, .05, { percent: 5, scope: 'all' }, .05).adjustedTotal);
});
