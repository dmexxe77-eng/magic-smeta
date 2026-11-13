import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DCLogic} from '../src/desktop/engine-base.js';
import {createDesignStorage} from '../src/design-bridge/design-storage.js';

const snapshot = () => ({version:1, blocks:[{id:'canvas',title:'Полотно'},{id:'main',title:'Профиль'}],
  presets:{canvas:[],main:[{id:'main_1',name:'Исходный пресет',items:[]}]},nom:[],roomOpts:[],projects:[],estEd:{}});

test('save status remains visible without scheduling more autosaves and clears after retry', async () => {
  const app = new DCLogic();
  let notifications = 0, lifecycleUpdates = 0;
  app.subscribe(()=>notifications++);
  app.componentDidUpdate = () => lifecycleUpdates++;
  app.mount();
  const store = {error:{kind:'quota',message:'Нет места'},save:()=>false};
  assert.equal(app.persistDesignSnapshot(store, {}), false);
  assert.equal(app.persistenceError.kind, 'quota');
  assert.equal(notifications, 1);
  app.persistDesignSnapshot(store, {});
  assert.equal(notifications, 1, 'the same failure does not create render churn');
  await Promise.resolve();
  assert.equal(lifecycleUpdates, 0, 'status notifications never start another autosave');
  app.saveDesign = () => app.persistDesignSnapshot({save:()=>true}, {});
  assert.equal(app.retryDesignSave(), true);
  assert.equal(app.persistenceError, null);
  assert.equal(notifications, 2);
});

test('retry commits the retained preset draft even after a successful baseline autosave', () => {
  const source = fs.readFileSync(new URL('../scripts/design-preset-editor.mjs',import.meta.url),'utf8');
  const methods = source.match(/const METHODS = String.raw`([\s\S]*?)  presetEditorVals\(\)\{/)[1];
  const value = snapshot(), values = new Map();
  let denyWrites = false;
  const storage = {getItem:key=>values.get(key)??null,setItem:(key,raw)=>{
    if (denyWrites) throw Object.assign(new Error('quota'),{name:'QuotaExceededError'});
    values.set(key,raw);
  }};
  const store = createDesignStorage({storage});
  store.save(value);
  const context = vm.createContext({DCLogic,PRESETS:value.presets,BLOCKS:value.blocks,DESIGN_STORE:store});
  vm.runInContext(`globalThis.TestEngine=class extends DCLogic {${methods}}`,context);
  const app = new context.TestEngine();
  app.state = {screen:'btnEd',projects:[]};
  app.designSnapshot = () => value;
  app.saveDesign = () => app.persistDesignSnapshot(store,app._presetDraft?app._presetDraft.snapshot:app.designSnapshot());
  app.toast = message => {app.notice=message;};
  app.go = screen => app.setState({screen});
  app.beginPresetDraft({from:'home'});
  value.presets.main[0].name = 'Новый пресет Safari';
  denyWrites = true;
  assert.equal(app.finishPresetDraft(true), false);
  assert.equal(app.state.screen,'btnEd');
  assert.equal(app._presetDraft.commitFailed,true);
  assert.equal(app.persistenceError.kind,'quota');
  assert.equal(createDesignStorage({storage}).load().presets.main[0].name,'Исходный пресет');
  denyWrites = false;
  assert.equal(app.saveDesign(),true,'the lifecycle can still save the original transaction baseline');
  assert.equal(app.persistenceError.kind,'quota','baseline success does not report the edited preset as saved');
  assert.equal(app.retryDesignSave(),true);
  assert.equal(app._presetDraft,null);
  assert.equal(app.persistenceError,null);
  assert.equal(app.state.screen,'home');
  assert.equal(createDesignStorage({storage}).load().presets.main[0].name,'Новый пресет Safari');
});

test('asynchronous saving stays pending until commit and retries beyond the equality cache', async () => {
  let status={key:'desktop',pending:false,error:null,revision:0,committedRevision:0};
  let notify, retries=0, writes=0;
  const backend={getStatus:()=>status,subscribe:listener=>{notify=listener;return()=>{};},
    retry:async()=>{retries++;status={...status,pending:false,error:null,committedRevision:status.revision};notify(status);return true;},
    flush:async()=>!status.error&&!status.pending};
  const store={persistence:backend,persistenceKey:'desktop',save:()=>{writes++;return true;}};
  const app=new DCLogic();
  let lifecycle=0;app.componentDidUpdate=()=>lifecycle++;app.mount();
  app.saveDesign=()=>app.persistDesignSnapshot(store,{});
  app.saveDesign();
  status={...status,pending:true,revision:1};notify(status);
  assert.equal(app.persistencePending,true);
  status={...status,pending:false,error:{kind:'storage',message:'Запись прервана'}};notify(status);
  assert.equal(app.persistenceError.message,'Запись прервана');
  app.saveDesign();
  assert.equal(app.persistenceError.message,'Запись прервана','accepting a cached value cannot acknowledge durability');
  assert.equal(await app.retryDesignSave(),true);
  assert.equal(retries,1);assert.equal(writes,3);
  assert.equal(app.persistenceError,null);
  await Promise.resolve();assert.equal(lifecycle,0,'commit notifications must not trigger more saves');
});

test('a success toast requires a durable commit and never commits an open preset draft', async () => {
  const app=new DCLogic(),messages=[];
  let committed=false,saves=0;
  app.toast=message=>messages.push(message);
  app.saveDesign=()=>{saves++;return true;};
  app._persistence={flush:async()=>committed};
  assert.equal(await app.toastWhenSaved('Расчёт сохранён'),false);
  assert.deepEqual(messages,[]);
  committed=true;
  assert.equal(await app.toastWhenSaved('Расчёт сохранён'),true);
  assert.deepEqual(messages,['Расчёт сохранён']);
  app._presetDraft={snapshot:{}};
  await app.toastWhenSaved('Позиция сохранена');
  assert.equal(saves,2,'open preset changes must not persist before Save preset');
  assert.match(messages.at(-1),/Сохраните пресет/);
});

test('an exclusive restore blocks old live state from overwriting the imported transaction',()=>{
  const app=new DCLogic();app._desktopRestoring=true;
  assert.equal(app.persistDesignSnapshot({save:()=>assert.fail('old RAM must not be queued')},{}),false);
});
