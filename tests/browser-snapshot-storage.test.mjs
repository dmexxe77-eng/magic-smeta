import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSnapshotStorage, DesktopSnapshotLoadError, DESKTOP_SNAPSHOT_KEYS} from '../src/desktop/browser-snapshot-storage.js';
import {encodeSnapshot} from '../src/desktop/snapshot-codec.js';

const [WORKING, DEMO] = DESKTOP_SNAPSHOT_KEYS;
const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = name => ({version:1,
  blocks:[{id:'canvas',title:'Полотно',single:true},{id:'main',title:'Профиль',single:true}],
  nom:[{id:'photo',n:'Профиль',p:500,u:'м.п.',br:'MSD',imageUrl:'data:image/png;base64,AAAA',photoSource:'data:image/png;base64,BBBB'}],
  presets:{canvas:[],main:[{id:'preset',name,items:[]}]}, roomOpts:[],projects:[],estEd:{}});
const raw = name => JSON.stringify(snapshot(name));
const quota = () => Object.assign(new Error('Full browser storage'), {name:'QuotaExceededError'});
const record = (value, revision=1) => ({version:1,raw:value,revision});

/** Only the IDB request/transaction surface used by this module; commits are explicit. */
function indexedDBFake(initial = []) {
  const records = new Map(initial);
  let created = false;
  let hold = false;
  const held = [];
  const writes = [];
  const database = {
    objectStoreNames:{contains:() => created},
    createObjectStore() { created = true; },
    close() {},
    transaction(_store, mode) {
      let finished = false;
      const tx = {
        error:null,
        objectStore() { return {
          get(key) {
            const request = {};
            queueMicrotask(() => {
              if (finished) return;
              request.result = records.get(key);
              request.onsuccess?.();
              finished = true;
              tx.oncomplete?.();
            });
            return request;
          },
          put(value, key) {
            assert.equal(mode,'readwrite');
            const request = {};
            writes.push({key,value:structuredClone(value)});
            const complete = error => {
              if (finished) return;
              finished = true;
              if (error) { tx.error = error; tx.onabort?.(); }
              else { records.set(key,structuredClone(value)); tx.oncomplete?.(); }
            };
            queueMicrotask(() => request.onsuccess?.());
            if (hold) held.push(complete);
            else queueMicrotask(() => complete());
            return request;
          },
        }; },
        abort() {
          if (finished) return;
          finished = true;
          queueMicrotask(() => tx.onabort?.());
        },
      };
      return tx;
    },
  };
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = database;
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
    records,writes,
    holdWrites(value=true) { hold=value; },
    completeNext(error) { assert.ok(held.length,'a write is awaiting commit'); held.shift()(error); },
    get pendingCount() { return held.length; },
  };
}
function localStorageFake(initial=[], {full=false}={}) {
  const values = new Map(initial), writes=[];
  return {values,writes,full,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key,value) { writes.push({key,value}); if(this.full) throw quota(); values.set(key,value); },
    removeItem() { throw new Error('Desktop snapshots must never remove a legacy entry'); },
  };
}

// IDB is intentionally separate from the origin's small synchronous localStorage quota.
test('a full localStorage still saves and rehydrates every snapshot field from IndexedDB',async()=>{
  const idb=indexedDBFake(), storage=localStorageFake([['zamer.design.v1','mobile'],['old-app','untouched']],{full:true});
  const before=[...storage.values];
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage}).initialize();
  store.setItem(WORKING,raw('Новый пресет'));
  assert.equal(store.getStatus(WORKING).pending,true);
  assert.equal(store.getStatus(WORKING).committedRevision,0);
  assert.equal(await store.flush(WORKING),true);
  assert.equal(store.getStatus(WORKING).committedRevision,1);
  const reload=await createBrowserSnapshotStorage({indexedDB:idb,storage}).initialize();
  assert.deepEqual(JSON.parse(reload.getItem(WORKING)),snapshot('Новый пресет'));
  assert.deepEqual([...storage.values],before);
  assert.equal(storage.writes.length,0);
});

test('request success does not acknowledge a write until transaction completion',async()=>{
  const idb=indexedDBFake(), store=await createBrowserSnapshotStorage({indexedDB:idb,storage:localStorageFake()}).initialize();
  const events=[]; store.subscribe(status=>events.push(status));
  idb.holdWrites(); store.setItem(WORKING,raw('Новый'));
  await tick();
  assert.equal(store.getStatus(WORKING).pending,true);
  assert.equal(store.getStatus(WORKING).committedRevision,0);
  assert.equal(idb.records.has(WORKING),false);
  idb.completeNext();
  assert.equal(await store.flush(WORKING),true);
  assert.equal(events.at(-1).pending,false);
  assert.equal(events.at(-1).error,null);
});

test('rapid writes keep the latest immutable waiting snapshot behind one active transaction',async()=>{
  const idb=indexedDBFake(), store=await createBrowserSnapshotStorage({indexedDB:idb,storage:localStorageFake()}).initialize();
  idb.holdWrites();
  store.setItem(WORKING,raw('Первый')); await tick();
  store.setItem(WORKING,raw('Второй')); store.setItem(WORKING,raw('Третий'));
  assert.equal(idb.pendingCount,1);
  idb.completeNext(); await tick();
  assert.equal(store.getStatus(WORKING).pending,true);
  assert.equal(store.getStatus(WORKING).committedRevision,1);
  assert.equal(idb.pendingCount,1);
  idb.completeNext(); assert.equal(await store.flush(),true);
  assert.deepEqual(idb.writes.map(item=>JSON.parse(item.value.raw).presets.main[0].name),['Первый','Третий']);
  assert.equal(idb.records.get(WORKING).raw,raw('Третий'));
  assert.equal(store.getStatus(WORKING).revision,3);
  assert.equal(store.getStatus(WORKING).committedRevision,3);
});

test('an aborted latest transaction keeps the old durable record and retries the latest cache',async()=>{
  const idb=indexedDBFake([[WORKING,record(raw('Исходный'),4)]]), storage=localStorageFake();
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage}).initialize();
  idb.holdWrites(); store.setItem(WORKING,raw('Несохранённый')); await tick();
  idb.completeNext(quota()); assert.equal(await store.flush(WORKING),false);
  assert.equal(store.getStatus(WORKING).error.kind,'quota');
  assert.equal(store.getItem(WORKING),raw('Несохранённый'));
  assert.equal(idb.records.get(WORKING).raw,raw('Исходный'));
  const retried=store.retry(WORKING); await tick();
  assert.equal(store.getStatus(WORKING).pending,true);
  idb.completeNext(); assert.equal(await retried,true);
  assert.equal(idb.records.get(WORKING).raw,raw('Несохранённый'));
  assert.equal(store.getStatus(WORKING).error,null);
});

test('a failed older transaction cannot replace a newer pending/successful status',async()=>{
  const idb=indexedDBFake(), store=await createBrowserSnapshotStorage({indexedDB:idb,storage:localStorageFake()}).initialize();
  idb.holdWrites(); store.setItem(WORKING,raw('Старый')); await tick();
  store.setItem(WORKING,raw('Последний')); idb.completeNext(quota()); await tick();
  assert.equal(store.getStatus(WORKING).error,null);
  assert.equal(store.getStatus(WORKING).pending,true);
  idb.completeNext(); assert.equal(await store.flush(WORKING),true);
  assert.equal(store.getStatus(WORKING).error,null);
  assert.equal(idb.records.get(WORKING).raw,raw('Последний'));
});

test('legacy gzip migrates only after an IDB commit and is never deleted or rewritten',async()=>{
  const compressed=encodeSnapshot(raw('Старый Safari'));
  const storage=localStorageFake([[WORKING,compressed],['zamer.design.v1','mobile'],[DEMO,raw('Демо')]]);
  const idb=indexedDBFake(), before=[...storage.values];
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage}).initialize();
  assert.equal(store.getItem(WORKING),raw('Старый Safari'));
  assert.equal(idb.records.get(WORKING).raw,raw('Старый Safari'));
  assert.equal(store.getItem(DEMO),raw('Демо'));
  assert.deepEqual([...storage.values],before);
  assert.deepEqual(storage.writes,[]);
});

test('an IDB record is canonical over a stale legacy record',async()=>{
  const idb=indexedDBFake([[WORKING,record(raw('Новое'))]]);
  const storage=localStorageFake([[WORKING,raw('Старое')]]);
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage}).initialize();
  assert.equal(store.getItem(WORKING),raw('Новое'));
  assert.equal(storage.values.get(WORKING),raw('Старое'));
});

test('invalid IDB and legacy records reject initialization instead of seeding or overwriting data',async()=>{
  for(const source of ['indexedDB','legacy']) {
    const invalid=JSON.stringify({...snapshot('Неверный'),projects:[{id:'p',name:'Данные повреждены',rooms:null}]});
    const idb=indexedDBFake(source==='indexedDB'?[[WORKING,record(invalid)]]:[]);
    const storage=localStorageFake([[WORKING,source==='legacy'?invalid:raw('Старый')]]);
    const store=createBrowserSnapshotStorage({indexedDB:idb,storage});
    await assert.rejects(store.initialize(),error=>error instanceof DesktopSnapshotLoadError && error.key===WORKING);
    assert.equal(store.initialized,false);
    assert.throws(()=>store.getItem(WORKING),/has not initialized/);
    assert.equal(idb.writes.length,0);
    assert.equal(storage.writes.length,0);
  }
});

test('an explicit valid recovery import replaces a corrupt record and permits hydration',async()=>{
  const idb=indexedDBFake([[WORKING,record('{broken')]]), storage=localStorageFake();
  const store=createBrowserSnapshotStorage({indexedDB:idb,storage});
  await assert.rejects(store.initialize(),DesktopSnapshotLoadError);
  await assert.rejects(store.recover(WORKING,'{still-broken'));
  assert.equal(idb.records.get(WORKING).raw,'{broken');
  assert.equal(await store.recover(WORKING,raw('Из резервной копии')),true);
  assert.equal(store.initialized,true);
  assert.equal(store.getItem(WORKING),raw('Из резервной копии'));
  assert.equal(storage.writes.length,0);
});

test('only the active key needs hydration; corrupt demo data does not block the working dataset',async()=>{
  const idb=indexedDBFake([[WORKING,record(raw('Работа'))],[DEMO,record('{broken')]]);
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage:localStorageFake(),keys:[WORKING]}).initialize();
  assert.equal(store.getItem(WORKING),raw('Работа'));
  assert.throws(()=>store.setItem('zamer.design.v1',raw('Wrong scope')),/Unsupported/);
  assert.equal(idb.records.get(DEMO).raw,'{broken');
});

test('localStorage fallback remains truthful and retains the latest raw for retry',async()=>{
  const storage=localStorageFake([[WORKING,raw('Исходный')]]);
  const store=await createBrowserSnapshotStorage({indexedDB:null,storage,keys:[WORKING]}).initialize();
  assert.equal(store.mode,'localStorage');
  storage.full=true;
  assert.throws(()=>store.setItem(WORKING,raw('Последний')),/Full browser storage/);
  assert.equal(await store.flush(WORKING),false);
  assert.equal(store.getStatus(WORKING).error.kind,'quota');
  assert.equal(store.getItem(WORKING),raw('Последний'));
  assert.equal(storage.values.get(WORKING),raw('Исходный'));
  storage.full=false;
  assert.equal(await store.retry(WORKING),true);
  assert.equal(storage.values.get(WORKING),raw('Последний'));
});

test('invalid writes do not replace the last cache or durable record',async()=>{
  const idb=indexedDBFake([[WORKING,record(raw('Работа'))]]);
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage:localStorageFake()}).initialize();
  assert.throws(()=>store.setItem(WORKING,JSON.stringify({version:1})),/Invalid desktop snapshot/);
  assert.equal(store.getItem(WORKING),raw('Работа'));
  assert.equal(idb.writes.length,0);
});

test('failed legacy migration opens the existing data with an error and can retry without touching legacy keys',async()=>{
  const storage=localStorageFake([[WORKING,encodeSnapshot(raw('Сохранённый Safari'))]],{full:true});
  const idb=indexedDBFake(); idb.holdWrites();
  const store=createBrowserSnapshotStorage({indexedDB:idb,storage,keys:[WORKING]});
  const loading=store.initialize(); await tick();
  assert.equal(idb.records.has(WORKING),false);
  assert.equal(store.initialized,false);
  idb.completeNext(quota()); await loading;
  assert.equal(store.getItem(WORKING),raw('Сохранённый Safari'));
  assert.equal(store.getStatus(WORKING).error.kind,'quota');
  assert.equal(await store.flush(WORKING),false);
  const retry=store.retry(WORKING); await tick(); idb.completeNext();
  assert.equal(await retry,true);
  assert.equal(idb.records.get(WORKING).raw,raw('Сохранённый Safari'));
  assert.equal(storage.writes.length,0);
});

test('working and demo saves serialize transactions without leaking their pending or error status',async()=>{
  const idb=indexedDBFake(), storage=localStorageFake();
  const store=await createBrowserSnapshotStorage({indexedDB:idb,storage}).initialize();
  idb.holdWrites(); store.setItem(WORKING,raw('Работа')); await tick();
  store.setItem(DEMO,raw('Демо'));
  assert.equal(idb.pendingCount,1);
  idb.completeNext(quota()); await tick();
  assert.equal(store.getStatus(WORKING).error.kind,'quota');
  assert.equal(store.getStatus(WORKING).pending,false);
  assert.equal(store.getStatus(DEMO).error,null);
  assert.equal(store.getStatus(DEMO).pending,true);
  idb.completeNext(); assert.equal(await store.flush(DEMO),true);
  assert.equal(await store.flush(),false);
  assert.equal(idb.records.get(DEMO).raw,raw('Демо'));
  assert.equal(idb.records.has(WORKING),false);
});
