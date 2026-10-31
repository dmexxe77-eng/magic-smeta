import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionEstimateExport, prepareEstimateExport } from '../src/utils/estimate-export.js';

const estimate = () => ({
  mats: [{ _k: 'material', n: 'Полотно', q: 2, p: 100, exportRoomId: 'room-a' }],
  works: [{ _k: 'work', n: 'Монтаж', q: 3, p: 50, exportRoomId: 'room-b' }],
});
const priceNumber = line => Number(line.exportPrice.replace(/\s/g, '').replace(',', '.'));
const cents = amount => Math.round((amount + Math.sign(amount) * Number.EPSILON * Math.max(1, Math.abs(amount))) * 100);
const sum = rows => rows.reduce((value, line) => value + cents(line.exportTotal), 0);
const assertRowsAddUp = prepared => {
  assert.equal(sum(prepared.mats), cents(prepared.materialsTotal));
  assert.equal(sum(prepared.works), cents(prepared.worksTotal));
  assert.equal(sum(prepared.equipment || []), cents(prepared.equipmentTotal || 0));
  for (const line of [...prepared.mats, ...prepared.works, ...(prepared.equipment || [])]) {
    const quantity = Number(line.exportQuantity.replace(/\s/g, '').replace(',', '.'));
    assert.equal(cents(priceNumber(line) * quantity), cents(line.exportTotal), JSON.stringify(line));
  }
};

test('showing an adjustment retains base prices while exposing authoritative base totals', () => {
  const prepared = prepareEstimateExport(estimate(), { percent: 10, scope: 'works' });
  assert.equal(prepared.mats[0].p, 100);
  assert.equal(prepared.works[0].p, 50);
  assert.equal(prepared.materialsTotal, 200);
  assert.equal(prepared.worksTotal, 150);
  assert.equal(prepared.totals.adjustedTotal, 365);
  assertRowsAddUp(prepared);
});

test('equipment is priced separately and all three sections reconcile for every scope', () => {
  const est = { ...estimate(), equipment: [{ k: 'driver', n: 'Блок питания', q: 3, p: 75.55 }] };
  for (const scope of ['all', 'works', 'mats', 'equipment']) {
    for (const percent of [10, -5, 2.5, -100]) {
      const shown = prepareEstimateExport(est, { percent, scope }, true);
      const hidden = prepareEstimateExport(est, { percent, scope }, false);
      assertRowsAddUp(shown);
      assertRowsAddUp(hidden);
      assert.equal(hidden.totals.adjustedTotal, shown.totals.adjustedTotal);
      assert.equal(sum(hidden.mats) + sum(hidden.works) + sum(hidden.equipment), cents(hidden.totals.adjustedTotal));
      if (scope === 'equipment') {
        assert.equal(hidden.mats[0].p, 100);
        assert.equal(hidden.works[0].p, 50);
      } else if (scope !== 'all') assert.equal(hidden.equipment[0].p, 75.55);
    }
  }
});

test('room partition uses edited global quantities once and preserves global kopecks', () => {
  const source = { mats: [], works: [{ k: 'install', q: 10, p: .055 }], equipment: [{ k: 'driver', q: 1, p: 1 }] };
  const rooms = [1, 2, 3].map(id => ({ id, name: `Комната ${id}`, est: {
    mats: [], works: [{ k: 'install', q: id, p: .05 }], equipment: [{ k: 'driver', q: 1, p: 1 }],
  } }));
  const prepared = prepareEstimateExport(source, { percent: 10, scope: 'all' }, false);
  const groups = partitionEstimateExport(prepared, rooms);
  assert.equal(groups.length, 3);
  groups.forEach(assertRowsAddUp);
  assert.equal(groups.reduce((total, group) => total + sum(group.works) + sum(group.equipment), 0), cents(prepared.totals.adjustedTotal));
  assert.equal(groups.reduce((total, group) => total + group.works[0].q, 0), 10);
  assert.equal(groups.reduce((total, group) => total + group.equipment[0].q, 0), 1);
  assert.equal(source.works[0].q, 10);
});

test('unmatched estimate lines remain visible in a common section', () => {
  const prepared = prepareEstimateExport({ mats: [{ k: 'unknown', q: 1, p: 100 }], works: [] });
  const groups = partitionEstimateExport(prepared, [{ id: 'a', est: { mats: [] } }]);
  assert.equal(groups.at(-1).name, 'Общие позиции');
  assert.equal(groups.at(-1).mats[0].exportTotal, 100);
});

test('hiding markup folds it into only the selected types and keeps the same grand total', () => {
  for (const scope of ['mats', 'works', 'all']) {
    const shown = prepareEstimateExport(estimate(), { percent: 10, scope });
    const hidden = prepareEstimateExport(estimate(), { percent: 10, scope }, false);
    assert.equal(hidden.totals.adjustedTotal, shown.totals.adjustedTotal);
    assert.equal(hidden.mats[0].p, scope === 'works' ? 100 : 110);
    assert.equal(hidden.works[0].p, scope === 'mats' ? 50 : 55);
    assert.equal(sum(hidden.mats) + sum(hidden.works), cents(hidden.totals.adjustedTotal));
    assertRowsAddUp(hidden);
  }
});

test('discounts including 100 percent use reduced prices without changing the unselected section', () => {
  const discount = prepareEstimateExport(estimate(), { percent: -10, scope: 'works' }, false);
  assert.equal(discount.works[0].p, 45);
  assert.equal(discount.mats[0].p, 100);
  assert.equal(discount.totals.adjustedTotal, 335);
  assertRowsAddUp(discount);
  const free = prepareEstimateExport(estimate(), { percent: -100, scope: 'all' }, false);
  assert.equal(free.totals.adjustedTotal, 0);
  assertRowsAddUp(free);
});

test('fractional quantities and cent remainders reconcile row, section and grand totals', () => {
  const est = {
    mats: [{ q: 0.5, p: 0.01 }, { q: 0.5, p: 0.01 }],
    works: [{ q: 3, p: 0.01 }, { q: 3, p: 0.01 }, { q: 3, p: 0.01 }],
  };
  for (const scope of ['mats', 'works', 'all']) {
    for (const percent of [10, 2.5, -15, -100, 1000]) {
      for (const showAdjustment of [true, false]) {
        const prepared = prepareEstimateExport(est, { percent, scope }, showAdjustment);
        assertRowsAddUp(prepared);
        assert.equal(sum(prepared.mats) + sum(prepared.works), cents(showAdjustment ? prepared.totals.baseTotal : prepared.totals.adjustedTotal));
      }
    }
  }
});

test('export price precision is sufficient for long fractional quantities', () => {
  const prepared = prepareEstimateExport({ mats: [], works: [{ q: 1253.67, p: 0.01 }, { q: 0.33, p: 17.45 }] }, { percent: 2.5, scope: 'works' }, false);
  assertRowsAddUp(prepared);
  assert.equal(sum(prepared.works), cents(prepared.totals.adjustedTotal));
});

test('printed quantities retain all digits needed to reproduce the line amount', () => {
  const source = { mats: [], works: [{ q: 0.333, p: 300 }, { q: 0.123456789, p: 400 }] };
  const prepared = prepareEstimateExport(source, { percent: 10, scope: 'works' }, false);
  assert.equal(prepared.works[0].exportQuantity, '0,333');
  assert.equal(prepared.works[1].exportQuantity, '0,123456789');
  for (const line of prepared.works) {
    const printedQuantity = Number(line.exportQuantity.replace(/\s/g, '').replace(',', '.'));
    assert.equal(cents(printedQuantity * priceNumber(line)), cents(line.exportTotal));
  }
  assert.equal(source.works[0].q, 0.333);
});

test('one global preparation preserves room identities and the whole-project cents', () => {
  const est = { mats: [], works: ['a', 'b', 'c'].map(exportRoomId => ({ q: 1, p: 0.05, exportRoomId })) };
  const prepared = prepareEstimateExport(est, { percent: 10, scope: 'works' }, false);
  assert.deepEqual(prepared.works.map(line => line.exportRoomId), ['a', 'b', 'c']);
  assert.equal(sum(prepared.works), 17);
  assert.equal(prepared.totals.adjustedTotal, 0.17);
  assertRowsAddUp(prepared);
});

test('the PDF total survives hidden works markup with materials left unchanged', () => {
  const est = { mats: [{ q: 1, p: 1808118 }], works: [{ q: 1, p: 2243016.45 }] };
  const prepared = prepareEstimateExport(est, { percent: 10, scope: 'works' }, false);
  assert.equal(prepared.materialsTotal, 1808118);
  assert.equal(prepared.worksTotal, 2467318.10);
  assert.equal(prepared.totals.adjustedTotal, 4275436.10);
  assertRowsAddUp(prepared);
});

test('source estimates remain unchanged and empty or zero-quantity lines are safe', () => {
  const source = estimate();
  const before = structuredClone(source);
  const prepared = prepareEstimateExport(source, { percent: 10, scope: 'works' }, false);
  assert.deepEqual(source, before);
  assert.notStrictEqual(prepared.mats[0], source.mats[0]);
  assert.notStrictEqual(prepared.works[0], source.works[0]);
  assert.equal(prepareEstimateExport(null).totals.adjustedTotal, 0);
  const zeros = prepareEstimateExport({ mats: [{ q: 0, p: 100 }], works: [] }, { percent: 10, scope: 'all' }, false);
  assert.equal(zeros.mats[0].exportTotal, 0);
  assertRowsAddUp(zeros);
});
