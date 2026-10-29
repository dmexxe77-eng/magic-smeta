import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  sourceOfBlock, getInstances, createInstance,
  blockQuantity, itemQuantity, instanceLines,
} from '../src/design-bridge/quantity-model.js';

const geometry = { a: 24, p: 20, inn: 4, out: 2, angs: [90, 90, 90, 90, 270, 270] };
const definitions = [
  { id: 'canvas', single: true, unit: 'м²' },
  { id: 'main', single: true, unit: 'м.п.' },
  { id: 'extra', source: 'manual', unit: 'м.п.', subP: true },
  { id: 'curtain', source: 'manual', unit: 'м.п.', subP: true },
  { id: 'light', source: 'manual', unit: 'шт' },
];
const def = id => definitions.find(block => block.id === id);
const result = (value, extra = {}) => ({ value, ...extra });
const rowValue = (item, instance = {}, base = result(3), g = geometry) =>
  itemQuantity(item, instance, base, g).value;

// A block determines the input source; each added instance owns its quantity.
test('built-in source defaults and explicit custom definitions', () => {
  assert.equal(sourceOfBlock({ id: 'canvas' }), 'area');
  assert.equal(sourceOfBlock({ id: 'main' }), 'perim');
  for (const id of ['extra', 'curtain', 'light', 'track', 'custom']) {
    assert.equal(sourceOfBlock({ id }), 'manual');
  }
  assert.equal(sourceOfBlock({ id: 'custom', source: 'area' }), 'area');
  assert.equal(sourceOfBlock({ id: 'custom', source: 'perim' }), 'perim');
});

test('instance traversal handles legacy single blocks and dynamic multi blocks', () => {
  const single = { pid: 'canvas-one' }, first = { id: 'a' }, second = { id: 'b' };
  const room = { canvas: single, custom: [first, second] };
  assert.deepEqual(getInstances(room, def('canvas')), [single]);
  assert.deepEqual(getInstances(room, { id: 'custom' }), [first, second]);
  assert.deepEqual(getInstances({}, def('canvas')), []);
  assert.deepEqual(getInstances({}, { id: 'custom' }), []);
});

test('new instances snapshot their source and unit without seeding an override', () => {
  const block = { id: 'custom', source: 'area', unit: 'м²' };
  const instance = createInstance(block, 'preset-one', 'instance-one');
  assert.equal(instance.id, 'instance-one');
  assert.equal(instance.pid, 'preset-one');
  assert.deepEqual(instance.qdef, { source: 'area', unit: 'м²' });
  assert.equal(instance.qty == null, true);
  block.source = 'manual'; block.unit = 'шт';
  const q = blockQuantity(block, instance, {}, geometry, definitions);
  assert.equal(q.value, 24);
  assert.equal(q.source, 'area');
  assert.equal(q.unit, 'м²');
});

test('area and perimeter blocks use geometry and derive their units', () => {
  const canvas = blockQuantity({ id: 'canvas', single: true }, {}, {}, geometry, definitions);
  assert.equal(canvas.value, 24);
  assert.equal(canvas.shown, 24);
  assert.equal(canvas.unit, 'м²');
  assert.equal(canvas.overridden, false);
  assert.equal(canvas.missing, false);
  const custom = blockQuantity({ id: 'custom', source: 'perim' }, {}, {}, geometry, definitions);
  assert.equal(custom.value, 20);
  assert.equal(custom.unit, 'м.п.');
});

test('manual quantity remains missing until entered and zero remains an explicit value', () => {
  const empty = blockQuantity(def('light'), {}, {}, geometry, definitions);
  assert.equal(empty.value, null);
  assert.equal(empty.shown, null);
  assert.equal(empty.missing, true);
  assert.equal(empty.unit, 'шт');
  const zero = blockQuantity(def('light'), { qty: 0 }, {}, geometry, definitions);
  assert.equal(zero.value, 0);
  assert.equal(zero.missing, false);
  assert.equal(zero.overridden, true);
});

test('a numeric multi-instance quantity overrides its geometric source', () => {
  const block = { id: 'custom', source: 'area', unit: 'м²' };
  for (const qty of [0, 3, 12.25]) {
    const q = blockQuantity(block, { qty }, {}, geometry, definitions);
    assert.equal(q.value, qty);
    assert.equal(q.shown, qty);
    assert.equal(q.overridden, true);
  }
});

test('main profile deducts only opted-in length instances, including dynamic blocks', () => {
  const custom = { id: 'custom', source: 'manual', unit: 'м.п.', subP: true };
  const room = {
    extra: [{ qty: 3, subP: true }, { qty: 100, subP: false }],
    curtain: [{ qty: 2, subP: true }],
    custom: [{ qty: 1, subP: true }],
    light: [{ qty: 8, subP: true }],
  };
  const q = blockQuantity(def('main'), {}, room, geometry, [...definitions, custom]);
  assert.equal(q.shown, 20);
  assert.equal(q.deducted, 6);
  assert.equal(q.value, 14);
  assert.equal(blockQuantity({ ...custom, source: 'perim' }, {}, room, geometry, definitions).value, 20);
});

test('legacy single qtyO is the final value and is not deducted twice', () => {
  const room = { extra: [{ qty: 3, subP: true }] };
  for (const qtyO of [0, 12, 20]) {
    const q = blockQuantity(def('main'), { qtyO }, room, geometry, definitions);
    assert.equal(q.value, qtyO);
    assert.equal(q.shown, qtyO);
    assert.equal(q.deducted, 0);
    assert.equal(q.overridden, true);
  }
});

test('main deductions clamp at zero and missing contributions add nothing', () => {
  const room = { extra: [{ qty: 30, subP: true }, { subP: true }] };
  const q = blockQuantity(def('main'), {}, room, geometry, definitions);
  assert.equal(q.value, 0);
  assert.equal(q.deducted, 30);
});

test('missing geometry remains missing while a manual override can still calculate', () => {
  for (const block of [def('canvas'), def('main')]) {
    const q = blockQuantity(block, {}, {}, { a: null, p: null }, definitions);
    assert.equal(q.value, null);
    assert.equal(q.shown, null);
    assert.equal(q.missing, true);
  }
  assert.equal(blockQuantity(def('canvas'), { qtyO: 9 }, {}, {}, definitions).value, 9);
});

test('invalid quantities are not allowed to contaminate totals', () => {
  for (const qty of [NaN, Infinity, -1]) {
    const q = blockQuantity(def('light'), { qty }, {}, geometry, definitions);
    assert.equal(q.value, null);
    assert.equal(q.missing, true);
  }
});

// The default row source reads its own effective block quantity.
test('block aliases resolve to the effective quantity without changing full perimeter rows', () => {
  for (const src of [undefined, 'block', 'param']) {
    assert.equal(rowValue({ n: 'row', src }, {}, result(15)), 15);
  }
  assert.equal(rowValue({ n: 'row', src: 'perim' }, {}, result(15)), 20);
});

test('each explicit geometric row source uses its own room metric', () => {
  const cases = { area: 24, perim: 20, angles: 6, inner: 4, outer: 2 };
  for (const [src, expected] of Object.entries(cases)) {
    assert.equal(rowValue({ n: 'row', src }), expected, src);
  }
});

test('missing geometric sources do not turn into zero', () => {
  for (const src of ['area', 'perim', 'angles', 'inner', 'outer']) {
    assert.equal(rowValue({ n: 'row', src }, {}, result(3), {}), null, src);
  }
  assert.equal(rowValue({ n: 'row' }, {}, result(null)), null);
  assert.equal(rowValue({ n: 'row', src: 'manual' }), null);
});

test('row manual overrides are final even with a norm and a multiple', () => {
  const item = { n: 'profile', u: 'шт', k: 1.3, mult: 4 };
  for (const value of [0, 3, 7]) {
    const q = itemQuantity(item, { iq: { profile: value } }, result(20), geometry);
    assert.equal(q.value, value);
    assert.equal(q.overridden, true);
    assert.equal(q.missing, false);
  }
  assert.equal(rowValue({ ...item, src: 'manual' }, { iq: { profile: 5 } }), 5);
});

test('norms round indivisible pieces only when a non-default norm is applied', () => {
  assert.equal(rowValue({ n: 'row', u: 'шт', k: 1.2 }), 4);
  assert.equal(rowValue({ n: 'row', u: 'шт.', k: 1.2 }), 4);
  assert.equal(rowValue({ n: 'row', u: 'м.п.', k: 1.2 }), 3.6);
  assert.equal(rowValue({ n: 'row', u: 'шт', k: 1 }, {}, result(2.5)), 2.5);
  assert.equal(rowValue({ n: 'row', u: 'м.п.', k: 1.12345 }), 3.37);
});

test('multiples apply after norms without floating point over-rounding', () => {
  assert.equal(rowValue({ n: 'row', k: 1.1, mult: 2 }), 4);
  assert.equal(rowValue({ n: 'row', mult: 2 }, {}, result(4)), 4);
  assert.equal(rowValue({ n: 'row', mult: 0.1 }, {}, result(0.3)), 0.3);
  assert.equal(rowValue({ n: 'row', mult: 2 }, {}, result(0)), 0);
});

test('invalid norms and multiples preserve the unmodified source', () => {
  for (const k of [0, -1, NaN, Infinity]) {
    assert.equal(rowValue({ n: 'row', k }), 3);
  }
  for (const mult of [0, -1, NaN, Infinity]) {
    assert.equal(rowValue({ n: 'row', mult }), 3);
  }
});

test('a row unit can differ from its source unit without blocking calculation', () => {
  assert.equal(rowValue({ n: 'row', u: 'компл', src: 'perim' }), 20);
});

// Calculator rows and estimate rows share the same final quantities.
test('instanceLines returns compatible row fields and excluded rows keep their quantity', () => {
  const block = def('extra');
  const instance = { qty: 3, iq: { tape: 7 }, off: { install: true } };
  const preset = { items: [
    { n: 'profile', p: 10, u: 'м.п.', m: 1 },
    { n: 'install', p: 20, u: 'м.п.' },
    { n: 'tape', p: 5, u: 'м.п.', k: 2, mult: 4 },
    { n: 'junction', p: 30, u: 'шт', src: 'manual' },
  ] };
  const lines = instanceLines(block, instance, preset, {}, geometry, definitions);
  assert.deepEqual(lines.map(({ q, t, on, ov, manual, missing }) => ({ q, t, on, ov, manual, missing })), [
    { q: 3, t: 30, on: true, ov: false, manual: false, missing: false },
    { q: 3, t: 0, on: false, ov: false, manual: false, missing: false },
    { q: 7, t: 35, on: true, ov: true, manual: false, missing: false },
    { q: null, t: 0, on: true, ov: false, manual: true, missing: true },
  ]);
});

test('two instances of the same preset isolate primary and row quantities', () => {
  const block = def('extra'), preset = { items: [{ n: 'profile', p: 10 }] };
  const first = { id: 'first', qty: 3, iq: { profile: 8 } };
  const second = { id: 'second', qty: 5 };
  assert.equal(instanceLines(block, first, preset, {}, geometry, definitions)[0].q, 8);
  assert.equal(instanceLines(block, second, preset, {}, geometry, definitions)[0].q, 5);
  assert.equal(second.iq, undefined);
  assert.equal(preset.items[0].qty, undefined);
});

test('missing presets and missing quantities produce no charged amount', () => {
  assert.deepEqual(instanceLines(def('extra'), {}, null, {}, geometry, definitions), []);
  const lines = instanceLines(def('extra'), {}, { items: [{ n: 'profile', p: 10 }] }, {}, geometry, definitions);
  assert.equal(lines[0].q, null);
  assert.equal(lines[0].t, 0);
});

test('quantity evaluation does not mutate room, definitions, instances, or presets', () => {
  const block = Object.freeze({ id: 'custom', source: 'perim', unit: 'м.п.' });
  const instance = Object.freeze({ qty: 3, iq: Object.freeze({ profile: 4 }), off: Object.freeze({}) });
  const room = Object.freeze({ custom: Object.freeze([instance]) });
  const preset = Object.freeze({ items: Object.freeze([Object.freeze({ n: 'profile', p: 10, k: 2 })]) });
  const frozenGeometry = Object.freeze({ ...geometry });
  assert.equal(instanceLines(block, instance, preset, room, frozenGeometry, Object.freeze([block]))[0].q, 4);
});
