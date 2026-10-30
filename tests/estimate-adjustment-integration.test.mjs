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
function harness(adjustment = { percent: 0, scope: 'all' }, edits = {}) {
  CALC_STATE_REF.presets = [{ id: 'fixture', items: [material.id, work.id], options: [] }];
  CALC_STATE_REF.globalOpts = [];
  CALC_STATE_REF.customBlocks = [];
  const saved = [];
  const renderComponent = hookRenderer(() => CalcScreen({ initRooms: rooms, initMode: 'main', initNomSnapshot: { [material.id]: 100, [work.id]: 200 },
    initEstimateAdjustment: adjustment, initEstimateEdits: edits,
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
  return { saved, render, click, get tree() { return tree; }, get text() { return text(tree); },
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
  // Another edit arriving before React re-renders must preserve the markup.
  calc.props.onEstimateEditsChange({ stable: { q: 20 } });
  tree = render();
  nodes(tree).find(n => n.type === CalcScreen).props.onBack();
  tree = render();
  const stored = JSON.parse(JSON.stringify(sanitizeOrdersForStorage(getHome().props.orders)));
  assert.deepEqual(stored[0].estimateAdjustment, { percent: 10, scope: 'works' });
  assert.equal(stored[0].estimateEdits.stable.q, 20);
  assert.equal(stored[0].planImage, 'existing-plan');
  assert.equal(stored[1].estimateAdjustment, undefined);
  getHome().props.onOpen('second');
  tree = render();
  assert.equal(nodes(tree).find(n => n.type === CalcScreen).props.initEstimateAdjustment, undefined);
  nodes(tree).find(n => n.type === CalcScreen).props.onBack();
  tree = render();
  getHome().props.onOpen('first');
  tree = render();
  assert.deepEqual(JSON.parse(JSON.stringify(nodes(tree).find(n => n.type === CalcScreen).props.initEstimateAdjustment)), { percent: 10, scope: 'works' });
});
