import test from 'node:test';
import assert from 'node:assert/strict';
import { measureTracePoints, recalibrateTraceRooms } from '../src/components/canvas/trace-measurements.js';

const square = [[100, 100], [300, 100], [300, 300], [100, 300]];

test('fractional centimetres survive measurement and saved slanted geometry', () => {
  const points = [[100, 150], [200, 350], [400, 250], [300, 50]];
  const measured = measureTracePoints(points, 4.656 / Math.hypot(100, 200));
  assert.ok(Math.abs(measured.lengths[0] - 4.656) < 1e-12);
  const stored = JSON.parse(JSON.stringify(measured.verts));
  assert.ok(Math.abs(Math.hypot(stored[1][0] - stored[0][0], stored[1][1] - stored[0][1]) - 4.656) < 1e-12);
});

test('sheet recalibration updates all traced dimensions and derived quantities, retaining identity and source points', () => {
  const rooms = [
    { id: 'one', name: 'Первая', imgPts: square, v: [], canvas: { btnId: 'film', qty: 25 }, mainProf: { btnId: 'profile', qty: 20, oq: { angles: 4 } } },
    { id: 'two', imgPts: square.map(([x, y]) => [x + 400, y]), v: [] },
    { id: 'manual', v: [[0, 0], [3, 0], [3, 3], [0, 3]] },
  ];
  const before = structuredClone(rooms);
  const scaled = recalibrateTraceRooms(rooms, 0.03);
  assert.deepEqual(scaled.slice(0, 2).map(room => [room.aO, room.pO]), [[36, 24], [36, 24]]);
  assert.equal(scaled[0].id, 'one');
  assert.equal(scaled[0].name, 'Первая');
  assert.equal(scaled[0].canvas.btnId, 'film');
  assert.equal(scaled[0].canvas.qty, 36);
  assert.equal(scaled[0].mainProf.qty, 24);
  assert.deepEqual(scaled[0].mainProf.oq, { angles: 4 });
  assert.equal(scaled[2], rooms[2]);
  assert.deepEqual(rooms, before);
  assert.deepEqual(recalibrateTraceRooms(scaled, 0.025)[0].v, [[0, 0], [5, 0], [5, 5], [0, 5]], 'repeat calibration always uses original image coordinates');
});

test('invalid calibration cannot corrupt existing rooms', () => {
  const room = { id: 'one', imgPts: square, v: [[0, 0], [5, 0], [5, 5], [0, 5]] };
  for (const scale of [0, -1, NaN, Infinity]) assert.equal(recalibrateTraceRooms([room], scale)[0], room);
});
