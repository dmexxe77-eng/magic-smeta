import test from 'node:test';
import assert from 'node:assert/strict';
import { traceNodeScale } from '../src/components/canvas/tracing-appearance.js';

test('overview nodes shrink with screen geometry and recover when zoom returns', () => {
  const room = [[0, 0], [160, 0], [160, 120], [0, 120]];
  const before = structuredClone(room);
  const detail = traceNodeScale(room);
  const overview = traceNodeScale(room.map(([x, y]) => [x * 0.25, y * 0.25]));
  assert.equal(detail, 1);
  assert.ok(overview < detail && overview >= 0.45);
  assert.equal(traceNodeScale(room), detail);
  assert.deepEqual(room, before, 'appearance never alters room coordinates');
});

test('one tiny wall does not shrink every node in an otherwise large room', () => {
  assert.equal(traceNodeScale([[0, 0], [160, 0], [160, 1], [160, 160], [0, 160]]), 1);
});

test('the imaginary closing edge is ignored while a contour is still open', () => {
  const path = [[0, 0], [20, 0], [120, 0]];
  assert.ok(traceNodeScale(path, false) < traceNodeScale(path, true));
});

test('tiny overviews remain visible and initial single points retain a usable size', () => {
  const tiny = traceNodeScale([[0, 0], [1, 0], [1, 1], [0, 1]]);
  assert.ok(tiny >= 0.45 && tiny < 1);
  assert.equal(traceNodeScale([[0, 0]], false), 1);
  assert.equal(traceNodeScale([]), 1);
});
