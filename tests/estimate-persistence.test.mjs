import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

const bundle = await build({
  stdin: { contents: 'export { buildEst, sanitizeOrdersForStorage } from "./src/data/presets.js"; export { ALL_NOM } from "./src/data/nomenclature.jsx";', resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', globalName: 'app', platform: 'node', loader: { '.js': 'jsx' }, logLevel: 'error',
});
const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(bundle.outputFiles[0].text, context);
const { buildEst, sanitizeOrdersForStorage, ALL_NOM } = context.app;
const work = ALL_NOM.find(n => n.type === 'work');
const preset = [{ id: 'test', items: [work.id], options: [] }];
const room = (id, qty) => ({ id, name: id, on: true, v: [], lights: [{ btnId: 'test', qty }] });
const key = (scope, kind, id) => JSON.stringify([scope, kind, id]);
const calc = (rooms, edits, scope) => buildEst(rooms, preset, [], { [work.id]: 100 }, edits, scope);
const roundTrip = order => JSON.parse(JSON.stringify(sanitizeOrdersForStorage([order])))[0];

test('a quantity correction survives project serialization and reopening', () => {
  const order = roundTrip({ id: 'project', rooms: [room('a', 15)], estimateEdits: { [key('total', 'works', work.id)]: { q: 150 } } });
  const line = calc(order.rooms, order.estimateEdits).works[0];
  assert.equal(line.q, 150);
  assert.equal(line.q * line.p, 15000);
});

test('room corrections affect the project total and stay in their own room', () => {
  const rooms = [room('a', 15), room('b', 20)];
  const edits = { [key('a', 'works', work.id)]: { q: 150 } };
  assert.equal(calc([rooms[0]], edits, 'a').works[0].q, 150);
  assert.equal(calc([rooms[1]], edits, 'b').works[0].q, 20);
  assert.equal(calc(rooms, edits).works[0].q, 170);
});

test('keys identify nomenclature rather than the position after sorting', () => {
  const other = ALL_NOM.find(n => n.type === 'work' && n.id !== work.id);
  const presets = [...preset, { id: 'other', items: [other.id], options: [] }];
  const rooms = [room('a', 15)];
  rooms[0].lights.unshift({ btnId: 'other', qty: 200 });
  const edits = { [key('total', 'works', work.id)]: { q: 42 } };
  const est = buildEst(rooms, presets, [], {}, edits);
  assert.equal(est.works.find(l => l._k === work.id).q, 42);
  assert.equal(est.works.find(l => l._k === other.id).q, 200);
});

test('zero is a saved correction and reset restores calculated values', () => {
  const rooms = [room('a', 15)];
  assert.equal(calc(rooms, { [key('total', 'works', work.id)]: { q: 0 } }).works[0].q, 0);
  assert.equal(calc(rooms, {}).works[0].q, 15);
  assert.equal(calc(rooms, null).works[0].q, 15);
});

test('corrections do not change another project or apply invalid values', () => {
  const rooms = [room('a', 15)];
  const edits = { [key('total', 'works', work.id)]: { q: 150 } };
  assert.equal(calc(rooms, edits).works[0].q, 150);
  assert.equal(calc(rooms, {}).works[0].q, 15);
  for (const q of [-1, NaN, Infinity, 'bad']) assert.equal(calc(rooms, { [key('total', 'works', work.id)]: { q } }).works[0].q, 15);
});
