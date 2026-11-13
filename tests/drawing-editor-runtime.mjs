// A small DOM adapter exercises the real editor's input, build and save handlers.
class Element {
  innerHTML = '';
  textContent = '';
  children = [];
  dataset = {};
  listeners = new Map();
  attributes = new Map();
  style = { setProperty() {}, removeProperty() {} };
  classes = new Set();
  classList = {
    toggle: (name, force) => { const on = force ?? !this.classes.has(name); if (on) this.classes.add(name); else this.classes.delete(name); return on; },
    add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name),
  };
  clientWidth = 800;
  clientHeight = 600;
  scrollTop = 0;
  get value() { return this.inputValue ?? ''; }
  set value(value) { this.inputValue = String(value ?? ''); }
  get id() { return this.attributes.get('id') || ''; }
  set id(value) { this.attributes.set('id', String(value)); }
  get open() { return this.attributes.has('open'); }
  set open(value) { if (value) this.attributes.set('open', ''); else this.attributes.delete('open'); }
  get firstChild() { return this.children[0]; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  addEventListener(type, fn, options = false) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), { fn, capture: options === true || !!options.capture }]);
  }
  dispatch(type, target, event = {}) {
    let stopped = false;
    const dispatched = { target, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {},
      stopImmediatePropagation() { stopped = true; }, ...event };
    const listeners = [...(this.listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture));
    for (const { fn } of listeners) { fn(dispatched); if (stopped) break; }
    return dispatched;
  }
  getBoundingClientRect() { return { left: 0, top: 0 }; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    if (selector.startsWith('details')) {
      if (this.detailsHTML !== this.innerHTML) {
        this.detailsHTML = this.innerHTML;
        this.details = [...this.innerHTML.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)].map(([, source, body]) => {
          const detail = new Element();
          detail.tagName = 'DETAILS';
          detail.owner = this;
          detail.innerHTML = body;
          for (const [, key, value] of source.matchAll(/([\w-]+)="([^"]*)"/g)) detail.attributes.set(key, value);
          detail.open = /(?:^|\s)open(?:\s|=|$)/.test(source);
          return detail;
        });
      }
      return this.details.filter(detail => [...selector.matchAll(/\[([\w-]+)="([^"]*)"\]/g)].every(([, key, value]) => detail.getAttribute(key) === value));
    }
    if (!selector.startsWith('input')) return [];
    if (this.inputHTML !== this.innerHTML) {
      this.inputHTML = this.innerHTML;
      this.inputs = [...this.innerHTML.matchAll(/<input\b([^>]*)>/g)].map(([, source]) => {
        const input = new Element();
        input.tagName = 'INPUT';
        input.owner = this;
        input.row = new Element();
        input.row.classes.add('row');
        for (const [, key, value] of source.matchAll(/([\w-]+)="([^"]*)"/g)) {
          input.attributes.set(key, value);
          if (key.startsWith('data-')) input.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
          if (key === 'class') value.split(/\s+/).forEach(name => input.classes.add(name));
          if (key === 'value') input.value = value;
        }
        return input;
      });
    }
    return this.inputs.filter(input => input.matches(selector));
  }
  matches(selector) {
    if (!selector.startsWith('input') || this.tagName !== 'INPUT') return false;
    const className = selector.match(/^input\.([\w-]+)/)?.[1];
    if (className && !this.classes.has(className)) return false;
    return [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([, key, value]) => this.attributes.has(key) && (value === undefined || this.attributes.get(key) === value));
  }
  closest(selector) { return selector === '.row' ? this.row || null : null; }
  focus() {
    const previous = globalThis.document.activeElement;
    if (previous === this) return;
    globalThis.document.activeElement = this;
    if (previous?.owner) previous.owner.dispatch('focusout', previous);
    this.owner?.dispatch('focusin', this);
  }
  blur() {
    if (globalThis.document.activeElement !== this) return;
    globalThis.document.activeElement = null;
    this.owner?.dispatch('focusout', this);
  }
  select() {}
  scrollIntoView() {}
  contains() { return true; }
}

export function mount(t, createEditor, initial, options = {}) {
  const { manualRAF = false, canvasBounds, ...editorOptions } = options;
  const previous = { document: globalThis.document, window: globalThis.window, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, setTimeout: globalThis.setTimeout };
  const timers = new Set();
  const frames = new Map();
  let frameId = 0, frameTime = 0;
  globalThis.setTimeout = (fn, delay, ...args) => { const timer = previous.setTimeout(fn, delay, ...args); timers.add(timer); return timer; };
  globalThis.document = { createElementNS: () => new Element(), activeElement: null };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = manualRAF ? fn => { const id = ++frameId; frames.set(id, fn); return id; } : fn => fn();
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const root = new Element(), nodes = new Map();
  root.querySelector = selector => {
    const id = selector.slice(1);
    if (selector.startsWith('#')) {
      for (const candidate of nodes.values()) {
        for (const tag of ['input', 'details']) {
          const element = Element.prototype.querySelector.call(candidate, `${tag}[id="${id}"]`);
          if (element) return element;
        }
      }
    }
    if (selector !== '.zoom' && ![root, ...nodes.values()].some(node => node.innerHTML.includes(`id="${id}"`))) return null;
    if (!nodes.has(selector)) {
      const element = new Element();
      if (selector === '#cv' && canvasBounds) {
        element.clientWidth = canvasBounds.width;
        element.clientHeight = canvasBounds.height;
      }
      nodes.set(selector, element);
    }
    return nodes.get(selector);
  };
  let result, finishCalls = 0;
  const editor = createEditor(root, { initial, canvasLook: 'classic', hideAppearance: true, ...editorOptions, onFinish: value => { result = value; finishCalls++; } });
  let destroyed = false;
  const destroy = () => { if (destroyed) return; destroyed = true; editor.destroy(); };
  t.after(() => {
    destroy();
    frames.clear();
    for (const timer of timers) clearTimeout(timer);
    for (const key of ['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout']) {
      if (previous[key] === undefined) delete globalThis[key];
      else globalThis[key] = previous[key];
    }
  });
  const node = selector => root.querySelector(selector);
  const dispatchAction = (selector, act, data = {}) => {
    const target = { dataset: { act, ...data }, closest() { return this; } };
    const container = node(selector);
    if (!container) throw new Error(`Missing editor action container: ${selector}`);
    container.dispatch('click', target, { detail: 0 });
  };
  const click = (act, data = {}) => dispatchAction('#sheet', act, data);
  const chooseTool = (act, data = {}) => dispatchAction('#measureTools', act, data);
  const input = (key, value, kind) => ({
    dataset: { in: kind, k: String(key), i: String(key) }, value,
    matches: selector => selector === 'input.in',
    blur() { globalThis.document.activeElement = null; },
  });
  const field = (key, kind) => node('#sheet').querySelector(`input[data-in="${kind}"][data-${kind === 'side' || kind === 'ang' ? 'i' : 'k'}="${key}"]`);
  const fill = (key, value, kind = 'q') => {
    const target = field(key, kind) || input(key, value, kind);
    target.value = value;
    node('#sheet').dispatch('input', target);
  };
  const enter = (key, kind) => node('#sheet').dispatch('keydown', field(key, kind) || input(key, '', kind), { key: 'Enter' });
  const focus = (key, kind = 'side') => { const target = field(key, kind); if (!target) throw new Error(`Missing rendered ${kind} input ${key}`); target.focus(); };
  const activeInput = () => { const target = globalThis.document.activeElement; return target ? { kind: target.dataset.in, key: target.dataset.i ?? target.dataset.k, value: target.value } : null; };
  const save = () => { result = undefined; click('finish'); return result; };
  const tap = (type, index, x = 100, y = 100, hole) => {
    const target = { dataset: { hit: type, i: String(index), ...(hole == null ? {} : { h: String(hole) }) }, closest() { return type ? this : null; } };
    const event = { clientX: x, clientY: y, pointerId: 1 };
    node('#cv').dispatch('pointerdown', target, event);
    node('#cv').dispatch('pointerup', target, event);
  };
  const selectSide = (index = 0, hole) => tap('s', index, 100, 100, hole);
  const selectVertex = (index = 0, hole) => tap('v', index, 100, 100, hole);
  const selectDiagonal = (index = 0) => tap('d', index);
  const tapAngle = (index = 0) => tap('ang', index);
  const sketchPoint = (x, y) => tap(null, null, x, y);
  const history = direction => node(direction === 'redo' ? '#bRedo' : '#bUndo').dispatch('click', {});
  const resize = (width, height) => {
    const canvas = node('#cv');
    canvas.clientWidth = width;
    canvas.clientHeight = height;
    editor.resize();
  };
  const flushAnimationFrames = (ms = 16, steps = 1) => {
    if (!manualRAF) throw new Error('Deterministic animation frames require manualRAF: true');
    let calls = 0;
    for (let step = 0; step < steps; step++) {
      frameTime += ms;
      for (const [id, callback] of [...frames]) {
        if (!frames.delete(id)) continue;
        calls++;
        callback(frameTime);
      }
    }
    return calls;
  };
  return { click, clickContainer: dispatchAction, chooseTool, fill, enter, focus, activeInput, node, save, finishCount: () => finishCalls, selectSide, selectVertex, selectDiagonal, tapAngle, sketchPoint, history, resize, destroy, flushAnimationFrames, pendingAnimationFrames: () => frames.size };
}
