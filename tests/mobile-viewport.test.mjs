import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileInputTemplate, mobileViewportHead, mobileViewportMeta, isMobileViewport, installMobileViewportGuard } from '../src/design-bridge/mobile-viewport.js';

test('small editable text is legible without changing larger amount fields or non-form typography', () => {
  const source = '<label style="font-size:12px">Цена</label><input type="number" style="font-size:12.5px;width:48px"><textarea style="font-size:13px!important">Текст</textarea><select style="font-size:14px"><option>Шт.</option></select><input style="font-size:30px"><input type="checkbox" style="font-size:10px">';
  const result = mobileInputTemplate(source);
  assert.match(result, /<input type="number" style="font-size:16px;width:48px">/);
  assert.match(result, /<textarea style="font-size:16px!important">Текст/);
  assert.match(result, /<select style="font-size:16px">/);
  assert.match(result, /<input style="font-size:30px">/);
  assert.match(result, /<label style="font-size:12px">/);
  assert.match(result, /<input type="checkbox" style="font-size:10px">/);
  assert.equal(mobileInputTemplate(result), result);
});

test('control attributes and multiline styles survive the mobile input normalization', () => {
  const source = `<textarea aria-label="a > b" style='color:red;\nfont-size:13px' sc-value="{{ value }}">a > b</textarea>`;
  assert.equal(mobileInputTemplate(source), source.replace('font-size:13px', 'font-size:16px'));
});

test('the application, login and bootstrap can share one fixed native viewport declaration', () => {
  assert.match(mobileViewportMeta(), /width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no/);
  assert.match(mobileViewportHead(), /touch-action:pan-x pan-y/);
  assert.match(mobileViewportHead(), /src="\/design\/viewport.js"/);
});

function windowFixture(mobile) {
  const listeners = new Map(), classes = new Set();
  const win = { navigator: { maxTouchPoints: mobile ? 5 : 0 }, matchMedia: () => ({ matches: false }), document: {
    documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    addEventListener: (name, handler, options) => listeners.set(name, { handler, options }),
    removeEventListener: (name, handler) => { if (listeners.get(name)?.handler === handler) listeners.delete(name); },
  } };
  return { win, listeners, classes };
}

test('touch and home-screen contexts are recognised without locking ordinary desktop pages', () => {
  const { win } = windowFixture(false);
  assert.equal(isMobileViewport(win), false);
  assert.equal(isMobileViewport({ ...win, navigator: { standalone: true } }), true);
  assert.equal(isMobileViewport({ ...win, matchMedia: query => ({ matches: query === '(display-mode: standalone)' }) }), true);
  assert.equal(isMobileViewport({ ...win, matchMedia: query => ({ matches: query === '(pointer: coarse)' }) }), true);
});

test('the Safari page-zoom default is cancelled while canvas events continue to propagate', () => {
  const { win, listeners, classes } = windowFixture(true);
  const cleanup = installMobileViewportGuard(win);
  assert.ok(classes.has('z-mobile-viewport'));
  assert.deepEqual([...listeners.keys()], ['gesturestart', 'gesturechange']);
  let prevented = 0, stopped = 0;
  for (const listener of listeners.values()) {
    assert.equal(listener.options.passive, false);
    listener.handler({ cancelable: true, preventDefault: () => prevented++, stopPropagation: () => stopped++ });
    listener.handler({ cancelable: false, preventDefault: () => { throw new Error('Not cancelable'); } });
  }
  assert.equal(prevented, 2); assert.equal(stopped, 0);
  assert.equal(listeners.has('touchmove'), false); assert.equal(listeners.has('pointermove'), false);
  cleanup(); assert.equal(listeners.size, 0); assert.equal(classes.size, 0);
});

test('desktop pages retain their browser gesture defaults', () => {
  const { win, listeners, classes } = windowFixture(false);
  installMobileViewportGuard(win)();
  assert.equal(listeners.size, 0); assert.equal(classes.size, 0);
});
