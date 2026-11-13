import assert from 'node:assert/strict';
import test from 'node:test';
import { visualViewportBounds, revealFocusedControl, revealElementInPane } from '../src/design-bridge/viewport-geometry.js';

function viewport(values = {}) {
  return { innerWidth: 390, innerHeight: 844, document: { documentElement: { clientWidth: 390, clientHeight: 844 } },
    visualViewport: { width: 390, height: 844, offsetLeft: 0, offsetTop: 0, ...values } };
}

test('a panned keyboard viewport uses layout coordinates independently of page scroll', () => {
  const win = viewport({ width: 370, height: 350, offsetLeft: 10, offsetTop: 240 });
  win.scrollY = 175;
  assert.deepEqual(visualViewportBounds(win), { left: 10, top: 240, width: 370, height: 350 });
  win.innerHeight = 350;
  assert.equal(visualViewportBounds(win).top, 240, 'the unchanged document layout remains the reference when innerHeight shrinks');
});

test('keyboard dismissal and invalid viewport values cannot leave a stale gap or invalid dimensions', () => {
  const win = viewport({ offsetTop: 240, offsetLeft: 50 });
  assert.deepEqual(visualViewportBounds(win), { left: 0, top: 0, width: 390, height: 844 });
  Object.assign(win.visualViewport, { width: NaN, height: -1, offsetTop: Infinity, offsetLeft: -20 });
  assert.deepEqual(visualViewportBounds(win), { left: 0, top: 0, width: 390, height: 844 });
  delete win.visualViewport;
  assert.deepEqual(visualViewportBounds(win), { left: 0, top: 0, width: 390, height: 844 });
});

function form({ fieldTop = 390, fieldHeight = 42, paneTop = 260, paneHeight = 180, paneScroll = 100 } = {}) {
  const win = viewport({ height: 350, offsetTop: 240 });
  const body = { scrollTop: 125 }, outer = { parentElement: body, overflowY: 'auto', scrollTop: 75, scrollHeight: 1400, clientHeight: 350 };
  const pane = { parentElement: outer, overflowY: 'auto', scrollHeight: 900, clientHeight: paneHeight, clientTop: 0, scrollTop: paneScroll,
    getBoundingClientRect: () => ({ top: paneTop, bottom: paneTop + paneHeight }) };
  const field = { parentElement: pane, matches: () => true, getBoundingClientRect: () => ({ top: fieldTop, bottom: fieldTop + fieldHeight, height: fieldHeight }) };
  Object.assign(win.document, { body, activeElement: field });
  win.getComputedStyle = node => ({ overflowY: node.overflowY });
  win.scrollTo = () => { throw new Error('Do not scroll the document'); };
  return { win, body, outer, pane, field };
}

test('a field obscured by the keyboard scrolls only its nearest form pane', () => {
  const env = form({ fieldTop: 430 });
  revealFocusedControl(env.win);
  assert.equal(env.pane.scrollTop, 140);
  assert.equal(env.outer.scrollTop, 75);
  assert.equal(env.body.scrollTop, 125);
});

test('visible controls do not move and fields above the pane can be reached without scrolling the page', () => {
  const env = form({ fieldTop: 300 });
  revealFocusedControl(env.win);
  assert.equal(env.pane.scrollTop, 100);
  env.field.getBoundingClientRect = () => ({ top: 240, bottom: 282, height: 42 });
  revealFocusedControl(env.win);
  assert.equal(env.pane.scrollTop, 72);
  assert.equal(env.body.scrollTop, 125);
});

test('a textarea larger than the remaining form space aligns its start and scroll limits stay bounded', () => {
  const env = form({ fieldTop: 350, fieldHeight: 300 });
  revealFocusedControl(env.win);
  assert.equal(env.pane.scrollTop, 182);
  env.pane.scrollTop = 715;
  revealFocusedControl(env.win);
  assert.equal(env.pane.scrollTop, 720);
});

test('noneditable focus and missing scroll panes do not trigger page movement', () => {
  const env = form();
  env.field.matches = () => false;
  revealFocusedControl(env.win);
  assert.equal(env.pane.scrollTop, 100);
  env.field.matches = () => true;
  env.field.parentElement = env.body;
  revealFocusedControl(env.win);
  assert.equal(env.body.scrollTop, 125);
});

test('explicit drawing or validation targets reveal inside their form pane without requiring active focus', () => {
  const env = form({ fieldTop: 430 });
  env.win.document.activeElement = null;
  revealElementInPane(env.win, env.field);
  assert.equal(env.pane.scrollTop, 140);
  assert.equal(env.body.scrollTop, 125);
});
