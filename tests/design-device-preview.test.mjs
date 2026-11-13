import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { devicePreviewPage } from '../scripts/design-device-preview.mjs';
import { PRESETS, isNativeDevice, resolvePreviewMode, resolveDevice, computePreviewLayout, appLocation } from '../design-src/device-preview.js';
import { readTemplate } from './design-runtime.mjs';

test('device preview: actual touch devices stay native even with a fine trackpad or mouse', () => {
  for (const capabilities of [
    { maxTouchPoints: 5, coarse: false, hoverFine: true },
    { maxTouchPoints: 2, coarse: true, hoverFine: true },
    { maxTouchPoints: 1, coarse: true, hoverFine: false },
    { maxTouchPoints: 0, coarse: true, hoverFine: false },
  ]) {
    assert.equal(isNativeDevice(capabilities), true);
    assert.equal(resolvePreviewMode('', capabilities), 'native');
  }
});

test('device preview: a desktop with a fine mouse receives the device chooser without user-agent detection', () => {
  for (const maxTouchPoints of [0, 1]) {
    const capabilities = { maxTouchPoints, coarse: false, hoverFine: true };
    assert.equal(isNativeDevice(capabilities), false);
    assert.equal(resolvePreviewMode('?v=tablet-review', capabilities), 'preview');
  }
  assert.equal(isNativeDevice(), true, 'unknown capabilities prefer the working native app');
});

test('device preview: explicit preview overrides work in both directions and unknown values preserve automatic choice', () => {
  const touch = { maxTouchPoints: 5, coarse: false, hoverFine: true }, mouse = { maxTouchPoints: 0, coarse: false, hoverFine: true };
  assert.equal(resolvePreviewMode('?preview=1', touch), 'preview');
  assert.equal(resolvePreviewMode('?preview=0', mouse), 'native');
  assert.equal(resolvePreviewMode('?preview=unknown', touch), 'native');
  assert.equal(resolvePreviewMode('?preview=unknown', mouse), 'preview');
});

test('device preview: known phone and tablet presets use real CSS viewport sizes and invalid selections have a safe default', () => {
  assert.equal(Object.isFrozen(PRESETS), true);
  assert.equal(new Set(PRESETS.map(preset => preset.id)).size, PRESETS.length);
  for (const [id, width, height] of [['iphone-se', 375, 667], ['iphone-14', 390, 844], ['iphone-pro-max', 430, 932], ['galaxy-s', 360, 800], ['pixel', 412, 915], ['ipad-mini', 768, 1024], ['ipad-11', 834, 1194], ['ipad-pro-13', 1024, 1366], ['galaxy-tab', 800, 1280]]) {
    assert.deepEqual([resolveDevice(id).width, resolveDevice(id).height], [width, height]);
    assert.ok(resolveDevice(id).name && resolveDevice(id).group);
  }
  for (const id of [undefined, null, '', 'https://untrusted.invalid/', 'missing-device']) assert.equal(resolveDevice(id).id, 'iphone-14');
  assert.equal(resolveDevice('responsive').id, 'responsive');
});

test('device preview: Fit changes only visual scale while portrait and landscape retain the selected CSS viewport', () => {
  const portrait = computePreviewLayout({ deviceId: 'iphone-14', stageWidth: 1000, stageHeight: 600 });
  assert.equal(portrait.width, 390);
  assert.equal(portrait.height, 844);
  assert.ok(portrait.scale > 0 && portrait.scale < 1);
  assert.ok(portrait.displayWidth <= 952 && portrait.displayHeight <= 552);
  assert.ok(Math.abs(portrait.displayWidth - portrait.width * portrait.scale) < 1e-6);
  assert.ok(Math.abs(portrait.displayHeight - portrait.height * portrait.scale) < 1e-6);
  const landscape = computePreviewLayout({ deviceId: 'ipad-11', orientation: 'landscape', stageWidth: 1100, stageHeight: 700 });
  assert.equal(landscape.width, 1194);
  assert.equal(landscape.height, 834);
  assert.ok(landscape.displayWidth <= 1052 && landscape.displayHeight <= 652);
});

test('device preview: 100 percent preserves large viewports for scrolling and Fit never enlarges them past native size', () => {
  const actual = computePreviewLayout({ deviceId: 'ipad-pro-13', orientation: 'landscape', zoom: '100', stageWidth: 600, stageHeight: 400 });
  assert.equal(actual.scale, 1);
  assert.equal(actual.width, 1366);
  assert.equal(actual.height, 1024);
  assert.equal(actual.displayWidth, 1366);
  assert.equal(actual.displayHeight, 1024);
  const roomy = computePreviewLayout({ deviceId: 'iphone-se', stageWidth: 3000, stageHeight: 2000 });
  assert.equal(roomy.scale, 1);
});

test('device preview: browser mode follows the available stage and tiny or invalid bounds remain finite', () => {
  const fluid = computePreviewLayout({ deviceId: 'responsive', orientation: 'landscape', stageWidth: 1280, stageHeight: 800 });
  assert.deepEqual([fluid.width, fluid.height, fluid.scale], [1232, 752, 1]);
  for (const bounds of [{}, { stageWidth: 0, stageHeight: 0 }, { stageWidth: NaN, stageHeight: Infinity }, { stageWidth: -100, stageHeight: -200 }]) {
    const fixed = computePreviewLayout(bounds), responsive = computePreviewLayout({ ...bounds, deviceId: 'responsive' });
    for (const value of [fixed, responsive]) {
      assert.ok(Object.values(value).every(Number.isFinite));
      assert.ok(value.width >= 1 && value.height >= 1 && value.scale > 0);
    }
  }
  const invalidControls = computePreviewLayout({ deviceId: 'bad', orientation: 'bad', zoom: 'bad', stageWidth: 1000, stageHeight: 600 });
  assert.equal(invalidControls.width, 390);
  assert.equal(invalidControls.height, 844);
  assert.ok(invalidControls.scale < 1);
});

test('device preview: app URLs retain project query and hash while stripping only namespaced host controls', () => {
  const href = 'https://smeta-xi.vercel.app/design/index.html?preview=1&previewDevice=ipad-11&previewOrientation=landscape&previewZoom=100&v=review-42&project=room%20one&device=keep&x=1&x=2#drawing';
  const app = new URL(appLocation(href));
  assert.equal(app.origin, 'https://smeta-xi.vercel.app');
  assert.equal(app.pathname, '/design/app.html');
  assert.equal(app.hash, '#drawing');
  for (const key of ['preview', 'previewDevice', 'previewOrientation', 'previewZoom']) assert.equal(app.searchParams.has(key), false);
  assert.equal(app.searchParams.get('project'), 'room one');
  assert.equal(app.searchParams.get('device'), 'keep');
  assert.equal(app.searchParams.get('v'), 'review-42');
  assert.deepEqual(app.searchParams.getAll('x'), ['1', '2']);
});

test('device preview: native redirects and iframe URLs always resolve to the native app without stale recursive overrides', () => {
  for (const path of ['/design/?preview=0#project', '/design/index.html?preview=1#project', '/design/app.html?previewDevice=ipad-11#project']) {
    const app = new URL(appLocation('http://127.0.0.1:5177' + path));
    assert.equal(app.pathname, '/design/app.html');
    assert.equal(app.origin, 'http://127.0.0.1:5177');
    assert.equal(app.hash, '#project');
    assert.equal(app.search, '');
  }
});

test('device preview page: the chooser host does not execute a duplicate app bundle and retains local font styling', () => {
  const html = devicePreviewPage({ css: '.preview-test{color:red}', scriptUrl: './device-preview.js', fonts: '@font-face{font-family:Manrope;src:url(data:font/woff2;base64,AA)}' });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="\.\/device-preview\.js")[^>]*>/);
  assert.ok(html.includes('.preview-test{color:red}'));
  assert.ok(html.includes('font-family:Manrope'));
  assert.doesNotMatch(html, /__bundler\/|data-dc-script|\/design\/(?:draw|trace|storage|estimate)\.js/);
});

function previewRuntime() {
  const html = devicePreviewPage(), elements = new Map();
  for (const [, id] of html.matchAll(/\bid="([^"]*)"/g)) {
    const listeners = new Map(), attrs = new Map(), classes = new Set();
    elements.set(id, {
      style: {}, dataset: {}, value: '', textContent: '', hidden: false,
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
      setAttribute(key, value) { attrs.set(key, value); },
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
      emit(type) { (listeners.get(type) || []).forEach(fn => fn()); },
      scrollTo() {},
    });
  }
  const frame = elements.get('preview-frame'), stage = elements.get('preview-stage'), navigations = [], iframeAppState = { draft: '' };
  Object.defineProperty(frame, 'src', { set(value) { navigations.push(value); iframeAppState.draft = ''; }, get() { return navigations.at(-1); } });
  frame.contentDocument = { querySelector: () => ({}) };
  stage.clientWidth = 1000; stage.clientHeight = 600;
  const initial = new URL('https://smeta-xi.vercel.app/design/?project=test&preview=1'), windowEvents = new Map(), observers = [];
  class PreviewResizeObserver {
    constructor(callback) { this.callback = callback; this.observeCalls = 0; this.watching = false; observers.push(this); }
    observe() { this.watching = true; this.observeCalls++; }
    disconnect() { this.watching = false; }
  }
  const window = {
    location: { href: initial.href, search: initial.search, replace() { throw new Error('A fine-mouse desktop should keep its preview host'); } },
    matchMedia: query => ({ matches: query.includes('hover: hover') }),
    history: { state: {}, replaceState(state, title, url) { window.location.href = String(url); window.location.search = new URL(url).search; } },
    addEventListener(type, fn) { if (!windowEvents.has(type)) windowEvents.set(type, new Set()); windowEvents.get(type).add(fn); },
    removeEventListener: (type, fn) => windowEvents.get(type)?.delete(fn),
    setTimeout: () => 1, clearTimeout() {},
  };
  const document = { getElementById: id => elements.get(id) || null, documentElement: { dataset: {} } };
  const source = transformSync(fs.readFileSync('design-src/device-preview.js', 'utf8'), { loader: 'js', format: 'iife' }).code;
  vm.runInNewContext(source, { window, document, navigator: { maxTouchPoints: 0 }, URL, URLSearchParams, ResizeObserver: PreviewResizeObserver, setTimeout: () => 1, clearTimeout() {} });
  return {
    frame, stage, navigations, iframeAppState, elements, observers,
    emitWindow: (type, event = {}) => [...(windowEvents.get(type) || [])].forEach(fn => fn(event)),
    listenerCount: type => windowEvents.get(type)?.size || 0,
  };
}

test('device preview runtime: changing device, orientation and scale resizes the same mounted iframe without navigation', () => {
  const { frame, stage, navigations, iframeAppState, elements, emitWindow, listenerCount } = previewRuntime();
  assert.equal(navigations.length, 1);
  assert.equal(new URL(frame.src).pathname, '/design/app.html');
  iframeAppState.draft = 'Незавершённый проект';
  const select = elements.get('preview-device');
  select.value = 'ipad-11'; select.emit('change');
  assert.equal(frame.style.width, '834px');
  assert.equal(frame.style.height, '1194px');
  elements.get('preview-rotate').emit('click');
  assert.equal(frame.style.width, '1194px');
  assert.equal(frame.style.height, '834px');
  assert.notEqual(frame.style.transform, 'scale(1)', 'Fit affects presentation without changing the iframe CSS viewport');
  elements.get('preview-actual').emit('click');
  assert.equal(frame.style.transform, 'scale(1)');
  elements.get('preview-fit').emit('click');
  select.value = 'responsive'; select.emit('change');
  assert.equal(frame.style.width, '952px');
  assert.equal(frame.style.height, '552px');
  stage.clientWidth = 1280; stage.clientHeight = 800;
  emitWindow('resize');
  assert.equal(frame.style.width, '1232px');
  assert.equal(frame.style.height, '752px');
  assert.equal(navigations.length, 1, 'every chooser action and outer resize keeps the existing app document');
  assert.equal(iframeAppState.draft, 'Незавершённый проект');
  emitWindow('pagehide');
  assert.equal(listenerCount('resize'), 0, 'the outer viewport listener is released with the host');
});

test('device preview runtime: returning from browser history resumes viewport updates without reloading the app', () => {
  const { frame, stage, navigations, iframeAppState, elements, emitWindow, listenerCount, observers } = previewRuntime();
  const select = elements.get('preview-device'), observer = observers[0];
  select.value = 'responsive'; select.emit('change');
  iframeAppState.draft = 'Сохранить черновик при возврате';
  assert.equal(listenerCount('resize'), 1);
  assert.equal(observer.watching, true);
  for (const [width, height] of [[1280, 800], [1440, 900]]) {
    emitWindow('pagehide', { persisted: true });
    assert.equal(listenerCount('resize'), 0);
    assert.equal(observer.watching, false);
    stage.clientWidth = width; stage.clientHeight = height;
    emitWindow('pageshow', { persisted: true });
    assert.equal(listenerCount('resize'), 1);
    assert.equal(observer.watching, true);
    assert.equal(frame.style.width, `${width - 48}px`);
    assert.equal(frame.style.height, `${height - 48}px`);
    const observed = observer.observeCalls;
    emitWindow('pageshow', { persisted: true });
    assert.equal(listenerCount('resize'), 1, 'repeated restoration events never duplicate callbacks');
    assert.equal(observer.observeCalls, observed, 'an already active observer is not registered again');
    stage.clientWidth -= 100;
    emitWindow('resize');
    assert.equal(frame.style.width, `${width - 148}px`, 'a later outer resize works after restoration');
    assert.equal(navigations.length, 1);
    assert.equal(iframeAppState.draft, 'Сохранить черновик при возврате');
  }
  emitWindow('pagehide', { persisted: false });
  assert.equal(listenerCount('resize'), 0);
  assert.equal(observer.watching, false);
  assert.equal(navigations.length, 1);
});

test('device preview build: the native app owns the business runtime while the desktop entry stays a light host', () => {
  const host = fs.readFileSync('public/design/index.html', 'utf8'), native = fs.readFileSync('public/design/app.html', 'utf8');
  assert.match(host, /device-preview\.js/);
  assert.doesNotMatch(host, /__bundler\/|data-dc-script/);
  assert.match(native, /__bundler\/template/);
  assert.match(native, /__bundler\/manifest/);
  assert.ok(readTemplate().includes('class Component extends DCLogic'));
  assert.doesNotMatch(native, /src="\.\/device-preview\.js"/, 'opening the native app does not create another preview host');
  assert.ok(fs.statSync('public/design/index.html').size < fs.statSync('public/design/app.html').size / 10);
});
