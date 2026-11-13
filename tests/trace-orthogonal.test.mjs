import test from 'node:test';
import assert from 'node:assert/strict';
import { projectOrthogonalPoint } from '../src/components/canvas/trace-orthogonal.js';

const close = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8, `${actual} vs ${expected}`));

test('the first point stays exact and does not share the input array', () => {
  const point = [100.25, 100.75];
  assert.deepEqual(projectOrthogonalPoint([], point), point);
  assert.notEqual(projectOrthogonalPoint([], point), point);
});

test('initial horizontal and vertical alignment uses an inclusive 10 screen pixel tolerance', () => {
  for (const scale of [0.25, 1, 3]) {
    for (const sign of [-1, 1]) {
      for (const error of [9, 10]) {
        const delta = error / scale;
        close(projectOrthogonalPoint([[0, 0]], [sign * 200, delta], scale), [sign * 200, 0]);
        close(projectOrthogonalPoint([[0, 0]], [delta, sign * 200], scale), [0, sign * 200]);
      }
      for (const error of [10.001, 11]) {
        const raw = [sign * 200, error / scale];
        assert.deepEqual(projectOrthogonalPoint([[0, 0]], raw, scale), raw);
      }
    }
  }
});

test('short and long new sides get the same screen-distance tolerance at every zoom', () => {
  const points = [[0, 0], [200, 0]];
  for (const scale of [0.25, 1, 3]) {
    for (const length of [3, 200]) {
      close(projectOrthogonalPoint(points, [200 + 9 / scale, length], scale), [200, length]);
      close(projectOrthogonalPoint(points, [200 - 10 / scale, -length], scale), [200, -length]);
      const raw = [200 + 11 / scale, length];
      assert.deepEqual(projectOrthogonalPoint(points, raw, scale), raw);
    }
  }
  assert.deepEqual(points, [[0, 0], [200, 0]]);
});

test('a rotated previous side keeps its own perpendicular basis', () => {
  const s = Math.SQRT1_2;
  const points = [[0, 0], [100, 100]];
  const near = [100 - 3 * s + 9 * s, 100 + 3 * s + 9 * s];
  close(projectOrthogonalPoint(points, near), [100 - 3 * s, 100 + 3 * s]);
  const far = [100 - 3 * s + 11 * s, 100 + 3 * s + 11 * s];
  assert.deepEqual(projectOrthogonalPoint(points, far), far);
});

test('the fourth corner can align with A while preserving the previous right angle', () => {
  const points = [[100, 100], [300, 100], [300, 130]];
  const before = structuredClone(points);
  close(projectOrthogonalPoint(points, [106, 124]), [100, 130]);
  close(projectOrthogonalPoint([[100, 100], [100, 300], [130, 300]], [124, 106]), [130, 100]);
  assert.deepEqual(points, before, 'guides never move already placed vertices');
});

test('start guides also work in a rotated first-side basis', () => {
  const s = Math.SQRT1_2;
  const points = [[0, 0], [100 * s, 100 * s], [70 * s, 130 * s]];
  close(projectOrthogonalPoint(points, [-30 * s + 4, 30 * s - 2]), [-30 * s, 30 * s]);
});

test('joint start-guide alignment uses the same screen-distance limit', () => {
  for (const scale of [0.5, 1, 3]) {
    const points = [[100, 100], [300, 100], [300, 130]].map(p => p.map(value => value / scale));
    close(projectOrthogonalPoint(points, [106 / scale, 124 / scale], scale), [100 / scale, 130 / scale]);
    // Both guides are individually close, but the joint corner would move over 10px.
    close(projectOrthogonalPoint(points, [109 / scale, 121 / scale], scale), [109 / scale, 130 / scale]);
  }
});

test('outside a start guide the primary perpendicular remains in place', () => {
  close(projectOrthogonalPoint([[100, 100], [300, 100], [300, 130]], [112, 124]), [112, 130]);
});

test('a start guide alone can align an intentionally slanted side', () => {
  close(projectOrthogonalPoint([[0, 0], [100, 0], [100, 100]], [5, 29]), [0, 29]);
  const raw = [11, 29];
  assert.deepEqual(projectOrthogonalPoint([[0, 0], [100, 0], [100, 100]], raw), raw);
});

test('start guides are not offered before the fourth corner', () => {
  close(projectOrthogonalPoint([[100, 100], [300, 100]], [309, 106]), [300, 106]);
});

test('nearly parallel guides never cause a distant intersection jump', () => {
  const points = [[0, 0], [100, 0], [100.005, 5]], raw = [30, 5];
  const projected = projectOrthogonalPoint(points, raw);
  assert.ok(Math.hypot(projected[0] - raw[0], projected[1] - raw[1]) <= 10);
  assert.ok(projected[1] > 4, 'the current perpendicular takes priority over an incompatible guide');
});

test('no snap candidate collapses the new side to the last vertex', () => {
  assert.deepEqual(projectOrthogonalPoint([[0, 0], [200, 0]], [209, 0]), [209, 0]);
  assert.deepEqual(projectOrthogonalPoint([[100, 100], [100, 100]], [140.5, 160.75]), [140.5, 160.75]);
  assert.deepEqual(projectOrthogonalPoint([[100, 100]], [100, 100]), [100, 100]);
});

test('invalid scale leaves placement free instead of creating a snap jump', () => {
  for (const scale of [0, -1, Infinity, NaN]) {
    const point = [209, 100];
    assert.deepEqual(projectOrthogonalPoint([[0, 0], [200, 0]], point, scale), point);
  }
});

test('A guides use distance to the line even when A itself is far away', () => {
  for (const scale of [0.25, 1, 3]) {
    const points = [[0, 0], [100, 0], [100, 400]].map(p => p.map(value => value / scale));
    close(projectOrthogonalPoint(points, [5 / scale, 394 / scale], scale), [0, 400 / scale]);
    close(projectOrthogonalPoint(points, [8 / scale, 394 / scale], scale), [0, 400 / scale]);
    close(projectOrthogonalPoint(points, [11 / scale, 394 / scale], scale), [11 / scale, 400 / scale]);
  }
  close(projectOrthogonalPoint([[100, 100], [300, 100], [300, 300]], [106, 294]), [100, 300]);
});

test('A guides cannot pull a new side through an existing wall', () => {
  const points = [[0, 0], [100, 0], [100, 100], [20, 100], [20, 20], [60, 20], [60, 30]];
  const before = structuredClone(points);
  close(projectOrthogonalPoint(points, [5, 26]), [5, 30]);
  assert.deepEqual(points, before);
});

test('A guides cannot make the closing side cross an existing wall', () => {
  const points = [[0, 0], [100, 0], [100, 100], [-50, 100], [-50, 10], [50, 10], [50, 30]];
  close(projectOrthogonalPoint(points, [5, 26]), [5, 30]);
});

test('touching a foreign vertex is rejected as well as crossing a side', () => {
  const points = [[0, 0], [100, 0], [100, 100], [20, 100], [20, 30], [30, 40], [60, 40], [60, 30]];
  close(projectOrthogonalPoint(points, [5, 26]), [5, 30]);
});

test('A guides cannot retrace the first or last incident edge', () => {
  close(projectOrthogonalPoint([[0, 0], [100, 0], [100, 100], [30, 100]], [26, 5]), [30, 5]);
  assert.deepEqual(projectOrthogonalPoint([[0, 0], [20, 0], [20, 30]], [20, 5]), [20, 5]);
});
