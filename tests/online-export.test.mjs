import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {convertOnlineData,assertMigrationDestinations} from '../scripts/export-online-data.mjs';
import {NOM_V2_IMAGES} from '../src/data/nomV2Images.js';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';
const source={
  _version:'2.4',_exportedAt:'2026-11-01T00:00:00Z',
  customNoms:[
    {id:'u_migration_a',name:'Одинаковое название',price:20.5,unit:'м.п.',type:'profile',brandName:'Бренд A',photo:png},
    {id:'u_migration_b',name:'Одинаковое название',price:42,unit:'м.п.',type:'profile',brandName:'Бренд B',photo:'blob:https://old.example/photo'},
    {id:'u_migration_canvas',name:'Тестовое полотно',price:100,unit:'м²',type:'canvas',brandName:'Тест'},
  ],editedNoms:[{id:'u_migration_a',photo:null,price:21}],deletedNomIds:[],customBrands:[],
  presets:[{id:'preset_a',name:'Устаревшая версия',cat:'extra',items:['u_migration_b'],options:[]}],sharedFavs:{},customBlocks:[],globalOpts:[],
  buttons:{version:1,blocks:[{id:'canvas',label:'Полотно'},{id:'extra',label:'Дополнительные'}],presets:[
    {id:'preset_a',blockId:'extra',name:'Исходный пресет A',param:{src:'manual',unit:'м.п.'},items:[{nomId:'u_migration_a',src:'param',order:0,k:1.5}],order:0,cut:{gap:12},hidden:false},
    {id:'preset_b',blockId:'extra',name:'Исходный пресет B',param:{src:'manual',unit:'м.п.'},items:[{nomId:'u_migration_b',src:'param',order:0}],order:1,hidden:true,archived:true},
    {id:'preset_canvas',blockId:'canvas',name:'Полотно с сохранённой нормой',param:{src:'area'},items:[{nomId:'u_migration_canvas',src:'param',order:0,k:2}],order:0},
  ]},
  contract:{head:{company:'Исходная компания',logo:png},customSection:'Поле без преобразования'},
  orders:[{
    id:'source_project',name:'Исходный проект',status:'discuss',date:'2026-11-01',planImage:png,statusDates:{discuss:'2026-11-01'},clientId:'original_client',unknownFutureField:{retain:true},
    nomSnapshot:{u_migration_a:12.5},estimateEdits:{'["source_room","mats","u_migration_a"]':{q:4.25},'["total","mats","u_migration_b"]':{q:9}},
    estimateAdjustment:{scope:'works',percent:10},payments:[],expenses:[],
    rooms:[{
      id:'source_room',name:'Комната',on:true,v:[[0,0],[4,0],[4,3],[0,3]],aO:null,pO:null,
      canvas:{id:'canvas_instance',btnId:'preset_canvas',off:{},oq:{}},mainProf:{id:'main_instance',btnId:'',off:{},oq:{}},
      extras:[{id:'instance_a',btnId:'preset_a',qty:2,off:{},iq:{},oq:{}},{id:'instance_b',btnId:'preset_b',qty:3,off:{},iq:{},oq:{}}],
      lights:[],tracks:[],curtains:[],extraItems:[],extraCanvas:[],optsOn:{},film:true,mats2:[{raw:'preserved'}],draw:{futureShape:true},imgPts:[[1,1],[2,2]],unknownRoomField:{retain:true},
    }],
  }],
};
const before=JSON.stringify(source);
let converted;
const data=()=>converted ||= convertOnlineData(source);

test('online export preserves source objects, full raw project data and raw room data',async()=>{
  const result=await data(),project=result.projects[0],room=project.rooms[0];
  assert.equal(JSON.stringify(source),before,'resolving edited nomenclature must not mutate backup photo references');
  assert.deepEqual(project._main,source.orders[0]);
  assert.deepEqual(room._main,source.orders[0].rooms[0]);
  assert.equal(project.planImage,png);
  assert.equal(project.clientId,'original_client');
  assert.equal(project.status,'discuss','the distinct agreement stage must survive migration');
  assert.deepEqual(project.statusDates,source.orders[0].statusDates);
  assert.deepEqual(room.mats2,[{raw:'preserved'}]);
  assert.equal(room.film,true);
  assert.deepEqual(result.contractTemplate,source.contract);
});

test('buttons configuration is authoritative and retains identity, visibility and consumption settings',async()=>{
  const result=await data(),presets=result.presets.extra;
  assert.equal(presets[0].name,'Исходный пресет A');
  assert.equal(presets[0].items[0].nid,'u_migration_a');
  assert.equal(presets[0].items[0].k,1.5);
  assert.deepEqual(presets[0].cut,{gap:12});
  assert.deepEqual(presets[0].qdef,{source:'manual',unit:'м.п.'});
  assert.equal(presets[1].hidden,true);
  assert.equal(presets[1].archived,true);
  assert.equal(result.presets.canvas[0].items[0].k,2,'preserve the configured norm even though legacy canvas arithmetic ignored it');
});

test('same display names retain separate IDs, prices and scoped estimate corrections',async()=>{
  const result=await data(),report=result.migration.report;
  const duplicates=result.nom.filter(item=>['u_migration_a','u_migration_b'].includes(item.id));
  assert.equal(duplicates.length,2);
  assert.equal(duplicates[0].n,duplicates[1].n);
  assert.notEqual(duplicates[0].p,duplicates[1].p);
  assert.equal(report.parityOk,true);
  const roomLines=report.rooms[0].expectedLines;
  assert.equal(roomLines.find(line=>line.key==='u_migration_a').q,4.25);
  assert.equal(roomLines.find(line=>line.key==='u_migration_a').p,12.5);
  assert.equal(report.projects[0].expectedLines.find(line=>line.key==='u_migration_b').q,9);
  assert.equal(report.projects[0].expectedLines.find(line=>line.key==='u_migration_canvas|source_room').q,12);
  assert.equal(report.projects[0].mainTotalCents,report.projects[0].onlineTotalCents);
});

test('portable custom photo survives an edited photo null while blob references are explicitly unresolved',async()=>{
  const result=await data(),a=result.nom.find(item=>item.id==='u_migration_a'),b=result.nom.find(item=>item.id==='u_migration_b');
  assert.match(a.imageUrl,/^\/online\/nom\/nom-.*\.png$/);
  assert.equal(a.sourcePhoto,png);
  assert.equal(b.imageUrl,undefined);
  const unavailable=result.migration.report.unavailablePhotos.find(item=>item.id==='u_migration_b');
  assert.equal(unavailable.name,'Одинаковое название');
  assert.equal(unavailable.originalReference,'blob:https://old.example/photo');
  assert.equal(unavailable.reason,'source_blob_url_not_portable');
});

test('CLI requires an explicit input and output instead of falling back to an old seed',()=>{
  const result=spawnSync(process.execPath,['scripts/export-online-data.mjs'],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/Required: --input/);
});

test('all output suffixes, file aliases and public symlink paths are rejected before writing',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zamer-export-guards-'));
  try {
    const input=path.join(folder,'data.report.json'),output=path.join(folder,'data'),assets=path.join(folder,'nom');
    fs.writeFileSync(input,'original backup');
    assert.throws(()=>assertMigrationDestinations(input,output,assets),/aliases the source/);
    const hard=path.join(folder,'hard.json');fs.linkSync(input,hard);
    assert.throws(()=>assertMigrationDestinations(input,hard,assets),/aliases the source/);
    const symbolic=path.join(folder,'symbolic.json');fs.symlinkSync(input,symbolic);
    assert.throws(()=>assertMigrationDestinations(input,symbolic,assets),/aliases the source/);
    const publicAlias=path.join(folder,'public-alias');fs.symlinkSync(path.resolve('public'),publicAlias);
    assert.throws(()=>assertMigrationDestinations(input,path.join(publicAlias,'private-data.json'),assets),/outside public/);
    assert.equal(fs.readFileSync(input,'utf8'),'original backup');
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});

test('asset files replace destination links atomically without mutating linked source bytes',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zamer-export-asset-links-'));
  try {
    const input=path.join(folder,'original.json'),assets=path.join(folder,'nom');fs.mkdirSync(assets);
    fs.writeFileSync(input,'immutable source bytes');
    const second='u_migration_photo2',fixture=structuredClone(source);
    fixture.customNoms.push({id:second,name:'Второе фото',price:1,unit:'шт',type:'profile',photo:png});
    const firstTarget=path.join(assets,`nom-${Buffer.from('u_migration_a').toString('base64url')}.png`);
    const secondTarget=path.join(assets,`nom-${Buffer.from(second).toString('base64url')}.png`);
    fs.linkSync(input,firstTarget);fs.symlinkSync(input,secondTarget);
    await convertOnlineData(fixture,{assetsDir:assets});
    assert.equal(fs.readFileSync(input,'utf8'),'immutable source bytes');
    assert.notEqual(fs.statSync(input).ino,fs.statSync(firstTarget).ino);
    assert.equal(fs.lstatSync(secondTarget).isSymbolicLink(),false);
    assert.equal(fs.readFileSync(firstTarget).subarray(1,4).toString(),'PNG');
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});

test('original image files recover blob references by exact source ID with byte hashes',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zamer-original-photos-'));
  try {
    const bytes=Buffer.from(png.split(',')[1],'base64');
    fs.writeFileSync(path.join(folder,'u_migration_b.png'),bytes);
    const result=await convertOnlineData(source,{photosDir:folder});
    const b=result.nom.find(item=>item.id==='u_migration_b');
    assert.match(b.imageUrl,/\.png$/);
    assert.equal(b.sourcePhoto,'blob:https://old.example/photo');
    assert.equal(result.migration.report.unavailablePhotos.length,0);
    const image=result.migration.report.images.find(item=>item.id==='u_migration_b');
    assert.equal(image.source,'custom');
    assert.equal(image.recovered,true);
    assert.equal(image.originalFile,'u_migration_b.png');
    assert.equal(image.bytes,bytes.length);
    assert.equal(image.sha256.length,64);
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});


test('legacy EUROKRAAB photo fallback is migrated under the original ID without changing its price or references',async()=>{
 const result=await data(),item=result.nom.find(item=>item.id==='p_2');
 assert.equal(item.id,'p_2'); assert.match(item.n,/EUROKRAAB STRONG/);
 assert.ok(item.imageUrl?.startsWith('/online/nom/nom-cF8y.'));
 const image=result.migration.report.images.find(image=>image.id==='p_2');
 assert.equal(image?.fallbackImg,'p9_320_0','use the same EUROKRAAB STRONG photo selected by the old app');
 const originalPhoto=Buffer.from(NOM_V2_IMAGES[image.fallbackImg].split(',')[1],'base64');
 assert.equal(image.bytes,originalPhoto.length);
 assert.equal(image.sha256,crypto.createHash('sha256').update(originalPhoto).digest('hex'));
 assert.equal(result.migration.report.parityOk,true);
});
