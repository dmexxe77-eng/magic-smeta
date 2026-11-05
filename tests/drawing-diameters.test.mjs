import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawEditor as bridgeEditor } from '../src/design-bridge/drawEditor/editor.js';
import { createDrawEditor as mainEditor } from '../src/components/builders/drawEditor/editor.js';
import { ovalPoly, flatten } from '../src/design-bridge/drawEditor/geometry.js';

// A small DOM adapter exercises the real editor's input, build and save handlers.
class Element {
  innerHTML = '';
  textContent = '';
  children = [];
  dataset = {};
  listeners = new Map();
  attributes = new Map();
  style = { setProperty() {}, removeProperty() {} };
  classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
  clientWidth = 800;
  clientHeight = 600;
  scrollTop = 0;
  get firstChild() { return this.children[0]; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  addEventListener(type, fn) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), fn]);
  }
  dispatch(type, target) { for (const fn of this.listeners.get(type) || []) fn({ target }); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return true; }
}

function mount(t, createEditor, initial) {
  const previous = { document: globalThis.document, window: globalThis.window };
  globalThis.document = { createElementNS: () => new Element(), activeElement: null };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const root = new Element(), nodes = new Map();
  root.querySelector = selector => {
    const id = selector.slice(1);
    if (selector !== '.zoom' && ![root, ...nodes.values()].some(node => node.innerHTML.includes(`id="${id}"`))) return null;
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  let result;
  const editor = createEditor(root, { initial, canvasLook: 'classic', hideAppearance: true, onFinish: value => { result = value; } });
  t.after(() => {
    editor.destroy();
    for (const key of ['document', 'window']) {
      if (previous[key] === undefined) delete globalThis[key];
      else globalThis[key] = previous[key];
    }
  });
  const node = selector => root.querySelector(selector);
  const click = (act, data = {}) => {
    const target = { dataset: { act, ...data }, closest() { return this; } };
    node('#sheet').dispatch('click', target);
  };
  const fill = (key, value) => node('#sheet').dispatch('input', {
    dataset: { in: 'q', k: key }, value, matches: selector => selector === 'input.in',
  });
  const save = () => { click('finish'); return result; };
  return { click, fill, node, save };
}

function assertSize(result, width, height, area) {
  const xs = result.verts.map(p => p[0]), ys = result.verts.map(p => p[1]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - width) < .002);
  assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - height) < .002);
  assert.equal(result.area, area);
}

for (const [name, createEditor] of [['desktop/mobile', bridgeEditor], ['main', mainEditor]]) {
  test(`${name}: ellipse inputs are full diameters and editing keeps the same dimensions`, t => {
    const ui = mount(t, createEditor);
    ui.click('q-oval');
    ui.click('qmode', { v: 'ellipse' });
    ui.fill('rx', '287');
    ui.fill('ry', '212');
    assert.match(ui.node('#qnote').textContent, /Площадь 4[.,]78 м²/);
    assert.match(ui.node('#sheet').innerHTML, /Диаметр по ширине/);
    assert.match(ui.node('#sheet').innerHTML, /Диаметр по высоте/);
    ui.click('quickBuild');
    const first = ui.save();
    assertSize(first, 2.87, 2.12, 4.78);
    ui.click('editQuick');
    assert.match(ui.node('#sheet').innerHTML, /data-k="rx"[^>]*value="287"/);
    assert.match(ui.node('#sheet').innerHTML, /data-k="ry"[^>]*value="212"/);
    ui.click('quickBuild');
    assert.deepEqual(ui.save(), first);
  });

  test(`${name}: a circle accepts a diameter with a decimal comma`, t => {
    const ui = mount(t, createEditor);
    ui.click('q-oval');
    ui.fill('r', '287,5');
    ui.click('quickBuild');
    assertSize(ui.save(), 2.875, 2.875, 6.49);
    ui.click('editQuick');
    assert.match(ui.node('#sheet').innerHTML, /<span class="k">Диаметр<\/span>/);
    assert.match(ui.node('#sheet').innerHTML, /data-k="r"[^>]*value="287.5"/);
  });

  for (const mode of ['circle', 'ellipse']) {
    test(`${name}: reopening legacy ${mode} radii displays diameters without resizing the room`, t => {
      const base = ovalPoly(2.87, mode === 'circle' ? 2.87 : 2.12);
      const initial = {
        verts: flatten(base).map(p => [p.x, p.y]),
        draw: { base, ops: [], origin: { kind: 'oval', mode, f: { r: '287', rx: '287', ry: '212' } } },
      };
      const snapshot = JSON.stringify(initial);
      const ui = mount(t, createEditor, initial);
      const before = ui.save();
      ui.click('editQuick');
      assert.match(ui.node('#sheet').innerHTML, /value="574"/);
      if (mode === 'ellipse') assert.match(ui.node('#sheet').innerHTML, /value="424"/);
      ui.click('quickBuild');
      assert.deepEqual(ui.save(), before);
      assert.equal(JSON.stringify(initial), snapshot, 'opening and editing must not mutate the saved input');
    });
  }

  test(`${name}: empty, zero and negative diameters cannot build a circle`, t => {
    const ui = mount(t, createEditor);
    ui.click('q-oval');
    for (const value of ['', '0', '-287']) {
      ui.fill('r', value);
      assert.equal(ui.node('#qbuild').disabled, true);
      ui.click('quickBuild');
      assert.equal(ui.save(), undefined);
    }
  });
}
