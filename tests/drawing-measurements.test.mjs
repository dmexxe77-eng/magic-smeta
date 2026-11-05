import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawEditor as bridgeEditor } from '../src/design-bridge/drawEditor/editor.js';
import { createDrawEditor as mainEditor } from '../src/components/builders/drawEditor/editor.js';
import * as bridgeGeometry from '../src/design-bridge/drawEditor/geometry.js';
import * as mainGeometry from '../src/components/builders/drawEditor/geometry.js';
import { mount } from './drawing-editor-runtime.mjs';

const rectangle = [[0, 0], [4, 0], [4, 3], [0, 3]];

function savedRoom(geometry, coordinates = rectangle, { free = false, diagonal = false } = {}) {
  const base = { v: coordinates.map(([x, y]) => ({ x, y, fillet: null, arc: null })) };
  const model = geometry.makeModel(coordinates.map(([x, y]) => ({ x: x * 80, y: y * 80 })), free ? 'free' : 'grid');
  model.sides = coordinates.map(([x, y], i) => Math.hypot(coordinates[(i + 1) % coordinates.length][0] - x, coordinates[(i + 1) % coordinates.length][1] - y) * 100);
  if (diagonal) model.diags = [{ i: 0, j: 2, cm: 500 }];
  geometry.solveModel(model);
  return { verts: coordinates, draw: { base, ops: [], origin: { kind: 'poly' }, m: model } };
}

function freeRectangle(t, editor) {
  const ui = mount(t, editor);
  ui.click('q-polyfree');
  for (const [x, y] of [[100, 100], [500, 100], [500, 400], [100, 400]]) ui.sketchPoint(x, y);
  ui.click('close');
  for (const [i, value] of ['400', '300', '400', '300'].entries()) ui.fill(i, value, 'side');
  ui.enter(3, 'side');
  return ui;
}

function requireTools(ui) {
  const tools = ui.node('#measureTools');
  assert.ok(tools, 'the measurement stage exposes its canvas tools');
  assert.equal(tools.hidden, false);
  assert.match(tools.innerHTML, /data-act="pickDiag"/);
  assert.match(tools.innerHTML, /data-act="pickAng"/);
  return tools;
}

test('the chooser explains automatic right-angle and manual measured construction', t => {
  const ui = mount(t, bridgeEditor);
  const chooser = ui.node('#start').innerHTML;
  assert.match(chooser, /Автоматическое построение/);
  assert.match(chooser, /все углы прямые/i);
  assert.match(chooser, /Ручное построение/);
  assert.match(chooser, /диагонали|диагоналей/);
  assert.match(chooser, /градус/);
});

for (const [name, editor, geometry] of [['desktop/mobile', bridgeEditor, bridgeGeometry], ['main', mainEditor, mainGeometry]]) {
  test(`${name}: measurement tools keep the contour visible and upright on a 400×200 canvas`, t => {
    const ui = mount(t, editor, savedRoom(geometry));
    const canvas = ui.node('#cv');
    canvas.clientWidth = 400;
    canvas.clientHeight = 200;
    ui.click('back2');
    requireTools(ui);
    const vertices = canvas.firstChild.children
      .filter(element => element.attributes.get('data-hit') === 'v')
      .sort((a, b) => Number(a.attributes.get('data-i')) - Number(b.attributes.get('data-i')))
      .map(element => ({ x: Number(element.attributes.get('cx')), y: Number(element.attributes.get('cy')) }));
    assert.equal(vertices.length, 4, 'all four corners are rendered');
    for (const { x, y } of vertices) {
      assert.ok(Number.isFinite(x) && x >= 0 && x <= canvas.clientWidth, 'each corner is inside the canvas horizontally');
      assert.ok(Number.isFinite(y) && y >= 0 && y <= canvas.clientHeight, 'each corner is inside the canvas vertically');
    }
    assert.ok(vertices[1].x > vertices[0].x, 'the left-to-right wall keeps a positive horizontal scale');
    assert.ok(vertices[3].y > vertices[0].y, 'the top-to-bottom wall keeps a positive vertical scale');
    const width = Math.max(...vertices.map(p => p.x)) - Math.min(...vertices.map(p => p.x));
    const height = Math.max(...vertices.map(p => p.y)) - Math.min(...vertices.map(p => p.y));
    assert.ok(width >= canvas.clientWidth * .2, 'the contour occupies a usable width');
    assert.ok(height >= canvas.clientHeight * .3, 'the contour occupies a usable height');
  });

  test(`${name}: a diagonal selected on the canvas determines the free room and survives reopening`, async t => {
    const ui = freeRectangle(t, editor);
    requireTools(ui);
    ui.chooseTool('pickDiag');
    ui.selectVertex(0);
    assert.match(ui.node('#measureTools').innerHTML, /A/);
    ui.selectVertex(2);
    assert.match(ui.node('#sheet').innerHTML, /data-in="diag"[^>]*data-k="0"/);
    ui.fill(0, '500,0', 'diag');
    ui.enter(0, 'diag');
    ui.click('done');
    const result = ui.save();
    assert.ok(result, 'the measured room can be completed');
    assert.equal(result.area, 12);
    assert.deepEqual(result.draw.m.sides, [400, 300, 400, 300]);
    assert.deepEqual(result.draw.m.diags, [{ i: 0, j: 2, cm: 500 }]);
    assert.ok(result.draw.m.vert.every(vertex => vertex.kind === 'free'), 'a manual sketch does not assume right angles');
    await t.test('the measured diagonal can be opened again', sub => {
      const reopened = mount(sub, editor, { verts: result.verts, draw: result.draw });
      reopened.click('back2');
      reopened.click('tab2', { v: 'diags' });
      assert.match(reopened.node('#sheet').innerHTML, /data-in="diag"[^>]*data-k="0"[^>]*value="500"/);
    });
  });

  test(`${name}: the angle tool accepts decimal degrees and determines the free room`, t => {
    const ui = freeRectangle(t, editor);
    requireTools(ui);
    ui.chooseTool('pickAng');
    ui.selectVertex(0);
    assert.match(ui.node('#sheet').innerHTML, /data-in="ang"[^>]*data-i="0"/);
    ui.fill(0, '90,5', 'ang');
    ui.enter(0, 'ang');
    ui.click('done');
    const result = ui.save();
    assert.ok(result, 'the measured angle completes the room');
    assert.equal(result.area, 12);
    assert.equal(result.draw.m.vert[0].kind, 'deg');
    assert.equal(result.draw.m.vert[0].deg, 90.5);
    assert.ok(result.draw.m.vert.slice(1).every(vertex => vertex.kind === 'free'));
    const points = geometry.ptsOf(result.draw.base);
    assert.ok(Math.abs(geometry.interiorDeg(points, 0, geometry.windOf(points)) - 90.5) < .1);
  });

  test(`${name}: tapping an angle label opens degrees without using the side panel tabs`, t => {
    const ui = freeRectangle(t, editor);
    ui.tapAngle(2);
    assert.match(ui.node('#sheet').innerHTML, /data-in="ang"[^>]*data-i="2"/);
  });

  test(`${name}: tapping an existing diagonal edits its length without duplicating the measurement`, t => {
    const ui = mount(t, editor, savedRoom(geometry, rectangle, { free: true, diagonal: true }));
    ui.click('back2');
    ui.selectDiagonal(0);
    assert.match(ui.node('#sheet').innerHTML, /data-in="diag"[^>]*data-k="0"[^>]*value="500"/);
    ui.fill(0, '450', 'diag');
    ui.enter(0, 'diag');
    ui.click('done');
    const result = ui.save();
    assert.deepEqual(result.draw.m.diags, [{ i: 0, j: 2, cm: 450 }]);
    assert.equal(result.area, 11.76, 'the new diagonal changes the solved geometry');
  });

  test(`${name}: cancelling a partially selected diagonal leaves measurements unchanged`, t => {
    const ui = mount(t, editor, savedRoom(geometry, rectangle, { free: true, diagonal: true }));
    const before = ui.save();
    ui.click('back2');
    requireTools(ui);
    ui.chooseTool('pickDiag');
    ui.selectVertex(1);
    ui.chooseTool('pickCancel');
    ui.click('done');
    const after = ui.save();
    assert.equal(after.area, before.area);
    assert.deepEqual(after.draw.m, before.draw.m);
    assert.deepEqual(after.draw.ops, before.draw.ops);
  });

  test(`${name}: canvas diagonal selection rejects adjacent vertices and an external concave diagonal`, t => {
    const contour = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
    const ui = mount(t, editor, savedRoom(geometry, contour));
    ui.click('back2');
    for (const [a, b] of [[0, 1], [2, 4]]) {
      ui.click('pickDiag');
      ui.selectVertex(a);
      ui.selectVertex(b);
      ui.click('done');
      const result = ui.save();
      assert.deepEqual(result.draw.m.diags, [], `invalid diagonal ${a}-${b} is not stored`);
      assert.equal(result.area, 7);
      ui.click('back2');
    }
  });

  test(`${name}: diagonal entry remains undoable and redoable`, t => {
    const ui = mount(t, editor, savedRoom(geometry));
    ui.click('back2');
    requireTools(ui);
    ui.chooseTool('pickDiag');
    ui.selectVertex(0);
    ui.selectVertex(2);
    ui.fill(0, '500', 'diag');
    ui.enter(0, 'diag');
    ui.history('undo');
    ui.click('done');
    assert.equal(ui.save().draw.m.diags[0].cm, null, 'undo removes the measured length');
    ui.click('back2');
    ui.history('redo');
    ui.click('done');
    assert.equal(ui.save().draw.m.diags[0].cm, 500);
  });

  test(`${name}: invalid degrees do not complete an undermeasured free room`, t => {
    const ui = freeRectangle(t, editor);
    ui.click('pickAng');
    ui.selectVertex(0);
    for (const value of ['', '0', '-10', '360', 'NaN']) {
      ui.fill(0, value, 'ang');
      ui.enter(0, 'ang');
      ui.click('done');
      assert.equal(ui.save(), undefined, `invalid angle ${value} does not create geometry`);
    }
    ui.fill(0, '90', 'ang');
    ui.enter(0, 'ang');
    ui.click('done');
    assert.equal(ui.save().area, 12, 'a valid angle still completes the same draft');
  });
}
