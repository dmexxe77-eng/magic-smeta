import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

// Exercise the actual calculator's controls and HTML exporter without a browser.
// Child components are not rendered; React's hook dispatcher retains local state
// between calls so clicks follow the same handlers as the application.
const bundle = await build({
  stdin: { contents: `import React from 'react'; export { React };
    export { default as App } from './src/App.jsx';
    export { sanitizeOrdersForStorage } from './src/data/presets.js';
    export { default as CalcScreen } from './src/components/screens/CalcScreen.jsx';
    export { CALC_STATE_REF } from './src/data/presets.js';
    export { ALL_NOM } from './src/data/nomenclature.jsx';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', globalName: 'fixture', platform: 'node',
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.js': 'jsx', '.css': 'empty' }, logLevel: 'error',
});
const context = vm.createContext({ console, setTimeout, clearTimeout });
vm.runInContext(bundle.outputFiles[0].text, context);
const { React, App, CalcScreen, CALC_STATE_REF, ALL_NOM, sanitizeOrdersForStorage } = context.fixture;
const material = ALL_NOM.find(n => n.type !== 'work' && !n.id.startsWith('c_'));
const work = ALL_NOM.find(n => n.type === 'work');
const rooms = [
  { id: 'room-a', name: 'Первая', on: true, v: [[0, 0], [2, 0], [2, 2], [0, 2]], lights: [{ btnId: 'fixture', qty: 2 }] },
  { id: 'room-b', name: 'Вторая', on: true, v: [[0, 0], [2, 0], [2, 2], [0, 2]], lights: [{ btnId: 'fixture', qty: 3 }] },
];
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node?.props) return [];
  return [node, ...nodes(node.props.children)];
}
function hookRenderer(component) {
  const state = [];
  let cursor = 0;
  const dispatcher = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect() {},
    useCallback(fn) { return fn; },
    useMemo(fn) { return fn(); },
  };
  return () => {
    cursor = 0;
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
    try { return component(); }
    finally { React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = null; }
  };
}
function harness(adjustment = { percent: 0, scope: 'all' }, edits = {}, exportOptions, fixture = {}) {
  CALC_STATE_REF.presets = [{ id: 'fixture', items: [material.id, work.id], options: [] }];
  CALC_STATE_REF.globalOpts = [];
  CALC_STATE_REF.customBlocks = [];
  const saved = [];
  const savedOptions = [];
  const renderComponent = hookRenderer(() => CalcScreen({ initRooms: fixture.rooms || rooms, initMode: 'main', initNomSnapshot: fixture.prices || { [material.id]: 100, [work.id]: 200 },
    initEstimateAdjustment: adjustment, initEstimateEdits: edits, initEstimateExportOptions: exportOptions,
    onEstimateExportOptionsChange: value => savedOptions.push(JSON.parse(JSON.stringify(value))),
    onEstimateAdjustmentChange: value => saved.push(JSON.parse(JSON.stringify(value))) }));
  let tree;
  const render = () => { tree = renderComponent(); return tree; };
  const click = async label => {
    const node = nodes(tree).find(n => n.props.onClick && text(n) === label);
    assert.ok(node, `click target exists: ${label}`);
    await node.props.onClick();
    render();
  };
  render();
  return { saved, savedOptions, render, click, get tree() { return tree; }, get text() { return text(tree); },
    async openExport() { await click('Смета'); await click('Экспорт сметы'); },
    get html() { return nodes(tree).find(n => n.type === 'iframe')?.props.srcDoc; },
  };
}
const normalize = value => value.replaceAll('\u00a0', ' ').replaceAll('&nbsp;', ' ');

test('export settings persist immediately and hydrate the calculator header', async () => {
  const calc = harness();
  await calc.openExport();
  await calc.click('На работы');
  await calc.click('+10%');
  assert.deepEqual(calc.saved.at(-1), { percent: 10, scope: 'works' });
  const reopened = harness(calc.saved.at(-1));
  const header = nodes(reopened.tree).find(n => n.props.subtitle === 'КАЛЬКУЛЯТОР');
  assert.match(normalize(text(header.props.right)), /1 600 ₽/);
  assert.match(normalize(text(header.props.right)), /1 500 ₽/);
  assert.match(text(header.props.right), /Наценка на работы \+10%/);
});

for (const [mode, expected] of [['Общая смета', 1600], ['Общая + чертежи', 1600], ['По помещениям', 1600], ['Одно помещение', 640]]) {
  test(`works markup is applied once in export: ${mode}`, async () => {
    const calc = harness({ percent: 10, scope: 'works' });
    await calc.openExport();
    await calc.click(mode);
    await calc.click('Скачать');
    const html = normalize(calc.html);
    assert.match(html, /Наценка на работы \+10%/);
    assert.match(html, new RegExp('grand-value">' + expected.toLocaleString('ru-RU').replaceAll('\u00a0', ' ') + ' ₽'));
    assert.match(html, /<td>100<\/td>/, 'base material price remains unchanged');
    assert.match(html, /<td>200<\/td>/, 'base work price remains unchanged');
  });
}

test('material discount leaves work subtotal untouched', async () => {
  const calc = harness({ percent: -10, scope: 'mats' });
  await calc.openExport();
  await calc.click('Скачать');
  const html = normalize(calc.html);
  assert.match(html, /Скидка на материалы/);
  assert.match(html, /grand-value">1 450 ₽/);
  assert.match(html, /Итого работы:<\/td><td class="r">1 000 ₽/);
});

test('room export explains total-only overrides before download', async () => {
  const calc = harness(undefined, { [JSON.stringify(['total', 'works', work.id])]: { q: 25 } });
  await calc.openExport();
  assert.doesNotMatch(calc.text, /не распределены по помещениям/);
  await calc.click('По помещениям');
  assert.match(calc.text, /не распределены по помещениям/);
  await calc.click('Одно помещение');
  assert.match(calc.text, /не распределены по помещениям/);
});


test('App retains markup with the edited project through export, reopening and project changes', () => {
  const render = hookRenderer(App);
  let tree = render();
  const getHome = () => nodes(tree).find(n => n.props.orders && n.props.onOpen);
  const first = { id: 'first', name: 'Первый', rooms, nomSnapshot: { [material.id]: 100, [work.id]: 200 }, estimateEdits: { stable: { q: 15 } }, planImage: 'existing-plan' };
  const second = { ...first, id: 'second', name: 'Второй', estimateEdits: {} };
  getHome().props.setOrders([first, second]);
  tree = render();
  getHome().props.onOpen('first');
  tree = render();
  const calc = nodes(tree).find(n => n.type === CalcScreen);
  calc.props.onEstimateAdjustmentChange({ percent: 10, scope: 'works' });
  calc.props.onEstimateExportOptionsChange({ showAdjustment: false });
  // Another edit arriving before React re-renders must preserve the markup.
  calc.props.onEstimateEditsChange({ stable: { q: 20 } });
  tree = render();
  nodes(tree).find(n => n.type === CalcScreen).props.onBack();
  tree = render();
  const stored = JSON.parse(JSON.stringify(sanitizeOrdersForStorage(getHome().props.orders)));
  assert.deepEqual(stored[0].estimateAdjustment, { percent: 10, scope: 'works' });
  assert.deepEqual(stored[0].estimateExportOptions, { showAdjustment: false });
  assert.equal(stored[0].estimateEdits.stable.q, 20);
  assert.equal(stored[0].planImage, 'existing-plan');
  assert.equal(stored[1].estimateAdjustment, undefined);
  assert.equal(stored[1].estimateExportOptions, undefined);
  getHome().props.onOpen('second');
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === CalcScreen).props.initEstimateAdjustment, undefined);
  nodes(tree).find(n => n.type === CalcScreen).props.onBack();
  tree = render();
  getHome().props.onOpen('first');
  tree = render();
  assert.deepEqual(JSON.parse(JSON.stringify(nodes(tree).find(n => n.type === CalcScreen).props.initEstimateAdjustment)), { percent: 10, scope: 'works' });
  assert.deepEqual(JSON.parse(JSON.stringify(nodes(tree).find(n => n.type === CalcScreen).props.initEstimateExportOptions)), { showAdjustment: false });
});


test('export disclosure is checked by default, saved when changed and does not hide internal totals', async () => {
  const calc = harness({ percent: 10, scope: 'works' });
  await calc.openExport();
  const checkbox = nodes(calc.tree).find(node => node.type === 'input' && node.props['aria-label'] === 'Показывать наценку или скидку в смете');
  assert.ok(checkbox, 'disclosure checkbox exists');
  assert.equal(checkbox.props.checked, true);
  checkbox.props.onChange({ target: { checked: false } });
  calc.render();
  assert.deepEqual(calc.savedOptions.at(-1), { showAdjustment: false });
  const reopened = harness({ percent: 10, scope: 'works' }, {}, calc.savedOptions.at(-1));
  await reopened.openExport();
  assert.equal(nodes(reopened.tree).find(node => node.type === 'input' && node.props['aria-label'] === 'Показывать наценку или скидку в смете').props.checked, false);
  const header = nodes(reopened.tree).find(node => node.props.subtitle === 'КАЛЬКУЛЯТОР');
  assert.match(text(header.props.right), /Наценка на работы/);
});

const amountFromHtml = html => Number(normalize(html).match(/class="grand-value">([\d ,.-]+) ₽/)[1].replaceAll(' ', '').replace(',', '.'));
for (const mode of ['Общая смета', 'Общая + чертежи', 'По помещениям', 'Одно помещение']) {
  for (const scope of ['works', 'mats', 'all']) {
    for (const percent of [10, -10]) {
      test(`embedded adjustment: ${mode}, ${scope}, ${percent}%`, async () => {
        const hidden = harness({ percent, scope }, {}, { showAdjustment: false });
        await hidden.openExport(); await hidden.click(mode); await hidden.click('Скачать');
        const shown = harness({ percent, scope }, {}, { showAdjustment: true });
        await shown.openExport(); await shown.click(mode); await shown.click('Скачать');
        const html = normalize(hidden.html);
        assert.doesNotMatch(html, /наценк|скидк|корректировк|без наценки|без скидки/i);
        assert.equal(amountFromHtml(html), amountFromHtml(shown.html));
        const materialPrice = scope === 'works' ? 100 : Math.round(100 * (1 + percent / 100));
        const workPrice = scope === 'mats' ? 200 : Math.round(200 * (1 + percent / 100));
        assert.ok(html.includes('<td>' + materialPrice + '</td>'), 'material unit price follows its selected scope');
        assert.ok(html.includes('<td>' + workPrice + '</td>'), 'work unit price follows its selected scope');
      });
    }
  }
}

test('per-room embedded adjustment allocates cent rounding globally', async () => {
  const fixture = { prices: { [material.id]: 0, [work.id]: 0.05 } };
  const exports = [];
  for (const showAdjustment of [true, false]) {
    const calc = harness({ percent: 10, scope: 'works' }, {}, { showAdjustment }, fixture);
    await calc.openExport(); await calc.click('По помещениям'); await calc.click('Скачать');
    exports.push(normalize(calc.html));
  }
  assert.equal(amountFromHtml(exports[0]), 0.28);
  assert.equal(amountFromHtml(exports[1]), 0.28);
  const rowTotals = [...exports[1].matchAll(/<tbody>(.*?)<\/tbody>/gs)]
    .flatMap(match => [...match[1].matchAll(/<tr>(.*?)<\/tr>/gs)])
    .map(match => Number([...match[1].matchAll(/<td>(.*?)<\/td>/gs)].at(-1)[1].replace(' ₽', '').replaceAll(' ', '').replace(',', '.')));
  assert.equal(Math.round(rowTotals.reduce((sum, value) => sum + value, 0) * 100), 28);
});

test('embedded markup formats quantity to two decimals and preserves exact price and amount', async () => {
  const edits = { [JSON.stringify(['total', 'works', work.id])]: { q: 0.333 } };
  const calc = harness({ percent: 10, scope: 'works' }, edits, { showAdjustment: false },
    { prices: { [material.id]: 0, [work.id]: 300 } });
  await calc.openExport(); await calc.click('Скачать');
  const html = normalize(calc.html);
  const workRow = [...html.matchAll(/<tr>(.*?)<\/tr>/gs)].find(match => match[1].includes(work.name))[1];
  const cells = [...workRow.matchAll(/<td>(.*?)<\/td>/gs)].map(match => match[1]);
  assert.equal(cells[2], '0,33');
  assert.equal(cells[4], '330');
  assert.equal(cells[5], '109,89 ₽');
  const number = value => Number(value.replace(' ₽', '').replaceAll(' ', '').replace(',', '.'));
  assert.equal(Math.round(0.333 * number(cells[4]) * 100), Math.round(number(cells[5]) * 100));
  assert.equal(amountFromHtml(html), 109.89);
});
