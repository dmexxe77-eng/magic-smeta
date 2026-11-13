import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureProjectCatalog, ensureProjectCatalog, captureRoomCatalog, captureInstancePreset,
  blocksForRoom, optionsForRoom, presetForInstance,
  refreshProjectNom, refreshProjectPreset, validProjectCalculation,
  projectNomPriceKeys, projectPresetPriceKeys, clearProjectPriceOverrides,
} from '../src/desktop/project-catalog.js';
import * as projectCatalogModel from '../src/desktop/project-catalog.js';

const copy = value => JSON.parse(JSON.stringify(value));
const photo = 'data:image/png;base64,cGhvdG8=';
const nom = (id, p) => ({id, n:`Позиция ${id}`, p, u:'м.п.', m:1, br:'MSD', pInst:40, pCost:20, mult:2, imageUrl:photo, photoSource:`${photo}original`, photoCrop:{v:1,zoom:2}});
const row = (id,p,extra={}) => ({nid:id,n:`Позиция ${id}`,p,u:'м.п.',m:1,...extra});
const library = () => ({
  blocks:[{id:'canvas',title:'Полотно',single:true},{id:'main',title:'Основной профиль',single:true},{id:'extra',title:'Дополнительный профиль',single:false}],
  presets:{canvas:[{id:'canvas-a',name:'Полотно',items:[row('a',100)]}],main:[{id:'main-a',name:'Основной',items:[row('a',110,{src:'perim',k:2,variants:[row('b',200),row('c',300)]}),row('b',220)]}],extra:[{id:'extra-a',name:'Дополнительный',items:[row('a',120)]}]},
  nom:[nom('a',100),nom('b',200),nom('c',300),nom('d',400),nom('option',50)],
  roomOpts:[{...row('option',50),id:'opt-a',title:'Защита'}],
});
const project = () => ({id:'project-a',name:'Корсакова',nomSnapshot:{a:90},rooms:[{
  id:'room-a',name:'Гостиная',on:true,v:[],canvas:{pid:'canvas-a',qtyO:12},
  main:{pid:'main-a',qtyBase:20,off:{b:true},iq:{a:7},variants:{a:'c'}},
  extra:[{id:'instance-a',pid:'extra-a',qty:3,subP:true}],
  extraItems:[{...row('d',440),id:'extra-item-a',qty:2}],opts:{'opt-a':true},
  estEd:{a:{p:90,q:2},'a|room-a':{p:95},b:{p:180},unrelated:{p:999}},
}]});

test('capture stores independent room definitions, instance assembly prices, alternatives and rendered photos',()=>{
  const source=library(),original=project(),frozen=captureProjectCatalog(original,source),room=frozen.rooms[0];
  assert.equal(original.rooms[0].catalogSnapshot,undefined);
  assert.equal(room.catalogSnapshot.version,1);
  assert.equal(room.main.presetSnapshot.version,1);
  assert.equal(room.main.presetSnapshot.items[0].p,110,'assembly price stays authoritative');
  assert.equal(room.main.presetSnapshot.items[0].img,photo);
  assert.equal(room.main.presetSnapshot.items[0]._photoFrozen,true);
  assert.equal(room.main.presetSnapshot.items[0].variants[1].img,photo);
  assert.equal(room.extraItems[0].img,photo);
  assert.equal(room.extraItems[0].p,440);
  assert.ok(!JSON.stringify(frozen).includes('photoSource'));
  assert.ok(!JSON.stringify(frozen).includes('photoCrop'));
  source.presets.main[0].items[0].p=9999;source.presets.main=[];source.nom[0].imageUrl='new.png';source.blocks[1].title='Новое';
  assert.equal(presetForInstance(room.main,'main',source).items[0].p,110);
  assert.equal(blocksForRoom(room,source)[1].title,'Основной профиль');
  assert.equal(presetForInstance(room.main,'main',source).items[0].img,photo);
  assert.ok(validProjectCalculation(frozen));
});

test('new rooms and new instances in an existing project capture current libraries independently',()=>{
  const source=library(),original=captureProjectCatalog(project(),source);
  source.presets.main[0].items[0].p=555;source.nom[0].imageUrl='fresh.png';
  const newInstance=captureInstancePreset({pid:'main-a',qty:4},'main',source);
  const newRoom=captureRoomCatalog(project().rooms[0],source);
  original.rooms[0].extra.push(newInstance);original.rooms.push(newRoom);
  assert.equal(original.rooms[0].main.presetSnapshot.items[0].p,110);
  assert.equal(newInstance.presetSnapshot.items[0].p,555);
  assert.equal(newRoom.main.presetSnapshot.items[0].p,555);
  assert.equal(newInstance.presetSnapshot.items[0].img,'fresh.png');
});

test('capture includes disabled rooms and legacy instances and keeps unresolved positions without guessing',()=>{
  const source=library(),original=project();original.rooms[0].on=false;
  original.rooms[0].extra[0]={id:'legacy',btnId:'extra-a',qty:4};
  source.presets.main[0].items.push(row('missing',0,{_unresolved:true}));
  const frozen=captureProjectCatalog(original,source);
  assert.equal(frozen.rooms[0].extra[0].presetSnapshot.id,'extra-a');
  assert.equal(frozen.rooms[0].main.presetSnapshot.items.at(-1)._unresolved,true);
  assert.equal(frozen.rooms[0].main.presetSnapshot.items.at(-1)._photoFrozen,true);
});

test('capture is additive across repeated migration and JSON reload and legacy reads can still resolve global defaults',()=>{
  const source=library(),original=project(),frozen=captureProjectCatalog(original,source);
  assert.equal(ensureProjectCatalog(frozen,source),frozen);
  const restored=copy(frozen);source.presets.main=[];source.roomOpts=[];
  assert.equal(ensureProjectCatalog(restored,source),restored);
  assert.equal(presetForInstance(restored.rooms[0].main,'main',source).name,'Основной');
  assert.equal(optionsForRoom(restored.rooms[0],source)[0].p,50);
  assert.equal(blocksForRoom(original.rooms[0],source),source.blocks);
  assert.equal(optionsForRoom(original.rooms[0],source),source.roomOpts);
  assert.equal(presetForInstance({pid:'canvas-a'},'canvas',source),source.presets.canvas[0]);
  assert.ok(validProjectCalculation(restored));
});

test('capturing a missing or unselected preset records an explicit empty snapshot that never falls back later',()=>{
  const source=library(),missing=captureInstancePreset({pid:'deleted'},'main',source),empty=captureInstancePreset({pid:null},'main',source);
  source.presets.main.push({id:'deleted',name:'Новый',items:[row('a',999)]});
  assert.equal(presetForInstance(missing,'main',source).missing,true);
  assert.deepEqual(presetForInstance(missing,'main',source).items,[]);
  assert.deepEqual(presetForInstance(empty,'main',source).items,[]);
  assert.equal(presetForInstance({},'missing',source),undefined);
});

test('explicit nomenclature Save refreshes only the selected project across assemblies, alternatives, options and extras',()=>{
  const source=library(),original=project();original.rooms[0].extraItems.push({...row('a',100),id:'extra-a',qty:5});source.roomOpts[0].nid='a';
  const frozen=captureProjectCatalog(original,source),before=copy(frozen),other=captureProjectCatalog(project(),source),record={...nom('a',777),n:'Новое название',mult:4};
  const changed=refreshProjectNom(frozen,'a',record),room=changed.rooms[0];
  assert.equal(room.main.presetSnapshot.items[0].p,777);
  assert.equal(room.canvas.presetSnapshot.items[0].p,777);
  assert.equal(room.extra[0].presetSnapshot.items[0].p,777);
  assert.equal(room.main.presetSnapshot.items[0].src,'perim');assert.equal(room.main.presetSnapshot.items[0].k,2);
  assert.equal(room.main.presetSnapshot.items[0].variants[0].p,200);
  assert.equal(room.catalogSnapshot.roomOpts[0].p,777);
  assert.equal(room.extraItems.at(-1).p,777);assert.equal(room.extraItems.at(-1).qty,5);
  assert.equal(room.extraItems[0].p,440);
  assert.deepEqual(room.main.iq,{a:7});assert.deepEqual(room.main.variants,{a:'c'});
  assert.deepEqual(room.estEd,{a:{q:2,u:'м.п.'},b:{p:180,u:'м.п.'},unrelated:{p:999}});
  assert.equal(changed.nomSnapshot.a,90,'legacy migration metadata stays unchanged');
  assert.deepEqual(frozen,before);
  assert.equal(other.rooms[0].main.presetSnapshot.items[0].p,110);
  assert.ok(!JSON.stringify(changed).includes('photoSource'));
});

test('saving a variant changes the alternative while preserving parent identity and all quantities',()=>{
  const frozen=captureProjectCatalog(project(),library()),before=copy(frozen),replacement={...nom('c',3333),photoRemoved:true};
  const changed=refreshProjectNom(frozen,{nid:'c'},replacement),room=changed.rooms[0];
  assert.equal(room.main.presetSnapshot.items[0].variants[1].p,3333);
  assert.equal(room.main.presetSnapshot.items[0].variants[1].img,undefined);
  assert.equal(room.main.presetSnapshot.items[0].variants[1].photoRemoved,true);
  assert.equal(room.main.presetSnapshot.items[0].nid,'a');
  assert.deepEqual(room.main.iq,before.rooms[0].main.iq);
  assert.deepEqual(room.main.variants,before.rooms[0].main.variants);
  assert.equal(room.canvas.presetSnapshot.items[0].p,100);
});

test('saving a preset replaces only matching instances using current prices and preserves manual calculation settings',()=>{
  const source=library(),original=captureProjectCatalog(project(),source),before=copy(original);
  source.presets.main[0]={id:'main-a',name:'Новая сборка',qdef:{source:'perim',unit:'м.п.'},items:[row('a',999,{src:'manual',k:3}),row('d',999)]};
  source.nom[0].p=777;source.nom[3].p=888;source.nom[3].imageUrl='new.png';
  const changed=refreshProjectPreset(original,'main','main-a',source),room=changed.rooms[0];
  assert.equal(room.main.presetSnapshot.name,'Новая сборка');
  assert.deepEqual(room.main.presetSnapshot.items.map(i=>i.p),[777,888]);
  assert.equal(room.main.presetSnapshot.items[0].src,'manual');assert.equal(room.main.presetSnapshot.items[0].k,3);
  assert.equal(room.main.presetSnapshot.items[1].img,'new.png');
  assert.equal(room.canvas.presetSnapshot.items[0].p,100);assert.equal(room.extra[0].presetSnapshot.items[0].p,120);
  const {presetSnapshot,...instance}=room.main,{presetSnapshot:oldPreset,...oldInstance}=before.rooms[0].main;
  assert.deepEqual(instance,{...oldInstance,iq:{},variants:{},off:{}},'removed rows and alternatives cannot retain stale manual state');
  assert.deepEqual(room.extraItems,before.rooms[0].extraItems);
  assert.deepEqual(room.estEd,{a:{q:2,u:'м.п.'},unrelated:{p:999}});
  assert.deepEqual(original,before);
});

test('preset refresh applies alternatives to all matching room instances without changing sibling instances',()=>{
  const source=library(),original=project();original.rooms.push(copy(original.rooms[0]));original.rooms[1].id='room-b';
  const frozen=captureProjectCatalog(original,source);source.nom[1].p=234;source.nom[2].p=345;
  const changed=refreshProjectPreset(frozen,'main','main-a',source);
  for(const room of changed.rooms){assert.deepEqual(room.main.presetSnapshot.items[0].variants.map(i=>i.p),[234,345]);assert.equal(room.main.variants.a,'c');}
  assert.equal(changed.rooms[0].extra[0].presetSnapshot.items[0].p,120);
});

test('deleted presets and unknown positions keep their captured calculation',()=>{
  const source=library(),frozen=captureProjectCatalog(project(),source);source.presets.main=[];
  assert.equal(refreshProjectPreset(frozen,'main','main-a',source),frozen);
  assert.equal(refreshProjectPreset(frozen,'unknown','unknown',source),frozen);
  assert.equal(refreshProjectNom(frozen,'unknown',nom('a',100)),frozen);
  assert.equal(refreshProjectNom(project(),'a',nom('a',200)).rooms[0].catalogSnapshot,undefined);
});

test('equal names keep distinct catalogue identities while name-only references remain supported',()=>{
  const source=library();source.nom[1].n=source.nom[0].n;
  source.presets.main[0].items=[row('a',100),{...row('b',200),n:source.nom[0].n},{n:'Позиция c',p:345,u:'шт',m:1}];
  const frozen=captureProjectCatalog(project(),source),changed=refreshProjectNom(frozen,'b',nom('b',999));
  assert.deepEqual(changed.rooms[0].main.presetSnapshot.items.map(i=>i.p),[100,999,345]);
  assert.equal(changed.rooms[0].main.presetSnapshot.items[2].img,photo);
});

test('validation rejects malformed room and instance snapshots, duplicate block ids and invalid row prices',()=>{
  const valid=captureProjectCatalog(project(),library());
  for(const mutate of [value=>{value.rooms[0].catalogSnapshot.version=2;},value=>{delete value.rooms[0].catalogSnapshot.blocks;},
    value=>{value.rooms[0].main.presetSnapshot.items[0].p=-1;},value=>{value.rooms[0].main.presetSnapshot.items[0].p=Infinity;},
    value=>{value.rooms[0].main.presetSnapshot.items[0].variants[0].u=null;},
    value=>{value.rooms[0].catalogSnapshot.blocks.push(copy(value.rooms[0].catalogSnapshot.blocks[0]));},
    value=>{value.rooms[0].catalogSnapshot.blocks[0].id='__proto__';},value=>{value.rooms[0].catalogSnapshot.roomOpts[0].p='50';},
    value=>{delete value.rooms[0].main.presetSnapshot;},
  ]){const invalid=copy(valid);mutate(invalid);assert.equal(validProjectCalculation(invalid),false);}
  for(const invalid of [null,[],{},1])assert.equal(validProjectCalculation(invalid),false);
});

test('empty projects and null-photo rows roundtrip with no leaked source metadata',()=>{
  const source=library();source.nom[0].photoRemoved=true;source.blocks[0].photoSource='secret';
  const frozen=captureProjectCatalog(project(),source),empty=captureProjectCatalog({id:'empty',name:'Пустой',rooms:[]},source);
  assert.equal(frozen.rooms[0].canvas.presetSnapshot.items[0].img,undefined);
  assert.equal(frozen.rooms[0].canvas.presetSnapshot.items[0]._photoFrozen,true);
  assert.ok(validProjectCalculation(empty));assert.ok(validProjectCalculation(copy(frozen)));
  assert.ok(!JSON.stringify(frozen).includes('photoSource'));
});

test('a legacy name changing into a stable id remaps the current calculation quantities, switches and variant references',()=>{
  const source=library(),original=project(),legacy='Старый профиль';
  source.presets.main[0].items=[{n:legacy,p:50,u:'шт',m:1}];
  original.rooms[0].main={pid:'main-a',qtyBase:20,off:{[legacy]:true},iq:{[legacy]:7},variants:{[legacy]:legacy}};
  original.rooms[0].estEd={[legacy]:{p:45,q:2},[`${legacy}|room-a`]:{p:46}};
  const frozen=captureProjectCatalog(original,source),next=refreshProjectNom(frozen,legacy,{...nom('stable',555),u:'шт'});
  assert.equal(next.rooms[0].main.presetSnapshot.items[0].nid,'stable');
  assert.deepEqual(next.rooms[0].main.off,{stable:true});
  assert.deepEqual(next.rooms[0].main.iq,{stable:7});
  assert.deepEqual(next.rooms[0].main.variants,{stable:'stable'});
  assert.deepEqual(next.rooms[0].estEd,{stable:{q:2,u:'шт'}});
  assert.deepEqual([...projectNomPriceKeys(frozen,legacy)],[legacy]);
});

test('refreshed assemblies discard removed variant selections and incompatible manual counts while retaining compatible values',()=>{
  const source=library(),original=project();
  original.rooms[0].main.variants={a:'c'};original.rooms[0].main.iq={a:7,b:8,unrelated:9};
  const frozen=captureProjectCatalog(original,source);
  source.presets.main[0].items[0].variants=[row('b',200)];
  let next=refreshProjectPreset(frozen,'main','main-a',source);
  assert.deepEqual(next.rooms[0].main.variants,{a:'b'});
  assert.deepEqual(next.rooms[0].main.iq,{b:8});
  source.presets.main[0].items[0].variants=[row('c',300)];
  next=refreshProjectPreset(frozen,'main','main-a',source);
  assert.equal(next.rooms[0].main.variants.a,'c');
  assert.equal(next.rooms[0].main.iq.a,7);
  source.nom[2].u='шт';
  next=refreshProjectPreset(frozen,'main','main-a',source);
  assert.equal(next.rooms[0].main.iq.a,undefined,'the same selected alternative with a changed unit is incompatible');
});

test('price override helpers target only affected identities and keep independent quantity overrides',()=>{
  const frozen=captureProjectCatalog(project(),library());
  assert.deepEqual([...projectNomPriceKeys(frozen,{nid:'a'})],['a']);
  assert.deepEqual([...projectPresetPriceKeys(frozen,'main','main-a')].sort(),['a','b','c']);
  assert.deepEqual(clearProjectPriceOverrides({a:{p:10,q:2},'a|r':{p:20},other:{p:30}},new Set(['a'])),{a:{q:2},other:{p:30}});
  assert.equal(clearProjectPriceOverrides(null,new Set()),null);
  assert.deepEqual(projectNomPriceKeys(frozen,'no-such-key'),new Set());
});

test('malformed block data or omitted required definitions cannot silently remove a calculation',()=>{
  const valid=captureProjectCatalog(project(),library());
  for(const mutate of [
    value=>{value.rooms[0].catalogSnapshot.blocks=value.rooms[0].catalogSnapshot.blocks.filter(b=>b.id!=='main');},
    value=>{value.rooms[0].catalogSnapshot.blocks[0].source='unknown';},
    value=>{value.rooms[0].catalogSnapshot.blocks[0].unit=4;},
    value=>{value.rooms[0].catalogSnapshot.blocks[0].single='yes';},
    value=>{value.rooms[0].main=[];},value=>{value.rooms[0].extra={bad:'shape'};},
    value=>{value.rooms[0].extra=[null];},
    value=>{value.rooms[0].catalogSnapshot.roomOpts.push(copy(value.rooms[0].catalogSnapshot.roomOpts[0]));},
  ]){const invalid=copy(valid);mutate(invalid);assert.equal(validProjectCalculation(invalid),false);}
});

test('an explicitly repaired catalogue position becomes usable and numeric identities preserve variant selection type',()=>{
  const source=library(),original=project();
  source.presets.main[0].items=[{n:'Старая позиция',p:0,u:'шт',m:1,_unresolved:true}];
  original.rooms[0].main.variants={'Старая позиция':'Старая позиция'};
  const frozen=captureProjectCatalog(original,source),next=refreshProjectNom(frozen,'Старая позиция',nom(13,200));
  assert.equal(next.rooms[0].main.presetSnapshot.items[0]._unresolved,undefined);
  assert.deepEqual(next.rooms[0].main.variants,{'13':13});
});

test('a legacy material canvas keeps room-scoped pricing when an explicit catalogue save assigns its first stable id',()=>{
  const source=library();source.presets.canvas[0].items=[{n:'Старое полотно',p:100,u:'м²',m:1}];
  const frozen=captureProjectCatalog(project(),source),record={id:'new-canvas',n:'Новое полотно',p:150,u:'м²',m:1,br:'MSD'};
  const next=refreshProjectNom(frozen,'Старое полотно',record);
  assert.equal(next.rooms[0].canvas.presetSnapshot.items[0].cv,1);
  assert.equal(next.rooms[0].canvas.presetSnapshot.items[0].nid,'new-canvas');
  const equipment=refreshProjectNom(frozen,'Старое полотно',{...record,category:'equipment'});
  assert.equal(equipment.rooms[0].canvas.presetSnapshot.items[0].cv,undefined);
});

test('implicit default alternatives discard incompatible counts after refresh and preserve compatible counts',()=>{
  for(const change of ['identity','unit','compatible']){
    const source=library(),original=project();original.rooms[0].main.variants={};
    const frozen=captureProjectCatalog(original,source);
    if(change==='identity')source.presets.main[0].items[0].variants=[row('c',300)];
    if(change==='unit')source.nom[1].u='шт';
    if(change==='compatible')source.nom[1].p=999;
    const next=refreshProjectPreset(frozen,'main','main-a',source);
    assert.equal(next.rooms[0].main.iq.a,change==='compatible'?7:undefined,change);
    assert.equal(next.rooms[0].main.qtyBase,20);
  }
});

test('removed rows cannot revive prior disabled flags, quantities or variant selections when re-added',()=>{
  const source=library(),original=project();
  Object.assign(original.rooms[0].main,{off:{a:false,b:true,unrelated:true},iq:{a:7,b:8,unrelated:9},variants:{a:'c',b:'b',unrelated:'a'}});
  const frozen=captureProjectCatalog(original,source),removed=source.presets.main[0].items.pop();
  const without=refreshProjectPreset(frozen,'main','main-a',source);
  assert.deepEqual(without.rooms[0].main.off,{a:false});
  assert.deepEqual(without.rooms[0].main.iq,{a:7});
  assert.deepEqual(without.rooms[0].main.variants,{a:'c'});
  source.presets.main[0].items.push(removed);
  const restored=refreshProjectPreset(without,'main','main-a',source);
  assert.equal(restored.rooms[0].main.off.b,undefined);
  assert.equal(restored.rooms[0].main.iq.b,undefined);
  assert.equal(restored.rooms[0].main.variants.b,undefined);
  assert.equal(restored.rooms[0].main.qtyBase,20);
});

test('a retained base row changing its unit discards its manual quantity without changing block quantity',()=>{
  const source=library(),original=project();original.rooms[0].main.iq.b=9;
  const frozen=captureProjectCatalog(original,source);source.nom[1].u='шт';
  const next=refreshProjectPreset(frozen,'main','main-a',source);
  assert.equal(next.rooms[0].main.iq.b,undefined);
  assert.equal(next.rooms[0].main.qtyBase,20);
});

test('explicit nomenclature saves reset counts only when that row is the effective position and changes unit',()=>{
  for(const selection of ['base','selected','default','inactive']){
    const source=library(),original=project();original.rooms[0].main.iq={a:7,b:8};
    if(selection==='base')delete source.presets.main[0].items[0].variants;
    if(selection==='default')original.rooms[0].main.variants={};
    const frozen=captureProjectCatalog(original,source),target=selection==='base'?'a':selection==='selected'?'c':'b';
    const next=refreshProjectNom(frozen,target,{...nom(target,222),u:'шт'});
    assert.equal(next.rooms[0].main.iq.a,selection==='inactive'?7:undefined,selection);
    assert.equal(next.rooms[0].main.iq.b,target==='b'?undefined:8,'the independent base row follows its own unit');
    assert.equal(next.rooms[0].main.qtyBase,20);
  }
});

test('required canvas and main definitions require explicit single mode for shared quantity traversal',()=>{
  const valid=captureProjectCatalog(project(),library());
  for(const id of ['canvas','main'])for(const single of [false,undefined]){
    const invalid=copy(valid);invalid.rooms[0].catalogSnapshot.blocks.find(b=>b.id===id).single=single;
    assert.equal(validProjectCalculation(invalid),false);
  }
});

test('initial room capture records first units once and later instance changes do not rewrite legacy override scope',()=>{
  const source=library(),original=captureProjectCatalog(project(),source),room=original.rooms[0],catalog=room.catalogSnapshot;
  assert.equal(catalog.legacyUnits.a,'м.п.');
  assert.equal(catalog.legacyUnits['a|room-a'],'м.п.');
  assert.equal(catalog.legacyUnits.c,'м.п.');
  assert.equal(catalog.legacyUnits.option,'м.п.');
  assert.equal(catalog.legacyUnits.d,'м.п.');
  assert.ok(Number.isFinite(catalog.capturedAt));
  const before=copy(catalog);
  source.nom[0].u='шт';source.presets.main[0].items[0].u='шт';
  room.extra.push(captureInstancePreset({id:'fresh',pid:'main-a',qty:4},'main',source));
  const recaptured=captureRoomCatalog(room,source);
  assert.deepEqual(recaptured.catalogSnapshot,before);
  const refreshed=refreshProjectNom(original,'a',{...nom('a',300),u:'шт'});
  assert.deepEqual(refreshed.rooms[0].catalogSnapshot.legacyUnits,before.legacyUnits);
  assert.equal(refreshed.rooms[0].catalogSnapshot.capturedAt,before.capturedAt);
  assert.ok(validProjectCalculation(copy(original)));
  for(const bad of [NaN,-1,'today']){const invalid=copy(original);invalid.rooms[0].catalogSnapshot.capturedAt=bad;assert.equal(validProjectCalculation(invalid),false);}
  const invalid=copy(original);invalid.rooms[0].catalogSnapshot.legacyUnits.a=7;assert.equal(validProjectCalculation(invalid),false);
});

test('restoring a deleted library preset retains its composition but adopts current records without frozen photo markers',()=>{
  const source=library(),frozen=captureProjectCatalog(project(),source),saved=frozen.rooms[0].main.presetSnapshot;
  source.nom[0].p=987;source.nom[2].p=654;source.nom[0].imageUrl='fresh.png';
  const restored=projectCatalogModel.restoreLibraryPreset(saved,'main',source);
  assert.equal(restored.items[0].p,987);assert.equal(restored.items[0].variants[1].p,654);
  assert.equal(restored.items[0].src,'perim');assert.equal(restored.items[0].k,2);
  assert.deepEqual(restored.items.map(i=>i.nid),saved.items.map(i=>i.nid));
  assert.equal(restored.items[0]._photoFrozen,undefined);assert.equal(restored.items[0].variants[1]._photoFrozen,undefined);
  assert.equal(restored.items[0].imageUrl,'fresh.png');assert.equal(restored.version,undefined);
  assert.ok(!JSON.stringify(restored).includes('data:image/'),'resolved library photos remain solely in NOM');
  assert.equal(saved.items[0].p,110);
});

test('room estimate overrides bind their original unit once and retain prices and quantities across later changes',()=>{
  const source=library(),original=project();original.rooms[0].estEd={a:{q:7,p:100},'a|room-a':{q:3,p:80},unknown:{q:4,p:90}};
  const frozen=captureProjectCatalog(original,source),room=frozen.rooms[0];
  assert.deepEqual(room.estEd,{a:{q:7,p:100,u:'м.п.'},'a|room-a':{q:3,p:80,u:'м.п.'},unknown:{q:4,p:90}});
  source.nom[0].u='шт';source.presets.main[0].items[0].u='шт';
  room.extra.push(captureInstancePreset({id:'fresh',pid:'main-a',qty:2},'main',source));
  const recaptured=captureRoomCatalog(copy(room),source);
  assert.deepEqual(recaptured.estEd,room.estEd);
  assert.deepEqual(original.rooms[0].estEd,{a:{q:7,p:100},'a|room-a':{q:3,p:80},unknown:{q:4,p:90}});
  assert.deepEqual(projectCatalogModel.bindEstimateOverrideUnits({a:{q:7,p:100,u:'шт'}},{a:'м.п.'}),{a:{q:7,p:100,u:'шт'}});
  assert.equal(projectCatalogModel.bindEstimateOverrideUnits(null,{}),null);
  const explicit='a|unit:'+encodeURIComponent('шт');
  assert.deepEqual(projectCatalogModel.bindEstimateOverrideUnits({[explicit]:{q:3}},{a:'м.п.'}),{[explicit]:{q:3,u:'шт'}});
  assert.deepEqual(projectCatalogModel.bindEstimateOverrideUnits({'a|unit:%E0':{q:3}},{a:'м.п.'}),{'a|unit:%E0':{q:3}});
});
