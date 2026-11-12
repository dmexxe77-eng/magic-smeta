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

test('thin rooms retain their full captions with proportionally smaller text and spacing', () => {
  const points = [[0, 0], [30, 0], [30, 250], [0, 250]];
  const layout = layoutRoomLabel(points, 'Коридор', '3 м²', measure);
  assert.ok(layout);
  assert.equal(layout.lines.join(' '), 'Коридор');
  assert.ok(layout.fontSize < 10);
  assert.equal(labelFitsRoom(points, layout, layout.margin), true);
  assert.ok(Math.abs(layout.haloWidth / layout.fontSize - 0.3) < 1e-10);
  assert.ok(Math.abs(layout.areaGap / layout.fontSize - 0.3) < 1e-10);
});

test('zooming out keeps captions inside a concave room and zooming back restores normal type', () => {
  const points = [[0, 0], [50, 0], [50, 130], [220, 130], [220, 180], [0, 180]];
  const before = structuredClone(points);
  const normal = layoutRoomLabel(points, 'Длинный коридор', '12,03 м²', measure);
  for (const zoom of [0.3, 0.1, 0.01]) {
    const scaled = points.map(point => point.map(value => value * zoom));
    const layout = layoutRoomLabel(scaled, 'Длинный коридор', '12,03 м²', measure);
    assert.ok(layout, `caption remains at zoom ${zoom}`);
    assert.ok(layout.fontSize < normal.fontSize);
    assert.equal(layout.lines.join(' '), 'Длинный коридор');
    assert.equal(labelFitsRoom(scaled, layout, layout.margin), true);
  }
  assert.deepEqual(layoutRoomLabel(points, 'Длинный коридор', '12,03 м²', measure), normal);
  assert.deepEqual(points, before);
});

test('an overview caption stays inside a thin room and avoids the visible wall dimension', () => {
  const points = [[0, 0], [160, 0], [160, 24], [0, 24]];
  const obstacle = { x: 80, y: 24, width: 30, height: 12.8 };
  const layout = layoutRoomLabel(points, 'Коридор', '38,39 м²', measure, [obstacle]);
  assert.ok(layout);
  assert.equal(layout.lines.join(' '), 'Коридор');
  assert.equal(labelFitsRoom(points, layout, layout.margin), true);
  assert.ok(Math.abs(layout.x - obstacle.x) >= (layout.width + obstacle.width) / 2 + layout.margin
    || Math.abs(layout.y - obstacle.y) >= (layout.height + obstacle.height) / 2 + layout.margin);
});
