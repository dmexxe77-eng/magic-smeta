import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEstimateEdits, estimateLineKey, mergeRoomEstimates } from '../src/utils/estimate-edits.js';

const line = (_k, q, p = 100) => ({ _k, n: `Position ${_k}`, q, p, u: 'шт' });
const estimate = () => ({ mats: [line('shared', 15)], works: [line('shared', 20)] });
const edit = (scope, kind, id, q) => ({ [estimateLineKey(scope, kind, id)]: { q } });

test('a persisted total correction is applied to its nomenclature line', () => {
  const savedEdits = JSON.parse(JSON.stringify(edit('total', 'mats', 'shared', 150)));
  const actual = applyEstimateEdits(estimate(), savedEdits);

  assert.equal(actual.mats[0].q, 150);
  assert.equal(actual.mats[0].q * actual.mats[0].p, 15000);
  assert.equal(actual.works[0].q, 20);
  assert.equal(actual.mats[0].k, estimateLineKey('total', 'mats', 'shared'));
});

test('zero and fractional quantities remain valid corrections', () => {
  const actual = applyEstimateEdits(estimate(), {
    ...edit('total', 'mats', 'shared', 0),
    ...edit('total', 'works', 'shared', 2.75),
  });

  assert.equal(actual.mats[0].q, 0);
  assert.equal(actual.works[0].q, 2.75);
});

test('invalid or missing corrections keep the calculated quantity', () => {
  for (const q of [-1, NaN, Infinity, -Infinity, '150', null, undefined]) {
    const actual = applyEstimateEdits(estimate(), edit('total', 'mats', 'shared', q));
    assert.equal(actual.mats[0].q, 15, `invalid quantity ${String(q)}`);
  }
  for (const edits of [undefined, null, {}, { [estimateLineKey('total', 'mats', 'shared')]: {} }]) {
    const actual = applyEstimateEdits(estimate(), edits);
    assert.equal(actual.mats[0].q, 15);
    assert.equal(actual.works[0].q, 20);
  }
});

test('room and total corrections are independent, including material and work with the same ID', () => {
  const edits = {
    ...edit('total', 'mats', 'shared', 100),
    ...edit('room-a', 'mats', 'shared', 10),
    ...edit('room-a', 'works', 'shared', 30),
    ...edit('room-b', 'mats', 'shared', 40),
  };

  assert.equal(applyEstimateEdits(estimate(), edits).mats[0].q, 100);
  assert.deepEqual(applyEstimateEdits(estimate(), edits, 'room-a').mats.map(l => l.q), [10]);
  assert.equal(applyEstimateEdits(estimate(), edits, 'room-a').works[0].q, 30);
  assert.equal(applyEstimateEdits(estimate(), edits, 'room-b').mats[0].q, 40);
  assert.equal(applyEstimateEdits(estimate(), edits, 'room-b').works[0].q, 20);
});

test('inserting or reordering lines does not move a correction to a different position', () => {
  const edits = edit('total', 'mats', 'shared', 150);
  const actual = applyEstimateEdits({ mats: [line('new', 200), line('shared', 15)], works: [] }, edits);

  assert.deepEqual(actual.mats.map(l => [l._k, l.q]), [['new', 200], ['shared', 150]]);
});

test('applying corrections leaves source estimates and saved edits unchanged', () => {
  const original = estimate();
  const edits = edit('total', 'mats', 'shared', 150);
  const before = structuredClone({ original, edits });
  const actual = applyEstimateEdits(original, edits);

  assert.deepEqual({ original, edits }, before);
  assert.notStrictEqual(actual.mats[0], original.mats[0]);
  assert.notStrictEqual(actual.works[0], original.works[0]);
});

test('line keys distinguish scopes and IDs containing separators or quotes', () => {
  assert.notEqual(estimateLineKey('a:b', 'mats', 'c'), estimateLineKey('a', 'mats', 'b:c'));
  assert.deepEqual(JSON.parse(estimateLineKey('room "one"', 'works', 'item,1')), ['room "one"', 'works', 'item,1']);
});

test('merging room estimates aggregates shared nomenclature and keeps kinds separate', () => {
  const actual = mergeRoomEstimates([
    { mats: [line('shared', 15), line('only-a', 2)], works: [line('shared', 3)] },
    { mats: [line('shared', 20), line('only-b', 4)], works: [line('shared', 7)] },
  ]);

  assert.deepEqual(actual.mats.map(l => [l._k, l.q]), [['shared', 35], ['only-a', 2], ['only-b', 4]]);
  assert.deepEqual(actual.works.map(l => [l._k, l.q]), [['shared', 10]]);
  assert.equal(actual.mats[0].p, 100);
  assert.equal(actual.mats[0].n, 'Position shared');
});

test('merging corrected room quantities preserves zero and rounds decimal totals', () => {
  const roomA = applyEstimateEdits({ mats: [line('shared', 15)], works: [line('rounded', 1.234)] }, edit('a', 'mats', 'shared', 0), 'a');
  const actual = mergeRoomEstimates([
    roomA,
    { mats: [line('shared', 0.1)], works: [line('other', 0.1)] },
    { mats: [line('shared', 0.2)], works: [line('other', 0.2)] },
  ]);

  assert.equal(actual.mats[0].q, 0.3);
  assert.equal(actual.works.find(l => l._k === 'rounded').q, 1.23);
  assert.equal(actual.works.find(l => l._k === 'other').q, 0.3);
});

test('merging estimates does not mutate rooms and supports an empty project', () => {
  const rooms = [estimate(), estimate()];
  const before = structuredClone(rooms);
  const actual = mergeRoomEstimates(rooms);

  assert.deepEqual(rooms, before);
  assert.notStrictEqual(actual.mats[0], rooms[0].mats[0]);
  assert.deepEqual(mergeRoomEstimates([]), { mats: [], works: [] });
  assert.deepEqual(mergeRoomEstimates([{ mats: [], works: [] }]), { mats: [], works: [] });
});
