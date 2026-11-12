import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOrthogonalPoint } from '../src/components/canvas/trace-orthogonal.js';

const close = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8));
const pointAt = (degrees, length = 200) => [Math.cos(degrees * Math.PI / 180) * length, Math.sin(degrees * Math.PI / 180) * length];

test('the first point stays exact and does not share the input array', () => {
  const point = [100.25, 100.75];
  assert.deepEqual(projectOrthogonalPoint([], point), point);
  assert.notEqual(projectOrthogonalPoint([], point), point);
});

test('the first side snaps near horizontal or vertical in all directions', () => {
  for (const angle of [0, 90, 180, 270]) {
    for (const deviation of [-10, -9, 0, 9, 10]) {
      const raw = pointAt(angle + deviation);
      const expected = angle % 180 === 0 ? [raw[0], 0] : [0, raw[1]];
      close(projectOrthogonalPoint([[0, 0]], raw), expected);
    }
  }
});

test('the first side stays free beyond the 10 degree threshold', () => {
  for (const angle of [10.001, 11, 45, 79, 100.001, 135, 191, 259, 315]) {
    const point = pointAt(angle);
    assert.deepEqual(projectOrthogonalPoint([[0, 0]], point), point);
  }
});

test('later sides snap only within 10 degrees of the previous perpendicular', () => {
  const points = [[0, 0], [200, 0]];
  for (const direction of [90, 270]) {
    for (const deviation of [-10, -9, 0, 9, 10]) {
      const offset = pointAt(direction + deviation), point = [200 + offset[0], offset[1]];
      close(projectOrthogonalPoint(points, point), [200, point[1]]);
    }
    for (const deviation of [-11, -10.001, 10.001, 11]) {
      const offset = pointAt(direction + deviation), point = [200 + offset[0], offset[1]];
      assert.deepEqual(projectOrthogonalPoint(points, point), point);
    }
  }
  assert.deepEqual(projectOrthogonalPoint(points, [400, 20]), [400, 20]);
  assert.deepEqual(points, [[0, 0], [200, 0]]);
});

test('a slanted previous side keeps its own perpendicular basis', () => {
  const points = [[0, 0], [100, 100]];
  const nearOffset = pointAt(135 + 9), near = [100 + nearOffset[0], 100 + nearOffset[1]];
  const projected = projectOrthogonalPoint(points, near);
  assert.ok(Math.abs(100 * (projected[0] - 100) + 100 * (projected[1] - 100)) < 1e-8);
  const farOffset = pointAt(135 + 11), far = [100 + farOffset[0], 100 + farOffset[1]];
  assert.deepEqual(projectOrthogonalPoint(points, far), far);
});

test('degenerate input does not trap the user at a duplicate vertex', () => {
  assert.deepEqual(projectOrthogonalPoint([[100, 100], [100, 100]], [140.5, 160.75]), [140.5, 160.75]);
  assert.deepEqual(projectOrthogonalPoint([[100, 100]], [100, 100]), [100, 100]);
});
