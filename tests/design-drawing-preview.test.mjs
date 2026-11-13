import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { roomDrawingPreview } from '../src/design-bridge/room-drawing-preview.js';
import { rectPoly, opArc, arcInfo, ovalPoly, flatten, flattenHoles, opFillet, opLength, checkFillets, checkHoles, withHole } from '../src/design-bridge/drawEditor/geometry.js';
import { holesTemplate, holesMethods } from '../scripts/design-holes.mjs';
import { drawingPreviewTemplate } from '../scripts/design-drawing-preview.mjs';

const rectangle = [[0, 0], [4, 0], [4, 3], [0, 3]];
const concave = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
const coordinateRoom = poly => ({ v: flatten(poly, 6).map(point => [point.x, point.y]), draw: { base: poly, ops: [], origin: { kind: 'poly' } } });
const counts = preview => Object.fromEntries(['inner', 'outer'].map(kind => [kind, preview.dots.filter(dot => dot.kind === kind).length]));

function assertSafePreview(preview) {
  assert.equal(typeof preview.path, 'string');
  assert.match(preview.path, /^[MmLlHhVvCcSsQqTtAaZz\d.,+\-\s]*$/);
  assert.doesNotMatch(JSON.stringify(preview), /NaN|Infinity|<|>/);
  assert.ok(Number.isFinite(preview.width) && preview.width > 0);
  assert.ok(Number.isFinite(preview.height) && preview.height > 0);
  for (const dot of preview.dots) {
    assert.ok(Number.isFinite(dot.cx) && Number.isFinite(dot.cy));
    assert.ok(dot.cx >= 0 && dot.cx <= preview.width && dot.cy >= 0 && dot.cy <= preview.height);
    assert.ok(Number.isFinite(dot.degrees) && dot.degrees > 0 && dot.degrees < 360);
    assert.equal(dot.fill, dot.kind === 'inner' ? '#16A34A' : '#FF3B30');
  }
  for (const dimension of preview.dimensions) {
    assert.ok(Number.isFinite(dimension.x) && Number.isFinite(dimension.y) && Number.isFinite(dimension.rotation));
    assert.match(dimension.label, /^(?:⌒\s*)?\d+(?:[.,]\d+)?$/);
    assert.ok(Number(dimension.label.replace(/^⌒\s*/, '').replace(',', '.')) > 0, 'zero or invalid lengths are never labelled');
  }
}

test('calculator drawing preview uses centimetres and four green internal corners for a rectangle', () => {
  const preview = roomDrawingPreview({ v: rectangle });
  assert.deepEqual(preview.counts, { inner: 4, outer: 0 });
  assert.deepEqual(counts(preview), preview.counts);
  assert.deepEqual(preview.dots.map(dot => dot.degrees), [90, 90, 90, 90]);
  assert.deepEqual(preview.dimensions.map(dimension => dimension.label).sort(), ['300', '300', '400', '400']);
  assertSafePreview(preview);
});

test('calculator drawing preview marks a reentrant ceiling corner red regardless of contour winding', () => {
  for (const v of [concave, concave.toReversed()]) {
    const preview = roomDrawingPreview({ v });
    assert.deepEqual(preview.counts, { inner: 5, outer: 1 });
    assert.deepEqual(counts(preview), preview.counts);
    assert.deepEqual(preview.dots.filter(dot => dot.kind === 'outer').map(dot => dot.degrees), [270]);
    assertSafePreview(preview);
  }
});

test('calculator drawing preview classifies oblique convex corners by the material angle', () => {
  const preview = roomDrawingPreview({ v: [[0, 0], [4, 0], [0, 4]] });
  assert.deepEqual(preview.counts, { inner: 3, outer: 0 });
  assert.deepEqual(preview.dots.map(dot => Math.round(dot.degrees)).sort((a, b) => a - b), [45, 45, 90]);
  assertSafePreview(preview);
});

test('calculator drawing preview reverses corner meaning on an internal cutout for either winding', () => {
  const outer = [[0, 0], [8, 0], [8, 8], [0, 8]];
  const hole = [[1, 1], [3, 1], [3, 3], [1, 3]];
  for (const v of [outer, outer.toReversed()]) {
    for (const ring of [hole, hole.toReversed()]) {
      const preview = roomDrawingPreview({ v, holes: [ring] }, { width: 400, height: 400 });
      assert.deepEqual(preview.counts, { inner: 4, outer: 4 });
      assert.deepEqual(counts(preview), preview.counts);
      assert.deepEqual(preview.dots.filter(dot => dot.kind === 'outer').map(dot => dot.degrees), [270, 270, 270, 270]);
      assert.equal((preview.path.match(/[Mm]/g) || []).length, 2, 'the cutout remains a separate closed subpath');
      assert.equal(preview.dimensions.filter(dimension => dimension.label === '200').length, 4);
      assertSafePreview(preview);
    }
  }
});

test('calculator drawing preview gives a reentrant cutout corner a green material angle', () => {
  const hole = [[1, 1], [4, 1], [4, 2], [2, 2], [2, 4], [1, 4]];
  const preview = roomDrawingPreview({ v: [[0, 0], [8, 0], [8, 8], [0, 8]], holes: [hole] });
  assert.deepEqual(preview.counts, { inner: 5, outer: 5 });
  assert.deepEqual(counts(preview), preview.counts);
  assert.equal(preview.dots.filter(dot => dot.kind === 'inner' && Math.abs(dot.degrees - 90) < 1e-6).length, 5);
  assertSafePreview(preview);
});

test('calculator drawing preview uses canonical curved walls instead of dimensioning every flattening sample', () => {
  const poly = opArc(rectPoly(4, 3), 0, 'h', .5, 'out');
  const preview = roomDrawingPreview(coordinateRoom(poly));
  const expectedArcCm = String(Math.round(arcInfo(poly, 0).len * 100));
  assert.equal(preview.dimensions.length, 4);
  assert.ok(preview.dimensions.some(dimension => dimension.label.replace(/^⌒\s*/, '') === expectedArcCm && dimension.label.startsWith('⌒')));
  assert.ok((preview.path.match(/[Ll]/g) || []).length > 4, 'the outline retains curved geometry');
  assertSafePreview(preview);
});

test('calculator drawing preview replays saved edits without mutating the room or its drawing metadata', () => {
  const room = { v: rectangle, draw: { base: rectPoly(4, 3), ops: [{ kind: 'shift', i: 0, off: .2 }], origin: { kind: 'poly' } } };
  const before = structuredClone(room);
  const preview = roomDrawingPreview(room);
  assert.ok(preview.dimensions.some(dimension => dimension.label === '320'), 'dimensions follow the shifted wall instead of the stale flattened coordinates');
  assert.deepEqual(room, before);
  assertSafePreview(preview);
});

test('calculator drawing preview drops a saved fillet when a later wall length no longer leaves room for it', () => {
  const base = rectPoly(4, 3);
  let actual = opFillet(base, 0, 1);
  assert.deepEqual(checkFillets(actual), []);
  actual = opLength(actual, 0, 'end', .8);
  checkHoles(actual);
  assert.deepEqual(checkFillets(actual), ['A']);
  assert.equal(actual.v[0].fillet, null);
  const room = {
    v: flatten(actual).map(point => [point.x, point.y]),
    draw: { base, ops: [{ kind: 'fillet', i: 0, r: 1 }, { kind: 'len', i: 0, end: 'end', len: .8 }] },
  };
  const preview = roomDrawingPreview(room);
  const expected = roomDrawingPreview(coordinateRoom(actual));
  assert.equal(preview.dots.length, 4, 'the corner becomes sharp again, matching the editor result');
  assert.deepEqual(preview.path, expected.path);
  assert.deepEqual(preview.dots, expected.dots);
  assert.deepEqual(preview.dimensions, expected.dimensions);
  assertSafePreview(preview);
});

test('calculator drawing preview also clears a fillet that stops fitting inside an edited cutout', () => {
  const base = rectPoly(10, 10);
  base.holes = [{ v: [[1, 1], [5, 1], [5, 4], [1, 4]].map(([x, y]) => ({ x, y, fillet: null, arc: null })) }];
  let actual = withHole(base, 0, hole => opFillet(hole, 0, 1));
  actual = withHole(actual, 0, hole => {
    const changed = opLength(hole, 0, 'end', .8);
    assert.deepEqual(checkFillets(changed), ['A']);
    return changed;
  });
  checkHoles(actual);
  const room = {
    v: flatten(actual).map(point => [point.x, point.y]),
    holes: flattenHoles(actual).map(ring => ring.map(point => [point.x, point.y])),
    draw: { base, ops: [{ kind: 'fillet', h: 0, i: 0, r: 1 }, { kind: 'len', h: 0, i: 0, end: 'end', len: .8 }] },
  };
  const preview = roomDrawingPreview(room);
  const expected = roomDrawingPreview(coordinateRoom(actual));
  assert.deepEqual(preview.counts, { inner: 4, outer: 4 });
  assert.deepEqual(preview.path, expected.path);
  assert.deepEqual(preview.dots, expected.dots);
  assert.deepEqual(preview.dimensions, expected.dimensions);
  assertSafePreview(preview);
});

test('calculator drawing preview rejects replayed geometry that pushes a cutout outside its room', () => {
  const base = rectPoly(4, 3), hole = [[2, 1], [3, 1], [3, 2], [2, 2]];
  base.holes = [{ v: hole.map(([x, y]) => ({ x, y, fillet: null, arc: null })) }];
  const room = { v: rectangle, holes: [hole], draw: { base, ops: [{ kind: 'len', i: 0, end: 'end', len: 1 }] } };
  const preview = roomDrawingPreview(room);
  const visible = roomDrawingPreview({ v: rectangle, holes: [hole] });
  assert.deepEqual(preview, visible, 'invalid drawing metadata falls back to the saved visible contour and cutout');
  assertSafePreview(preview);
});

test('calculator drawing preview falls back to the visible room if legacy drawing operations are unsupported', () => {
  const preview = roomDrawingPreview({ v: rectangle, draw: { base: rectPoly(10, 10), ops: [{ kind: 'unknown-old-operation' }] } });
  assert.deepEqual(preview.dimensions.map(dimension => dimension.label).sort(), ['300', '300', '400', '400']);
  assertSafePreview(preview);
});

test('calculator drawing preview keeps ovals and legacy curve samples free of fictitious corners and tiny dimensions', () => {
  const canonical = roomDrawingPreview(coordinateRoom(ovalPoly(3, 2)));
  assert.ok(canonical.dots.length < 4);
  assert.ok(canonical.dimensions.length <= 8);
  assertSafePreview(canonical);
  const v = Array.from({ length: 60 }, (_, i) => [3 * Math.cos(i * Math.PI / 30), 2 * Math.sin(i * Math.PI / 30)]);
  const legacy = roomDrawingPreview({ v });
  assert.ok(legacy.dots.length < 10);
  assert.ok(legacy.dimensions.length < 10);
  assertSafePreview(legacy);
});

test('calculator drawing preview sanitizes duplicate, invalid and degenerate coordinates', () => {
  const duplicate = roomDrawingPreview({ v: [[0, 0], [4, 0], [4, 0], [4, 3], [0, 3], [0, 0]] });
  assert.deepEqual(duplicate.counts, { inner: 4, outer: 0 });
  assert.equal(duplicate.dimensions.length, 4);
  assertSafePreview(duplicate);
  for (const v of [undefined, [], [[0, 0], [1, 1]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [NaN, 1], [0, 2]], [[0, 0], [Infinity, 1], [0, 2]]]) {
    const preview = roomDrawingPreview({ v });
    assert.equal(preview.path, '');
    assert.deepEqual(preview.dots, []);
    assert.deepEqual(preview.dimensions, []);
    assertSafePreview(preview);
  }
});

test('calculator drawing preview returns an empty safe model when finite coordinates overflow geometric arithmetic', () => {
  const preview = roomDrawingPreview({ v: [[-1e308, -1e308], [1e308, -1e308], [1e308, 1e308], [-1e308, 1e308]] });
  assert.equal(preview.path, '');
  assert.deepEqual(preview.dots, []);
  assert.deepEqual(preview.dimensions, []);
  assert.deepEqual(preview.counts, { inner: 0, outer: 0 });
  assertSafePreview(preview);
});

test('calculator drawing preview never injects room strings or nonnumeric SVG tokens into its model', () => {
  const attack = '\"><script>alert(1)</script>';
  const preview = roomDrawingPreview({ name: attack, v: rectangle.map(([x, y]) => [x, y, attack]), color: attack }, { width: attack, height: attack, padding: attack });
  assertSafePreview(preview);
  assert.deepEqual(preview.counts, { inner: 4, outer: 0 });
  assert.doesNotMatch(JSON.stringify(preview), /script|alert|onload/);
});

function legacyCalculatorTemplate() {
  const source = fs.readFileSync(new URL('../design-src/prototype.html', import.meta.url), 'utf8');
  const template = JSON.parse(source.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
  // The full build adds the fourth geometry call through its Easy Ceiling export method.
  return holesTemplate(template + '\ngeom(r.v)');
}

test('calculator drawing preview template connects pure preview data and preserves quantity geometry', () => {
  const source = legacyCalculatorTemplate();
  const geometry = source.match(/const geom=\(v,holes\)=>\{[\s\S]*?\};/)[0];
  const patched = drawingPreviewTemplate(source);
  assert.equal((patched.match(/window\.MagicDraw\.preview\(r\)/g) || []).length, 1);
  assert.match(patched, /polyDimensions=preview\.dimensions/);
  assert.match(patched, /polyGrid=preview\.grid/);
  assert.match(patched, /list="\{\{ polyDimensions \}\}"/);
  assert.match(patched, /list="\{\{ polyDots \}\}"/);
  assert.ok(patched.includes(geometry), 'drawing appearance does not alter the quantities or corner-count formulas');
});

test('calculator drawing preview template rejects missing or ambiguous integration anchors', () => {
  const source = legacyCalculatorTemplate();
  assert.throws(() => drawingPreviewTemplate(''), /drawing preview:/);
  assert.throws(() => drawingPreviewTemplate(source.replace('const{to}=this.svgPoly(r.v,150,120,14)', 'const changedProjection=null')), /projection/);
  assert.throws(() => drawingPreviewTemplate(source.replace('      polyPath,polyDots,', '      changedPreviewBindings,')), /bindings/);
  assert.throws(() => drawingPreviewTemplate(source.replace('                <svg sc-camel-view-box="0 0 150 120"', '                <svg data-changed="true"')), /SVG/);
  const projection = source.match(/    const\{to\}=this\.svgPoly\(r\.v,150,120,14\);[\s\S]*?(?=    const roomChips=)/)[0];
  assert.throws(() => drawingPreviewTemplate(source + projection + '    const roomChips=[];'), /ambiguous/);
  assert.throws(() => drawingPreviewTemplate(drawingPreviewTemplate(source)), /drawing preview:/);
});

test('calculator drawing preview template rejects a duplicate SVG even when projection bindings are unique', () => {
  const source = legacyCalculatorTemplate();
  const anchor = '                <svg sc-camel-view-box="0 0 150 120"';
  const drawing = source.match(/                <svg sc-camel-view-box="0 0 150 120"[\s\S]*?<\/svg>/)[0];
  assert.throws(() => drawingPreviewTemplate(source + drawing), /calculator SVG found 2, expected 1/);
  assert.throws(() => drawingPreviewTemplate(anchor + '></svg>\n' + source), /calculator SVG found 2, expected 1/);
});

test('calculator drawing thumbnail is a native button that opens the currently selected room', () => {
  const patched = drawingPreviewTemplate(legacyCalculatorTemplate());
  const button = patched.match(/<button\b[^>]*class="room-drawing-trigger"[^>]*>[\s\S]*?<\/button>/)[0];
  assert.match(button, /type="button"/);
  assert.match(button, /aria-label="Изменить чертёж помещения"/);
  assert.match(button, /sc-camel-on-click="\{\{ editRoomDrawing \}\}"/);
  assert.match(button, /<svg\b[^>]*class="room-drawing-preview"/);
  const expression = patched.match(/editRoomDrawing:([^,\n]+),/)[1];
  const selectedRoom = { id: 'second-room', name: 'Выбранное помещение', v: rectangle };
  let opened;
  const context = { openDraw: room => { opened = room; } };
  const click = Function('r', 'return (' + expression + ');').call(context, selectedRoom);
  click();
  assert.equal(opened, selectedRoom, 'the handler closes over the active room rather than opening a new or first room');
});

function patchedOpenDraw(window) {
  const source = fs.readFileSync(new URL('../scripts/build-design.mjs', import.meta.url), 'utf8');
  const literal = source.match(/const METHODS = \[([\s\S]*?)\n\]\.join\('\\n'\);/)[1];
  const lines = holesMethods(Function('return [' + literal + '];')());
  const first = lines.findIndex(line => line.includes('openDraw(r){'));
  const end = lines.findIndex(line => line.includes('openTrace(){'));
  return Function('window', 'mk', 'F', 'return ({' + lines.slice(first, end).join('\n') + '});')(
    window, () => { throw new Error('Editing a room must not create a new room'); }, String,
  );
}

for (const savedDrawing of [false, true]) {
  test(`calculator drawing editing preserves holes ${savedDrawing ? 'with saved drawing metadata' : 'in a legacy room without drawing metadata'}`, () => {
    const holes = [[[1, 1], [2, 1], [2, 2], [1, 2]]];
    const room = { id: 'selected-room', name: 'Исходное помещение', v: rectangle, holes, on: true, opts: { cornice: true }, canvas: { pid: 'keep-material' } };
    if (savedDrawing) room.draw = { base: rectPoly(4, 3), ops: [] };
    const other = { id: 'other-room', name: 'Соседнее помещение', v: rectangle };
    const project = { id: 'project-1', rooms: [other, room], status: 'estimate' };
    const original = structuredClone(project);
    let options, updated, closed = 0;
    const api = patchedOpenDraw({ MagicDraw: { open: value => { options = value; return { close: () => { closed++; } }; } } });
    Object.assign(api, { cur: () => project, upd: (id, update) => { assert.equal(id, project.id); updated = update(project); }, go() {}, toast() {} });
    api.openDraw(room);
    assert.equal(options.initial.verts, room.v);
    assert.equal(options.initial.holes, room.holes);
    assert.equal(options.initial.draw, room.draw || null);
    assert.deepEqual(project, original, 'opening the editor does not modify the selected room');
    const result = { name: 'Исправленное помещение', verts: [[0, 0], [5, 0], [5, 3], [0, 3]], holes: [[[1, 1], [1.5, 1], [1.5, 1.5], [1, 1.5]]], draw: { base: rectPoly(5, 3), ops: [] }, area: 14.75 };
    options.onFinish(result);
    assert.equal(closed, 1);
    assert.equal(updated.rooms.length, 2);
    assert.equal(updated.rooms[0], other);
    assert.deepEqual(updated.rooms[1], { ...room, name: result.name, v: result.verts, holes: result.holes, draw: result.draw });
    assert.deepEqual(project, original, 'saving creates updated room data without mutating the original project');
  });
}
