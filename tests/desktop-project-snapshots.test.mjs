import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { roomDrawingPreview } from '../src/design-bridge/room-drawing-preview.js';
import { DCLogic, createDesktopStorage, desktopToday, desktopDisplayDate, desktopPeriodStart, desktopTodayLabel } from '../src/desktop/engine-base.js';
import { createDesktopDesignStorage, desktopMigrationMetadata } from '../src/desktop/desktop-storage.js';
import { nomKey, resolveNom, withEstimateImages } from '../src/desktop/nomenclature-identity.js';
import { instanceLines as desktopInstanceLines } from '../src/desktop/quantity-adapter.js';
import * as quantity from '../src/design-bridge/quantity-model.js';
import { normalizePhotoCrop, photoCropSourceUrl, MAX_PHOTO_ZOOM } from '../src/desktop/photo-crop.js';
import * as projectCatalog from '../src/desktop/project-catalog.js';

const clone = value => JSON.parse(JSON.stringify(value));
const line = { nid:'nom-a', n:'Профиль', p:100, u:'м.п.', m:1 };
const fixture = () => ({
  nom:[{ id:'nom-a',n:'Профиль',p:100,u:'м.п.',m:1,br:'Тест',img:'first.webp' },{ id:'nom-b',n:'Монтаж',p:50,u:'м.п.',m:0,br:'Тест' }],
  presets:{ canvas:[],main:[],extra:[{id:'preset-a',name:'Сборка',items:[{...line}]}],light:[],track:[],curtain:[],other:[] },
  blocks:[],roomOpts:[],estEd:{},
  projects:['a','b'].map(id=>({id:'project-'+id,name:'Проект '+id,status:'order',date:'01.11.2026',events:[],ops:[],rooms:[{id:'room-'+id,name:'Комната',on:true,v:[[0,0],[4,0],[4,3],[0,3]],canvas:{pid:null,off:{}},main:{pid:null,off:{}},extra:[{id:'instance-'+id,pid:'preset-a',qty:2}]}]})),
});

async function runtime({main=fixture(),saved,json=JSON}={}) {
  const entries=new Map(saved?[['zamer.desktop.v1',saved]]:[]),localStorage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const ctx=vm.createContext({...projectCatalog,JSON:json,DCLogic,createDesktopStorage:()=>createDesktopStorage(()=>localStorage,()=>ctx.MAGIC_MAIN),createDesktopDesignStorage,desktopMigrationMetadata,nomKey,resolveNom,withEstimateImages,desktopInstanceLines,normalizePhotoCrop,photoCropSourceUrl,MAX_PHOTO_ZOOM,desktopToday,desktopDisplayDate,desktopPeriodStart,desktopTodayLabel,console,confirm:()=>true,localStorage,setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},document:{querySelector:()=>null,addEventListener:()=>{},removeEventListener:()=>{},visibilityState:'visible'},addEventListener:()=>{},removeEventListener:()=>{}});
  vm.runInContext('window=globalThis;',ctx);
  for(const file of ['main-data.js','quantity.js','storage.js','estimate.js'])vm.runInContext(fs.readFileSync(new URL('../public/design/'+file,import.meta.url),'utf8'),ctx);
  ctx.MAGIC_MAIN=clone(main);ctx.MagicQuantity=quantity;ctx.MagicDraw={preview:roomDrawingPreview};
  const generated=fs.readFileSync(new URL('../src/desktop/generated/mobile-engine.js',import.meta.url),'utf8');
  vm.runInContext(generated.replace(/^import .*?;\n/gm,'').replace(/^export \{.*?\};\n/gm,'')+'\nglobalThis.API={Component,NOM,PRESETS,BLOCKS,ROOM_OPTS,est,mk,instLines};',ctx);
  return {...ctx.API,ctx,entries,app:new ctx.API.Component()};
}
const total=(r,id='project-a')=>r.est(r.app.state.projects.find(p=>p.id===id).rooms,r.app.ed(id)).total;
const changePrice=(r,price)=>{r.app.nomEdVals().niPrices[0].change({target:{value:String(price)}});r.app.nomEdVals().niDone();};
const openCatalog=r=>{r.app.go('nomEd',{curId:null,tab:null});r.app.nomEdVals().neGroups.flatMap(g=>g.items).find(n=>n.nid==='nom-a').open();};

test('global catalogue and preset edits preserve every existing project through browser save/reload',async()=>{
  let r=await runtime();assert.equal(total(r),200);
  openCatalog(r);changePrice(r,300);
  assert.equal(r.NOM[0].p,300);assert.equal(total(r),200,'a global price change cannot reprice an existing calculation');
  r.PRESETS.extra[0].items.push({nid:'nom-b',n:'Монтаж',p:50,u:'м.п.',m:0});
  r.PRESETS.extra[0].name='Новая сборка';
  assert.equal(total(r,'project-b'),200,'a global composition change cannot change another saved project');
  r.PRESETS.extra.splice(0,1);
  assert.equal(total(r),200,'deleting the library preset retains all its calculated rows');
  assert.equal(r.app.saveDesign(),true);
  r=await runtime({saved:r.entries.get('zamer.desktop.v1')});
  assert.equal(total(r),200);assert.equal(total(r,'project-b'),200);
});

test('opening latest catalogue data and cancelling keeps old prices; Save updates only the current project',async()=>{
  const r=await runtime();openCatalog(r);changePrice(r,300);
  r.app.openCalc('project-a');r.app.openNom({nid:'nom-a',...line});
  assert.equal(r.app.state.ni.p,'300');assert.equal(total(r),200);
  r.app.nomEdVals().niBack();assert.equal(total(r),200,'Back applies none of the latest catalogue data');
  r.app.openNom(line);r.app.nomEdVals().niDone();
  assert.equal(total(r),600);assert.equal(total(r,'project-b'),200);
});

test('preset editor opens the latest composition transactionally and applies it only on outer Save',async()=>{
  const r=await runtime();
  r.PRESETS.extra[0].items.push({nid:'nom-b',n:'Монтаж',p:50,u:'м.п.',m:0});
  r.app.openCalc('project-a');
  const edit=()=>r.app.quantityBlocks(r.app.cur().rooms[0],{a:12,p:14,inn:4,out:0},r.app.cur(),()=>({})).find(b=>b.id==='extra').insts[0].editButtons();
  edit();assert.equal(r.app.beVals().beItems.length,2);assert.equal(total(r),200);
  r.app.finishPresetDraft(false);assert.equal(total(r),200);
  edit();r.app.finishPresetDraft(true);
  assert.equal(total(r),300);assert.equal(total(r,'project-b'),200);
});

test('a deleted saved preset can be opened and cancelled without restoring it in the global library',async()=>{
  const r=await runtime();r.PRESETS.extra.splice(0,1);r.app.openCalc('project-a');
  const block=r.app.quantityBlocks(r.app.cur().rooms[0],{a:12,p:14,inn:4,out:0},r.app.cur(),()=>({})).find(b=>b.id==='extra');
  assert.equal(block.selLines[0].name,'Сборка');block.insts[0].editButtons();
  assert.equal(r.app.beVals().beName,'Сборка');r.app.finishPresetDraft(false);
  assert.equal(r.PRESETS.extra.length,0);assert.equal(total(r),200);
});

test('new instances use current prices while equal preset IDs in the same room retain their own prices',async()=>{
  const r=await runtime();openCatalog(r);changePrice(r,300);r.app.openCalc('project-a');
  r.app.calcVals().blocks.find(b=>b.id==='extra').addInst();
  const added=r.app.calcVals().blocks.find(b=>b.id==='extra').insts[1];added.qtyChange({target:{value:'3'}});added.qtyBlur();
  const instances=r.app.cur().rooms[0].extra;
  assert.equal(instances[0].presetSnapshot.items[0].p,100);assert.equal(instances[1].presetSnapshot.items[0].p,300);
  assert.equal(total(r),1100,'2 × 100 plus 3 × 300, with a weighted consolidated row');
  assert.equal(total(r,'project-b'),200);
  r.app.openNom(line);r.app.nomEdVals().niDone();assert.equal(total(r),1500);
});

test('a nested nomenclature Save waits for the outer preset Save and Back rolls back the whole transaction',async()=>{
  const r=await runtime();r.app.openCalc('project-a');
  const edit=()=>r.app.calcVals().blocks.find(b=>b.id==='extra').insts[0].editButtons();
  edit();r.app.openNom(line);changePrice(r,250);
  assert.equal(r.app.state.screen,'btnEd');assert.equal(total(r),200);assert.equal(r.NOM[0].p,250);
  r.app.finishPresetDraft(false);assert.equal(total(r),200);assert.equal(r.NOM[0].p,100);
  edit();r.app.openNom(line);changePrice(r,250);r.app.finishPresetDraft(true);
  assert.equal(total(r),500);assert.equal(total(r,'project-b'),200);
});

test('opening missing nomenclature has no catalogue side effect and Save restores only its original identity',async()=>{
  const r=await runtime();r.NOM.splice(0,1);const count=r.NOM.length;r.app.openCalc('project-a');
  const frozen=r.app.cur().rooms[0].extra[0].presetSnapshot.items[0];
  r.app.openNom(frozen);assert.equal(r.NOM.length,count);assert.equal(r.app.state.ni.ref,'nom-a');
  r.app.nomEdVals().niBack();assert.equal(r.NOM.length,count);assert.equal(total(r),200);
  r.app.openNom(frozen);changePrice(r,350);
  assert.equal(r.NOM.length,count+1);assert.equal(r.NOM.find(n=>n.id==='nom-a').p,350);
  assert.equal(total(r),700);assert.equal(total(r,'project-b'),200);
});

test('old options, quantities and exclusions survive global edits and a later explicit catalogue refresh',async()=>{
  const main=fixture();main.roomOpts=[{id:'option-a',...line,src:'perim',title:'Защита'}];
  for(const project of main.projects){project.rooms[0].opts={'option-a':true};project.rooms[0].extra[0].iq={'nom-a':4};project.rooms[0].extra[0].off={'nom-a':true};}
  const r=await runtime({main});assert.equal(total(r),1400);
  openCatalog(r);changePrice(r,300);r.ROOM_OPTS.splice(0,1);assert.equal(total(r),1400);
  r.app.openCalc('project-a');assert.equal(r.app.calculatorAppearanceVals().pcOptionsSummary.length,1);r.app.openNom(line);r.app.nomEdVals().niDone();
  assert.equal(total(r),4200);assert.equal(total(r,'project-b'),1400);
  assert.equal(r.app.cur().rooms[0].extra[0].iq['nom-a'],4);assert.equal(r.app.cur().rooms[0].extra[0].off['nom-a'],true);
});

test('new rooms and copied calculations retain independent catalogue values through save/reload',async()=>{
  let r=await runtime();openCatalog(r);changePrice(r,300);
  const fresh=r.mk('Новая',[[0,0],[4,0],[4,3],[0,3]],{extra:[['preset-a',2]]});
  r.app.upd('project-a',p=>({...p,rooms:p.rooms.concat(fresh)}));
  assert.equal(total(r),800);assert.equal(total(r,'project-b'),200);
  r.app.openProject('project-a');r.app.projectVals().projMenu.find(x=>x.label==='Дублировать проект').pick();
  const copied=r.app.state.projects[0];assert.equal(r.est(copied.rooms,{}).total,800);
  r.app.saveDesign();r=await runtime({saved:r.entries.get('zamer.desktop.v1')});
  assert.equal(total(r),800);assert.equal(r.est(r.app.state.projects[0].rooms,{}).total,800);
});

test('a newly created project saves immediately and after its first frozen room is added',async()=>{
  let r=await runtime();r.app.go('new',{nf:{name:'Новый расчёт',client:'',designer:'',phone:'',address:'',notes:''}});r.app.newVals().nfCreate();
  const id=r.app.cur().id;assert.equal(r.app.cur().calculationSnapshotVersion,1);assert.equal(r.app.saveDesign(),true);
  const fresh=r.mk('Комната',[[0,0],[4,0],[4,3],[0,3]],{extra:[['preset-a',2]]});
  r.app.upd(id,p=>({...p,rooms:[fresh]}));assert.equal(r.app.saveDesign(),true);assert.equal(total(r,id),200);
  r=await runtime({saved:r.entries.get('zamer.desktop.v1')});assert.equal(total(r,id),200);
});

test('frozen deduction definitions are used both when calculating and when changing quantities',async()=>{
  const main=fixture();main.presets.main=[{id:'main-a',name:'Основной',items:[{...line}]}];
  main.projects[0].rooms[0].main={pid:'main-a',qtyO:14,off:{}};main.projects[0].rooms[0].extra[0].subP=true;
  const r=await runtime({main});r.app.openCalc('project-a');
  r.BLOCKS.find(b=>b.id==='extra').subP=false;
  let values=r.app.calcVals().blocks;values.find(b=>b.id==='extra').insts[0].inc();
  values=r.app.calcVals().blocks;assert.equal(values.find(b=>b.title==='Основной профиль').quantity.value,13.5,'editing a length still deducts under the saved room definition');
  values.find(b=>b.title==='Основной профиль').qtyChange({target:{value:'10'}});values.find(b=>b.title==='Основной профиль').qtyBlur();
  assert.equal(r.app.calcVals().blocks.find(b=>b.title==='Основной профиль').quantity.value,10);
});

test('accepting a newly identified legacy item retains project quantity overrides and removes only its price override',async()=>{
  const main=fixture();delete main.nom[0].id;delete main.presets.extra[0].items[0].nid;
  main.estEd={'project-a':{'Профиль':{q:7,p:500}}};
  const r=await runtime({main});assert.equal(total(r),3500);r.app.openCalc('project-a');r.app.openNom('Профиль');changePrice(r,250);
  const key=r.NOM[0].id;assert.deepEqual(clone(r.app.ed('project-a')),{[key]:{q:7,u:'м.п.'}});
  assert.equal(total(r),1750);assert.equal(total(r,'project-b'),200);
});

test('one identity with historical and current units produces separate stable rows within and across rooms',async()=>{
  const r=await runtime();openCatalog(r);r.app.nomEdVals().niUnits.find(u=>u.label==='шт').pick();changePrice(r,300);r.app.openCalc('project-a');
  r.app.calcVals().blocks.find(b=>b.id==='extra').addInst();
  const added=r.app.calcVals().blocks.find(b=>b.id==='extra').insts[1];added.qtyChange({target:{value:'3'}});added.qtyBlur();
  const rows=()=>r.est(r.app.cur().rooms,{}).mats.map(row=>({k:row.k,q:row.q,u:row.u,p:row.p,t:row.t})).sort((a,b)=>a.u.localeCompare(b.u));
  const expected=[{k:'nom-a|unit:'+encodeURIComponent('м.п.'),q:2,u:'м.п.',p:100,t:200},{k:'nom-a|unit:'+encodeURIComponent('шт'),q:3,u:'шт',p:300,t:900}].sort((a,b)=>a.u.localeCompare(b.u));
  assert.deepEqual(clone(rows()),expected);assert.equal(total(r),1100);
  const project=r.app.cur(),room=project.rooms[0],second={...clone(room),id:'second-room',extra:[clone(room.extra[1])]};
  r.app.upd(project.id,p=>({...p,rooms:[{...room,extra:[room.extra[0]]},second]}));assert.deepEqual(clone(rows()),expected);
  r.app.upd(project.id,p=>({...p,rooms:[...p.rooms].reverse()}));assert.deepEqual(clone(rows()),expected,'keys are independent of room order');
  assert.equal(r.est(r.app.cur().rooms,{[expected.find(x=>x.u==='м.п.').k]:{q:7,p:11}}).total,977);
});

test('restoring a deleted preset keeps project-only photo markers out of the editable global library',async()=>{
  const main=fixture();main.presets.extra[0].items[0].variants=[{...line},{nid:'nom-b',n:'Монтаж',p:50,u:'м.п.',m:0}];
  const r=await runtime({main});r.PRESETS.extra.splice(0,1);r.NOM[0].imageUrl='/online/new-photo.webp';r.NOM[0].p=350;r.NOM[1].p=75;r.app.openCalc('project-a');
  const old=r.app.cur().rooms[0].extra[0].presetSnapshot.items[0];assert.equal(old._photoFrozen,true);
  r.app.calcVals().blocks.find(b=>b.id==='extra').insts[0].editButtons();
  assert.equal(r.PRESETS.extra[0].items[0]._photoFrozen,undefined,'restored library rows remain live for subsequent selections');
  assert.equal(r.PRESETS.extra[0].items[0].p,350);assert.deepEqual(clone(r.PRESETS.extra[0].items[0].variants.map(x=>x.p)),[350,75]);assert.equal(r.PRESETS.extra[0].items[0].variants[0]._photoFrozen,undefined);
  assert.equal(r.app.cur().rooms[0].extra[0].presetSnapshot.items[0].img,'/design/nom/first.webp');
  assert.equal(total(r),200,'opening the restored editor leaves the calculation unchanged until Save');
  assert.equal(r.app.finishPresetDraft(true),true,JSON.stringify(r.app.persistenceError));r.app.calcVals().blocks.find(b=>b.id==='extra').addInst();
  assert.equal(r.app.cur().rooms[0].extra[1].presetSnapshot.items[0].img,'/online/new-photo.webp');
  assert.equal(r.app.cur().rooms[0].extra[1].presetSnapshot.items[0].p,350);
});

test('duplicating a calculated project copies its own estimate overrides without sharing them',async()=>{
  const main=fixture();main.estEd={'project-a':{'nom-a':{q:7,p:321}}};
  let r=await runtime({main});assert.equal(total(r),2247);r.app.openProject('project-a');r.app.projectVals().projMenu.find(x=>x.label==='Дублировать проект').pick();
  const copy=r.app.state.projects[0];assert.notEqual(copy.id,'project-a');assert.deepEqual(clone(r.app.ed(copy.id)),{'nom-a':{q:7,p:321,u:'м.п.'}});assert.notEqual(r.app.ed(copy.id),r.app.ed('project-a'));
  assert.equal(total(r,copy.id),2247);r.app.saveDesign();r=await runtime({main,saved:r.entries.get('zamer.desktop.v1')});assert.equal(total(r,copy.id),2247);assert.equal(total(r),2247);
});

test('a legacy unqualified quantity override is not repeated onto a new unit of the same nomenclature',async()=>{
  for(const scope of ['project','room']){
    const main=fixture();if(scope==='project')main.estEd={'project-a':{'nom-a':{q:7}}};else main.projects[0].rooms[0].estEd={'nom-a':{q:7}};
    const r=await runtime({main});assert.equal(total(r),700);openCatalog(r);r.app.nomEdVals().niUnits.find(u=>u.label==='шт').pick();changePrice(r,300);r.app.openCalc('project-a');
    r.app.calcVals().blocks.find(b=>b.id==='extra').addInst();const added=r.app.calcVals().blocks.find(b=>b.id==='extra').insts[1];added.qtyChange({target:{value:'3'}});added.qtyBlur();
    const estimate=r.est(r.app.cur().rooms,r.app.ed('project-a'));
    assert.equal(estimate.mats.find(row=>row.u==='м.п.').q,7);assert.equal(estimate.mats.find(row=>row.u==='шт').q,3,scope+' override belongs to the original unit');
    assert.equal(estimate.total,1600);
    const original=r.app.cur().rooms[0],fresh=r.mk('Новая комната',[[0,0],[4,0],[4,3],[0,3]],{extra:[['preset-a',3]]});original.catalogSnapshot.capturedAt=1;fresh.catalogSnapshot.capturedAt=2;
    r.app.upd('project-a',p=>({...p,rooms:[fresh,{...original,extra:[original.extra[0]]}]}));
    assert.equal(total(r),1600,'placing a newer room first keeps legacy overrides attached to the original unit');
    r.app.upd('project-a',p=>({...p,rooms:[fresh]}));assert.equal(total(r),900,'removing the original room cannot transfer its override to another unit');
    assert.equal(r.app.saveDesign(),true);const restored=await runtime({main,saved:r.entries.get('zamer.desktop.v1')});assert.equal(total(restored),900,'the original unit binding also survives reload');
  }
});

test('an override explicitly bound to a unit remains authoritative when surviving rooms have another provenance order',async()=>{
  const main=fixture();main.estEd={'project-a':{'nom-a':{q:7,u:'м.п.'}}};
  const r=await runtime({main});openCatalog(r);r.app.nomEdVals().niUnits.find(u=>u.label==='шт').pick();changePrice(r,300);r.app.openCalc('project-a');
  const original=r.app.cur().rooms[0],oldCopy={...clone(original),id:'retained-old-room'},fresh=r.mk('Новая комната',[[0,0],[4,0],[4,3],[0,3]],{extra:[['preset-a',3]]});
  fresh.catalogSnapshot.capturedAt=2;oldCopy.catalogSnapshot.capturedAt=3;
  r.app.upd('project-a',p=>({...p,rooms:[fresh,oldCopy]}));
  const estimate=r.est(r.app.cur().rooms,r.app.ed('project-a'));
  assert.equal(estimate.mats.find(row=>row.u==='м.п.').q,7);assert.equal(estimate.mats.find(row=>row.u==='шт').q,3);assert.equal(estimate.total,1600);
});

test('large repeated project photographs are never JSON-cloned during seed, room edits, preset drafts or duplication',async()=>{
  const main=fixture(),photo='data:image/png;base64,'+'QUJD'.repeat(64*1024),base=main.projects[0].rooms[0];main.nom[0].imageUrl=photo;
  main.projects[0].rooms=Array.from({length:32},(_,index)=>({...clone(base),id:'photo-room-'+index,extra:Array.from({length:8},(_,n)=>({...clone(base.extra[0]),id:'photo-instance-'+index+'-'+n}))}));
  let frozenSerializations=0;
  const hasFrozenPhoto=value=>{const stack=[value],seen=new Set();while(stack.length){const item=stack.pop();if(!item||typeof item!=='object'||seen.has(item))continue;seen.add(item);if(item._photoFrozen&&(item.imageUrl===photo||item.img===photo))return true;for(const child of Object.values(item))if(child&&typeof child==='object')stack.push(child);}return false;};
  const json={parse:JSON.parse,stringify:(value,...args)=>{if(hasFrozenPhoto(value)){frozenSerializations++;throw Error('A frozen project photo must not pass through JSON.stringify for cloning');}return JSON.stringify(value,...args);}};
  const r=await runtime({main,json});assert.equal(r.app.state.projects[0].rooms.length,32);r.app.openCalc('project-a');
  r.app.updRoom(room=>{room.extra[0].qty=3;return room;});assert.equal(r.app.cur().rooms[0].extra[0].qty,3);
  r.app.calcVals().roomMenu.find(item=>item.label==='Дублировать').pick();assert.equal(r.app.cur().rooms.length,33);
  const edit=()=>r.app.calcVals().blocks.find(b=>b.id==='extra').insts[0].editButtons();edit();r.app.finishPresetDraft(false);
  r.app.openProject('project-a');r.app.projectVals().projMenu.find(x=>x.label==='Дублировать проект').pick();
  assert.equal(r.app.state.projects[0].rooms[0].extra[0].presetSnapshot.items[0].imageUrl,photo);
  assert.equal(frozenSerializations,0);
});
