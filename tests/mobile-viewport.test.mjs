import test from 'node:test';
import assert from 'node:assert/strict';
import { mobileInputTemplate, mobileViewportHead, mobileViewportMeta, isMobileViewport, installMobileKeyboardViewport, installMobileViewportGuard } from '../src/design-bridge/mobile-viewport.js';

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
  const listeners = new Map(), windowListeners = new Map(), viewportListeners = new Map(), classes = new Set(), styles = new Map(), frames = new Map();
  let nextFrame = 1;
  const events = collection => ({
    addEventListener: (name, handler, options) => collection.set(name, { handler, options }),
    removeEventListener: (name, handler) => { if (collection.get(name)?.handler === handler) collection.delete(name); },
  });
  const win = { innerWidth: 390, innerHeight: 844, scrollY: 0, navigator: { maxTouchPoints: mobile ? 5 : 0 }, matchMedia: () => ({ matches: false }),
    ...events(windowListeners),
    visualViewport: { width: 390, height: 844, offsetLeft: 0, offsetTop: 0, ...events(viewportListeners) },
    requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    document: {
    documentElement: { clientWidth: 390, clientHeight: 844,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      style: { getPropertyValue: name => styles.get(name) || '', setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name) } },
    ...events(listeners),
  } };
  return { win, listeners, windowListeners, viewportListeners, classes, styles, frames,
    emit(name, target = 'document') { (target === 'viewport' ? viewportListeners : target === 'window' ? windowListeners : listeners).get(name)?.handler(); },
    flush() { const pending = [...frames]; frames.clear(); pending.forEach(([, callback]) => callback()); },
  };
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
  assert.ok(listeners.has('gesturestart')); assert.ok(listeners.has('gesturechange'));
  let prevented = 0, stopped = 0;
  for (const name of ['gesturestart', 'gesturechange']) {
    const listener = listeners.get(name);
    assert.equal(listener.options.passive, false);
    listener.handler({ cancelable: true, preventDefault: () => prevented++, stopPropagation: () => stopped++ });
    listener.handler({ cancelable: false, preventDefault: () => { throw new Error('Not cancelable'); } });
  }
  assert.equal(prevented, 2); assert.equal(stopped, 0);
  assert.equal(listeners.has('touchmove'), false); assert.equal(listeners.has('pointermove'), false);
  cleanup(); assert.equal(listeners.size, 0); assert.equal(classes.size, 0);
});

test('the native app follows keyboard height and pan without adding document scroll, then restores full height', () => {
  const env = windowFixture(true), { win, styles } = env;
  const close = installMobileKeyboardViewport(win);
  assert.equal(styles.get('--z-viewport-height'), '844px');
  win.visualViewport.height = 350; win.visualViewport.offsetTop = 240; win.scrollY = 175;
  env.emit('resize', 'viewport'); env.emit('scroll', 'viewport'); env.emit('scroll', 'window');
  assert.equal(env.frames.size, 1, 'related keyboard events share one layout update');
  env.flush(); env.flush();
  assert.equal(styles.get('--z-viewport-top'), '240px');
  assert.equal(styles.get('--z-viewport-height'), '350px');
  assert.equal(styles.get('--z-viewport-width'), '390px');
  assert.equal(win.scrollY, 175, 'the page is not force-scrolled while the user types');
  win.visualViewport.height = 844;
  env.emit('resize', 'viewport'); env.flush(); env.flush();
  assert.equal(styles.get('--z-viewport-top'), '0px', 'a stale iOS pan offset cannot survive keyboard dismissal');
  assert.equal(styles.get('--z-viewport-height'), '844px');
  close();
});

test('keyboard viewport cleanup restores prior style values and cancels queued updates', () => {
  const env = windowFixture(true);
  env.styles.set('--z-viewport-top', '11px');
  const close = installMobileKeyboardViewport(env.win);
  env.emit('focusin');
  const queued = [...env.frames.values()];
  close();
  assert.deepEqual([...env.styles], [['--z-viewport-top', '11px']]);
  assert.equal(env.listeners.size + env.windowListeners.size + env.viewportListeners.size, 0);
  assert.equal(env.frames.size, 0);
  queued.forEach(callback => callback());
  assert.deepEqual([...env.styles], [['--z-viewport-top', '11px']], 'late callbacks cannot affect a closed viewport controller');
});

test('viewport installation is reused on one document and rebinds after the bootstrap replaces the root', () => {
  const env = windowFixture(true), close = installMobileViewportGuard(env.win);
  assert.equal(installMobileViewportGuard(env.win), close);
  const oldHtml = env.win.document.documentElement, nextClasses = new Set(), nextStyles = new Map();
  env.win.document.documentElement = { ...oldHtml,
    classList: { add: name => nextClasses.add(name), remove: name => nextClasses.delete(name), contains: name => nextClasses.has(name) },
    style: { getPropertyValue: name => nextStyles.get(name) || '', setProperty: (name, value) => nextStyles.set(name, value), removeProperty: name => nextStyles.delete(name) },
  };
  const nextClose = installMobileViewportGuard(env.win);
  assert.notEqual(nextClose, close);
  assert.equal(env.classes.size, 0); assert.equal(env.styles.size, 0);
  assert.ok(nextClasses.has('z-mobile-viewport'));
  assert.equal(nextStyles.get('--z-viewport-height'), '844px');
  close();
  assert.ok(nextClasses.has('z-mobile-viewport'), 'a late old-root cleanup cannot detach the current viewport');
  assert.ok(env.listeners.has('gesturestart'));
  nextClose();
  assert.equal(nextClasses.size + nextStyles.size + env.listeners.size, 0);
});

test('desktop pages retain their browser gesture defaults', () => {
  const { win, listeners, classes } = windowFixture(false);
  installMobileViewportGuard(win)();
  assert.equal(listeners.size, 0); assert.equal(classes.size, 0);
});
