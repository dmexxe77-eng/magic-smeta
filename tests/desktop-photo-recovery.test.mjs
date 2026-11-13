import test from 'node:test';
import assert from 'node:assert/strict';
import {upgradeWorkingPhotos} from '../src/desktop/photo-recovery.js';

const photo = {id:'p_2',n:'EUROKRAAB STRONG',img:'nom-cF8y.webp',imageUrl:'/online/nom/nom-cF8y.webp'};
const dataset = {migration:{sourceHash:'original-backup',photoRecoveryVersion:2},nom:[photo]};
const saved = () => ({migration:{sourceHash:'original-backup'},nom:[{id:'p_2',n:'Название исправлено',p:721}],
  projects:[{id:'project',rooms:[{id:'room',main:{qtyO:18.4}}],estimateAdjustment:{percent:7}}],
  estEd:{project:{p_2:{q:17,p:600}}},profile:{company:'Моя компания'},catalogFolderOrder:['kraab','msd']});

test('photo recovery matches the preserved ID and changes only missing photo metadata',()=>{
  const original=saved(),raw=JSON.stringify(original),result=JSON.parse(upgradeWorkingPhotos(raw,dataset));
  assert.deepEqual(result,{...original,migration:{...original.migration,photoRecoveryVersion:2},
    nom:[{...original.nom[0],img:photo.img,imageUrl:photo.imageUrl}]});
  assert.equal(JSON.stringify(original),raw);
});

test('equal names never transfer photos to another source ID',()=>{
  const original={...saved(),nom:[{id:'another-id',n:photo.n},{n:photo.n}]};
  const result=JSON.parse(upgradeWorkingPhotos(JSON.stringify(original),dataset));
  assert.deepEqual(result.nom,original.nom);
});

test('custom images and explicit photo removals survive recovery',()=>{
  for(const existing of [{imageUrl:'data:image/png;base64,custom'},{img:'own.webp'},{photo:'blob:custom'},{photoRemoved:true}]) {
    const original={...saved(),nom:[{id:photo.id,...existing}]};
    assert.deepEqual(JSON.parse(upgradeWorkingPhotos(JSON.stringify(original),dataset)).nom,original.nom);
  }
});

test('recovery runs once so later removals and user edits remain intact',()=>{
  const original={...saved(),migration:{sourceHash:'original-backup',photoRecoveryVersion:2}};
  const raw=JSON.stringify(original);
  assert.equal(upgradeWorkingPhotos(raw,dataset),raw);
});

test('foreign, missing and malformed sources remain byte-for-byte unchanged',()=>{
  for(const original of [{...saved(),migration:{sourceHash:'foreign'}},{...saved(),migration:{}},null,{}]) {
    const raw=JSON.stringify(original);
    assert.equal(upgradeWorkingPhotos(raw,dataset),raw);
  }
  for(const current of [null,{migration:{photoRecoveryVersion:2},nom:[photo]},
    {migration:{sourceHash:'original-backup',photoRecoveryVersion:2}},
    {...dataset,migration:{...dataset.migration,photoRecoveryVersion:Infinity}}]) {
    const raw=JSON.stringify(saved());
    assert.equal(upgradeWorkingPhotos(raw,current),raw);
  }
  assert.equal(upgradeWorkingPhotos('{broken',dataset),'{broken');
  assert.equal(upgradeWorkingPhotos(null,dataset),null);
});

test('removed dataset photos are never reintroduced',()=>{
  const result=JSON.parse(upgradeWorkingPhotos(JSON.stringify(saved()),{...dataset,nom:[{...photo,photoRemoved:true}]}));
  assert.deepEqual(result.nom,saved().nom);
});
