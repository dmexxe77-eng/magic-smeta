import assert from 'node:assert/strict';
import test from 'node:test';
import * as bridge from '../src/design-bridge/drawEditor/geometry.js';
import * as main from '../src/components/builders/drawEditor/geometry.js';

const polygon = points => ({ v: points.map(([x, y]) => ({ x, y, fillet: null, arc: null })) });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);

for (const [name, geometry] of [['bridge', bridge], ['main', main]]) {
  test(`${name}: a single fillet can use more than half the shorter wall`, () => {
    const base = geometry.rectPoly(4, 2.62);
    const rounded = geometry.opFillet(base, 0, 1.4);
    near(geometry.filletLimit(base, 0).maxRadius, 2.62);
    assert.equal(rounded.v[0].fillet, 1.4);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.equal(base.v[0].fillet, null);
  });

  test(`${name}: exact contact at the next corner is valid but exceeding it is rejected`, () => {
    const base = geometry.rectPoly(4, 2.62);
    const rounded = geometry.opFillet(base, 0, 2.62);
    near(geometry.filletInfo(rounded, 0).t, 2.62);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.ok(geometry.polyStats(rounded).area > 0);
    assert.throws(() => geometry.opFillet(base, 0, 2.63), /Максимальный радиус 262/);
  });

  test(`${name}: a 220 cm fillet reaches the neighbouring corner and 221 cm is rejected`, () => {
    const base = geometry.rectPoly(4, 2.2);
    const rounded = geometry.opFillet(base, 0, 2.2), info = geometry.filletInfo(rounded, 0);
    near(info.T1.x, base.v[3].x);
    near(info.T1.y, base.v[3].y);
    assert.equal(geometry.filletLimit(base, 0).maxRadiusCm, 220);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.throws(() => geometry.opFillet(base, 0, 2.21), /Максимальный радиус 220/);
  });

  test(`${name}: microscopic endpoint noise does not subtract a displayed centimetre or extend the arc`, () => {
    const height = 2.2 - 1e-8, base = geometry.rectPoly(4, height);
    const rounded = geometry.opFillet(base, 0, 2.2), info = geometry.filletInfo(rounded, 0);
    assert.equal(geometry.filletLimit(base, 0).maxRadiusCm, 220);
    near(rounded.v[0].fillet, height);
    assert.ok(info.t <= height + 1e-12, 'the accepted radius is clamped to the real endpoint');
    near(info.T1.y, base.v[3].y);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    const restored = structuredClone(base);
    restored.v[0].fillet = 2.2;
    assert.ok(geometry.filletInfo(restored, 0).t <= height + 1e-12, 'previewing saved numerical noise also stops at the corner');
    assert.deepEqual(geometry.checkFillets(restored), []);
    near(restored.v[0].fillet, height);
    assert.throws(() => geometry.opFillet(base, 0, 2.21), /Максимальный радиус 220/);
  });

  test(`${name}: a genuinely shorter fractional wall reports its fractional radius and rejects 220 cm`, () => {
    const base = geometry.rectPoly(4, 2.199);
    assert.equal(geometry.cm(geometry.sideLen(base, 3)), 220, 'the ordinary dimension label rounds to centimetres');
    assert.equal(geometry.filletLimit(base, 0).maxRadiusCm, 219.9);
    assert.throws(() => geometry.opFillet(base, 0, 2.2), /Максимальный радиус 219,9/);
    const rounded = geometry.opFillet(base, 0, 2.199);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.throws(() => geometry.opFillet(geometry.rectPoly(4, 2.2 - 1.01e-6), 0, 2.2), /Не помещается/, 'the numerical allowance remains below a measured wall discrepancy');
  });

  test(`${name}: numerical endpoint contact also respects acute angles and neighbouring fillets`, () => {
    const acute = polygon([[0, 0], [4, 0], [10, 6], [6, 6]]), limit = geometry.filletLimit(acute, 0);
    const rounded = geometry.opFillet(acute, 0, limit.maxRadius + .5e-6);
    near(rounded.v[0].fillet, limit.maxRadius);
    assert.ok(geometry.filletInfo(rounded, 0).t <= limit.availableT + 1e-12);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.throws(() => geometry.opFillet(acute, 0, limit.maxRadius + 1.01e-6), /Не помещается/);

    const neighbours = geometry.opFillet(geometry.rectPoly(4, 3), 3, .7);
    const joined = geometry.opFillet(neighbours, 0, 2.3 + 1e-8);
    near(joined.v[0].fillet, 2.3);
    assert.deepEqual(geometry.checkFillets(joined), []);
    assert.equal(joined.v[3].fillet, .7, 'the neighbouring radius is retained at the shared tangent');
  });

  test(`${name}: neighbouring fillets reserve only their actual tangent distances`, () => {
    let base = geometry.opFillet(geometry.rectPoly(4, 3), 1, 1);
    base = geometry.opFillet(base, 3, .7);
    near(geometry.filletLimit(base, 0).maxRadius, 2.3);
    const before = structuredClone(base), rounded = geometry.opFillet(base, 0, 2.3);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.equal(rounded.v[1].fillet, 1);
    assert.equal(rounded.v[3].fillet, .7);
    assert.throws(() => geometry.opFillet(base, 0, 2.31), /Максимальный радиус 230/);
    assert.deepEqual(base, before, 'an invalid new radius cannot discard another corner');
  });

  test(`${name}: non-right angles convert available wall length into radius`, () => {
    const base = polygon([[0, 0], [4, 0], [3, 3]]);
    const fi = geometry.filletInfo({ v: base.v.map((p, i) => ({ ...p, fillet: i === 0 ? 1 : null })) }, 0);
    const maximum = Math.min(fi.lp, fi.ln) * Math.tan(fi.phi / 2);
    near(geometry.filletLimit(base, 0).maxRadius, maximum);
    assert.equal(geometry.opFillet(base, 0, maximum / 4).v[0].fillet, maximum / 4);
    assert.throws(() => geometry.opFillet(base, 0, maximum + .01), /Максимальный радиус/);
  });

  test(`${name}: a reflex corner can use the full unoccupied neighbour distance`, () => {
    const base = polygon([[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]]);
    const rounded = geometry.opFillet(base, 3, 1.4);
    near(geometry.filletLimit(base, 3).maxRadius, 2);
    assert.deepEqual(geometry.checkFillets(rounded), []);
    assert.ok(geometry.polyStats(rounded).area > geometry.polyStats(base).area);
  });

  test(`${name}: a large fillet cannot cross a distant part of the room`, () => {
    const base = polygon([[0, 0], [4, 0], [4, 4], [3, 4], [3, 1], [1, 1], [1, 4], [0, 4]]);
    near(geometry.filletLimit(base, 0).maxRadius, 4);
    assert.throws(() => geometry.opFillet(base, 0, 3.9), /пересека|контур/);
    assert.equal(base.v[0].fillet, null);
  });

  test(`${name}: shortening a wall keeps a fitting fillet and drops only an oversized one`, () => {
    let rounded = geometry.opFillet(geometry.rectPoly(4, 3), 0, 1);
    rounded = geometry.opLength(rounded, 0, 'end', 1);
    assert.deepEqual(geometry.checkFillets(rounded), [], 'full wall length is available');
    rounded = geometry.opLength(rounded, 0, 'end', .8);
    assert.deepEqual(geometry.checkFillets(rounded), ['A']);
    assert.equal(rounded.v[0].fillet, null);
  });

  test(`${name}: a neighbouring curved wall still blocks corner rounding`, () => {
    const base = geometry.opArc(geometry.rectPoly(4, 3), 0, 'h', .5, 'out');
    assert.throws(() => geometry.opFillet(base, 0, 1), /Рядом дуга/);
  });

  test(`${name}: replay resolves overlapping neighbouring fillets deterministically`, () => {
    let rounded = geometry.opFillet(geometry.rectPoly(4, 3), 0, 1.4);
    rounded = geometry.opFillet(rounded, 1, 2);
    rounded = geometry.opLength(rounded, 0, 'end', 3);
    assert.deepEqual(geometry.checkFillets(rounded), ['A']);
    assert.equal(rounded.v[1].fillet, 2, 'a fitting neighbour can still use more than half the wall');
    assert.deepEqual(geometry.checkFillets(rounded), [], 'cleanup is stable when replayed again');
  });

  test(`${name}: a later wall shift clears a crossing fillet while preserving unrelated radii`, () => {
    const base = polygon([[0, 0], [10, 0], [10, 3], [3, 3], [3, 4], [10, 4], [10, 10], [0, 10]]);
    let rounded = geometry.opFillet(base, 0, 10);
    rounded = geometry.opFillet(rounded, 6, .2);
    const shifted = geometry.opShift(rounded, 3, -1);
    assert.throws(() => geometry.opFillet(shifted, 0, 10), /пересекает контур/);
    assert.deepEqual(geometry.checkFillets(shifted), ['A']);
    assert.equal(shifted.v[0].fillet, null);
    assert.equal(shifted.v[6].fillet, .2);
    assert.deepEqual(geometry.checkFillets(shifted), []);
  });
}

test('bridge: a larger outer fillet cannot leave an existing cutout outside the ceiling', () => {
  const base = bridge.rectPoly(4, 3);
  base.holes = [polygon([[.1, .1], [.4, .1], [.4, .4], [.1, .4]])];
  assert.throws(() => bridge.opFillet(base, 0, 2.5), /Вырез|вырез/);
  assert.equal(base.v[0].fillet, null);
});

test('bridge: a later edit clears only the outer fillet that clips an existing cutout', () => {
  const base = bridge.rectPoly(4, 3);
  base.holes = [polygon([[1.1, .1], [1.3, .1], [1.3, .3], [1.1, .3]])];
  const rounded = bridge.opFillet(base, 0, 1.4), shifted = bridge.opShift(rounded, 3, -.3);
  assert.throws(() => bridge.checkHoles(shifted), /Вырез/);
  assert.deepEqual(bridge.checkFillets(shifted), ['A']);
  assert.doesNotThrow(() => bridge.checkHoles(shifted));
  assert.equal(shifted.holes.length, 1);
});
