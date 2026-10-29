import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_STORAGE_KEY, createDesignStorage, validateDesignSnapshot } from '../src/design-bridge/design-storage.js';

const copy = value => JSON.parse(JSON.stringify(value));
const snapshot = () => ({
  version: 1,
  blocks: [
    { id: 'canvas', title: 'Полотно', single: true, unit: 'м²' },
    { id: 'main', title: 'Основной профиль', single: true, unit: 'м.п.' },
    { id: 'custom_1', title: 'Мой блок', unit: 'м.п.', param: 'manual', custom: true },
  ],
  presets: {
    canvas: [{ id: 'canvas_1', name: 'Полотно', items: [{ n: 'Полотно', p: 100, u: 'м²', m: 1 }] }],
    main: [{ id: 'main_1', name: 'Профиль', items: [{ n: 'Профиль', p: 200, u: 'м.п.', m: 1 }] }],
    custom_1: [{ id: 'custom_preset', name: 'Феникс', items: [{ n: 'Лента', p: 50, u: 'м.п.', m: 1, src: 'manual' }], customMetadata: { future: 7 } }],
  },
  nom: [{ n: 'Лента', p: 50, u: 'м.п.', m: 1, br: 'Мои позиции' }],
  roomOpts: [{ id: 'opt1', n: 'Защита стен', title: 'Защита стен', p: 10, u: 'м.п.', m: 0, src: 'perim' }],
  projects: [{ id: 'project1', name: 'Новый проект', notes: 'Сохранить заметки', rooms: [{
    id: 'room1', name: 'Комната', on: true, v: [[0, 0], [3, 0], [3, 4], [0, 4]],
    canvas: { pid: 'canvas_1', off: {} }, main: { pid: 'main_1', off: {} },
    custom_1: [{ id: 'instance1', pid: 'custom_preset', qty: 3, iq: { Лента: 2 } }],
    holes: [], draw: { someFutureField: true },
  }] }],
  estEd: { project1: { Лента: { q: 2, p: 45 } } },
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    writes: 0,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { this.writes++; values.set(key, value); },
  };
}

test('a reload restores custom blocks, presets, projects, estimate edits, options and nomenclature together', () => {
  const storage = memoryStorage({ magicapp_v2_4_autosave_v1: 'main app data', 'zamer.contractTpl': 'contract data' });
  const store = createDesignStorage({ storage });
  const saved = snapshot();
  assert.equal(DESIGN_STORAGE_KEY, 'zamer.design.v1');
  assert.equal(store.save(saved), true);
  assert.deepEqual(createDesignStorage({ storage }).load(), saved);
  assert.equal(storage.values.get('magicapp_v2_4_autosave_v1'), 'main app data');
  assert.equal(storage.values.get('zamer.contractTpl'), 'contract data');
  assert.equal(storage.values.size, 3);
});

test('restored data is detached from the saved object and keeps unrecognised fields', () => {
  const saved = { ...snapshot(), futureExtension: { enabled: true } };
  const storage = memoryStorage({ [DESIGN_STORAGE_KEY]: JSON.stringify(saved) });
  const loaded = createDesignStorage({ storage }).load();
  assert.deepEqual(loaded, saved);
  loaded.projects[0].notes = 'Changed after restoration';
  loaded.presets.custom_1[0].customMetadata.future = 9;
  assert.equal(saved.projects[0].notes, 'Сохранить заметки');
  assert.equal(JSON.parse(storage.values.get(DESIGN_STORAGE_KEY)).presets.custom_1[0].customMetadata.future, 7);
});

test('an intentionally empty project list survives reload', () => {
  const saved = { ...snapshot(), projects: [], estEd: {} };
  const storage = memoryStorage({ [DESIGN_STORAGE_KEY]: JSON.stringify(saved) });
  assert.deepEqual(createDesignStorage({ storage }).load().projects, []);
});

test('missing storage starts from the supplied seed without an error or write', () => {
  const storage = memoryStorage();
  const errors = [];
  assert.equal(createDesignStorage({ storage, onError: message => errors.push(message) }).load(), null);
  assert.equal(storage.writes, 0);
  assert.deepEqual(errors, []);
});

test('invalid JSON falls back safely, preserves the raw value and reports once', () => {
  const storage = memoryStorage({ [DESIGN_STORAGE_KEY]: '{broken' });
  const errors = [];
  const store = createDesignStorage({ storage, onError: message => errors.push(message) });
  assert.equal(store.load(), null);
  assert.equal(store.load(), null);
  assert.equal(storage.values.get(DESIGN_STORAGE_KEY), '{broken');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /восстанов/i);
});

test('validation rejects unsafe, inconsistent and unsupported snapshots without accepting partial directories', () => {
  assert.equal(validateDesignSnapshot(snapshot()), true);
  const invalid = [null, [], {}, { ...snapshot(), version: 2 }, { ...snapshot(), presets: [] },
    { ...snapshot(), blocks: [] }, { ...snapshot(), projects: [{ id: 'bad', name: 'Bad', rooms: null }] },
    { ...snapshot(), nom: [{ n: 'Broken', u: 'шт', p: null }] }];
  const missingPresets = snapshot(); delete missingPresets.presets.custom_1; invalid.push(missingPresets);
  const badId = snapshot(); badId.blocks[2].id = '__proto__'; invalid.push(badId);
  const duplicateId = snapshot(); duplicateId.blocks[2].id = 'main'; invalid.push(duplicateId);
  const badPoint = snapshot(); badPoint.projects[0].rooms[0].v[0][0] = 'NaN'; invalid.push(badPoint);
  const badExtraItems = snapshot(); badExtraItems.projects[0].rooms[0].extraItems = {}; invalid.push(badExtraItems);
  const badExtraPosition = snapshot(); badExtraPosition.projects[0].rooms[0].extraItems = [null]; invalid.push(badExtraPosition);
  const missingBrand = snapshot(); delete missingBrand.nom[0].br; invalid.push(missingBrand);
  const missingTitle = snapshot(); delete missingTitle.blocks[2].title; invalid.push(missingTitle);
  for (const value of invalid) assert.equal(validateDesignSnapshot(value), false);
  const storage = memoryStorage({ [DESIGN_STORAGE_KEY]: JSON.stringify(missingPresets) });
  assert.equal(createDesignStorage({ storage }).load(), null);
});

test('unchanged snapshots do not repeatedly write while later edits are persisted', () => {
  const storage = memoryStorage();
  const store = createDesignStorage({ storage });
  const saved = snapshot();
  assert.equal(store.save(saved), true);
  assert.equal(store.save(copy(saved)), true);
  assert.equal(storage.writes, 1);
  saved.projects[0].name = 'Изменённый проект';
  assert.equal(store.save(saved), true);
  assert.equal(storage.writes, 2);
  assert.equal(createDesignStorage({ storage }).load().projects[0].name, 'Изменённый проект');
});

test('a write failure reports once and does not prevent retrying the latest data', () => {
  const storage = memoryStorage();
  const write = storage.setItem;
  let fail = true;
  storage.setItem = function (key, value) { if (fail) throw new Error('quota exceeded'); write.call(this, key, value); };
  const errors = [];
  const store = createDesignStorage({ storage, onError: message => errors.push(message) });
  const saved = snapshot();
  assert.equal(store.save(saved), false);
  assert.equal(store.save(saved), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /сохран/i);
  fail = false;
  saved.projects[0].notes = 'Latest unsaved edit';
  assert.equal(store.save(saved), true);
  assert.equal(createDesignStorage({ storage }).load().projects[0].notes, 'Latest unsaved edit');
});

test('denied access to localStorage does not crash the editor and reports once', () => {
  const errors = [];
  const store = createDesignStorage({ getStorage: () => { throw new Error('access denied'); }, onError: message => errors.push(message) });
  assert.equal(store.load(), null);
  assert.equal(store.save(snapshot()), false);
  assert.equal(errors.length, 1);
});

test('the template restores directories before state creation and saves global edits through lifecycle hooks', async () => {
  const { storageTemplate } = await import('../scripts/design-storage.mjs');
  const { runInNewContext } = await import('node:vm');
  const saved = snapshot();
  const storage = memoryStorage({ [DESIGN_STORAGE_KEY]: JSON.stringify(saved) });
  const source = `<script src="/design/main-data.js"></script>
const MAIN=JSON.parse(JSON.stringify(window.MAGIC_MAIN));
const PRESETS=MAIN.presets;
const BLOCKS=[{id:'canvas',single:true},{id:'main',single:true}];
BLOCKS.forEach(b=>{const l=PRESETS[b.id]||[];b.def=(l[0]||{}).id;});
const NOM=MAIN.nom;
[{n:'Защита стен плёнкой',p:365,u:'м.п.',m:0,br:'Прочее'},{n:'Вынос строительного мусора',p:120,u:'м²',m:0,br:'Прочее'}].forEach(x=>{if(!NOM.some(n=>n.n===x.n))NOM.push(x);});
const ROOM_OPTS=MAIN.roomOpts.concat([{id:'builtin',n:'Builtin',p:1,u:'шт'}]);
const optQty=o=>0;
class Component extends DCLogic {
  state={projects:this.seed(),estEd:JSON.parse(JSON.stringify(MAIN.estEd||{}))};
  seed(){return JSON.parse(JSON.stringify(MAIN.projects||[]));}
  componentDidMount(){this.applyStart();window.__zamer=this;this.themeTick();}
  componentDidUpdate(pp){if(pp.startScreen!==this.props.startScreen)this.applyStart();if(pp.theme!==this.props.theme&&this.state.themeO)this.setState({themeO:null});this.themeTick();}
  componentWillUnmount(){if(this._mo)this._mo.disconnect();}
  applyStart(){} themeTick(){} toast(message){this.notice=message;}
}
globalThis.TestComponent=Component;
globalThis.TestDirectories={BLOCKS,PRESETS,NOM,ROOM_OPTS};`;
  const seed = { presets: { canvas: [], main: [] }, nom: [], roomOpts: [], projects: [], estEd: {} };
  const listeners = new Map();
  const window = { MAGIC_MAIN: copy(seed), localStorage: storage,
    MagicDesignStorage: { createDesignStorage },
    addEventListener: (name, fn) => listeners.set('window:' + name, fn),
    removeEventListener: name => listeners.delete('window:' + name),
  };
  const document = { visibilityState: 'visible',
    addEventListener: (name, fn) => listeners.set('document:' + name, fn),
    removeEventListener: name => listeners.delete('document:' + name),
  };
  const context = { window, document, setTimeout, clearTimeout, DCLogic: class { constructor(){this.props={};} } };
  const patched = storageTemplate(source);
  assert.match(patched, /src="\/design\/storage\.js"/);
  runInNewContext(patched.replace(/<script[^>]*><\/script>/g, ''), context);
  const component = new context.TestComponent();
  assert.deepEqual(copy(component.state.projects), saved.projects);
  assert.deepEqual(copy(context.TestDirectories.BLOCKS).map(b => b.id), saved.blocks.map(b => b.id));
  assert.deepEqual(copy(context.TestDirectories.ROOM_OPTS), saved.roomOpts);
  assert.deepEqual(copy(context.TestDirectories.NOM), saved.nom);
  assert.deepEqual(window.MAGIC_MAIN, seed);
  component.componentDidMount();
  context.TestDirectories.PRESETS.custom_1[0].name = 'Новое имя';
  component.state.estEd.project1.Лента.q = 7;
  component.componentDidUpdate({});
  listeners.get('window:pagehide')();
  const reloaded = createDesignStorage({ storage }).load();
  assert.equal(reloaded.presets.custom_1[0].name, 'Новое имя');
  assert.equal(reloaded.estEd.project1.Лента.q, 7);
  component.componentWillUnmount();
  assert.equal(listeners.size, 0);
});
