import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { APPEARANCES, drawDimension, drawVertex } from '../src/design-bridge/drawEditor/canvas-appearance.js';

class SvgElement {
  constructor(tag) {
    this.tagName = tag;
    this.attributes = new Map();
    this.children = [];
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  appendChild(child) { this.children.push(child); return child; }
}

const originalDocument = globalThis.document;
before(() => { globalThis.document = { createElementNS: (_, tag) => new SvgElement(tag) }; });
after(() => {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
});

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

function assertFiniteSvg(group) {
  const numeric = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'width', 'height', 'font-size', 'stroke-width']);
  for (const element of descendants(group)) {
    for (const [name, value] of element.attributes) {
      assert.doesNotMatch(value, /NaN|Infinity/, `${element.tagName}.${name} must be finite`);
      if (numeric.has(name)) assert.ok(Number.isFinite(Number(value)), `${element.tagName}.${name} must be a finite number`);
    }
  }
}

function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} vs ${expected}`);
}

function visualLabel(group) {
  const dimension = descendants(group).find(element => element.getAttribute('class') === 'appearance-dimension');
  const background = descendants(dimension).find(element => element.getAttribute('class') === 'appearance-dimension-background');
  assert.ok(background, 'dimension has a visible label background');
  const text = descendants(dimension).find(element => element.getAttribute('class') === 'appearance-label');
  const x = Number(background.getAttribute('x')), y = Number(background.getAttribute('y'));
  const width = Number(background.getAttribute('width')), height = Number(background.getAttribute('height'));
  const rotation = dimension.getAttribute('transform')?.match(/^rotate\(([^ ]+) ([^ ]+) ([^)]+)\)$/);
  const angle = rotation ? Number(rotation[1]) : 0;
  const pivot = rotation ? { x: Number(rotation[2]), y: Number(rotation[3]) } : { x: 0, y: 0 };
  const radians = angle * Math.PI / 180;
  const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([cx, cy]) => ({
    x: pivot.x + (cx - pivot.x) * Math.cos(radians) - (cy - pivot.y) * Math.sin(radians),
    y: pivot.y + (cx - pivot.x) * Math.sin(radians) + (cy - pivot.y) * Math.cos(radians),
  }));
  const left = Math.min(...corners.map(point => point.x)), right = Math.max(...corners.map(point => point.x));
  const top = Math.min(...corners.map(point => point.y)), bottom = Math.max(...corners.map(point => point.y));
  return { background, text, angle, left, right, top, bottom, width: right - left, height: bottom - top };
}

function assertHitMatchesLabel(hit, visual) {
  assertNear(hit.center.x, (visual.left + visual.right) / 2, 'hit center follows the visible label');
  assertNear(hit.center.y, (visual.top + visual.bottom) / 2, 'hit center follows the visible label');
  assertNear(hit.width, visual.width, 'hit width contains the rotated label');
  assertNear(hit.height, visual.height, 'hit height contains the rotated label');
}

function assertInsideCanvas(visual, viewport) {
  assert.ok(visual.left >= -1e-7 && visual.top >= -1e-7, 'label is inside the top and left canvas edges');
  assert.ok(visual.right <= viewport.width + 1e-7 && visual.bottom <= viewport.height + 1e-7, 'label is inside the right and bottom canvas edges');
}

const bounds = { width: 360, height: 190, top: 52, bottom: 12 };
const edges = {
  right: { a: { x: 325.8, y: 55 }, b: { x: 325.8, y: 150 }, normal: { x: 1, y: 0 } },
  left: { a: { x: 8, y: 55 }, b: { x: 8, y: 150 }, normal: { x: -1, y: 0 } },
  bottom: { a: { x: 70, y: 181 }, b: { x: 290, y: 181 }, normal: { x: 0, y: 1 } },
};

for (const look of Object.keys(APPEARANCES)) {
  for (const [edge, geometry] of Object.entries(edges)) {
    test(`${look}: dimension beside the ${edge} edge stays visible on a 360×190 canvas`, () => {
      const group = new SvgElement('g');
      const hit = drawDimension({ group, ...geometry, label: '200', look, bounds });
      const visual = visualLabel(group);
      assertInsideCanvas(visual, bounds);
      assertHitMatchesLabel(hit, visual);
      assertFiniteSvg(group);
    });
  }

  test(`${look}: diagonal wall near the bottom-left corner keeps its label on the canvas`, () => {
    const group = new SvgElement('g');
    const cornerBounds = { width: 360, height: 190, top: 54, bottom: 32 };
    const hit = drawDimension({
      group, a: { x: -25, y: 215 }, b: { x: 45, y: 145 },
      normal: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
      label: '200', look, bounds: cornerBounds,
    });
    const visual = visualLabel(group);
    assertInsideCanvas(visual, cornerBounds);
    assertHitMatchesLabel(hit, visual);
    assertFiniteSvg(group);
  });

  for (const length of [0, 20]) {
    test(`${look}: ${length}px segment produces finite SVG and label hit bounds`, () => {
      const group = new SvgElement('g');
      const hit = drawDimension({
        group, a: { x: 180, y: 100 }, b: { x: 180 + length, y: 100 },
        normal: { x: 0, y: -1 }, label: '12', look, scale: .6, bounds,
      });
      for (const value of [hit.center.x, hit.center.y, hit.width, hit.height]) assert.ok(Number.isFinite(value));
      assert.ok(hit.width > 0 && hit.height > 0);
      assertFiniteSvg(group);
    });
  }

  test(`${look}: dimension and vertex decoration do not intercept editor pointer targets`, () => {
    const group = new SvgElement('g');
    drawDimension({ group, ...edges.right, label: '200', look, bounds, active: true });
    drawVertex({ group, point: { x: 180, y: 100 }, outward: { x: 0, y: -1 }, label: 'А', look });
    drawVertex({ group, point: { x: 200, y: 100 }, outward: { x: 1, y: 0 }, label: 'Б', look, fillet: true, picked: true });
    assert.equal(group.children.length, 3);
    for (const decoration of group.children) {
      assert.equal(decoration.getAttribute('pointer-events'), 'none');
      for (const element of descendants(decoration).slice(1)) {
        const pointerEvents = element.getAttribute('pointer-events');
        assert.ok(pointerEvents === undefined || pointerEvents === 'none', 'decoration inherits disabled pointer events');
        assert.equal(element.getAttribute('data-hit'), undefined, 'decorative SVG creates no editor hit target');
      }
    }
    assertFiniteSvg(group);
  });
}

for (const [name, a, b] of [
  ['horizontal', { x: 50, y: 90 }, { x: 290, y: 90 }],
  ['vertical', { x: 180, y: 40 }, { x: 180, y: 160 }],
  ['downward diagonal', { x: 50, y: 50 }, { x: 250, y: 150 }],
  ['upward diagonal', { x: 50, y: 150 }, { x: 250, y: 50 }],
]) {
  for (const reverse of [false, true]) {
    test(`technical: ${name} label lies on its wall and stays readable${reverse ? ' when reversed' : ''}`, () => {
      const group = new SvgElement('g');
      const hit = drawDimension({
        group, a: reverse ? b : a, b: reverse ? a : b,
        normal: { x: 0, y: -1 }, label: '420', look: 'technical',
      });
      const visual = visualLabel(group);
      assertNear(hit.center.x, (a.x + b.x) / 2, 'label starts at the wall midpoint');
      assertNear(hit.center.y, (a.y + b.y) / 2, 'label starts at the wall midpoint');
      const baseline = { x: Math.cos(visual.angle * Math.PI / 180), y: Math.sin(visual.angle * Math.PI / 180) };
      assertNear(baseline.x * (b.y - a.y) - baseline.y * (b.x - a.x), 0, 'text baseline follows the side');
      assert.ok(visual.angle >= -90 && visual.angle < 90, 'text never faces upside down');
      if (name === 'vertical') assert.equal(visual.angle, -90, 'vertical dimensions read bottom to top');
      if (name === 'horizontal') assertNear(visual.angle, 0, 'horizontal dimensions read left to right');
      assert.equal(descendants(group).filter(element => element.tagName === 'line' || element.tagName === 'path').length, 0, 'no external dimension lines or ticks');
      assert.equal(Number(visual.background.getAttribute('height')), 16, 'compact background breaks the wall under the text');
      assertHitMatchesLabel(hit, visual);
      assertFiniteSvg(group);
    });
  }
}

test('technical: a label slides along its actual segment to stay visible near a corner', () => {
  const a = { x: -25, y: 215 }, b = { x: 45, y: 145 };
  const group = new SvgElement('g');
  const hit = drawDimension({ group, a, b, normal: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, label: '200', look: 'technical', bounds });
  assertNear((hit.center.x - a.x) * (b.y - a.y) - (hit.center.y - a.y) * (b.x - a.x), 0, 'bounded label stays on the real side');
  assert.ok(hit.center.x >= a.x && hit.center.x <= b.x && hit.center.y >= b.y && hit.center.y <= a.y, 'bounded label does not extend the segment');
  assertInsideCanvas(visualLabel(group), bounds);
});

test('technical: arc anchor and tangent are respected even near reserved canvas space', () => {
  const group = new SvgElement('g');
  const anchor = { center: { x: 92, y: 42 }, tangent: { x: 1, y: -1 } };
  const hit = drawDimension({
    group, a: { x: 60, y: 120 }, b: { x: 280, y: 120 }, normal: { x: 0, y: -1 },
    anchor, label: '200', look: 'technical', bounds: { width: 360, height: 190, top: 70, bottom: 32 },
  });
  const visual = visualLabel(group);
  assert.deepEqual(hit.center, anchor.center, 'label stays on the supplied point of the curve');
  assert.equal(visual.angle, -45, 'text uses the curve tangent instead of its chord');
  assertHitMatchesLabel(hit, visual);
  assertFiniteSvg(group);
});

test('technical: selected and automatic dimensions retain their colors on an unframed paper background', () => {
  for (const [state, expected] of [[{ active: true }, 'var(--laser)'], [{ automatic: true }, 'var(--ink3)']]) {
    const group = new SvgElement('g');
    drawDimension({ group, a: { x: 50, y: 90 }, b: { x: 290, y: 90 }, normal: { x: 0, y: -1 }, label: '200', look: 'technical', ...state });
    const visual = visualLabel(group);
    assert.equal(visual.text.getAttribute('fill'), expected);
    assert.equal(visual.background.getAttribute('fill'), 'var(--paper)');
    assert.equal(visual.background.getAttribute('stroke'), undefined);
    if (state.automatic) assert.equal(visual.text.getAttribute('font-style'), 'italic');
  }
});
