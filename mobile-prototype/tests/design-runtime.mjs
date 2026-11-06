import fs from 'node:fs';
import vm from 'node:vm';
import { roomDrawingPreview } from '../src/design-bridge/room-drawing-preview.js';

export function readTemplate() {
  const bundled = fs.readFileSync(fs.existsSync('public/design/app.html') ? 'public/design/app.html' : 'public/design/index.html', 'utf8');
  return JSON.parse(bundled.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
}

export async function runtime({ saved, storageError = false, mainDataPatch, viewport } = {}) {
  const entries = new Map(saved ? [['zamer.design.v1', saved]] : []);
  const localStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { if (storageError) throw new Error('storage unavailable'); entries.set(key, value); },
    removeItem: key => entries.delete(key),
  };
  class DCLogic {
    props = { platform:'ios', theme:'light', startScreen:'dash' };
    setState(change) {
      const next = typeof change === 'function' ? change(this.state, this.props) : change;
      this.state = { ...this.state, ...next };
      this.componentDidUpdate?.(this.props);
    }
    forceUpdate() { this.componentDidUpdate?.(this.props); }
  }
  const listeners = new Map(), visualListeners = new Map();
  const eventSurface = collection => ({
    addEventListener(type, listener) { if (!collection.has(type)) collection.set(type, new Set()); collection.get(type).add(listener); },
    removeEventListener(type, listener) { collection.get(type)?.delete(listener); },
  });
  const ctx = vm.createContext({
    DCLogic, console, localStorage, MagicDraw: { preview: roomDrawingPreview }, setTimeout:()=>1,clearTimeout:()=>{},
    requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},
    document:{querySelector:()=>null,addEventListener:()=>{},removeEventListener:()=>{},visibilityState:'visible'},
    ...eventSurface(listeners),
    ...(viewport ? { innerWidth: viewport.width, innerHeight: viewport.height } : {}),
    ...(viewport?.visualHeight == null ? {} : { visualViewport: { height: viewport.visualHeight, ...eventSurface(visualListeners) } }),
  });
  vm.runInContext('window=globalThis;', ctx);
  for (const file of ['main-data.js','quantity.js','storage.js','estimate.js']) {
    const filePath = 'public/design/' + file;
    if (fs.existsSync(filePath)) vm.runInContext(fs.readFileSync(filePath,'utf8'),ctx);
  }
  if (mainDataPatch) Object.assign(ctx.MAGIC_MAIN, typeof mainDataPatch === 'function' ? mainDataPatch(ctx.MAGIC_MAIN) : mainDataPatch);
  const template = readTemplate();
  const code = template.match(/<script\b(?=[^>]*\bdata-dc-script\b)[^>]*>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(code + '\n;globalThis.testAPI={Component,BLOCKS,PRESETS,NOM,ROOM_OPTS,geom,est,instLines,singleQty,shownQty,mk};',ctx);
  const emit = (collection, type) => [...(collection.get(type) || [])].forEach(listener => listener());
  const resize = (width, height) => {
    ctx.innerWidth = width; ctx.innerHeight = height;
    if (ctx.visualViewport) ctx.visualViewport.height = height;
    emit(listeners, 'resize');
  };
  const visualResize = height => { if (!ctx.visualViewport) throw new Error('A visual viewport requires viewport.visualHeight'); ctx.visualViewport.height = height; emit(visualListeners, 'resize'); };
  const listenerCount = (type, surface = 'window') => (surface === 'visual' ? visualListeners : listeners).get(type)?.size || 0;
  return { ...ctx.testAPI, ctx, entries, component: new ctx.testAPI.Component(), resize, visualResize, listenerCount };
}
