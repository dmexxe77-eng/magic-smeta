import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from './design-runtime.mjs';

test('room options and extra rows fold independently without changing the estimate', async () => {
  const r = await runtime(), app = r.component;
  const project = app.state.projects.find(p => p.rooms.length);
  app.openCalc(project.id);
  const room = app.cur().rooms[0];
  room.opts = { [r.ROOM_OPTS[0].id]: true };
  const total = app.pSum(app.cur());
  assert.equal(app.calculatorAppearanceVals().pcOptionsOpen, false);
  app.calculatorAppearanceVals().pcToggleOptions();
  assert.equal(app.calculatorAppearanceVals().pcOptionsOpen, true);
  assert.equal(app.calculatorAppearanceVals().pcExtrasOpen, false);
  assert.equal(app.calculatorAppearanceVals().pcOptionsSummary[0].title, r.ROOM_OPTS[0].title);
  app.calculatorAppearanceVals().pcToggleExtras();
  assert.equal(app.calculatorAppearanceVals().pcExtrasOpen, true);
  assert.equal(app.pSum(app.cur()), total);
  app.calculatorAppearanceVals().pcToggleOptions();
  assert.equal(app.calculatorAppearanceVals().pcOptionsOpen, false);
});

test('every calculator entry starts with all sections collapsed', async () => {
  const r = await runtime(), app = r.component;
  const project = app.state.projects.find(p => p.rooms.length);
  app.openCalc(project.id);
  assert.ok(app.calcVals().blocks.every(b => b.closed));
  app.calcVals().blocks[0].toggleOpen();
  app.calculatorAppearanceVals().pcToggleOptions();
  assert.equal(app.calcVals().blocks[0].closed, false);
  app.go('project');
  app.openCalc(project.id);
  assert.ok(app.calcVals().blocks.every(b => b.closed));
  assert.equal(app.calculatorAppearanceVals().pcOptionsOpen, false);
  assert.equal(app.calculatorAppearanceVals().pcExtrasOpen, false);
});

test('calculator chooses an alternative in only the clicked instance and clears its old override', async () => {
  const r = await runtime(), app = r.component;
  const project = app.state.projects.find(p => p.rooms.length), room = project.rooms[0];
  const preset = r.PRESETS.extra.find(p => p.items.length), item = preset.items[0];
  item.variants = [{ n: item.n, p: 10, u: item.u, m: item.m }, { n: 'Вариант B', p: 20, u: item.u, m: item.m }];
  room.extra = [{ id: 'a', pid: preset.id, qty: 3, iq: { [item.n]: 7 } }, { id: 'b', pid: preset.id, qty: 5 }];
  app.openCalc(project.id);
  app.calcVals().blocks.find(b => b.id === 'extra').insts[0].lines[0].chooseVariant();
  app.presetEditorVals().peCalcChoices[1].pick();
  const instances = app.cur().rooms[0].extra;
  assert.equal(instances[0].variants[item.n], 'Вариант B');
  assert.equal(instances[0].iq[item.n], undefined);
  assert.equal(instances[1].variants, undefined);
  const cards = app.calcVals().blocks.find(b => b.id === 'extra').insts;
  assert.equal(cards[0].lines[0].n, 'Вариант B');
  assert.equal(cards[1].lines[0].n, item.n);
});
