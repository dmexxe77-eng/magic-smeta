import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function traceBridge(project) {
  const source = fs.readFileSync(new URL('../scripts/build-design.mjs', import.meta.url), 'utf8');
  const literal = source.match(/const METHODS = \[([\s\S]*?)\n\]\.join\('\\n'\);/)[1];
  const lines = Function('return [' + literal + '];')();
  const first = lines.findIndex(line => line.includes('openTrace(){'));
  const end = lines.findIndex(line => line.includes('openContract(){'));
  const sessions = [], inputs = [], notices = [];
  let serial = 0;
  const document = {
    body: { appendChild() {} },
    createElement() {
      const input = { style: {}, files: [{ name: 'plan.png' }], remove() {}, click() { this.onchange(); } };
      inputs.push(input);
      return input;
    },
  };
  const window = { MagicTrace: { open(options) { sessions.push(options); return { close() {} }; } } };
  const mk = (name, v) => ({ id: 'persisted-' + ++serial, name, v, on: true,
    canvas: { pid: 'selected-canvas', qtyO: 99, iq: { finish: 12.5 } },
    main: { pid: 'selected-profile', qtyO: 31 }, opts: { protect: true } });
  const api = Function('window', 'document', 'mk', 'F', 'return ({' + lines.slice(first, end).join('\n') + '});')(window, document, mk, String);
  Object.assign(api, {
    cur: () => project,
    upd(id, update) { assert.equal(id, project.id); Object.assign(project, update(project)); },
    toast(value) { notices.push(value); }, go() {},
  });
  return { api, sessions, inputs, notices };
}

test('recalibration updates existing traced rooms once and preserves project rooms and quantity overrides', () => {
  const existing = { id: 'manual-room', name: 'Ручное помещение', v: [[0, 0], [4, 0], [4, 3], [0, 3]], canvas: { qtyO: 17 } };
  const project = { id: 'project', rooms: [existing], status: 'order' };
  const { api, sessions, notices } = traceBridge(project);
  api.openTrace();
  const trace = sessions[0];
  const oldVerts = [[0, 0], [4, 0], [4, 3], [0, 3]];
  trace.onRoom({ traceId: 'source-a', name: 'Спальня', verts: oldVerts, area: 12 });
  trace.onRoom({ traceId: 'source-b', name: 'Кухня', verts: oldVerts, area: 12 });
  const originals = project.rooms.slice(1);
  const nextA = [[0, 0], [4.656, 0], [4.656, 3.492], [0, 3.492]];
  const nextB = [[0, 0], [9.312, 0], [9.312, 3.492], [0, 3.492]];
  trace.onRoomsChange([
    { traceId: 'source-a', verts: nextA },
    { traceId: 'source-b', verts: nextB },
    { traceId: 'unknown-source', verts: [[0, 0], [1, 0], [1, 1]] },
  ]);
  assert.equal(project.rooms.length, 3, 'recalibration never appends duplicate rooms');
  assert.equal(project.rooms[0], existing, 'manual rooms outside this image are untouched');
  assert.deepEqual(project.rooms.slice(1).map(room => room.v), [nextA, nextB]);
  project.rooms.slice(1).forEach((room, i) => {
    assert.equal(room.id, originals[i].id);
    assert.equal(room.name, originals[i].name);
    assert.equal(room.canvas, originals[i].canvas, 'canvas choice and manual quantity overrides remain intact');
    assert.equal(room.main, originals[i].main);
    assert.equal(room.opts, originals[i].opts);
  });
  assert.equal(notices.length, 2, 'only adding a room shows the added-room notification');
});

test('calibration identities are scoped to the current imported image session', () => {
  const project = { id: 'project', rooms: [], status: 'estimate' };
  const { api, sessions } = traceBridge(project);
  const vertices = [[0, 0], [4, 0], [4, 3], [0, 3]];
  api.openTrace();
  sessions[0].onRoom({ traceId: 'same-local-id', name: 'Первый лист', verts: vertices, area: 12 });
  const first = project.rooms[0];
  api.openTrace();
  sessions[1].onRoom({ traceId: 'same-local-id', name: 'Другой лист', verts: vertices, area: 12 });
  const updated = [[0, 0], [8, 0], [8, 6], [0, 6]];
  sessions[1].onRoomsChange([{ traceId: 'same-local-id', verts: updated }]);
  assert.equal(project.rooms[0], first, 'a later image cannot rescale rooms from a prior import');
  assert.equal(project.rooms[1].v, updated);
  assert.equal(project.rooms.length, 2);
});
