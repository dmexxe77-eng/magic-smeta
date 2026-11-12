import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutRoomLabel, labelFitsRoom, pointInRoom } from '../src/components/canvas/trace-room-label.js';

const measure = (text, size) => text.length * size * 0.6;

test('a readable room name is complete and its caption fits inside a rectangular room', () => {
  const points = [[0, 0], [200, 0], [200, 160], [0, 160]];
  const before = structuredClone(points);
  const layout = layoutRoomLabel(points, 'Спальня', '20 м²', measure);
  assert.ok(layout);
  assert.equal(layout.lines.join(' '), 'Спальня');
  assert.equal(labelFitsRoom(points, layout, 9), true);
  assert.deepEqual(points, before, 'caption layout never moves room vertices');
});

test('a long two-word name wraps instead of becoming an ellipsis', () => {
  const points = [[0, 0], [80, 0], [80, 180], [0, 180]];
  const layout = layoutRoomLabel(points, 'Мастер спальня', '18 м²', measure);
  assert.ok(layout);
  assert.ok(layout.lines.length > 1);
  assert.equal(layout.lines.join(' '), 'Мастер спальня');
  assert.equal(labelFitsRoom(points, layout, 9), true);
});

test('a narrow concave corridor gets a full label in its wide interior arm', () => {
  const points = [[0, 0], [50, 0], [50, 130], [220, 130], [220, 180], [0, 180]];
  const average = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
  assert.equal(pointInRoom(average, points), false, 'the fixture catches naive vertex-average placement');
  const layout = layoutRoomLabel(points, 'Коридор', '12 м²', measure);
  assert.ok(layout);
  assert.equal(layout.lines.join(' '), 'Коридор');
  assert.equal(labelFitsRoom(points, layout, 9), true);
  assert.ok(layout.y > 130, 'full text belongs in the corridor arm with sufficient width');
});

test('a caption cannot bridge a concave notch even when all its corners are inside the room', () => {
  const points = [[0, 0], [200, 0], [200, 200], [140, 200], [140, 60], [60, 60], [60, 200], [0, 200]];
  for (const point of [[20, 80], [180, 80], [180, 120], [20, 120]]) assert.equal(pointInRoom(point, points), true);
  assert.equal(labelFitsRoom(points, { x: 100, y: 100, width: 160, height: 40 }), false);
});

test('unreadably thin rooms defer captions rather than clipping or shortening their names', () => {
  assert.equal(layoutRoomLabel([[0, 0], [30, 0], [30, 250], [0, 250]], 'Коридор', '3 м²', measure), null);
});
