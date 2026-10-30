import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

// Run App's real effects and storage adapters. The fake IndexedDB below delays
// transaction completion, not saveAppStateToIdb/loadAppStateFromIdb themselves.
const bundle = await build({
  stdin: { contents: `import React from 'react'; export { React };
    export { default as App } from './src/App.jsx';
    export { default as CalcScreen } from './src/components/screens/CalcScreen.jsx';
    export { saveAppStateToIdb, loadAppStateFromIdb } from './src/data/presets.js';
    export { AUTO_SAVE_KEY } from './src/utils/storage.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'iife', globalName: 'fixture', platform: 'node',
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  loader: { '.js': 'jsx', '.css': 'empty' }, logLevel: 'error',
});
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const room = { id: 'r', name: 'Комната', on: true, v: [], lights: [] };
const order = (percent = 0) => ({ id: 'a', name: 'Первый', rooms: [room], nomSnapshot: { retained: 100 },
  estimateAdjustment: { percent, scope: 'works' }, planImage: 'plan-data' });
const snapshot = (ts, percent = 0) => ({ v: 2, ts, theme: 'light', orders: [order(percent)] });
function storage(initial, fallback) {
  const data = new Map([['appState:state', copy(initial)]]);
  const local = new Map();
  if (fallback != null) local.set('magicapp_v2_4_autosave_v1', typeof fallback === 'string' ? fallback : JSON.stringify(fallback));
  const pending = [];
  const db = {
    version: 2, objectStoreNames: { contains: () => true }, close() {},
    transaction(store) {
      const tx = { objectStore: () => ({
        get(key) {
          const req = {};
          queueMicrotask(() => { req.result = copy(data.get(store + ':' + key)); req.onsuccess?.(); });
          return req;
        },
        put(value, key) {
          const saved = copy(value);
          const commit = () => { data.set(store + ':' + key, saved); tx.oncomplete?.(); };
          if (store === 'appState') pending.push({ value: saved, commit });
          else queueMicrotask(commit);
        },
      }) };
      return tx;
    },
  };
  return { local, pending, data, now: 1000, indexedDB: { open() {
    const req = {};
    queueMicrotask(() => { req.result = db; req.onsuccess?.(); });
    return req;
  } } };
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
async function mount(persistence) {
  const listeners = new Map();
  const window = {
    location: { search: '', pathname: '/app/' },
    localStorage: { getItem: key => persistence.local.get(key) ?? null, setItem: (key, value) => persistence.local.set(key, value) },
    addEventListener: (name, listener) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
    removeEventListener: (name, listener) => listeners.get(name)?.delete(listener),
    dispatchEvent: event => { for (const fn of listeners.get(event.type) || []) fn(event); return true; },
  };
  class Clock extends Date { static now() { return persistence.now; } }
  class Event { constructor(type) { this.type = type; } }
  class CustomEvent extends Event { constructor(type, options) { super(type); this.detail = options?.detail; } }
  const context = vm.createContext({ console, window, indexedDB: persistence.indexedDB, URLSearchParams, Date: Clock,
    Event, CustomEvent, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} });
  vm.runInContext(bundle.outputFiles[0].text, context);
  const { React, App, CalcScreen } = context.fixture;
  const slots = [];
  let cursor = 0, dirty = false, tree;
  let effects = [];
  const dispatcher = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => {
        const value = typeof next === 'function' ? next(slots[i]) : next;
        if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps?.some((value, index) => !Object.is(value, slots[i].deps?.[index]))) {
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
    useCallback(fn) { cursor++; return fn; },
    useMemo(fn) { cursor++; return fn(); },
  };
  const render = () => {
    dirty = false; cursor = 0;
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
    try { tree = App(); }
    finally { React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = null; }
    const ready = effects; effects = []; ready.forEach(fn => fn());
  };
  const flush = async () => { for (let i = 0; i < 80; i++) { await Promise.resolve(); if (dirty) render(); } };
  render();
  await flush();
  return { flush, context, window,
    get home() { return nodes(tree).find(node => node.props.onOpen && node.props.orders)?.props; },
    get calc() { return nodes(tree).find(node => node.type === CalcScreen)?.props; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('real app-state IDB adapter reaches the appState store and reads back its data', async () => {
  const persistence = storage(null);
  const app = await mount(persistence);
  assert.equal(persistence.pending.length, 1, 'initial autosave must start a real IDB transaction');
  persistence.pending.shift().commit();
  await app.flush();
  const read = await app.context.fixture.loadAppStateFromIdb();
  assert.ok(Array.isArray(read.orders));
  app.unmount();
});

test('rapid markup and quantity edits queue a save behind an in-flight IDB write', async () => {
  const persistence = storage(snapshot(100));
  const app = await mount(persistence);
  assert.equal(persistence.pending.length, 1);
  app.home.onOpen('a'); await app.flush();
  app.calc.onEstimateAdjustmentChange({ percent: 0, scope: 'works' });
  app.calc.onEstimateAdjustmentChange({ percent: 10, scope: 'works' });
  app.calc.onEstimateEditsChange({ '["total","works","x"]': { q: 150 } });
  await app.flush();
  const syncCopy = JSON.parse(persistence.local.get('magicapp_v2_4_autosave_v1'));
  assert.equal(syncCopy.orders[0].estimateAdjustment.percent, 10, 'latest edit is protected before IDB finishes');
  persistence.pending.shift().commit(); await app.flush();
  assert.equal(persistence.pending.length, 1, 'coalesced latest edit must be written after the first transaction');
  assert.equal(persistence.pending[0].value.orders[0].estimateAdjustment.percent, 10);
  assert.equal(persistence.pending[0].value.orders[0].estimateEdits['["total","works","x"]'].q, 150);
  assert.equal(JSON.parse(persistence.local.get('magicapp_v2_4_autosave_v1')).orders[0].estimateAdjustment.percent, 10, 'old completion cannot overwrite the fallback');
  persistence.pending.shift().commit(); await app.flush();
  app.unmount();
  const reopened = await mount(persistence);
  assert.equal(reopened.home.orders[0].estimateAdjustment.percent, 10);
  assert.equal(reopened.home.orders[0].planImage, 'plan-data');
  reopened.unmount();
});

test('reload before IDB completion restores newer unload data and preserves the plan', async () => {
  const persistence = storage(snapshot(100));
  const app = await mount(persistence);
  app.home.onOpen('a'); await app.flush();
  app.calc.onEstimateAdjustmentChange({ percent: 10, scope: 'works' });
  app.window.dispatchEvent({ type: 'beforeunload' });
  app.unmount();
  persistence.pending.shift()?.commit(); await app.flush();
  const reopened = await mount(persistence);
  assert.equal(reopened.home.orders[0].estimateAdjustment.percent, 10);
  assert.equal(reopened.home.orders[0].planImage, 'plan-data');
  reopened.unmount();
});

for (const [name, idb, local, expected] of [
  ['newer fallback', snapshot(100, 0), snapshot(200, 10), 10],
  ['newer IDB', snapshot(300, 15), snapshot(200, 10), 15],
  ['equal timestamps prefer full IDB', snapshot(200, 15), snapshot(200, 10), 15],
  ['invalid fallback', snapshot(300, 15), '{broken', 15],
  ['malformed newer fallback', snapshot(300, 15), { ts: 9999, orders: 'invalid' }, 15],
  ['malformed IDB', { ts: 9999, orders: 'invalid' }, snapshot(200, 10), 10],
]) {
  test(`startup chooses the newest valid saved snapshot: ${name}`, async () => {
    const app = await mount(storage(idb, local));
    assert.equal(app.home.orders[0].estimateAdjustment.percent, expected);
    app.unmount();
  });
}

test('newer fallback with explicit null plan does not revive a removed plan', async () => {
  const fallback = snapshot(200, 10); fallback.orders[0].planImage = null;
  const app = await mount(storage(snapshot(100), fallback));
  assert.equal(app.home.orders[0].planImage, null);
  app.unmount();
});
