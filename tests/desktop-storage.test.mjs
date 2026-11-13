import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopStorage, DESKTOP_STORAGE_KEY, DESKTOP_WORKING_STORAGE_KEY} from '../src/desktop/engine-base.js';
import {createDesktopDesignStorage} from '../src/desktop/desktop-storage.js';

test('a working dataset never seeds itself from the mobile or desktop demo', () => {
  const values = new Map([['zamer.design.v1','phone demo'],[DESKTOP_STORAGE_KEY,'desktop demo']]);
  const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const adapter = createDesktopStorage(()=>storage,()=>({migration:{sourceHash:'working-backup-hash'}}));
  assert.equal(adapter.getItem('zamer.design.v1'), null);
  adapter.setItem('zamer.design.v1','working data');
  assert.equal(adapter.getItem('zamer.design.v1'),'working data');
  assert.equal(values.get(DESKTOP_WORKING_STORAGE_KEY),'working data');
  assert.equal(values.get(DESKTOP_STORAGE_KEY),'desktop demo');
  assert.equal(values.get('zamer.design.v1'),'phone demo');
  adapter.removeItem('zamer.design.v1');
  assert.equal(values.has(DESKTOP_WORKING_STORAGE_KEY), false);
  assert.equal(values.get(DESKTOP_STORAGE_KEY),'desktop demo');
});

test('desktop persistence round trips variants with equal labels and different IDs', () => {
  const values = new Map();
  const storage = {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const value = {version:1,blocks:[{id:'canvas',title:'Полотно',single:true},{id:'main',title:'Профиль',single:true}],
    nom:[{id:'a',n:'Профиль',p:100,u:'м.п.',m:1,br:'Первый'},{id:'b',n:'Профиль',p:900,u:'м.п.',m:1,br:'Второй'}],
    presets:{canvas:[],main:[{id:'preset',name:'Варианты',items:[{nid:'a',n:'Профиль',p:100,u:'м.п.',m:1,
      variants:[{nid:'a',n:'Профиль',p:100,u:'м.п.',m:1},{nid:'b',n:'Профиль',p:900,u:'м.п.',m:1}]}]}]},
    roomOpts:[],projects:[],estEd:{},migration:{sourceHash:'original'}};
  const store = createDesktopDesignStorage({storage});
  assert.equal(store.save(value), true);
  assert.deepEqual(createDesktopDesignStorage({storage}).load(), value);
});

test('the status compatibility repair preserves every edit and runs once for the same working source', () => {
  const sourceHash = 'same-working-source';
  const dataset = { migration: { sourceHash, statusMappingVersion: 2 },
    projects: [{ id: 'agreement', status: 'discuss' }, { id: 'changed', status: 'discuss' }, { id: 'ordinary', status: 'estimate' }] };
  const saved = { version: 1, migration: { sourceHash },
    projects: [{ id: 'agreement', status: 'estimate', name: 'Имя изменено', date: '02.11.2026', rooms: [{ id: 'room', norm: 2.5 }] },
      { id: 'changed', status: 'contract' }, { id: 'ordinary', status: 'estimate' }],
    profile: { company: 'Своя компания' }, presets: { custom: [{ id: 'edited', k: 4 }] }, estEd: { agreement: { item: { p: 99 } } } };
  const values = new Map([[DESKTOP_WORKING_STORAGE_KEY, JSON.stringify(saved)], ['zamer.design.v1', 'mobile'], [DESKTOP_STORAGE_KEY, 'demo']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const adapter = createDesktopStorage(() => storage, () => dataset);
  const repaired = JSON.parse(adapter.getItem('zamer.design.v1'));
  assert.deepEqual(repaired, { ...saved, migration: { sourceHash, statusMappingVersion: 2 },
    projects: saved.projects.map(project => project.id === 'agreement' ? { ...project, status: 'discuss' } : project) });
  repaired.projects[0].status = 'estimate';
  adapter.setItem('zamer.design.v1', JSON.stringify(repaired));
  assert.equal(JSON.parse(adapter.getItem('zamer.design.v1')).projects[0].status, 'estimate', 'a later manual choice is never repaired again');
  assert.equal(values.get('zamer.design.v1'), 'mobile');
  assert.equal(values.get(DESKTOP_STORAGE_KEY), 'demo');
});

test('status repair leaves a foreign source and the demo dataset unchanged', () => {
  const raw = JSON.stringify({ migration: { sourceHash: 'another-source' }, projects: [{ id: 'same-id', status: 'estimate' }] });
  const values = new Map([[DESKTOP_WORKING_STORAGE_KEY, raw], [DESKTOP_STORAGE_KEY, raw]]);
  const storage = { getItem: key => values.get(key) ?? null };
  const dataset = { migration: { sourceHash: 'current-source', statusMappingVersion: 2 }, projects: [{ id: 'same-id', status: 'discuss' }] };
  assert.equal(createDesktopStorage(() => storage, () => dataset).getItem('zamer.design.v1'), raw);
  assert.equal(createDesktopStorage(() => storage, () => ({ projects: dataset.projects })).getItem('zamer.design.v1'), raw);
});

test('folder order survives a desktop snapshot without changing catalogue or projects',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const snapshot={version:1,blocks:[{id:'canvas',title:'Полотно',single:true},{id:'main',title:'Профиль',single:true}],nom:[],presets:{canvas:[],main:[]},roomOpts:[],projects:[],estEd:{},catalogFolderOrder:['v2_msd','v2_kraab']};
 const store=createDesktopDesignStorage({storage});
 assert.equal(store.save(snapshot),true); assert.deepEqual(store.load(),snapshot);
 assert.equal(store.save({...snapshot,catalogFolderOrder:['v2_msd','v2_msd']}),false);
 assert.equal(store.save({...snapshot,catalogFolderOrder:[{}]}),false);
 assert.deepEqual(store.load(),snapshot);
});
