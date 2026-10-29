import fs from 'node:fs';
import vm from 'node:vm';

export function readTemplate() {
  const bundled = fs.readFileSync('public/design/index.html', 'utf8');
  return JSON.parse(bundled.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
}

export async function runtime({ saved, storageError = false, mainDataPatch } = {}) {
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
  const ctx = vm.createContext({
    DCLogic, console, localStorage, setTimeout:()=>1,clearTimeout:()=>{},
    requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},
    document:{querySelector:()=>null,addEventListener:()=>{},removeEventListener:()=>{},visibilityState:'visible'},
    addEventListener:()=>{},removeEventListener:()=>{},
  });
  vm.runInContext('window=globalThis;', ctx);
  for (const file of ['main-data.js','quantity.js','storage.js']) {
    const filePath = 'public/design/' + file;
    if (fs.existsSync(filePath)) vm.runInContext(fs.readFileSync(filePath,'utf8'),ctx);
  }
  if (mainDataPatch) Object.assign(ctx.MAGIC_MAIN, typeof mainDataPatch === 'function' ? mainDataPatch(ctx.MAGIC_MAIN) : mainDataPatch);
  const template = readTemplate();
  const code = template.match(/<script\b(?=[^>]*\bdata-dc-script\b)[^>]*>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(code + '\n;globalThis.testAPI={Component,BLOCKS,PRESETS,NOM,ROOM_OPTS,geom,est,instLines,singleQty,shownQty,mk};',ctx);
  return { ...ctx.testAPI, ctx, entries, component: new ctx.testAPI.Component() };
}
