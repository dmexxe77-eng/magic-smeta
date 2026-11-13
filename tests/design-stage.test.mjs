import assert from 'node:assert/strict';
import test from 'node:test';
import { fitToStage } from '../src/design-bridge/stage.js';

const styles = overrides => ({ overflow: 'hidden', overflowX: 'hidden', overflowY: 'hidden', borderTopLeftRadius: '24px', borderRadius: '24px', ...overrides });
const element = (rect, computed = styles()) => ({ rect, computed, getBoundingClientRect() { return this.rect; } });

function surface(t, { marker = null, legacy = [], width = 1366, observer = true } = {}) {
  const previous = Object.fromEntries(['document', 'window', 'getComputedStyle', 'ResizeObserver'].map(key => [key, globalThis[key]]));
  const events = collection => ({
    addEventListener(type, fn) { if (!collection.has(type)) collection.set(type, new Set()); collection.get(type).add(fn); },
    removeEventListener(type, fn) { collection.get(type)?.delete(fn); },
  });
  const windowEvents = new Map(), viewportEvents = new Map(), observers = [], html = {}, root = { querySelectorAll() { scans++; return legacy; } };
  let current = marker, scans = 0;
  globalThis.document = { documentElement: html, body: root, querySelector: selector => selector === '[data-zamer-app-stage]' ? current : null, getElementById: () => root };
  globalThis.getComputedStyle = node => node.computed;
  class ResizeObserverMock {
    constructor(callback) { this.callback = callback; this.observed = new Set(); this.unobserved = []; this.disconnected = false; observers.push(this); }
    observe(node) { this.observed.add(node); }
    unobserve(node) { this.observed.delete(node); this.unobserved.push(node); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
  }
  globalThis.window = { innerWidth: width, ...events(windowEvents), visualViewport: events(viewportEvents), ...(observer ? { ResizeObserver: ResizeObserverMock } : {}) };
  if (observer) globalThis.ResizeObserver = ResizeObserverMock;
  else delete globalThis.ResizeObserver;
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } });
  return {
    observers, html, setMarker: value => { current = value; }, scans: () => scans,
    emit(type, where = 'window') { [...((where === 'window' ? windowEvents : viewportEvents).get(type) || [])].forEach(fn => fn()); },
    listenerCount: where => [...(where === 'visual' ? viewportEvents : windowEvents).values()].reduce((sum, set) => sum + set.size, 0),
  };
}

test('overlay stage: the explicit full-width workspace wins over large rounded cards', t => {
  const marker = element({ left: 0, top: 56, width: 1366, height: 968 }, styles({ borderRadius: '0px', borderTopLeftRadius: '0px' }));
  const card = element({ left: 40, top: 80, width: 620, height: 900 });
  const env = surface(t, { marker, legacy: [card] }), host = { style: {} }, close = fitToStage(host);
  assert.equal(env.scans(), 0, 'semantic workspace selection never scans decorative cards');
  assert.deepEqual(host.style, { position: 'fixed', left: '0px', top: '56px', width: '1366px', height: '968px', right: 'auto', bottom: 'auto', borderRadius: '0px', overflow: 'hidden' });
  assert.ok(env.observers[0].observed.has(marker));
  assert.ok(env.observers[0].observed.has(env.html));
  close();
});

test('overlay stage: orientation, visual viewport and observed container changes update exact bounds', t => {
  const marker = element({ left: 0, top: 60, width: 834, height: 1134 }), env = surface(t, { marker }), host = { style: {} }, close = fitToStage(host);
  marker.rect = { left: 76, top: 0, width: 1118, height: 834 };
  env.emit('resize');
  assert.equal(host.style.left, '76px');
  assert.equal(host.style.width, '1118px');
  assert.equal(host.style.height, '834px');
  marker.rect = { left: 76.5, top: 10.25, width: 1117.5, height: 500.25 };
  env.emit('resize', 'visual');
  assert.equal(host.style.top, '10.25px');
  assert.equal(host.style.height, '500.25px');
  marker.rect.height = 490;
  env.observers[0].callback();
  assert.equal(host.style.height, '490px');
  close();
});

test('overlay stage: replacing a screen swaps the observed marker and cleanup blocks queued callbacks', t => {
  const first = element({ left: 0, top: 0, width: 834, height: 1194 }), second = element({ left: 0, top: 0, width: 1194, height: 834 });
  const env = surface(t, { marker: first }), host = { style: {} }, close = fitToStage(host), observer = env.observers[0];
  env.setMarker(second);
  observer.callback();
  assert.ok(observer.unobserved.includes(first));
  assert.ok(observer.observed.has(second));
  assert.equal(host.style.width, '1194px');
  assert.equal(env.listenerCount('window'), 2);
  assert.equal(env.listenerCount('visual'), 2);
  close();
  assert.equal(observer.disconnected, true);
  assert.equal(env.listenerCount('window'), 0);
  assert.equal(env.listenerCount('visual'), 0);
  const before = { ...host.style };
  second.rect.width = 400;
  observer.callback();
  env.emit('resize');
  env.emit('scroll', 'visual');
  assert.deepEqual(host.style, before, 'late queued work cannot resize a closed overlay');
});

test('overlay stage: a temporarily empty explicit workspace falls back to the viewport without selecting a rounded card', t => {
  const marker = element({ left: 0, top: 0, width: 0, height: 0 }), card = element({ left: 20, top: 20, width: 620, height: 900 });
  const env = surface(t, { marker, legacy: [card] }), host = { style: { width: '620px', borderRadius: '32px' } }, close = fitToStage(host);
  assert.equal(env.scans(), 0);
  assert.deepEqual(host.style, { position: 'fixed', left: '0px', top: '0px', right: '0px', bottom: '0px', width: '', height: '', borderRadius: '', overflow: '' });
  marker.rect = { left: 0, top: 0, width: 1280, height: 800 };
  env.observers[0].callback();
  assert.equal(host.style.width, '1280px');
  assert.equal(host.style.height, '800px');
  close();
});

test('overlay stage: older prototypes without a marker retain their clipped phone-screen fallback', t => {
  const phone = element({ left: 195, top: 28, width: 402, height: 874 });
  const tooSmall = element({ left: 0, top: 0, width: 300, height: 300 });
  const fullWidth = element({ left: 0, top: 0, width: 800, height: 900 });
  const plain = element({ left: 0, top: 0, width: 600, height: 900 }, styles({ borderTopLeftRadius: '0px' }));
  const open = element({ left: 0, top: 0, width: 620, height: 900 }, styles({ overflow: 'visible', overflowX: 'visible', overflowY: 'visible' }));
  const env = surface(t, { legacy: [phone, tooSmall, fullWidth, plain, open], width: 800 }), host = { style: {} }, close = fitToStage(host);
  assert.equal(env.scans(), 1);
  assert.equal(host.style.left, '195px');
  assert.equal(host.style.top, '28px');
  assert.equal(host.style.width, '402px');
  assert.equal(host.style.height, '874px');
  close();
});

test('overlay stage: a page without a suitable stage fills the viewport and still supports resize without ResizeObserver', t => {
  const env = surface(t, { observer: false }), host = { style: {} }, close = fitToStage(host);
  assert.equal(host.style.right, '0px');
  assert.equal(host.style.bottom, '0px');
  const marker = element({ left: 0, top: 0, width: 1280, height: 720 });
  env.setMarker(marker);
  env.emit('resize');
  assert.equal(host.style.width, '1280px');
  assert.equal(host.style.height, '720px');
  close();
  assert.equal(env.listenerCount('window'), 0);
  assert.equal(env.listenerCount('visual'), 0);
});
