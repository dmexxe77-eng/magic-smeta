import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawEditor } from '../src/design-bridge/drawEditor/editor.js';
import { rulerCandidate, adjustRulerCandidate } from '../src/design-bridge/drawEditor/sketch-ruler.js';
import { rulerEdgeVelocity, clipRulerPointer } from '../src/design-bridge/drawEditor/ruler-edge-pan.js';
import { mount } from './drawing-editor-runtime.mjs';

const mobile = { mobileWorkflow: true };
const descendants = element => [element, ...element.children.flatMap(descendants)];
const canvasText = ui => descendants(ui.node('#cv')).filter(element => element.textContent).map(element => element.textContent);
const vertices = ui => descendants(ui.node('#cv'))
  .filter(element => element.attributes.get('data-hit') === 'v')
  .sort((a, b) => Number(a.attributes.get('data-i')) - Number(b.attributes.get('data-i')))
  .map(element => ({ x: Number(element.attributes.get('cx')), y: Number(element.attributes.get('cy')) }));
const emptySurface = { closest: () => null };
const extendTarget = index => ({ dataset: { hit: 'extend', i: String(index) }, closest() { return this; } });
// Geometry fixtures keep their original logical coordinates while the actual
// SVG camera may pan or zoom between committed walls.
const draftOrigins = new WeakMap();
function rememberOrigin(ui, point) { draftOrigins.set(ui, { point, scale: 1 }); }
function draftCamera(ui) {
  const points = vertices(ui), record = draftOrigins.get(ui) || { point: points[0], scale: 1 };
  const firstCm = Number(canvasText(ui).find(label => /^\d+ см$/.test(label))?.split(' ')[0]);
  if (points.length >= 2 && firstCm > 0) record.scale = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) / (firstCm * .8);
  draftOrigins.set(ui, record);
  return { k: record.scale, dx: points[0].x - record.point.x * record.scale, dy: points[0].y - record.point.y * record.scale };
}
function toDraftScreen(ui, point) {
  const camera = draftCamera(ui);
  return { x: point.x * camera.k + camera.dx, y: point.y * camera.k + camera.dy };
}
function visibleDraftTarget(ui, point) {
  const canvas = ui.node('#cv'), inside = p => p.x >= 24 && p.x <= canvas.clientWidth - 24 && p.y >= 24 && p.y <= canvas.clientHeight - 24;
  for (let attempt = 0; attempt < 20; attempt++) {
    const screen = toDraftScreen(ui, point);
    if (inside(screen) && inside(vertices(ui).at(-1))) return screen;
    ui.click('viewZoomOut');
  }
  throw new Error('The logical fixture target could not be brought onto the canvas');
}
function logicalSketch(ui) {
  const camera = draftCamera(ui), stable = number => Math.round(number * 1e9) / 1e9;
  return vertices(ui).map(point => ({ x: stable((point.x - camera.dx) / camera.k), y: stable((point.y - camera.dy) / camera.k) }));
}
function assertPointsClose(actual, expected, message) {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((point, i) => {
    assert.ok(Math.abs(point.x - expected[i].x) < 1e-6 && Math.abs(point.y - expected[i].y) < 1e-6, `${message || 'logical point'} ${i}`);
  });
}

function start(t, ruler = true, options = {}) {
  const ui = mount(t, createDrawEditor, undefined, { ...mobile, ...options });
  ui.click('q-poly');
  if (ruler) ui.click('rulerMode', { v: 'ruler' });
  ui.sketchPoint(100, 100);
  rememberOrigin(ui, { x: 100, y: 100 });
  return ui;
}
function beginDrag(ui, end) {
  const points = vertices(ui), origin = points.at(-1), target = extendTarget(points.length - 1), canvas = ui.node('#cv');
  canvas.dispatch('pointerdown', target, { clientX: origin.x, clientY: origin.y, pointerId: 1 });
  canvas.dispatch('pointermove', target, { clientX: end.x, clientY: end.y, pointerId: 1 });
  return (type = 'pointerup', final = end) => canvas.dispatch(type, target, { clientX: final.x, clientY: final.y, pointerId: 1 });
}
function dragSide(ui, end, { cancel = false } = {}) {
  beginDrag(ui, end)(cancel ? 'pointercancel' : 'pointerup');
}
function addSide(ui, x, y) {
  dragSide(ui, visibleDraftTarget(ui, { x, y }));
  draftCamera(ui);
}
function rectangle(t) {
  const ui = start(t);
  addSide(ui, 420, 100);
  addSide(ui, 420, 340);
  addSide(ui, 100, 340);
  return ui;
}

function smallSkewRoom(t) {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-poly');
  ui.click('rulerMode', { v: 'ruler' });
  ui.sketchPoint(120, 420);
  rememberOrigin(ui, { x: 120, y: 420 });
  for (const [x, y] of [[120, 180], [520, 180], [520, 280], [292.8, 280], [292.8, 344], [520, 344], [520, 420]]) addSide(ui, x, y);
  for (let centimetre = 0; centimetre < 3; centimetre++) ui.click('rulerAdjust', { delta: '1' });
  ui.click('viewFit');
  return ui;
}

function longFirstWall(t, canvasBounds = { width: 390, height: 844 }, centimetres = 500) {
  const ui = start(t, true, { canvasBounds });
  const steps = centimetres > 1000 ? 16 : 2;
  for (let i = 0; i < steps; i++) ui.click('viewZoomOut');
  const scale = 1 / 1.3 ** steps, first = vertices(ui)[0];
  dragSide(ui, { x: first.x + centimetres * .8 * scale, y: first.y });
  assert.ok(canvasText(ui).includes(centimetres + ' см'));
  return ui;
}

function panWithTwoFingers(ui, dx, dy) {
  const canvas = ui.node('#cv'), a = { x: 100, y: 100 }, b = { x: 200, y: 100 };
  for (const [pointerId, point] of [[1, a], [2, b]]) canvas.dispatch('pointerdown', emptySurface, { clientX: point.x, clientY: point.y, pointerId });
  for (const [pointerId, point] of [[1, a], [2, b]]) canvas.dispatch('pointermove', emptySurface, { clientX: point.x + dx, clientY: point.y + dy, pointerId });
  for (const [pointerId, point] of [[1, a], [2, b]]) canvas.dispatch('pointerup', emptySurface, { clientX: point.x + dx, clientY: point.y + dy, pointerId });
}

for (const height of [500, 844]) {
  test(`ruler work camera: a 500 cm wall leaves a 20 cm return easy to draw on a 390×${height} canvas`, t => {
    const ui = longFirstWall(t, { width: 390, height }), before = vertices(ui), last = before.at(-1);
    assert.equal(ui.node('#cv').clientWidth, 390);
    assert.equal(ui.node('#cv').clientHeight, height);
    assert.ok(Math.abs(draftCamera(ui).k - 2.5) < 1e-6);
    assert.ok(last.x >= 36 && last.x <= 354 && last.y >= 36 && last.y <= height - 36);
    const release = beginDrag(ui, { x: last.x, y: last.y + 40 });
    assert.ok(canvasText(ui).includes('20 см'), 'a short return gets forty physical pixels rather than a tiny fitted segment');
    assert.deepEqual(vertices(ui), before, 'drawing the next side does not change the current camera');
    release();
    assert.ok(Math.abs(draftCamera(ui).k - 2.5) < 1e-6);
    assert.deepEqual(logicalSketch(ui), [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 116 }]);
    ui.click('close');
    ui.click('done');
    assert.deepEqual(ui.save().draw.m.sides, [500, 20, null]);
  });
}

test('ruler work camera: manual zoom-out is frozen during a drag and precision returns only after a valid release', t => {
  const ui = longFirstWall(t);
  for (let i = 0; i < 3; i++) ui.click('viewZoomOut');
  const before = vertices(ui), scale = draftCamera(ui).k, last = before.at(-1);
  assert.ok(scale < 2.5);
  const release = beginDrag(ui, { x: last.x, y: last.y + 25 * .8 * scale });
  assert.ok(canvasText(ui).includes('25 см'));
  assert.deepEqual(vertices(ui), before);
  release();
  assert.ok(Math.abs(draftCamera(ui).k - 2.5) < 1e-6);
  assert.deepEqual(logicalSketch(ui).at(-1), { x: 500, y: 120 });
});

test('ruler work camera: a user-selected higher detail scale survives the next successful side', t => {
  const ui = longFirstWall(t);
  for (let i = 0; i < 3; i++) ui.click('viewZoomIn');
  const scale = draftCamera(ui).k, last = vertices(ui).at(-1);
  assert.ok(scale > 2.5);
  dragSide(ui, { x: last.x, y: last.y + 25 * .8 * scale });
  assert.ok(Math.abs(draftCamera(ui).k - scale) < 1e-6);
  assert.deepEqual(logicalSketch(ui).at(-1), { x: 500, y: 120 });
});

test('ruler work camera: rejected or cancelled sides do not replace a chosen low zoom', t => {
  const ui = longFirstWall(t);
  ui.click('viewZoomOut');
  ui.click('viewZoomOut');
  const before = vertices(ui), scale = draftCamera(ui).k, last = before.at(-1);
  dragSide(ui, { x: last.x - 40, y: last.y });
  assert.deepEqual(vertices(ui), before, 'a rejected reversal leaves the camera and draft unchanged');
  dragSide(ui, { x: last.x, y: last.y + 40 }, { cancel: true });
  assert.deepEqual(vertices(ui), before, 'cancelling a valid preview leaves the camera unchanged');
  const release = beginDrag(ui, { x: last.x, y: last.y + 40 });
  release('pointerup', last);
  assert.deepEqual(vertices(ui), before, 'releasing back on the origin is not a successful wall');
  assert.equal(draftCamera(ui).k, scale);
});

test('ruler work camera: a true overview fits an enormous draft and a later wall restores working detail', t => {
  const ui = longFirstWall(t, { width: 390, height: 500 }, 10000), original = logicalSketch(ui);
  ui.click('viewFit');
  const scale = draftCamera(ui).k, fitted = vertices(ui), last = fitted.at(-1);
  assert.ok(scale < .5, 'overview is allowed beyond the ordinary zoom-out limit');
  for (const point of fitted) assert.ok(point.x >= 20 && point.x <= 370 && point.y >= 20 && point.y <= 480);
  assert.deepEqual(logicalSketch(ui), original, 'Fit changes only the view');
  dragSide(ui, { x: last.x, y: last.y + 1000 * .8 * scale });
  assert.ok(Math.abs(draftCamera(ui).k - 2.5) < 1e-6);
  assert.deepEqual(logicalSketch(ui), [...original, { x: 8100, y: 900 }]);
});

test('ruler work camera: changing a small-scale overview to rough sketch still allows further zoom-out', t => {
  const ui = longFirstWall(t, { width: 390, height: 500 }, 10000);
  ui.click('viewFit');
  assert.ok(draftCamera(ui).k < .5);
  const [a, b] = vertices(ui), fittedLength = Math.hypot(b.x - a.x, b.y - a.y);
  ui.click('rulerMode', { v: 'rough' });
  ui.click('viewZoomOut');
  const [afterA, afterB] = vertices(ui), newLength = Math.hypot(afterB.x - afterA.x, afterB.y - afterA.y);
  assert.ok(Math.abs(newLength - fittedLength / 1.3) < 1e-6, 'Zoom Out continues outward after switching entry tools');
  assert.equal(vertices(ui).length, 2);
});

test('rough work camera: Fit followed by Zoom Out never jumps back to a larger default scale', t => {
  const ui = start(t, false, { canvasBounds: { width: 390, height: 500 } });
  for (let i = 0; i < 20; i++) ui.click('viewZoomOut');
  const first = vertices(ui)[0];
  ui.sketchPoint(first.x + 100, first.y);
  ui.click('viewFit');
  const [a, b] = vertices(ui), fittedLength = Math.hypot(b.x - a.x, b.y - a.y);
  ui.click('viewZoomOut');
  const [afterA, afterB] = vertices(ui), newLength = Math.hypot(afterB.x - afterA.x, afterB.y - afterA.y);
  assert.ok(Math.abs(newLength - fittedLength / 1.3) < 1e-6);
  assert.equal(vertices(ui).length, 2);
  assert.deepEqual(canvasText(ui), ['A', 'B'], 'rough mode still invents no measured dimensions');
});

test('ruler work camera: undo and centimetre refinement bring the current endpoint back without changing scale or earlier points', t => {
  const ui = longFirstWall(t), second = vertices(ui).at(-1);
  dragSide(ui, { x: second.x, y: second.y + 40 });
  const original = logicalSketch(ui), scale = draftCamera(ui).k;
  panWithTwoFingers(ui, -1200, -1000);
  assert.ok(vertices(ui).at(-1).x < 0);
  ui.click('rulerAdjust', { delta: '1' });
  const adjusted = vertices(ui).at(-1);
  assert.ok(adjusted.x >= 0 && adjusted.x <= 390 && adjusted.y >= 0 && adjusted.y <= 844);
  assert.equal(draftCamera(ui).k, scale);
  assert.deepEqual(logicalSketch(ui).slice(0, 2), original.slice(0, 2));
  assert.deepEqual(logicalSketch(ui).at(-1), { x: 500, y: 116.8 });
  panWithTwoFingers(ui, -1200, -1000);
  ui.history('undo');
  const endpoint = vertices(ui).at(-1);
  assert.ok(endpoint.x >= 0 && endpoint.x <= 390 && endpoint.y >= 0 && endpoint.y <= 844);
  assert.equal(draftCamera(ui).k, scale);
  assert.deepEqual(logicalSketch(ui), original.slice(0, 2));
});

test('ruler work camera: resize while a finger is down defers camera correction until the side is committed', t => {
  const ui = start(t);
  addSide(ui, 420, 100);
  const before = vertices(ui), last = before.at(-1), scale = draftCamera(ui).k;
  const release = beginDrag(ui, { x: last.x, y: last.y + 80 });
  assert.ok(canvasText(ui).includes('40 см'));
  ui.resize(390, 500);
  assert.deepEqual(vertices(ui), before, 'resize cannot zoom or pan an active ruler pointer');
  assert.ok(canvasText(ui).includes('40 см'));
  release();
  assert.equal(vertices(ui).length, 3, ui.node('#toast').textContent);
  const endpoint = vertices(ui).at(-1);
  assert.ok(endpoint.x >= 0 && endpoint.x <= 390 && endpoint.y >= 0 && endpoint.y <= 500);
  assert.equal(draftCamera(ui).k, scale);
  assert.deepEqual(logicalSketch(ui).at(-1), { x: 420, y: 132 });
});

test('ruler readout: one stable live row exists before a length, during a preview and after release', t => {
  const ui = start(t);
  const readout = () => {
    const html = ui.node('#sheet').innerHTML;
    assert.equal((html.match(/class="ruler-readout"/g) || []).length, 1);
    assert.match(html, /role="status"/);
    return html;
  };
  const empty = readout();
  assert.match(empty, /id="rulerLength">—</);
  assert.doesNotMatch(canvasText(ui).join(' '), /\d+ см/);
  const release = beginDrag(ui, { x: 232.8, y: 100 });
  assert.match(readout(), /id="rulerLength">166</);
  release();
  assert.match(readout(), /id="rulerLength">166</);
  ui.click('rulerAdjust', { delta: '1' });
  assert.match(readout(), /id="rulerLength">167</);
  assert.ok(canvasText(ui).includes('167 см'));
});

test('ruler: invalid pointer distances cannot create a side and fine adjustments keep a positive length', () => {
  const origin = { x: 0, y: 0 };
  assert.equal(rulerCandidate(origin, origin), null);
  assert.equal(rulerCandidate(origin, { x: NaN, y: 0 }, 'free'), null);
  const candidate = rulerCandidate(origin, { x: 80, y: 0 });
  assert.equal(candidate.cm, 100);
  const smallest = adjustRulerCandidate(candidate, origin, -200);
  assert.equal(smallest.cm, 1);
  assert.ok(Math.abs(smallest.point.x - .8) < 1e-9);
  assert.equal(adjustRulerCandidate(null, origin, 1), null);
  assert.equal(adjustRulerCandidate(candidate, origin, NaN), candidate);
  assert.equal(candidate.cm, 100, 'refinement does not mutate the original preview');
});

for (const zoomed of [false, true]) {
  test(`ruler: 80 logical units per metre stays correct ${zoomed ? 'after zooming' : 'at the initial zoom'}`, t => {
    const ui = start(t);
    if (zoomed) ui.click('viewZoomIn');
    const origin = vertices(ui)[0], screenLength = 320 * (zoomed ? 1.3 : 1);
    const release = beginDrag(ui, { x: origin.x + screenLength, y: origin.y });
    assert.ok(canvasText(ui).includes('400 см'), 'the preview reports four metres regardless of zoom');
    assert.equal(vertices(ui).length, 1, 'previewing a length does not create a corner');
    assert.equal(ui.activeInput(), null, 'finger measurement keeps the keyboard closed');
    assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="rulerConfirm"/, 'no extra confirmation action is required');
    release();
    const [a, b] = logicalSketch(ui);
    assert.equal(vertices(ui).length, 2);
    assert.ok(Math.abs(b.x - a.x - 320) < 1e-6, 'idle camera changes preserve the four-metre logical wall');
    release();
    assert.equal(vertices(ui).length, 2, 'one release cannot add the same corner twice');
  });
}

test('ruler: one-centimetre snapping accepts lengths that are not multiples of five', t => {
  const ui = start(t);
  dragSide(ui, { x: 232.8, y: 103 });
  assert.ok(canvasText(ui).includes('166 см'));
  const [a, b] = logicalSketch(ui);
  assert.ok(Math.abs(b.x - a.x - 132.8) < 1e-6);
  assert.equal(b.y, a.y);
  assert.equal(ui.activeInput(), null);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="rulerConfirm"/);
});

test('ruler: releasing the finger uses its final coordinate rather than the last move event', t => {
  const ui = start(t);
  const release = beginDrag(ui, { x: 232.8, y: 100 });
  assert.ok(canvasText(ui).includes('166 см'));
  release('pointerup', { x: 233.6, y: 100 });
  assert.equal(vertices(ui).length, 2);
  assert.ok(canvasText(ui).includes('167 см'));
  const points = logicalSketch(ui);
  assert.ok(Math.abs(points[1].x - points[0].x - 133.6) < 1e-6);
});

test('ruler: one-centimetre refinement updates only the last committed endpoint and length', t => {
  const ui = start(t);
  addSide(ui, 420, 100);
  const earlier = logicalSketch(ui);
  const release = beginDrag(ui, visibleDraftTarget(ui, { x: 420, y: 232.8 }));
  ui.click('rulerAdjust', { delta: '1' });
  assert.deepEqual(logicalSketch(ui), earlier, 'fine adjustment is inactive during the drag preview');
  assert.ok(canvasText(ui).includes('166 см'));
  release();
  ui.click('rulerAdjust', { delta: '1' });
  assert.equal(vertices(ui).length, 3);
  assert.deepEqual(logicalSketch(ui).slice(0, 2), earlier);
  assert.ok(canvasText(ui).includes('167 см'));
  assert.ok(Math.abs(logicalSketch(ui)[2].y - logicalSketch(ui)[1].y - 133.6) < 1e-6);
  ui.click('rulerAdjust', { delta: '-1' });
  assert.equal(vertices(ui).length, 3);
  assert.deepEqual(logicalSketch(ui).slice(0, 2), earlier);
  assert.ok(canvasText(ui).includes('166 см'));
  assert.equal(ui.activeInput(), null);
  addSide(ui, 100, 232.8);
  ui.click('close');
  ui.click('done');
  assert.deepEqual(ui.save().draw.m.sides, [400, 166, 400, null]);
});

test('ruler: tapping an empty endpoint commits it while tapping its extension handle does not duplicate it', t => {
  const ui = start(t);
  ui.sketchPoint(232.8, 100);
  assert.equal(vertices(ui).length, 2);
  assert.ok(canvasText(ui).includes('166 см'));
  const b = vertices(ui)[1], target = extendTarget(1), canvas = ui.node('#cv');
  canvas.dispatch('pointerdown', target, { clientX: b.x, clientY: b.y, pointerId: 1 });
  canvas.dispatch('pointerup', target, { clientX: b.x, clientY: b.y, pointerId: 1 });
  assert.equal(vertices(ui).length, 2);
});

test('ruler: free-angle mode preserves the direction of a measured oblique side', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-polyfree');
  ui.click('rulerMode', { v: 'ruler' });
  ui.sketchPoint(100, 100);
  rememberOrigin(ui, { x: 100, y: 100 });
  dragSide(ui, { x: 356, y: 292 });
  assert.ok(canvasText(ui).includes('400 см'));
  assert.deepEqual(logicalSketch(ui), [{ x: 100, y: 100 }, { x: 356, y: 292 }]);
  assert.equal(ui.activeInput(), null);
});

test('ruler: confirmed lengths seed editable fields and closing leaves the final side unmeasured', t => {
  const ui = rectangle(t);
  const sketch = logicalSketch(ui);
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 2);
  for (const [i, value] of ['400', '300', '400', ''].entries()) {
    ui.focus(i, 'side');
    assert.equal(ui.activeInput().value, value);
  }
  ui.click('done');
  const result = ui.save();
  assert.equal(result.area, 12);
  assert.deepEqual(result.draw.m.sides, [400, 300, 400, null]);
  assertPointsClose(result.draw.m.prior, sketch, 'closing preserves every committed logical sketch point');
  assert.equal(result.verts.length, 4);
  ui.click('back2');
  ui.fill(0, '420', 'side');
  ui.enter(0, 'side');
  ui.click('done');
  assert.equal(ui.save().draw.m.sides[0], 420, 'a ruler measurement can still be edited as a normal side length');
});

test('ruler: an unaligned closing side never moves confirmed corners to manufacture a right angle', t => {
  const ui = start(t);
  addSide(ui, 420, 100);
  addSide(ui, 420, 340);
  addSide(ui, 180, 340);
  const before = logicalSketch(ui);
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  const result = ui.save();
  assertPointsClose(result.draw.m.prior, before);
  assert.deepEqual(result.draw.m.sides, [400, 300, 300, null]);
  assert.equal(result.draw.m.vert[0].kind, 'free');
  assert.equal(result.draw.m.vert[3].kind, 'free');
  assert.ok(result.draw.m.vert.slice(1, 3).every(vertex => vertex.kind === 'ortho'));
  assert.deepEqual(result.draw.origin.closure, { kind: 'skew', n: 4 });
});

test('ruler: a small closing discrepancy keeps all seven measured walls and their original coordinates', t => {
  const ui = smallSkewRoom(t), sketch = logicalSketch(ui);
  assert.equal(sketch.length, 8);
  assert.ok(Math.abs(sketch[7].y - sketch[0].y - 2.4) < 1e-6, 'three centimetres of discrepancy remain after fine adjustment');
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 2, 'a slightly sloped closing wall is allowed without straightening measured walls');
  for (const [i, value] of ['300', '500', '125', '284', '80', '284', '98', ''].entries()) {
    ui.focus(i, 'side');
    assert.equal(ui.activeInput().value, value);
  }
  ui.click('done');
  assert.equal(ui.node('#app').dataset.stage, 3);
  const result = ui.save();
  assert.deepEqual(result.draw.m.sides, [300, 500, 125, 284, 80, 284, 98, null]);
  assertPointsClose(result.draw.m.prior, sketch);
  assert.equal(result.draw.m.vert[0].kind, 'free');
  assert.equal(result.draw.m.vert[7].kind, 'free');
  assert.ok(result.draw.m.vert.slice(1, 7).every(vertex => vertex.kind === 'ortho'));
  assert.deepEqual(result.draw.origin.closure, { kind: 'skew', n: 8 });
  const expectedVertices = [[0, 3], [0, 0], [5, 0], [5, 1.25], [2.16, 1.25], [2.16, 2.05], [5, 2.05], [5, 3.03]];
  assert.equal(result.verts.length, expectedVertices.length);
  result.verts.forEach((point, i) => {
    assert.equal(point.length, expectedVertices[i].length);
    point.forEach((value, axis) => {
      assert.ok(Math.abs(value - expectedVertices[i][axis]) < 1e-12, `saved coordinate ${i}:${axis} retains the measured wall`);
    });
  });
});

test('ruler: closing discrepancy stays visible, updates after measurement changes and survives reopening', async t => {
  const ui = smallSkewRoom(t);
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 2);
  assert.match(ui.node('#st2t').innerHTML, /Погрешность замыкания: 3 см/);
  ui.fill(6, '99', 'side');
  ui.enter(6, 'side');
  assert.match(ui.node('#st2t').innerHTML, /Погрешность замыкания: 4 см/);
  ui.click('done');
  assert.match(ui.node('#canvasMeta').innerHTML, /Погрешность замыкания: 4 см/);
  const saved = ui.save();
  assert.equal(saved.draw.m.sides[6], 99);
  ui.destroy();
  await t.test('the saved sloped closure remains editable after reopening', child => {
    const reopened = mount(child, createDrawEditor, saved, mobile);
    assert.match(reopened.node('#canvasMeta').innerHTML, /Погрешность замыкания: 4 см/);
    assert.deepEqual(reopened.save(), saved);
    reopened.click('back2');
    assert.match(reopened.node('#st2t').innerHTML, /Погрешность замыкания: 4 см/);
    reopened.fill(6, '95', 'side');
    reopened.enter(6, 'side');
    assert.doesNotMatch(reopened.node('#st2t').innerHTML, /Погрешность замыкания/);
    reopened.click('done');
    assert.doesNotMatch(reopened.node('#canvasMeta').innerHTML, /Погрешность замыкания/);
    const corrected = reopened.save();
    assert.equal(corrected.draw.m.sides[6], 95);
    assert.ok(Math.abs(corrected.verts[7][1] - corrected.verts[0][1]) < 1e-12, 'corrected closure remains aligned without rounding saved coordinates');
  });
});

test('ruler: reclosing an unchanged sloped sketch keeps measurements, edits and the previous undo history', t => {
  const ui = smallSkewRoom(t);
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.chooseTool('pickDiag');
  ui.selectVertex(1);
  ui.selectVertex(4);
  ui.fill(0, String(Math.hypot(216, 125)), 'diag');
  ui.enter(0, 'diag');
  ui.click('tab2', { v: 'walls' });
  ui.fill(6, '99', 'side');
  ui.enter(6, 'side');
  ui.click('done');
  ui.selectSide(1);
  ui.click('op', { k: 'shift' });
  ui.fill('d', '20', 'op');
  ui.click('apply');
  const before = ui.save();
  assert.equal(before.draw.m.diags.length, 1);
  assert.equal(before.draw.ops.length, 1);
  assert.equal(before.draw.m.sides[6], 99);
  ui.click('back1');
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  assert.deepEqual(ui.save(), before, 'reclosing does not overwrite edited sizes with the original ruler draft');
  ui.click('back2');
  ui.history('undo');
  assert.equal(ui.save().draw.m.sides[6], 98, 'reclosing adds no history entry before the previous measurement edit');
  ui.history('undo');
  assert.deepEqual(ui.save().draw.m.diags, [{ i: 1, j: 4, cm: null }], 'diagonal entry history is preserved too');
});

test('ruler: a near-aligned closing wall still cannot intersect an earlier measured wall', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-poly');
  ui.click('rulerMode', { v: 'ruler' });
  ui.sketchPoint(100, 300);
  rememberOrigin(ui, { x: 100, y: 300 });
  for (const [x, y] of [[100, 100], [300, 100], [300, 400], [500, 400], [500, 300]]) addSide(ui, x, y);
  ui.click('rulerAdjust', { delta: '1' });
  const sketch = vertices(ui);
  ui.click('close');
  assert.equal(ui.node('#app').dataset.stage, 1);
  assert.deepEqual(vertices(ui), sketch, 'rejecting an unsafe closing edge does not alter measured points');
  assert.equal(ui.save(), undefined);
});

for (const method of ['tap A', 'drag to A']) {
  test(`ruler: ${method} closes a slightly skewed room without duplicating A or changing measured walls`, t => {
    const ui = smallSkewRoom(t), sketch = logicalSketch(ui), first = vertices(ui)[0];
    if (method === 'tap A') ui.selectVertex(0);
    else dragSide(ui, { x: first.x + 4, y: first.y + 4 });
    assert.equal(ui.node('#app').dataset.stage, 2);
    ui.click('done');
    const result = ui.save();
    assert.equal(result.verts.length, 8);
    assertPointsClose(result.draw.m.prior, sketch);
    assert.deepEqual(result.draw.m.sides.slice(0, 7), [300, 500, 125, 284, 80, 284, 98]);
    assert.equal(result.draw.m.sides[7], method === 'drag to A' ? 500 : null, 'an explicit ruler drag confirms the closing measurement');
    assert.deepEqual(result.draw.origin.closure, { kind: 'skew', n: 8 });
    assert.match(ui.node('#canvasMeta').innerHTML, /Погрешность замыкания: 3 см/);
  });
}

test('ruler: a finger inside the first-point radius closes a valid triangle while retaining its right interior corner', t => {
  const ui = anchorSketch(t), sketch = logicalSketch(ui), first = vertices(ui)[0];
  dragSide(ui, { x: first.x + 4, y: first.y + 4 });
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  const result = ui.save();
  assert.equal(result.verts.length, 3);
  assertPointsClose(result.draw.m.prior, sketch);
  assert.deepEqual(result.draw.m.sides, [400, 300, 500]);
  assert.equal(result.draw.m.vert[0].kind, 'free');
  assert.deepEqual(result.draw.m.vert[1], { kind: 'ortho', deg: 90 });
  assert.equal(result.draw.m.vert[2].kind, 'free');
  assert.deepEqual(result.draw.origin.closure, { kind: 'skew', n: 3 });
});

test('ruler: undo removes a corner and its incoming measurement while preserving earlier lengths', t => {
  const ui = start(t);
  addSide(ui, 420, 100);
  addSide(ui, 420, 340);
  ui.history('undo');
  assert.deepEqual(logicalSketch(ui), [{ x: 100, y: 100 }, { x: 420, y: 100 }]);
  ui.click('rulerMode', { v: 'rough' });
  for (const point of [{ x: 420, y: 260 }, { x: 100, y: 260 }]) {
    const screen = toDraftScreen(ui, point);
    ui.sketchPoint(screen.x, screen.y);
  }
  ui.click('close');
  ui.focus(0, 'side');
  assert.equal(ui.activeInput().value, '400');
  ui.focus(1, 'side');
  assert.equal(ui.activeInput().value, '', 'the removed incoming length cannot leak into the replacement wall');
});

test('ruler: cancelling a finger gesture discards its preview without committing a corner', t => {
  const ui = start(t), original = vertices(ui);
  dragSide(ui, { x: 420, y: 100 }, { cancel: true });
  assert.deepEqual(vertices(ui), original);
  assert.ok(!canvasText(ui).includes('400 см'));
});

test('ruler: two-finger gestures discard an active candidate and never create a measured corner', t => {
  const ui = start(t), canvas = ui.node('#cv'), target = extendTarget(0);
  canvas.dispatch('pointerdown', target, { clientX: 100, clientY: 100, pointerId: 1 });
  canvas.dispatch('pointermove', target, { clientX: 420, clientY: 100, pointerId: 1 });
  assert.ok(canvasText(ui).includes('400 см'));
  canvas.dispatch('pointerdown', emptySurface, { clientX: 500, clientY: 200, pointerId: 2 });
  canvas.dispatch('pointerup', emptySurface, { clientX: 500, clientY: 200, pointerId: 2 });
  canvas.dispatch('pointerup', target, { clientX: 420, clientY: 100, pointerId: 1 });
  assert.equal(vertices(ui).length, 1);
  assert.ok(!canvasText(ui).includes('400 см'));
});

test('ruler: rough sketching remains the default and never invents measured lengths', t => {
  const ui = start(t, false);
  ui.sketchPoint(420, 100);
  ui.sketchPoint(420, 340);
  ui.sketchPoint(100, 340);
  assert.deepEqual(canvasText(ui), ['A', 'B', 'C', 'D']);
  ui.click('close');
  for (let i = 0; i < 4; i++) {
    ui.focus(i, 'side');
    assert.equal(ui.activeInput().value, '');
  }
});

test('ruler: changing only the entry tool preserves completed measurements, diagonals and their undo history', t => {
  const ui = start(t, false);
  ui.sketchPoint(420, 100);
  ui.sketchPoint(420, 340);
  ui.sketchPoint(100, 340);
  ui.click('close');
  for (const [i, value] of ['400', '300', '400', '300'].entries()) ui.fill(i, value, 'side');
  ui.enter(3, 'side');
  ui.chooseTool('pickDiag');
  ui.selectVertex(0);
  ui.selectVertex(2);
  ui.fill(0, '500', 'diag');
  ui.enter(0, 'diag');
  ui.click('done');
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.fill('d', '20', 'op');
  ui.click('apply');
  const before = ui.save();
  assert.equal(before.draw.ops.length, 1);
  ui.click('back1');
  ui.click('rulerMode', { v: 'ruler' });
  ui.click('close');
  assert.deepEqual(ui.save(), before, 'a different entry tool preserves the saved measurement model, operations and exported geometry');
  assert.equal(ui.node('#doneBtn').disabled, false);
  ui.history('undo');
  const afterUndo = ui.save().draw.m;
  assert.deepEqual(afterUndo.sides, before.draw.m.sides);
  assert.deepEqual(afterUndo.diags, [{ i: 0, j: 2, cm: null }], 'the original diagonal-entry undo step is still available');
});

test('ruler: adjacent reversal is rejected while a forward collinear extension remains valid', t => {
  const ui = start(t);
  addSide(ui, 420, 100);
  const before = logicalSketch(ui);
  dragSide(ui, toDraftScreen(ui, { x: 260, y: 100 }));
  assert.deepEqual(logicalSketch(ui), before, 'a new edge cannot overlap the preceding edge backwards');
  addSide(ui, 500, 100);
  assert.deepEqual(logicalSketch(ui), [...before, { x: 500, y: 100 }]);
  assert.ok(canvasText(ui).includes('100 см'));
});

test('ruler: releasing a preview back at its origin restores the last-side controls', t => {
  const ui = start(t);
  addSide(ui, 420, 100);
  addSide(ui, 420, 340);
  const before = vertices(ui);
  const release = beginDrag(ui, toDraftScreen(ui, { x: 100, y: 340 }));
  assert.ok(canvasText(ui).includes('400 см'));
  release('pointerup', before.at(-1));
  assert.deepEqual(vertices(ui), before);
  const sheet = ui.node('#sheet').innerHTML;
  assert.match(sheet, /data-act="rulerAdjust"/);
  const closeButton = sheet.match(/<button\b[^>]*data-act="close"[^>]*>/)[0];
  assert.doesNotMatch(closeButton, /\sdisabled(?:\s|=|>)/);
});

test('ruler: edge pressure is bounded and respects the selected grid axis', () => {
  const bounds = { width: 800, height: 600 }, horizontal = { x: 1, y: 0 }, vertical = { x: 0, y: 1 };
  assert.deepEqual(rulerEdgeVelocity({ x: 400, y: 300 }, bounds, horizontal), { x: 0, y: 0 });
  assert.deepEqual(rulerEdgeVelocity({ x: 800, y: 0 }, bounds, horizontal), { x: -120, y: 0 });
  assert.deepEqual(rulerEdgeVelocity({ x: 0, y: 600 }, bounds, vertical), { x: 0, y: -120 });
  assert.deepEqual(rulerEdgeVelocity({ x: 0, y: 0 }, bounds, null, 'free'), { x: 120, y: 120 });
  assert.ok(Math.abs(rulerEdgeVelocity({ x: 795, y: 300 }, bounds, horizontal).x) > Math.abs(rulerEdgeVelocity({ x: 770, y: 300 }, bounds, horizontal).x));
  assert.deepEqual(clipRulerPointer({ x: -10, y: 900 }, bounds), { x: 12, y: 588 });
});

test('ruler: holding a stationary finger at the edge extends the length without zoom or axis drift', t => {
  const ui = start(t, true, { manualRAF: true });
  addSide(ui, 420, 100);
  ui.click('viewZoomIn');
  const before = vertices(ui), release = beginDrag(ui, { x: 795, y: before[1].y });
  const previewCm = () => Number(canvasText(ui).filter(label => /^\d+ см$/.test(label)).at(-1).split(' ')[0]);
  const initialCm = previewCm();
  assert.ok(ui.pendingAnimationFrames() > 0);
  ui.flushAnimationFrames(16, 60);
  const during = vertices(ui), grownCm = previewCm();
  assert.ok(grownCm > initialCm, 'length grows while the pointer is held still');
  assert.equal(during.length, 2, 'animation only previews the next point');
  assert.ok(during[0].x < before[0].x && during[1].x < before[1].x, 'the camera moves away from the held right edge');
  assert.equal(during[0].y, before[0].y);
  assert.equal(during[1].y, before[1].y);
  assert.ok(Math.abs((during[1].x - during[0].x) - (before[1].x - before[0].x)) < 1e-6, 'the existing 400 cm wall retains its pixel scale');
  release();
  const after = vertices(ui);
  assert.equal(after.length, 3);
  const scale = Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y) / 320;
  assert.ok(Math.abs(after[2].x - after[1].x - grownCm * .8 * scale) < 1e-6, 'release commits the final grown length at the same zoom');
  assert.equal(after[2].y, after[1].y);
  assert.ok(canvasText(ui).includes(grownCm + ' см'));
  assert.equal(ui.pendingAnimationFrames(), 0);
  assert.equal(ui.flushAnimationFrames(16, 10), 0);
  assert.deepEqual(vertices(ui), after);
});

test('ruler work camera: restoring detail preserves the original rate of long-wall edge extension', t => {
  const ui = start(t, true, { manualRAF: true });
  addSide(ui, 420, 100);
  const before = vertices(ui), scale = draftCamera(ui).k, release = beginDrag(ui, { x: 800, y: before.at(-1).y });
  const centimetres = () => Number(canvasText(ui).filter(label => /^\d+ см$/.test(label)).at(-1).split(' ')[0]);
  const initial = centimetres();
  ui.flushAnimationFrames(16, 64);
  const gained = centimetres() - initial;
  assert.ok(gained >= 149 && gained <= 153, 'about one second at the edge still adds about 150 centimetres');
  assert.equal(draftCamera(ui).k, scale, 'edge extension pans without zooming');
  release('pointercancel');
  assert.equal(vertices(ui).length, 2);
});

for (const stop of ['cancel', 'pinch', 'rulerMode', 'sketchMode', 'destroy']) {
  test(`ruler: edge animation stops completely after ${stop}`, t => {
    const ui = start(t, true, { manualRAF: true });
    const release = beginDrag(ui, { x: 795, y: 100 });
    ui.flushAnimationFrames(16, 5);
    assert.ok(ui.pendingAnimationFrames() > 0);
    if (stop === 'cancel') release('pointercancel');
    else if (stop === 'pinch') {
      const canvas = ui.node('#cv');
      canvas.dispatch('pointerdown', emptySurface, { clientX: 500, clientY: 300, pointerId: 2 });
      canvas.dispatch('pointerup', emptySurface, { clientX: 500, clientY: 300, pointerId: 2 });
      release();
    } else if (stop === 'destroy') ui.destroy();
    else ui.click(stop, { v: 'rough' });
    assert.equal(ui.pendingAnimationFrames(), 0);
    assert.equal(ui.flushAnimationFrames(16, 10), 0);
    if (stop !== 'destroy') assert.equal(vertices(ui).length, 1, 'stopping a gesture does not commit its candidate');
  });
}

test('ruler: a centred finger and ordinary rough sketch gestures never start edge animation', t => {
  const ui = start(t, true, { manualRAF: true });
  const release = beginDrag(ui, { x: 500, y: 300 });
  const before = vertices(ui), labels = canvasText(ui);
  assert.equal(ui.pendingAnimationFrames(), 0);
  assert.equal(ui.flushAnimationFrames(16, 20), 0);
  assert.deepEqual(vertices(ui), before);
  assert.deepEqual(canvasText(ui), labels);
  release('pointercancel');
  ui.click('rulerMode', { v: 'rough' });
  const canvas = ui.node('#cv');
  canvas.dispatch('pointerdown', emptySurface, { clientX: 200, clientY: 200, pointerId: 1 });
  canvas.dispatch('pointermove', emptySurface, { clientX: 795, clientY: 100, pointerId: 1 });
  const manuallyPanned = vertices(ui);
  assert.equal(ui.pendingAnimationFrames(), 0);
  ui.flushAnimationFrames(16, 20);
  assert.deepEqual(vertices(ui), manuallyPanned);
  canvas.dispatch('pointerup', emptySurface, { clientX: 795, clientY: 100, pointerId: 1 });
  assert.deepEqual(canvasText(ui), ['A']);
});

function anchorSketch(t, { free = false, zoomed = false, complete = false } = {}) {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click(free ? 'q-polyfree' : 'q-poly');
  ui.click('rulerMode', { v: 'ruler' });
  ui.sketchPoint(300, 200);
  rememberOrigin(ui, { x: 300, y: 200 });
  addSide(ui, 620, 200);
  addSide(ui, 620, 440);
  if (complete) addSide(ui, 300, 440);
  ui.click('viewFit');
  ui.click('viewZoomOut');
  if (zoomed) ui.click('viewZoomIn');
  return ui;
}

test('ruler: first-point guide tolerance is measured in screen pixels and never bends a fixed grid axis', () => {
  const origin = { x: 400, y: 300 }, anchor = { x: 100, y: 100 }, target = { x: 106.4, y: 105 };
  const inside = rulerCandidate(origin, target, 'grid', { anchor, screenScale: 1, snapPx: 7 });
  assert.deepEqual(inside.point, { x: 100, y: 300 });
  assert.equal(inside.cm, 375);
  assert.equal(inside.snappedX, true);
  assert.equal(inside.closes, false, 'a nearby free coordinate cannot pull the fixed coordinate onto A');
  const outside = rulerCandidate(origin, target, 'grid', { anchor, screenScale: 2, snapPx: 7 });
  assert.ok(Math.abs(outside.point.x - anchor.x) > 6, 'the same logical offset is outside the guide when zoomed in');
  const zoomedInside = rulerCandidate(origin, { x: 103.2, y: 300 }, 'grid', { anchor, screenScale: 2, snapPx: 7 });
  assert.deepEqual(zoomedInside.point, { x: 100, y: 300 });
  const ordinary = rulerCandidate(origin, target, 'grid');
  assert.ok(Math.abs(ordinary.point.x - anchor.x) > 6, 'the optional guide does not change callers without an anchor');
});

test('ruler: free mode snaps fully to A only inside the radial tolerance and otherwise uses one closest guide', () => {
  const origin = { x: 400, y: 300 }, anchor = { x: 100, y: 100 };
  const closes = rulerCandidate(origin, { x: 104, y: 103 }, 'free', { anchor, screenScale: 1, snapPx: 7 });
  assert.deepEqual(closes.point, anchor);
  assert.equal(closes.closes, true);
  const oneAxis = rulerCandidate(origin, { x: 106, y: 106 }, 'free', { anchor, screenScale: 1, snapPx: 7 });
  assert.equal(Number(!!oneAxis.snappedX) + Number(!!oneAxis.snappedY), 1);
  assert.equal(oneAxis.closes, false);
  assert.ok(oneAxis.point.x === anchor.x || oneAxis.point.y === anchor.y);
});

test('ruler: an exact free-mode anchor remains reachable at very high zoom despite centimetre rounding', () => {
  const origin = { x: 100, y: 100 }, anchor = { x: 123.4, y: 157.3 };
  for (const screenScale of [32, 64]) {
    const candidate = rulerCandidate(origin, anchor, 'free', { anchor, screenScale, snapPx: 7 });
    assert.deepEqual(candidate.point, anchor);
    assert.equal(candidate.closes, true);
    assert.equal(candidate.cm, Math.round(Math.hypot(anchor.x - origin.x, anchor.y - origin.y) / 80 * 100));
  }
});

test('ruler: centimetre rounding cannot attract a raw finger position outside the screen-space snap tolerance', () => {
  const origin = { x: 0, y: 0 };
  for (const screenScale of [32, 64]) {
    const axisAnchor = { x: 100.1, y: 100 };
    const grid = rulerCandidate(origin, { x: 100.35, y: 0 }, 'grid', { anchor: axisAnchor, screenScale, snapPx: 7 });
    assert.equal(grid.point.x, 100, 'an outside raw position keeps its ordinary one-centimetre endpoint');
    assert.equal(grid.cm, 125);
    assert.ok(!grid.snappedX && !grid.snappedY && !grid.closes);
    const freeAnchor = { x: 100.1, y: 100.1 };
    const free = rulerCandidate(origin, { x: 100.35, y: 100.35 }, 'free', { anchor: freeAnchor, screenScale, snapPx: 7 });
    assert.notDeepEqual(free.point, freeAnchor);
    assert.ok(!free.snappedX && !free.snappedY && !free.closes, 'rounding alone cannot close a free-mode contour');
  }
});

for (const zoomed of [false, true]) {
  test(`ruler: a point within six screen pixels of A's guide snaps exactly ${zoomed ? 'after zooming' : 'at normal zoom'}`, t => {
    const ui = anchorSketch(t, { zoomed }), before = logicalSketch(ui), screen = vertices(ui), first = screen[0], last = screen.at(-1);
    dragSide(ui, { x: first.x + 6, y: last.y });
    const after = logicalSketch(ui);
    assert.equal(after.length, 4);
    assert.equal(after[3].x, before[0].x);
    assert.equal(after[3].y, before.at(-1).y);
    assert.deepEqual(after.slice(0, 3), before);
    assert.ok(canvasText(ui).includes('400 см'), 'snapping retains the one-centimetre length scale');
  });

  test(`ruler: a point ten screen pixels from A's guide remains unsnapped ${zoomed ? 'after zooming' : 'at normal zoom'}`, t => {
    const ui = anchorSketch(t, { zoomed }), before = logicalSketch(ui), screen = vertices(ui), first = screen[0], last = screen.at(-1), scale = draftCamera(ui).k;
    dragSide(ui, { x: first.x + 10, y: last.y });
    const after = logicalSketch(ui);
    assert.equal(after.length, 4);
    assert.ok(Math.abs(after[3].x - before[0].x) * scale > 7);
    assert.equal(after[3].y, before.at(-1).y);
    const centimetres = Math.abs(after[3].x - after[2].x) / .8;
    assert.ok(Math.abs(centimetres - Math.round(centimetres)) < 1e-6, 'an unsnapped side still uses whole centimetres');
  });
}

test('ruler: a grid drag toward A aligns only its moving coordinate instead of adding a diagonal closing edge', t => {
  const ui = anchorSketch(t), before = logicalSketch(ui), first = vertices(ui)[0];
  dragSide(ui, { x: first.x + 6, y: first.y + 6 });
  const after = logicalSketch(ui);
  assert.equal(ui.node('#app').dataset.stage, 1);
  assert.equal(after.length, 4);
  assert.equal(after[3].x, before[0].x);
  assert.equal(after[3].y, before[2].y);
  assert.notEqual(after[3].y, before[0].y);
});

test('ruler: reaching A closes the room without a duplicate corner and stores the measured closing side', t => {
  const ui = anchorSketch(t, { complete: true }), sketch = logicalSketch(ui), first = vertices(ui)[0];
  dragSide(ui, { x: first.x + 4, y: first.y + 4 });
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  const result = ui.save();
  assert.equal(result.area, 12);
  assert.equal(result.verts.length, 4);
  assert.equal(result.draw.m.n, 4);
  assertPointsClose(result.draw.m.prior, sketch);
  assert.deepEqual(result.draw.m.sides, [400, 300, 400, 300]);
});

test('ruler: free-mode arrival at A closes the contour while leaving angle determination to the measurement stage', t => {
  const ui = anchorSketch(t, { free: true, complete: true }), first = vertices(ui)[0];
  dragSide(ui, { x: first.x + 4, y: first.y + 4 });
  assert.equal(ui.node('#app').dataset.stage, 2);
  assert.equal(ui.node('#doneBtn').disabled, true);
  ui.chooseTool('pickAng');
  ui.selectVertex(0);
  ui.fill(0, '90', 'ang');
  ui.enter(0, 'ang');
  ui.click('done');
  const result = ui.save();
  assert.equal(result.verts.length, 4);
  assert.equal(result.area, 12);
  assert.deepEqual(result.draw.m.sides, [400, 300, 400, 300]);
  assert.ok(result.draw.m.vert.slice(1).every(vertex => vertex.kind === 'free'));
});

for (const stop of ['cancel', 'pinch']) {
  test(`ruler: ${stop} during a snapped closing preview never closes or adds a corner`, t => {
    const ui = anchorSketch(t, { complete: true }), before = vertices(ui), first = before[0];
    const release = beginDrag(ui, { x: first.x + 4, y: first.y + 4 });
    assert.equal(ui.node('#app').dataset.stage, 1);
    assert.deepEqual(vertices(ui), before);
    if (stop === 'cancel') release('pointercancel');
    else {
      const canvas = ui.node('#cv');
      canvas.dispatch('pointerdown', emptySurface, { clientX: 500, clientY: 300, pointerId: 2 });
      canvas.dispatch('pointerup', emptySurface, { clientX: 500, clientY: 300, pointerId: 2 });
      release();
    }
    assert.equal(ui.node('#app').dataset.stage, 1);
    assert.deepEqual(vertices(ui), before);
  });
}

test('embedded drawing retains the ordinary sketch workflow without mobile ruler controls or measured labels', t => {
  const ui = mount(t, createDrawEditor, undefined, { embedded: true });
  ui.click('q-poly');
  ui.click('rulerMode', { v: 'ruler' });
  for (const [x, y] of [[300, 200], [620, 200], [620, 440], [300, 440]]) ui.sketchPoint(x, y);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="rulerMode"/);
  assert.deepEqual(canvasText(ui), ['A', 'B', 'C', 'D']);
  ui.click('close');
  for (let i = 0; i < 4; i++) {
    ui.focus(i, 'side');
    assert.equal(ui.activeInput().value, '');
  }
});

function correctedRectangle(t) {
  const ui = rectangle(t);
  ui.click('close');
  ui.fill(0, '420', 'side');
  ui.fill(2, '420', 'side');
  ui.enter(2, 'side');
  ui.chooseTool('pickDiag');
  ui.selectVertex(0);
  ui.selectVertex(2);
  ui.fill(0, String(Math.hypot(420, 300)), 'diag');
  ui.enter(0, 'diag');
  ui.click('done');
  ui.selectSide(0);
  ui.click('op', { k: 'shift' });
  ui.fill('d', '20', 'op');
  ui.click('apply');
  return ui;
}

test('ruler: snapping an unchanged sketch closed preserves corrected sides, diagonals, angles, edits and history', t => {
  const ui = correctedRectangle(t), before = ui.save();
  assert.equal(before.area, 13.44);
  assert.deepEqual(before.draw.m.sides, [420, 300, 420, null]);
  ui.click('back1');
  const first = vertices(ui)[0];
  dragSide(ui, { x: first.x, y: first.y + 5 });
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  const after = ui.save();
  assert.deepEqual(after.draw.m.sides, [420, 300, 420, 300]);
  assert.deepEqual(after.draw.m.diags, before.draw.m.diags);
  assert.deepEqual(after.draw.m.vert, before.draw.m.vert);
  assert.deepEqual(after.draw.ops, before.draw.ops);
  assert.deepEqual(after.verts, before.verts);
  assert.equal(after.area, before.area);
  ui.click('back2');
  ui.history('undo');
  assert.deepEqual(ui.save().draw.m.sides, before.draw.m.sides, 'one undo removes only the newly measured closing side');
  ui.history('undo');
  assert.deepEqual(ui.save().draw.m.diags, [{ i: 0, j: 2, cm: null }], 'the earlier diagonal-entry history is still available');
});

test('ruler: a genuinely changed sketch still builds a fresh model when snapped closed', t => {
  const ui = correctedRectangle(t);
  ui.click('back1');
  ui.history('undo');
  addSide(ui, 260, 340);
  addSide(ui, 260, 500);
  addSide(ui, 100, 500);
  ui.click('viewFit');
  const first = vertices(ui)[0];
  dragSide(ui, { x: first.x, y: first.y + 5 });
  assert.equal(ui.node('#app').dataset.stage, 2);
  ui.click('done');
  const result = ui.save();
  assert.equal(result.draw.m.n, 6);
  assert.deepEqual(result.draw.m.sides, [400, 300, 200, 200, 200, 500]);
  assert.deepEqual(result.draw.m.diags, []);
  assert.deepEqual(result.draw.ops, []);
  assert.equal(result.area, 16);
});
