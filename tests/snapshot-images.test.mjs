import test from 'node:test';
import assert from 'node:assert/strict';
import {packSnapshotImages, unpackSnapshotImages, validateSnapshotImages} from '../src/desktop/snapshot-images.js';
import {createDesktopDesignStorage, validateDesktopSnapshot} from '../src/desktop/desktop-storage.js';
import {MAX_SNAPSHOT_BACKUP_BYTES, parseSnapshotBackup, serializeSnapshotBackup} from '../src/desktop/snapshot-backup.js';
import {decodeSnapshot, encodeSnapshot} from '../src/desktop/snapshot-codec.js';
import {createBrowserSnapshotStorage, DESKTOP_SNAPSHOT_KEYS} from '../src/desktop/browser-snapshot-storage.js';

const photo = 'data:image/png;base64,YWJjZA==';
function fixture(image = photo, rooms = 1) {
  const blocks = [{id:'canvas',title:'Полотно',single:true},{id:'main',title:'Профиль',single:true}];
  const row = {nid:'n1',n:'Полотно',p:100,u:'м²',m:1,_photoFrozen:true,img:image,imageUrl:image};
  return {version:1,blocks,presets:{canvas:[],main:[]},roomOpts:[],estEd:{},
    nom:[{id:'n1',n:'Полотно',p:200,u:'м²',br:'MSD',imageUrl:image,photoSource:'data:image/png;base64,c291cmNl'}],
    projects:[{id:'p1',name:'Корсакова',calculationSnapshotVersion:1,rooms:Array.from({length:rooms},(_,index)=>({
      id:`r${index}`,v:[],catalogSnapshot:{version:1,blocks,roomOpts:[]},
      canvas:{pid:'p1',presetSnapshot:{version:1,id:'p1',name:'Полотно',items:[{...row}]}},
      main:{pid:null,presetSnapshot:{version:1,id:null,name:'',items:[],missing:true}},
    }))}]};
}
const frozen = snapshot => snapshot.projects[0].rooms[0].canvas.presetSnapshot.items[0];

function imageDatabase(records = new Map()) {
  const database={objectStoreNames:{contains:()=>true},close(){},transaction(){
    const tx={objectStore:()=>({get(key){const request={};queueMicrotask(()=>{request.result=records.get(key);tx.oncomplete?.();});return request;},
      put(value,key){queueMicrotask(()=>{records.set(key,value);tx.oncomplete?.();});}})};
    return tx;
  }};
  return {records,open(){const request={};queueMicrotask(()=>{request.result=database;request.onsuccess?.();});return request;}};
}

test('one frozen ready photograph is pooled once without mutating either source or editing originals',()=>{
  const source=fixture(photo,4), before=structuredClone(source);
  frozen(source).variants=[{...frozen(source)}];
  before.projects[0].rooms[0].canvas.presetSnapshot.items[0].variants=[{...frozen(before)}];
  const packed=packSnapshotImages(source);
  assert.deepEqual(source,before);
  assert.equal(Object.keys(packed._frozenImages.values).length,1);
  assert.equal(Object.values(packed._frozenImages.values)[0],photo);
  assert.match(frozen(packed).img,/^zamer-image-ref:/);
  assert.equal(frozen(packed).img,frozen(packed).imageUrl);
  assert.equal(packed.nom[0].imageUrl,photo);
  assert.equal(packed.nom[0].photoSource,source.nom[0].photoSource);
  assert.deepEqual(unpackSnapshotImages(packed),source);
  assert.deepEqual(packSnapshotImages(packed),packed,'already packed data is deterministically repacked');
  frozen(packed).p=999;
  assert.equal(frozen(source).p,100);
});

test('legacy snapshots and bundled image paths retain every logical field',()=>{
  const source=fixture('/online/nom/profile.webp');
  const packed=packSnapshotImages(source);
  assert.equal(packed._frozenImages,undefined);
  assert.deepEqual(unpackSnapshotImages(packed),source);
  assert.deepEqual(unpackSnapshotImages(source),source);
  assert.equal(validateSnapshotImages(source),true);
});

test('a legal 600 KiB photograph shared by 60 rooms fits durable storage, compression and a restorable backup',()=>{
  const image='data:image/png;base64,'+'A'.repeat(600*1024);
  const source=fixture(image,60);
  assert.ok(image.length*2*60>MAX_SNAPSHOT_BACKUP_BYTES,'the expanded image fields alone exceed the old JSON limit');
  const raw=serializeSnapshotBackup(source);
  assert.ok(Buffer.byteLength(raw)<2*1024*1024,'wire JSON stores one global photo plus one frozen pool value');
  assert.equal(decodeSnapshot(encodeSnapshot(raw)),raw);
  const restored=parseSnapshotBackup(raw);
  assert.equal(restored.projects[0].rooms.length,60);
  assert.equal(frozen(restored).imageUrl,image);
  assert.equal(restored._frozenImages,undefined);
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(createDesktopDesignStorage({storage}).save(source),true);
  assert.ok([...values.values()][0].length<2*1024*1024);
  assert.deepEqual(createDesktopDesignStorage({storage}).load(),source);
});

test('broken or unsafe image pools never validate, import or overwrite the last good snapshot',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const store=createDesktopDesignStorage({storage}),source=fixture();
  assert.equal(store.save(source),true);
  const validRaw=[...values.values()][0];
  const missing=packSnapshotImages(source);delete missing._frozenImages;
  const dangling=packSnapshotImages(source);frozen(dangling).img='zamer-image-ref:absent';
  const svg=packSnapshotImages(source);Object.keys(svg._frozenImages.values).forEach(id=>svg._frozenImages.values[id]='data:image/svg+xml;base64,PHN2Zz4=');
  const wrongVersion=packSnapshotImages(source);wrongVersion._frozenImages.version=2;
  const unsafe=JSON.parse(JSON.stringify(packSnapshotImages(source)).replace('"values":{','"values":{"__proto__":"data:image/png;base64,YWJjZA==",'));
  const outside=packSnapshotImages(source);outside.nom[0].imageUrl=frozen(outside).imageUrl;
  for(const bad of [missing,dangling,svg,wrongVersion,unsafe,outside]) {
    assert.equal(validateSnapshotImages(bad),false);
    assert.equal(validateDesktopSnapshot(bad),false);
    assert.throws(()=>unpackSnapshotImages(bad));
    assert.throws(()=>parseSnapshotBackup(JSON.stringify(bad)),/повреждён/);
    assert.equal(store.save(bad),false);
    assert.equal(store.error.kind,'validation');
    assert.equal([...values.values()][0],validRaw);
  }
  assert.deepEqual(createDesktopDesignStorage({storage}).load(),source);
  assert.equal({}.polluted,undefined);
});

test('malformed pools are rejected during the browser facade load instead of exposing references to calculations',()=>{
  const source=packSnapshotImages(fixture());delete source._frozenImages;
  let reports=0;
  const store=createDesktopDesignStorage({storage:{getItem:()=>JSON.stringify(source)},onError:()=>reports++});
  assert.equal(store.load(),null);
  assert.equal(reports,1);
});

test('IndexedDB hydration validates packed images and explicit recovery refuses dangling references',async()=>{
  const [key]=DESKTOP_SNAPSHOT_KEYS,raw=serializeSnapshotBackup(fixture());
  const idb=imageDatabase(new Map([[key,{version:1,revision:1,raw}]]));
  const options={indexedDB:idb,keys:[key],storage:{getItem:()=>null}};
  const backend=await createBrowserSnapshotStorage(options).initialize();
  assert.equal(backend.mode,'indexedDB');
  const adapter={getItem:()=>backend.getItem(key),setItem:(_key,value)=>backend.setItem(key,value)};
  assert.deepEqual(createDesktopDesignStorage({storage:adapter}).load(),fixture());
  const invalid=packSnapshotImages(fixture());delete invalid._frozenImages;
  await assert.rejects(()=>backend.recover(key,JSON.stringify(invalid)),/Invalid desktop snapshot/);
  assert.equal(idb.records.get(key).raw,raw);
  idb.records.set(key,{version:1,revision:2,raw:JSON.stringify(invalid)});
  await assert.rejects(()=>createBrowserSnapshotStorage(options).initialize(),{name:'DesktopSnapshotLoadError'});
  assert.equal(idb.records.get(key).revision,2,'an invalid stored record remains untouched for explicit recovery');
});
