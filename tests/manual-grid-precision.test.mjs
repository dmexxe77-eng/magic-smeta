import assert from 'node:assert/strict';
import test from 'node:test';
import { makeModel, solveModel, hyp, interiorDeg, shoelace } from '../src/design-bridge/drawEditor/geometry.js';

const points = coordinates => coordinates.map(([x, y]) => ({ x, y }));
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `expected ${expected}, received ${actual}`);

test('a fully measured grid rectangle keeps decimal dimensions and right angles regardless of sketch proportions', () => {
  const prior = points([[78, 143.2578125], [312, 143.2578125], [312, 372.4703063964844], [78, 372.4703063964844]]);
  const model = makeModel(prior, 'grid');
  model.sides = [465.6, 300.4, null, null];
  solveModel(model);
  assert.equal(model.status.missing, 0);
  for (let i = 0; i < model.n; i++) {
    close(hyp(model.sol[i], model.sol[(i + 1) % model.n]), i % 2 ? 3.004 : 4.656, 1e-11);
    close(interiorDeg(model.sol, i, model.wind), 90);
  }
  close(Math.abs(shoelace(model.sol)), 4.656 * 3.004);
  assert.deepEqual(model.prior, prior);
  assert.deepEqual(model.sides, [465.6, 300.4, null, null]);
});

test('the same grid constraints preserve lengths when the sketch is rotated', () => {
  const angle = 0.37;
  const prior = points([[0, 0], [234, 0], [234, 229.2124938964844], [0, 229.2124938964844]])
    .map(({ x, y }) => ({ x: 100 + x * Math.cos(angle) - y * Math.sin(angle), y: 70 + x * Math.sin(angle) + y * Math.cos(angle) }));
  const model = makeModel(prior, 'grid');
  model.sides = [465.6, 300.4, null, null];
  solveModel(model);
  for (let i = 0; i < model.n; i++) {
    close(hyp(model.sol[i], model.sol[(i + 1) % model.n]), i % 2 ? 3.004 : 4.656);
    close(interiorDeg(model.sol, i, model.wind), 90);
  }
});

test('a determined concave grid contour also satisfies dimensions instead of following the rough shape', () => {
  const model = makeModel(points([[0, 0], [350, 0], [350, 120], [180, 120], [180, 300], [0, 300]]), 'grid');
  model.sides = [465.6, 123.4, 265.6, 177, 200, 300.4];
  solveModel(model);
  assert.equal(model.status.missing, 0);
  for (let i = 0; i < model.n; i++) {
    close(hyp(model.sol[i], model.sol[(i + 1) % model.n]), model.sides[i] / 100);
    close(interiorDeg(model.sol, i, model.wind), i === 3 ? 270 : 90);
  }
});

test('a determined free triangle honors measured sides without introducing inferred right angles', () => {
  const model = makeModel(points([[0, 0], [200, 0], [180, 150]]), 'free');
  model.sides = [465.6, 300.4, 500];
  solveModel(model);
  assert.equal(model.status.missing, 0);
  for (let i = 0; i < model.n; i++) close(hyp(model.sol[i], model.sol[(i + 1) % model.n]), model.sides[i] / 100);
  assert.ok(model.vert.every(vertex => vertex.kind === 'free'));
});

test('partial grid measurements remain underdetermined and retain the sketch as a shape guide', () => {
  const model = makeModel(points([[0, 0], [234, 0], [234, 229], [0, 229]]), 'grid');
  model.sides[0] = 465.6;
  solveModel(model);
  assert.equal(model.status.missing, 1);
  close(hyp(model.sol[1], model.sol[2]) / hyp(model.sol[0], model.sol[1]), 229 / 234);
});
