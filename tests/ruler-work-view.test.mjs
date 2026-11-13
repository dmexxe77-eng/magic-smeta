import assert from 'node:assert/strict';
import test from 'node:test';
import { RULER_WORK_SCALE, rulerWorkView, fitRulerView } from '../src/design-bridge/drawEditor/ruler-work-view.js';

const screen = (view, point) => ({ x: point.x * view.k + view.dx, y: point.y * view.k + view.dy });

test('ruler work view: a successful wall restores a useful centimetre scale around its visible endpoint', () => {
  const bounds = { width: 390, height: 844 }, point = { x: 100, y: 200 };
  const before = { k: 1, dx: 95, dy: 180 }, original = { ...before };
  const after = rulerWorkView(before, point, bounds);
  assert.equal(RULER_WORK_SCALE, 2.5);
  assert.equal(after.k, 2.5, 'one centimetre occupies two screen pixels at the working scale');
  assert.deepEqual(screen(after, point), screen(before, point), 'a visible endpoint stays anchored through idle zoom');
  assert.deepEqual(before, original, 'the camera input is not mutated');
});

test('ruler work view: higher user zoom is preserved while an offscreen endpoint returns inside the phone canvas', () => {
  const bounds = { width: 390, height: 500 }, point = { x: 1000, y: -500 }, before = { k: 6, dx: 10, dy: 20 };
  const after = rulerWorkView(before, point, bounds), visible = screen(after, point);
  assert.equal(after.k, 6);
  assert.ok(visible.x >= 36 && visible.x <= bounds.width - 36);
  assert.ok(visible.y >= 36 && visible.y <= bounds.height - 36);
});

test('ruler work view: first points, undo and fine adjustments can ensure visibility without replacing manual scale', () => {
  const bounds = { width: 390, height: 844 }, point = { x: 500, y: 100 };
  for (const k of [.25, 1, 4]) {
    const before = { k, dx: 2000, dy: 2000 };
    const after = rulerWorkView(before, point, bounds, { precision: false }), visible = screen(after, point);
    assert.equal(after.k, k);
    assert.ok(visible.x >= 0 && visible.x <= bounds.width);
    assert.ok(visible.y >= 0 && visible.y <= bounds.height);
  }
});

test('ruler work view: fitting a very long draft can go below the normal zoom limit and reveals every point', () => {
  const bounds = { width: 390, height: 500 }, points = [{ x: -5000, y: -100 }, { x: 5000, y: 100 }, { x: 4000, y: 1000 }];
  const original = structuredClone(points), fitted = fitRulerView(points, bounds);
  assert.ok(fitted.k > 0 && fitted.k < .5);
  for (const point of points) {
    const visible = screen(fitted, point);
    assert.ok(visible.x >= 20 && visible.x <= bounds.width - 20);
    assert.ok(visible.y >= 20 && visible.y <= bounds.height - 20);
  }
  assert.deepEqual(points, original);
  const resumed = rulerWorkView(fitted, points.at(-1), bounds);
  assert.equal(resumed.k, RULER_WORK_SCALE, 'the next successful side can restore precision after a fit');
});

test('ruler work view: empty fits are harmless and repeated visibility checks do not drift an already visible camera', () => {
  const bounds = { width: 390, height: 844 }, point = { x: 0, y: 0 }, view = { k: 3, dx: 195, dy: 380 };
  assert.equal(fitRulerView([], bounds), null);
  const once = rulerWorkView(view, point, bounds);
  assert.deepEqual(rulerWorkView(once, point, bounds), once);
  const singleton = fitRulerView([point], bounds), visible = screen(singleton, point);
  assert.ok(Number.isFinite(singleton.k) && singleton.k > 0);
  assert.ok(visible.x >= 0 && visible.x <= bounds.width && visible.y >= 0 && visible.y <= bounds.height);
});
