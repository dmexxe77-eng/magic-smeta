import assert from 'node:assert/strict';
import test from 'node:test';
import * as bridge from '../src/design-bridge/drawEditor/geometry.js';
import * as main from '../src/components/builders/drawEditor/geometry.js';

const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);

function assertContour(geometry, poly, expectedVertices) {
  const points = geometry.ptsOf(poly);
  assert.equal(points.length, expectedVertices);
  for (let i = 0; i < points.length; i++) {
    const previous = points[(i - 1 + points.length) % points.length];
    const current = points[i], next = points[(i + 1) % points.length];
    assert.ok(Number.isFinite(current.x) && Number.isFinite(current.y), 'finite vertex');
    assert.ok(geometry.hyp(current, next) > 1e-8, 'no zero-length edge');
    const before = geometry.sub(current, previous), after = geometry.sub(next, current);
    assert.ok(Math.abs(geometry.cross(before, after)) > 1e-8 || geometry.dot(before, after) > 0, 'no backtracking edge');
    for (let j = i + 2; j < points.length; j++) {
      if ((j + 1) % points.length === i) continue;
      assert.equal(geometry.segX(current, next, points[j], points[(j + 1) % points.length]), false, 'no crossing edges');
    }
  }
}

for (const [name, geometry] of [['desktop/mobile', bridge], ['main', main]]) {
  test(`${name}: a bump touching either corner has one shoulder on every wall and winding`, () => {
    for (const reverse of [false, true]) for (const side of [0, 1, 2, 3]) {
      const room = geometry.rectPoly(4, 3);
      if (reverse) room.v.reverse();
      const before = JSON.stringify(room), length = geometry.sideLen(room, side);
      for (const from of ['start', 'end']) for (const offset of [0, length - 1]) for (const direction of ['in', 'niche']) {
        const result = geometry.opBump(room, side, from, offset, 1, .5, direction);
        assertContour(geometry, result, 6);
        near(geometry.polyStats(result).area, direction === 'in' ? 11.5 : 12.5, `${side}/${from}/${offset}/${direction}`);
        near(geometry.polyStats(result).perim, direction === 'in' ? 14 : 15, 'single shoulder perimeter');
      }
      assert.equal(JSON.stringify(room), before, 'source contour is unchanged');
    }
  });

  test(`${name}: a full-wall bump is a parallel wall shift without extra corners`, () => {
    for (const side of [0, 1, 2, 3]) for (const from of ['start', 'end']) for (const direction of ['in', 'niche']) {
      const room = geometry.rectPoly(4, 3), length = geometry.sideLen(room, side);
      const result = geometry.opBump(room, side, from, 0, length, .5, direction);
      assertContour(geometry, result, 4);
      assert.deepEqual(result, geometry.opShift(room, side, direction === 'niche' ? .5 : -.5));
    }
  });

  test(`${name}: corner joins stay on a sloping neighboring wall`, () => {
    const room = { v: [[0, 0], [4, 0], [4, 3], [1, 3]].map(([x, y]) => ({ x, y, arc: null, fillet: null })) };
    for (const direction of ['in', 'niche']) {
      const result = geometry.opBump(room, 0, 'start', 0, 1, .5, direction);
      assertContour(geometry, result, 6);
      const sign = direction === 'niche' ? -1 : 1;
      near(result.v[0].x, sign / 6);
      near(result.v[0].y, sign / 2);
      near(geometry.polyStats(result).area, 10.5 - sign * .5 + 1 / 24);
    }
  });

  test(`${name}: positive offsets retain two shoulders, including offsets below four millimeters`, () => {
    const room = geometry.rectPoly(4, 3);
    for (const offset of [.002, .5]) for (const direction of ['in', 'niche']) {
      const result = geometry.opBump(room, 0, 'start', offset, 1, .5, direction);
      assertContour(geometry, result, 8);
      near(geometry.polyStats(result).area, direction === 'in' ? 11.5 : 12.5);
      near(geometry.polyStats(result).perim, 15);
    }
  });

  test(`${name}: invalid dimensions and a corner shift collapsing the neighboring wall are rejected`, () => {
    const room = geometry.rectPoly(4, 3);
    for (const [offset, width, depth] of [[-.1, 1, .5], [3.5, 1, .5], [0, 0, .5], [0, 1, 0], [NaN, 1, .5], [0, 1, Infinity]]) {
      assert.throws(() => geometry.opBump(room, 0, 'start', offset, width, depth, 'in'));
    }
    assert.throws(() => geometry.opBump(room, 0, 'start', 0, 1, 3, 'in'));
  });

  test(`${name}: legacy topology keeps saved indices for later wall operations`, () => {
    const room = geometry.rectPoly(4, 3);
    for (const [offset, expectedArea] of [[3, 12.3], [.002, 12.2995]]) {
      const bumped = geometry.opBump(room, 0, 'start', offset, 1, .5, 'in', 1);
      assert.equal(bumped.v.length, 7, 'saved histories expect seven vertices');
      const shifted = geometry.opShift(bumped, 5, .2);
      near(geometry.polyStats(shifted).area, expectedArea);
      near(shifted.v[5].y, 3.2, 'saved wall 5 remains the bottom wall');
      near(shifted.v[6].y, 3.2);
    }
  });

  test(`${name}: legacy topology retains original corner indices for a full-wall bump`, () => {
    const result = geometry.opBump(geometry.rectPoly(4, 3), 0, 'start', 0, 4, .5, 'in', 1);
    assert.equal(result.v.length, 6);
    assert.deepEqual(result.v.map(({ x, y }) => [x, y]), [[0, 0], [0, .5], [4, .5], [4, 0], [4, 3], [0, 3]]);
  });
}

test('desktop/mobile: a corner bump on a cutout preserves a valid cutout and room area', () => {
  const room = bridge.rectPoly(10, 10);
  room.holes = [{ v: bridge.rectPoly(2, 2).v.map(point => ({ ...point, x: point.x + 3, y: point.y + 3 })) }];
  const result = bridge.withHole(room, 0, hole => bridge.opBump(hole, 0, 'start', 0, .5, .25, 'niche'));
  assertContour(bridge, result.holes[0], 6);
  near(bridge.polyStats(result).area, 95.875);
  assert.doesNotThrow(() => bridge.checkHoles(result));
});
