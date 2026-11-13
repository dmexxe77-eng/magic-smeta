import test from 'node:test';
import assert from 'node:assert/strict';
import {captureProjectCatalog} from '../src/desktop/project-catalog.js';
import {createDesktopDesignStorage,validateDesktopSnapshot} from '../src/desktop/desktop-storage.js';
import {parseSnapshotBackup} from '../src/desktop/snapshot-backup.js';

function fixture(){
  const library={blocks:[{id:'canvas',title:'Полотно',single:true,source:'area',unit:'м²'},{id:'main',title:'Профиль',single:true,source:'perim',unit:'м.п.'}],
    presets:{canvas:[{id:'c',name:'Полотно',items:[{nid:'a',n:'Полотно',u:'м²',p:100,m:1}]}],main:[{id:'p',name:'Профиль',items:[]}]},
    nom:[{id:'a',n:'Полотно',u:'м²',p:100,m:1,br:'База'}],roomOpts:[]};
  const project={id:'project',name:'Сохранённый',rooms:[{id:'r',v:[[0,0],[2,0],[2,2],[0,2]],canvas:{pid:'c'},main:{pid:'p'},on:true}]};
  return {version:1,...library,projects:[captureProjectCatalog(project,library)],estEd:{}};
}

test('frozen calculations round trip independently of deleted global presets',()=>{
  const snapshot=fixture();snapshot.presets={canvas:[],main:[]};
  assert.equal(validateDesktopSnapshot(snapshot),true);
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  assert.equal(createDesktopDesignStorage({storage}).save(snapshot),true);
  assert.deepEqual(createDesktopDesignStorage({storage}).load(),JSON.parse(JSON.stringify(snapshot)));
});

test('a broken embedded snapshot never replaces the last saved browser data',()=>{
  const valid=fixture(),data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const store=createDesktopDesignStorage({storage});assert.equal(store.save(valid),true);
  const bad=structuredClone(valid);bad.projects[0].rooms[0].canvas.presetSnapshot.items[0].p=-1;
  assert.equal(store.save(bad),false);
  assert.deepEqual(createDesktopDesignStorage({storage}).load(),JSON.parse(JSON.stringify(valid)));
  assert.throws(()=>parseSnapshotBackup(JSON.stringify(bad)),/повреждён/);
});

test('marked projects require complete room and instance snapshots on import',()=>{
  const snapshot=fixture();delete snapshot.projects[0].rooms[0].canvas.presetSnapshot;
  assert.equal(validateDesktopSnapshot(snapshot),false);
  const legacy=fixture();delete legacy.projects[0].calculationSnapshotVersion;
  delete legacy.projects[0].rooms[0].catalogSnapshot;delete legacy.projects[0].rooms[0].canvas.presetSnapshot;delete legacy.projects[0].rooms[0].main.presetSnapshot;
  assert.equal(validateDesktopSnapshot(legacy),true,'existing browser snapshots remain readable for migration');
  legacy.projects[0].rooms[0].canvas.presetSnapshot={version:1,id:'c',name:'Неполный снимок',items:[]};
  assert.equal(validateDesktopSnapshot(legacy),false,'a partial new snapshot must not bypass the embedded schema');
});
