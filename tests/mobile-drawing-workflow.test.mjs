import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawEditor } from '../src/design-bridge/drawEditor/editor.js';
import { makeModel, solveModel } from '../src/design-bridge/drawEditor/geometry.js';
import { mount } from './drawing-editor-runtime.mjs';

const rectangle = [[0, 0], [4, 0], [4, 3], [0, 3]];
const mobile = { mobileWorkflow: true };

function measuredRoom(coordinates = rectangle, diagonal = false) {
  const points = coordinates.map(([x, y]) => ({ x, y }));
  const model = makeModel(points.map(({ x, y }) => ({ x: x * 80, y: y * 80 })), 'free');
  model.sides = points.map((p, i) => Math.hypot(points[(i + 1) % points.length].x - p.x, points[(i + 1) % points.length].y - p.y) * 100);
  if (diagonal) model.diags = [{ i: 0, j: 2, cm: 500 }];
  solveModel(model);
  return { verts: coordinates, draw: { base: { v: points.map(p => ({ ...p, fillet: null, arc: null })) }, ops: [], origin: { kind: 'poly' }, m: model } };
}

const measurementState = ui => {
  const { sides, vert, diags } = ui.save().draw.m;
  return { sides, vert, diags };
};
const canvasVertices = ui => ui.node('#cv').firstChild.children
  .filter(element => element.attributes.get('data-hit') === 'v' && !element.attributes.has('data-h'))
  .sort((a, b) => Number(a.attributes.get('data-i')) - Number(b.attributes.get('data-i')))
  .map(element => ({ x: Number(element.attributes.get('cx')), y: Number(element.attributes.get('cy')) }));
const descendants = element => [element, ...element.children.flatMap(descendants)];
const hasClass = (element, name) => (element.attributes.get('class') || '').split(/\s+/).includes(name);
const appearanceLabels = element => descendants(element).filter(node => hasClass(node, 'appearance-label')).map(node => node.textContent);
const dimensionLabels = ui => descendants(ui.node('#cv')).filter(node => hasClass(node, 'appearance-dimension')).flatMap(appearanceLabels);

function sketchRectangle(t) {
  const ui = mount(t, createDrawEditor, undefined, { ...mobile, canvasLook: 'technical' });
  ui.click('q-poly');
  for (const [x, y] of [[100, 100], [500, 100], [500, 400], [100, 400]]) ui.sketchPoint(x, y);
  return ui;
}

function openMeasurements(t) {
  const ui = mount(t, createDrawEditor, measuredRoom(), mobile);
  ui.click('back2');
  return ui;
}

function dragCanvas(ui, dx, dy) {
  const canvas = ui.node('#cv'), target = { closest: () => null };
  canvas.dispatch('pointerdown', target, { clientX: 100, clientY: 100, pointerId: 1 });
  canvas.dispatch('pointermove', target, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
  canvas.dispatch('pointerup', target, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1 });
}

test('mobile: the unmeasured sketch labels corners without inventing numeric lengths', t => {
  const ui = sketchRectangle(t);
  const labels = descendants(ui.node('#cv')).filter(node => hasClass(node, 'appearance-label') || hasClass(node, 'appearance-vertex-label')).map(node => node.textContent);
  assert.deepEqual(labels, ['A', 'B', 'C', 'D']);
  assert.deepEqual(dimensionLabels(ui), []);
});

test('mobile: a closed unmeasured contour shows unknown side lengths', t => {
  const ui = sketchRectangle(t);
  ui.click('close');
  assert.equal(ui.node('#doneBtn').disabled, true);
  assert.deepEqual(dimensionLabels(ui), ['?', '?', '?', '?']);
});

test('mobile: one measured wall leaves every underdetermined wall unknown', t => {
  const ui = sketchRectangle(t);
  ui.click('close');
  ui.fill(0, '400', 'side');
  ui.enter(0, 'side');
  assert.equal(ui.node('#doneBtn').disabled, true);
  assert.deepEqual(dimensionLabels(ui), ['400', '?', '?', '?']);
});

test('mobile: calculated opposite sides appear approximately only after the rectangle is determined', t => {
  const ui = sketchRectangle(t);
  ui.click('close');
  ui.fill(0, '400', 'side');
  ui.fill(1, '300', 'side');
  ui.enter(1, 'side');
  assert.equal(ui.node('#doneBtn').disabled, false);
  assert.deepEqual(dimensionLabels(ui), ['400', '300', '≈400', '≈300']);
});

test('mobile: decimal centimetres entered with comma or dot remain exact through solving and saving', async t => {
  const ui = sketchRectangle(t);
  ui.click('close');
  ui.fill(0, '465,6', 'side');
  ui.fill(1, '300.4', 'side');
  ui.enter(1, 'side');
  assert.equal(ui.node('#doneBtn').disabled, false);
  assert.deepEqual(dimensionLabels(ui).slice(0, 2), ['465,6', '300,4']);
  ui.click('done');
  const saved = ui.save();
  assert.deepEqual(saved.draw.m.sides, [465.6, 300.4, null, null]);
  await t.test('reopening preserves the original measurements in labels and inputs', subtest => {
    const restored = mount(subtest, createDrawEditor, saved, { ...mobile, canvasLook: 'technical' });
    restored.click('back2');
    assert.deepEqual(dimensionLabels(restored).slice(0, 2), ['465,6', '300,4']);
    restored.focus(0, 'side');
    assert.equal(restored.activeInput().value, '465,6');
    assert.deepEqual(measurementState(restored).sides, saved.draw.m.sides);
  });
});

test('mobile: changing sketch mode refreshes its label, retains every point and constructs the chosen right-angle model', t => {
  const ui = mount(t, createDrawEditor, undefined, mobile);
  ui.click('q-polyfree');
  for (const [x, y] of [[100, 100], [500, 100], [500, 400], [100, 400]]) ui.sketchPoint(x, y);
  const points = canvasVertices(ui);
  assert.equal(points.length, 4);
  assert.match(ui.node('#sheet').innerHTML, /data-act="sketchMode">Диагонали \/ градусы</);
  ui.click('sketchMode');
  assert.match(ui.node('#sheet').innerHTML, /data-act="sketchMode">Прямые углы</);
  assert.deepEqual(canvasVertices(ui), points, 'switching modes does not clear or reposition the sketch');
  ui.click('close');
  for (const [i, value] of ['400', '300', '400', '300'].entries()) ui.fill(i, value, 'side');
  ui.click('done');
  const result = ui.save();
  assert.equal(result.area, 12);
  assert.equal(result.verts.length, 4);
  assert.ok(result.draw.m.vert.every(vertex => vertex.kind === 'ortho' && vertex.deg === 90));
});

test('mobile: next and previous keep the keyboard field focused and preserve pending wall lengths', t => {
  const ui = openMeasurements(t);
  ui.focus(0, 'side');
  ui.fill(0, '450', 'side');
  ui.click('nextField');
  assert.deepEqual(ui.activeInput(), { kind: 'side', key: '1', value: '300' });
  ui.fill(1, '320', 'side');
  ui.click('prevField');
  assert.deepEqual(ui.activeInput(), { kind: 'side', key: '0', value: '450' });
  assert.deepEqual(measurementState(ui).sides, [450, 320, 400, 300]);
});

test('mobile: the last next action finishes entry without wrapping to the first wall', t => {
  const ui = openMeasurements(t);
  ui.focus(3, 'side');
  ui.fill(3, '310', 'side');
  ui.click('nextField');
  assert.equal(ui.activeInput(), null);
  assert.equal(measurementState(ui).sides[3], 310);
});

test('mobile: selecting a measurement chip focuses its matching field', t => {
  const ui = mount(t, createDrawEditor, measuredRoom(rectangle, true), mobile);
  ui.click('back2');
  ui.click('mobileField', { kind: 'side', i: '2' });
  assert.deepEqual(ui.activeInput(), { kind: 'side', key: '2', value: '400' });
  ui.click('mobileField', { kind: 'diag', i: '0' });
  assert.deepEqual(ui.activeInput(), { kind: 'diag', key: '0', value: '500' });
});

test('mobile: focusing opposite walls moves each toward the canvas centre without zooming or changing measurements', t => {
  const ui = openMeasurements(t);
  const before = ui.save();
  ui.focus(0, 'side');
  const topView = canvasVertices(ui);
  ui.focus(2, 'side');
  const bottomView = canvasVertices(ui);
  const centre = { x: ui.node('#cv').clientWidth / 2, y: ui.node('#cv').clientHeight / 2 };
  const middle = (vertices, i) => ({ x: (vertices[i].x + vertices[(i + 1) % vertices.length].x) / 2, y: (vertices[i].y + vertices[(i + 1) % vertices.length].y) / 2 });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(distance(middle(topView, 0), centre) < distance(middle(bottomView, 0), centre), 'AB moves toward the centre when focused');
  assert.ok(distance(middle(bottomView, 2), centre) < distance(middle(topView, 2), centre), 'CD moves toward the centre when focused');
  for (let i = 0; i < topView.length; i++) {
    const next = (i + 1) % topView.length;
    assert.ok(Math.abs(distance(topView[i], topView[next]) - distance(bottomView[i], bottomView[next])) < .001, 'focus preserves the displayed scale');
  }
  assert.deepEqual(ui.save(), before, 'focus only moves the camera');
});

test('mobile: automatic focus pan keeps a fitted contour inside the canvas with a 20 pixel margin', t => {
  const ui = openMeasurements(t), canvas = ui.node('#cv');
  assert.equal(canvas.clientWidth, 800);
  assert.equal(canvas.clientHeight, 600);
  for (let i = 0; i < 4; i++) {
    ui.focus(i, 'side');
    for (const point of canvasVertices(ui)) {
      assert.ok(point.x >= 20 - 1e-6 && point.x <= canvas.clientWidth - 20 + 1e-6, `focused wall ${i} keeps every corner horizontally visible`);
      assert.ok(point.y >= 20 - 1e-6 && point.y <= canvas.clientHeight - 20 + 1e-6, `focused wall ${i} keeps every corner vertically visible`);
    }
  }
});

test('mobile: manual canvas dragging stays in control while a measurement field is focused', t => {
  const ui = openMeasurements(t);
  ui.focus(0, 'side');
  const before = ui.save(), vertices = canvasVertices(ui);
  dragCanvas(ui, 40, 30);
  const dragged = canvasVertices(ui);
  for (let i = 0; i < vertices.length; i++) {
    assert.ok(Math.abs(dragged[i].x - vertices[i].x - 40) < 1e-6, 'drag moves the displayed contour horizontally');
    assert.ok(Math.abs(dragged[i].y - vertices[i].y - 30) < 1e-6, 'drag moves the displayed contour vertically');
  }
  assert.deepEqual(ui.activeInput(), { kind: 'side', key: '0', value: '400' });
  assert.deepEqual(ui.save(), before);
});

test('mobile: delayed input application does not recenter a manually positioned focused contour', async t => {
  const ui = openMeasurements(t);
  ui.focus(0, 'side');
  dragCanvas(ui, 40, 30);
  const positioned = canvasVertices(ui), before = ui.save();
  ui.fill(0, '400,0', 'side');
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.deepEqual(canvasVertices(ui), positioned, 'applying another numeric representation of the same length preserves the camera position');
  assert.deepEqual(ui.save(), before);
});

test('mobile: make all angles right preserves measurements and is one undoable change', t => {
  const ui = mount(t, createDrawEditor, measuredRoom(rectangle, true), mobile);
  ui.click('back2');
  const before = measurementState(ui);
  ui.click('allOrtho');
  const after = measurementState(ui);
  assert.ok(after.vert.every(vertex => vertex.kind === 'ortho' && vertex.deg === 90));
  assert.deepEqual(after.sides, before.sides);
  assert.deepEqual(after.diags, before.diags);
  ui.history('undo');
  assert.deepEqual(measurementState(ui), before, 'one undo restores every original free angle');
  ui.history('redo');
  assert.deepEqual(measurementState(ui), after);
  ui.click('freeAngles');
  assert.ok(measurementState(ui).vert.every(vertex => vertex.kind === 'free' && vertex.deg == null));
  assert.deepEqual(measurementState(ui).diags, before.diags);
});

test('mobile: right-angle conversion keeps the reentrant 270° corner of a concave ceiling', t => {
  const contour = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
  const ui = mount(t, createDrawEditor, measuredRoom(contour), mobile);
  ui.click('back2');
  ui.click('allOrtho');
  const { vert } = measurementState(ui);
  assert.deepEqual(vert.map(vertex => vertex.deg), [90, 90, 90, 270, 90, 90]);
  ui.click('done');
  assert.equal(ui.save().area, 7);
});

test('mobile: an odd-sided room rejects impossible all-right-angle conversion without altering measurements', t => {
  const ui = mount(t, createDrawEditor, measuredRoom([[0, 0], [4, 0], [0, 3]]), mobile);
  ui.click('back2');
  const before = measurementState(ui);
  ui.click('allOrtho');
  assert.deepEqual(measurementState(ui), before);
});

test('mobile: camera rotation, alignment and fit never rewrite ceiling geometry, holes or legacy operations', t => {
  const room = measuredRoom();
  room.draw.base.holes = [{ v: [[1, 1], [1.5, 1], [1.5, 1.5], [1, 1.5]].map(([x, y]) => ({ x, y, fillet: null, arc: null })) }];
  room.draw.ops = [
    { kind: 'bump', i: 0, from: 'start', off: 3, w: 1, dp: .5, dir: 'in' },
    { kind: 'shift', i: 5, off: .2 },
  ];
  const ui = mount(t, createDrawEditor, room, mobile);
  const before = ui.save();
  const upright = canvasVertices(ui);
  ui.click('viewRotateRight');
  assert.notDeepEqual(canvasVertices(ui), upright, 'the displayed contour rotates');
  assert.deepEqual(ui.save(), before);
  ui.click('viewRotateLeft');
  assert.deepEqual(canvasVertices(ui), upright, 'opposite view rotations restore orientation');
  for (const action of ['viewRotateRight', 'viewAlign', 'viewFit']) {
    ui.click(action);
    assert.deepEqual(ui.save(), before, `${action} changes only the camera`);
  }
});

test('mobile: rotation buttons turn the view in five-degree steps and the range allows one-degree adjustments', t => {
  const ui = mount(t, createDrawEditor, measuredRoom(), mobile);
  const before = ui.save();
  const heading = () => { const [a, b] = canvasVertices(ui); return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; };
  ui.click('viewRotateRight');
  assert.ok(Math.abs(heading() - 5) < 1e-6);
  ui.click('viewRotateRight');
  assert.ok(Math.abs(heading() - 10) < 1e-6);
  ui.click('viewRotateLeft');
  assert.ok(Math.abs(heading() - 5) < 1e-6);
  ui.click('viewToggle');
  const range = ui.node('#viewRotation');
  assert.equal(range.getAttribute('step'), '1');
  for (const degrees of [17, 18, 180]) {
    range.value = String(degrees);
    ui.node('#viewPanel').dispatch('input', range);
    assert.ok(Math.abs(heading() - degrees) < 1e-6, `range input rotates the actual SVG to ${degrees}°`);
    assert.equal(ui.node('#viewRotation').value, String(degrees), 'the displayed range value stays at the chosen degree, including the positive endpoint');
    assert.deepEqual(ui.save(), before, 'fine rotation preserves every geometry and measurement value');
  }
});

test('mobile: secondary tools stay closed until requested and still create a real internal cutout', t => {
  const ui = mount(t, createDrawEditor, measuredRoom(), mobile);
  assert.match(ui.node('#sheet').innerHTML, /data-act="toggleTools"/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="hole"/);
  const before = ui.save();
  ui.click('toggleTools');
  assert.match(ui.node('#sheet').innerHTML, /data-act="hole"/);
  assert.match(ui.node('#sheet').innerHTML, /class="mobile-operation-menu"/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="selectSide"|data-act="selectVertex"/, 'the first decision is the operation rather than a target list');
  ui.click('toggleTools');
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="hole"/);
  assert.deepEqual(ui.save(), before);
  ui.click('toggleTools');
  ui.click('hole');
  for (const [key, value] of [['d1', '100'], ['d2', '100'], ['w', '50'], ['hh', '50']]) ui.fill(key, value, 'op');
  ui.click('apply');
  const after = ui.save();
  assert.equal(after.area, 11.75);
  assert.equal(after.holes.length, 1);
  assert.equal(after.draw.ops.at(-1).kind, 'hole');
});

test('embedded desktop retains its existing details interface when mobile workflow is not enabled', t => {
  const ui = mount(t, createDrawEditor, measuredRoom(), { embedded: true });
  assert.match(ui.node('#sheet').innerHTML, /data-act="hole"/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="toggleTools"/);
  assert.match(ui.node('#sheet').innerHTML, /data-act="selectSide"/);
  assert.doesNotMatch(ui.node('#sheet').innerHTML, /data-act="chooseTool"/);
  ui.selectSide(0);
  assert.match(ui.node('#sheet').innerHTML, /data-k="shift"/);
});
