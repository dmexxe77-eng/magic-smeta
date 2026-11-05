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
  dispatch(type, target, event = {}) { for (const fn of this.listeners.get(type) || []) fn({ target, preventDefault() {}, ...event }); }
  getBoundingClientRect() { return { left: 0, top: 0 }; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains() { return true; }
}

export function mount(t, createEditor, initial) {
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
  const dispatchAction = (selector, act, data = {}) => {
    const target = { dataset: { act, ...data }, closest() { return this; } };
    const container = node(selector);
    if (!container) throw new Error(`Missing editor action container: ${selector}`);
    container.dispatch('click', target);
  };
  const click = (act, data = {}) => dispatchAction('#sheet', act, data);
  const chooseTool = (act, data = {}) => dispatchAction('#measureTools', act, data);
  const input = (key, value, kind) => ({
    dataset: { in: kind, k: String(key), i: String(key) }, value,
    matches: selector => selector === 'input.in',
    blur() { globalThis.document.activeElement = null; },
  });
  const fill = (key, value, kind = 'q') => node('#sheet').dispatch('input', {
    ...input(key, value, kind),
  });
  const enter = (key, kind) => node('#sheet').dispatch('keydown', input(key, '', kind), { key: 'Enter' });
  const save = () => { click('finish'); return result; };
  const tap = (type, index, x = 100, y = 100) => {
    const target = { dataset: { hit: type, i: String(index) }, closest() { return type ? this : null; } };
    const event = { clientX: x, clientY: y, pointerId: 1 };
    node('#cv').dispatch('pointerdown', target, event);
    node('#cv').dispatch('pointerup', target, event);
  };
  const selectSide = (index = 0) => tap('s', index);
  const selectVertex = (index = 0) => tap('v', index);
  const selectDiagonal = (index = 0) => tap('d', index);
  const tapAngle = (index = 0) => tap('ang', index);
  const sketchPoint = (x, y) => tap(null, null, x, y);
  const history = direction => node(direction === 'redo' ? '#bRedo' : '#bUndo').dispatch('click', {});
  return { click, chooseTool, fill, enter, node, save, selectSide, selectVertex, selectDiagonal, tapAngle, sketchPoint, history };
}

