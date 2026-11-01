import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, readTemplate } from './design-runtime.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const event = value => ({ target: { value } });
const projects = () => ['first', 'second'].map(id => ({
  id, name: id, status: 'order', rooms: [{
    id: id + '-room', name: 'Комната', on: true,
    canvas: { pid: 'none', off: {} }, main: { pid: 'none', off: {} },
    v: [[0, 0], [3, 0], [3, 4], [0, 4]],
    extraItems: [
      { id: 'material', n: 'Материал', m: 1, qty: 1, p: 100, u: 'шт' },
      { id: 'work', n: 'Монтаж', m: 0, qty: 2, p: 100, u: 'шт' },
      { id: 'equipment', n: 'Оборудование', m: 1, category: 'equipment', qty: 3, p: 100, u: 'шт' },
    ],
  }],
}));
async function setup() {
  const r = await runtime({ mainDataPatch: { projects: projects(), estEd: {} } });
  r.component.openCalc('first');
  r.component.setState({ sheet: 'export' });
  return r;
}
const pickScope = (app, scope) => app.expVals().expScopes.find(x => x.id === scope).pick();
const pickPercent = (app, value) => app.expVals().expPcts.find(x => x.label === value).pick();

test('group selection remembers independent percentages and all sets a common percentage', async () => {
  const { component: app } = await setup();
  assert.equal(app.pSum(app.cur()), 600);
  pickScope(app, 'mats'); pickPercent(app, '−5%');
  pickScope(app, 'works'); pickPercent(app, '+10%');
  pickScope(app, 'equipment'); pickPercent(app, '−10%');
  assert.equal(app.pSum(app.cur()), 585);
  for (const [scope, percent] of [['mats', -5], ['works', 10], ['equipment', -10]]) {
    pickScope(app, scope);
    assert.equal(app.cur().estimateAdjustment.percent, percent);
    assert.equal(app.pSum(app.cur()), 585, 'selection does not move a rate to another group');
  }
  pickScope(app, 'all');
  assert.equal(app.expVals().expScopes.find(x => x.id === 'all').value, 'Разные');
  assert.ok(app.expVals().expPcts.every(x => x.bg === '#fff'));
  pickPercent(app, '+10%');
  for (const scope of ['all', 'mats', 'works', 'equipment']) {
    pickScope(app, scope);
    assert.equal(app.pSum(app.cur()), 660, scope);
    assert.equal(app.estimateTotals(app.cur()).baseTotal, 600);
    assert.equal(app.cur().estimateAdjustment.scope, scope);
  }
});

test('a discount and zero percent retain base row prices and agree on every total surface', async () => {
  const { component: app } = await setup();
  const before = copy(app.cur().rooms);
  pickScope(app, 'works');
  pickPercent(app, '−10%');
  assert.equal(app.pSum(app.cur()), 580);
  const calculator = app.calcVals();
  assert.match(calculator.cTotalTxt, /580/);
  assert.match(app.estimateAdjustmentVals().estimateBaseTxt, /600/);
  assert.match(app.estimateAdjustmentVals().estimateAdjustmentTxt, /Скидка на работы −10%/);
  app.go('project');
  assert.match(app.projectVals().pSumTxt, /580/);
  app.go('home');
  assert.match(app.homeVals().cards.find(x => x.id === 'first').sumTxt, /580/);
  app.openCalc('first');
  app.setState({ sheet: 'estimate', estTab: 'all' });
  assert.match(app.renderVals().estGrand, /580/);
  app.setState({ sheet: 'export' });
  pickPercent(app, '0%');
  assert.equal(app.pSum(app.cur()), 600);
  assert.equal(app.estimateAdjustmentVals().hasEstimateAdjustment, false);
  assert.deepEqual(copy(app.cur().rooms), before);
});

test('export disclosure and adjustment persist per project without changing base rows', async () => {
  const { component: app, entries } = await setup();
  pickScope(app, 'works');
  pickPercent(app, '+10%');
  app.expVals().expToggleShowPct();
  assert.equal(app.expVals().expShowPct, false);
  app.openCalc('second');
  app.setState({ sheet: 'export' });
  assert.equal(app.pSum(app.cur()), 600);
  assert.equal(app.expVals().expShowPct, true);
  pickScope(app, 'equipment');
  pickPercent(app, '−5%');
  assert.equal(app.pSum(app.cur()), 585);
  assert.equal(app.saveDesign(), true);
  const restored = (await runtime({ saved: entries.get('zamer.design.v1') })).component;
  restored.openCalc('first');
  restored.setState({ sheet: 'export' });
  assert.equal(restored.pSum(restored.cur()), 620);
  assert.equal(restored.expVals().expShowPct, false);
  restored.openCalc('second');
  assert.equal(restored.pSum(restored.cur()), 585);
});

test('custom percent accepts a decimal comma, normalizes limits and ignores invalid text', async () => {
  const { component: app } = await setup();
  pickScope(app, 'equipment');
  app.expVals().expCustomChange(event('12,5'));
  app.expVals().expCustomBlur();
  assert.equal(app.cur().estimateAdjustment.percent, 12.5);
  assert.equal(app.pSum(app.cur()), 637.5);
  app.expVals().expCustomChange(event('not a number'));
  app.expVals().expCustomBlur();
  assert.equal(app.cur().estimateAdjustment.percent, 12.5);
  app.expVals().expCustomChange(event('-200'));
  app.expVals().expCustomBlur();
  assert.equal(app.cur().estimateAdjustment.percent, -100);
  assert.equal(app.pSum(app.cur()), 300);
  app.expVals().expCustomChange(event('2000'));
  app.expVals().expCustomBlur();
  assert.equal(app.cur().estimateAdjustment.percent, 1000);
  app.expVals().expCustomChange(event(''));
  app.expVals().expCustomBlur();
  assert.equal(app.pSum(app.cur()), 600);
});

test('an uncommitted custom value stays with its project and is saved to its original group', async () => {
  const { component: app } = await setup();
  pickScope(app, 'mats');
  app.expVals().expCustomChange(event('7,5'));
  app.openCalc('second');
  app.setState({ sheet: 'export' });
  assert.equal(app.expVals().expCustomVal, '');
  app.openCalc('first');
  app.setState({ sheet: 'export' });
  assert.equal(app.expVals().expCustomVal, '7,5');
  pickScope(app, 'works');
  assert.equal(app.cur().estimateAdjustment.percent, 0);
  assert.equal(app.cur().estimateAdjustment.scope, 'works');
  assert.deepEqual(copy(app.cur().estimateAdjustment.rates), { mats: 7.5, works: 0, equipment: 0 });
  assert.equal(app.pSum(app.cur()), 607.5);
});

test('a fully discounted estimate remains a zero-priced estimate instead of looking absent', async () => {
  const { component: app } = await setup();
  app.expVals().expCustomChange(event('-100'));
  app.expVals().expCustomBlur();
  app.go('project');
  assert.match(app.projectVals().pSumTxt, /^0\s*₽$/);
  app.go('home');
  assert.match(app.homeVals().cards.find(x => x.id === 'first').sumTxt, /^0\s*₽$/);
});

test('real export receives saved disclosure, pending percent and raw room quantities', async () => {
  const r = await setup(), app = r.component;
  pickScope(app, 'works');
  app.expVals().expCustomChange(event('12,5'));
  app.expVals().expToggleShowPct();
  app.setState({ estEd: { first: { Монтаж: { q: 4, p: 150 } } } });
  let received;
  r.ctx.MagicEstimate = { ...r.ctx.MagicEstimate, downloadEstimate: async opts => {
    received = opts;
    return { status: 'downloaded' };
  } };
  await app.expVals().expDownload();
  assert.equal(received.adjustment.percent, 12.5);
  assert.equal(received.adjustment.scope, 'works');
  assert.equal(received.showAdjustment, false);
  assert.equal(received.est.works[0].q, 4);
  assert.equal(received.rooms[0].est.works[0].q, 2);
  assert.equal(app.cur().status, 'estimate');
  assert.equal(app.state.estimateExportBusy, false);
});

test('failed or cancelled exports do not report success or advance project status', async () => {
  const r = await setup(), app = r.component;
  r.ctx.MagicEstimate = { ...r.ctx.MagicEstimate, shareEstimate: async () => ({ status: 'cancelled' }),
    downloadEstimate: async () => { throw new Error('PDF недоступен'); } };
  await app.expVals().expSend();
  assert.equal(app.cur().status, 'order');
  assert.equal(app.state.toast, null);
  await app.expVals().expDownload();
  assert.equal(app.cur().status, 'order');
  assert.match(app.state.toast, /PDF недоступен/);
  assert.equal(app.state.estimateExportBusy, false);
});

test('the prototype offers accessible scoped controls and contains no simulated export success', () => {
  const template = readTemplate();
  assert.match(template, /aria-label="К чему применить процент"/);
  assert.match(template, /role="checkbox" aria-checked="\{\{ expShowPct \}\}"/);
  assert.match(template, /Предпросмотр сметы/);
  assert.doesNotMatch(template, /смета отправлена клиенту/);
});

test('all three group percentages survive export, project switching and reload', async () => {
  const r = await setup(), app = r.component;
  const before = copy(app.cur().rooms);
  pickScope(app, 'mats'); pickPercent(app, '−5%');
  pickScope(app, 'works'); pickPercent(app, '+10%');
  pickScope(app, 'equipment'); pickPercent(app, '−10%');
  let received;
  r.ctx.MagicEstimate = { ...r.ctx.MagicEstimate, previewEstimate: async opts => {
    received = opts; return { status: 'previewed' };
  } };
  await app.expVals().expPreview();
  assert.deepEqual(copy(received.adjustment.rates), { mats: -5, works: 10, equipment: -10 });
  assert.equal(app.expVals().expAdjustmentRows.length, 3);
  app.openCalc('second'); app.setState({ sheet: 'export' });
  assert.equal(app.pSum(app.cur()), 600);
  app.openCalc('first'); app.setState({ sheet: 'export' });
  assert.equal(app.pSum(app.cur()), 585);
  assert.equal(app.saveDesign(), true);
  const restored = (await runtime({ saved: r.entries.get('zamer.design.v1') })).component;
  restored.openCalc('first'); restored.setState({ sheet: 'export' });
  assert.deepEqual(copy(restored.cur().estimateAdjustment.rates), { mats: -5, works: 10, equipment: -10 });
  assert.match(restored.calcVals().cTotalTxt, /585/);
  assert.match(restored.estimateAdjustmentVals().estimateAdjustmentTxt, /материалы −5%.*работы \+10%.*оборудование −10%/);
  pickScope(restored, 'works'); pickPercent(restored, '0%');
  assert.equal(restored.pSum(restored.cur()), 565);
  assert.deepEqual(copy(restored.cur().rooms), before);
});

test('opening another group preserves legacy markup and invalid input never clears mixed rates', async () => {
  const r = await runtime({ mainDataPatch: { projects: projects().map(p => ({ ...p, estimateAdjustment: { scope: 'works', percent: 10 } })), estEd: {} } });
  const app = r.component; app.openCalc('first'); app.setState({ sheet: 'export' });
  pickScope(app, 'mats');
  assert.equal(app.pSum(app.cur()), 620);
  assert.equal(app.cur().estimateAdjustment.percent, 0);
  pickScope(app, 'all');
  app.expVals().expCustomChange(event('incorrect'));
  app.expVals().expCustomBlur();
  assert.deepEqual(copy(app.cur().estimateAdjustment.rates), { mats: 0, works: 10, equipment: 0 });
});
