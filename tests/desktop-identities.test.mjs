import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { roomDrawingPreview } from '../src/design-bridge/room-drawing-preview.js';
import {
  DCLogic, createDesktopStorage, desktopToday, desktopDisplayDate,
  desktopPeriodStart, desktopTodayLabel,
} from '../src/desktop/engine-base.js';
import { nomKey, resolveNom, withEstimateImages } from '../src/desktop/nomenclature-identity.js';
import { instanceLines as desktopInstanceLines } from '../src/desktop/quantity-adapter.js';
import { instanceLines as sharedInstanceLines } from '../src/design-bridge/quantity-model.js';
import * as currentQuantityModel from '../src/design-bridge/quantity-model.js';
import { createDesktopDesignStorage, desktopMigrationMetadata, validateDesktopSnapshot } from '../src/desktop/desktop-storage.js';
import { validateDesignSnapshot } from '../src/design-bridge/design-storage.js';
import { transformDesktopIdentities } from '../scripts/desktop-identities.mjs';
import { normalizePhotoCrop, photoCropSourceUrl, MAX_PHOTO_ZOOM } from '../src/desktop/photo-crop.js';
import { contractTemplateAccess } from '../src/design-bridge/contract-template-store.js';
import { contractFields, contractHtml } from '../src/data/contract.js';
import * as projectCatalog from '../src/desktop/project-catalog.js';

const copy = value => JSON.parse(JSON.stringify(value));
const geometry = { a: 12, p: 14, inn: 4, out: 0 };
const definition = { id: 'extra', source: 'manual', unit: 'м.п.' };
const name = 'Профиль с одинаковым названием';
const catalogue = () => [
  { id: 'nom-a', n: name, p: 100, u: 'м.п.', m: 1, br: 'Тест', img: 'first.jpg' },
  { id: 'nom-b', n: name, p: 900, u: 'м.п.', m: 1, br: 'Тест', img: 'second.jpg' },
];
const reference = item => ({ ...item, nid: item.id, id: undefined });
const duplicatePreset = () => ({ id: 'duplicate', name: 'Два разных профиля', items: catalogue().map(reference) });
const room = (id = 'room-a') => ({
  id, name: 'Гостиная', on: true, v: [[0, 0], [4, 0], [4, 3], [0, 3]],
  canvas: { pid: null, off: {} }, main: { pid: null, off: {} },
  extra: [{ id: 'instance-a', pid: 'duplicate', qty: 2 }],
});
const fixture = () => ({
  nom: catalogue(), presets: { canvas: [], main: [], extra: [duplicatePreset()], light: [], track: [], curtain: [], other: [] },
  blocks: [], roomOpts: [], estEd: {},
  projects: [{ id: 'project-a', name: 'Объект', status: 'order', date: '01.11.2026', rooms: [room()], events: [], ops: [] }],
});

test('catalogue photo drafts add, replace and remove on Save while cancellation and reload preserve identity and prices', async () => {
  const main=fixture();
  Object.assign(main.nom[0],{pInst:55,pCost:20,mult:3});
  delete main.nom[0].img;delete main.presets.extra[0].items[0].img;
  let desktop=await desktopRuntime({main});
  const priceFields=item=>[item.id,item.n,item.p,item.pInst,item.pCost,item.mult,item.u,item.m];
  const before=priceFields(desktop.NOM[0]);
  const first='data:image/webp;base64,Zmlyc3Q=',replacement='data:image/webp;base64,c2Vjb25k';
  const setDraft=photo=>{const app=desktop.component;app.openNom('nom-a');app.setState({ni:{...app.state.ni,photo}});return app;};
  setDraft(first).nomEdVals().niBack();
  assert.equal(desktop.NOM[0].imageUrl,undefined,'Cancel leaves the catalogue unchanged');
  desktop.component.saveDesign();
  desktop=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});
  assert.equal(desktop.NOM[0].imageUrl,undefined,'Cancel also survives reload');
  for(const photo of [first,replacement,null]){
    const app=setDraft(photo);
    assert.equal(desktop.NOM[0].imageUrl,photo===replacement?first:photo===null?replacement:undefined,'the draft does not change the catalogue before Save');
    app.nomEdVals().niDone();
    assert.deepEqual(priceFields(desktop.NOM[0]),before);
    assert.equal(desktop.NOM[0].imageUrl,photo||undefined);
    assert.equal(desktop.NOM[0].photoRemoved,!photo);
    assert.ok(!JSON.stringify(desktop.PRESETS).includes('data:image/'),'photo bytes are stored only in the catalogue');
    assert.equal(app.saveDesign(),true);
    desktop=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});
    assert.deepEqual(priceFields(desktop.NOM[0]),before);
    assert.equal(desktop.NOM[0].imageUrl,photo||undefined);
    assert.equal(desktop.NOM[0].photoRemoved,!photo);
  }
});

test('duplicating a catalogue position retains its photo, draft choice and prices under a new ID', async () => {
  for(const mode of ['custom','bundled','removed','draft']){
    const main=fixture(),photo='data:image/webp;base64,Y3VzdG9t',draft='data:image/webp;base64,ZHJhZnQ=';
    Object.assign(main.nom[0],{pInst:55,pCost:20,mult:3});
    if(mode==='custom'||mode==='draft')main.nom[0].imageUrl=photo;
    if(mode==='removed')main.nom[0].photoRemoved=true;
    const desktop=await desktopRuntime({main}),app=desktop.component;
    app.openNom('nom-a');
    if(mode==='draft')app.setState({ni:{...app.state.ni,photo:draft}});
    app.nomEdVals().niDup();
    const expected=mode==='draft'?draft:mode==='custom'?photo:mode==='removed'?null:'/design/nom/first.jpg';
    assert.equal(app.state.ni.photo,expected,'the new draft has the same visible photo');
    app.nomEdVals().niDone();
    const duplicate=desktop.NOM.find(item=>item.n===name+' (копия)');
    assert.ok(duplicate);assert.notEqual(duplicate.id,'nom-a');
    assert.deepEqual([duplicate.p,duplicate.pInst,duplicate.pCost,duplicate.mult],[100,55,20,3]);
    assert.equal(duplicate.imageUrl,expected||undefined);
    assert.equal(duplicate.photoRemoved,!expected);
    assert.equal(desktop.NOM[0].imageUrl,mode==='custom'||mode==='draft'?photo:undefined,'the original photo remains unchanged');
    assert.equal(app.saveDesign(),true);
    const restored=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});
    assert.equal(restored.NOM.find(item=>item.id===duplicate.id).imageUrl,expected||undefined);
  }
});

test('photo crop source and placement survive Save, reload and re-edit without changing catalogue identities or prices',async()=>{
  const main=fixture(),rendered='data:image/webp;base64,Y3JvcHBlZA==',source='data:image/png;base64,b3JpZ2luYWw=';
  Object.assign(main.nom[0],{pInst:55,pCost:20,mult:3});
  const fields=item=>[item.id,item.n,item.p,item.pInst,item.pCost,item.mult,item.u,item.m];
  let desktop=await desktopRuntime({main}),app=desktop.component;
  const before=fields(desktop.NOM[0]),sibling=copy(desktop.NOM[1]);
  app.openNom('nom-a');
  const crop={v:1,zoom:2.5,x:0.3,y:-0.2,unexpected:'not persisted'};
  app.setState({ni:{...app.state.ni,photo:rendered,photoSource:source,photoCrop:crop}});
  assert.equal(desktop.NOM[0].photoSource,undefined,'editing does not update the catalogue');
  app.nomEdVals().niDone();
  const expectedCrop={v:1,zoom:2.5,x:0.3,y:-0.2};
  assert.deepEqual(copy(desktop.NOM[0].photoCrop),expectedCrop);
  assert.notEqual(desktop.NOM[0].photoCrop,crop,'the saved placement is copied from the draft');
  assert.equal(desktop.NOM[0].imageUrl,rendered);
  assert.equal(desktop.NOM[0].photoSource,source);
  assert.deepEqual(fields(desktop.NOM[0]),before);
  assert.deepEqual(copy(desktop.NOM[1]),sibling);
  assert.ok(!JSON.stringify(desktop.PRESETS).includes('photoSource'));
  assert.ok(!JSON.stringify(desktop.PRESETS).includes('photoCrop'));
  assert.ok(!JSON.stringify(desktop.PRESETS).includes('data:image/'));
  assert.equal(app.saveDesign(),true);
  desktop=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});app=desktop.component;
  assert.equal(desktop.NOM[0].photoSource,source);
  assert.deepEqual(copy(desktop.NOM[0].photoCrop),expectedCrop);
  app.openNom('nom-a');
  app.setState({ni:{...app.state.ni,photo:'data:image/webp;base64,Y2FuY2Vs',photoSource:'/online/nom/new.webp',photoCrop:{v:1,zoom:3,x:1,y:1}}});
  app.nomEdVals().niBack();
  assert.equal(desktop.NOM[0].imageUrl,rendered);
  assert.equal(desktop.NOM[0].photoSource,source,'cancelling keeps the previous original');
  assert.deepEqual(copy(desktop.NOM[0].photoCrop),expectedCrop);
  assert.deepEqual(fields(desktop.NOM[0]),before);
});

test('a plain replacement or removal clears prior crop metadata, and an unchanged Save retains it',async()=>{
  for(const replacement of ['data:image/webp;base64,bmV3',null]){
    const main=fixture(),source='/online/nom/original.webp',crop={v:1,zoom:2,x:0.2,y:0};
    Object.assign(main.nom[0],{imageUrl:'data:image/webp;base64,b2xk',photoSource:source,photoCrop:crop});
    const desktop=await desktopRuntime({main}),app=desktop.component;
    app.openNom('nom-a');app.nomEdVals().niDone();
    assert.equal(desktop.NOM[0].photoSource,source);
    assert.deepEqual(copy(desktop.NOM[0].photoCrop),crop);
    app.openNom('nom-a');app.setState({ni:{...app.state.ni,photo:replacement}});app.nomEdVals().niDone();
    assert.equal(desktop.NOM[0].imageUrl,replacement||undefined);
    assert.equal(desktop.NOM[0].photoSource,undefined);
    assert.equal(desktop.NOM[0].photoCrop,undefined);
    assert.equal(desktop.NOM[0].photoRemoved,!replacement);
    assert.equal(app.saveDesign(),true);
    const restored=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});
    assert.ok(!Object.hasOwn(restored.NOM[0],'photoSource'));
    assert.ok(!Object.hasOwn(restored.NOM[0],'photoCrop'));
  }
});

test('duplicating saved, bundled, draft and removed photos retains only their own crop metadata',async()=>{
  const original='data:image/webp;base64,b2xk',draft='data:image/webp;base64,bmV3';
  for(const mode of ['saved','bundled','draft','plain-draft','removed']){
    const main=fixture(),source=mode==='bundled'?'/design/nom/first.jpg':'data:image/png;base64,b3JpZ2luYWw=';
    const crop={v:1,zoom:2,x:0.2,y:-0.1},newCrop={v:1,zoom:4,x:-1,y:0.5};
    Object.assign(main.nom[0],{pInst:55,pCost:20,mult:3,photoSource:source,photoCrop:crop});
    if(mode!=='bundled')main.nom[0].imageUrl=original;
    if(mode==='removed')main.nom[0].photoRemoved=true;
    const desktop=await desktopRuntime({main}),app=desktop.component,originalRecord=copy(desktop.NOM[0]);
    app.openNom('nom-a');
    if(mode==='draft')app.setState({ni:{...app.state.ni,photo:draft,photoSource:'/online/nom/draft.webp',photoCrop:newCrop}});
    if(mode==='plain-draft')app.setState({ni:{...app.state.ni,photo:draft}});
    app.nomEdVals().niDup();app.nomEdVals().niDone();
    const duplicate=desktop.NOM.find(item=>item.id!=='nom-a'&&item.n===name+' (копия)');
    assert.ok(duplicate);assert.notEqual(duplicate.id,'nom-a');
    assert.deepEqual([duplicate.p,duplicate.pInst,duplicate.pCost,duplicate.mult],[100,55,20,3]);
    const hasMetadata=mode!=='plain-draft'&&mode!=='removed';
    assert.equal(duplicate.photoSource,hasMetadata?(mode==='draft'?'/online/nom/draft.webp':source):undefined,mode);
    assert.deepEqual(copy(duplicate.photoCrop??null),hasMetadata?(mode==='draft'?newCrop:crop):null,mode);
    assert.equal(duplicate.imageUrl,mode==='removed'?undefined:mode==='draft'||mode==='plain-draft'?draft:mode==='bundled'?'/design/nom/first.jpg':original);
    assert.equal(duplicate.photoRemoved,mode==='removed');
    assert.deepEqual(copy(desktop.NOM[0]),originalRecord,'duplicating never changes the original');
    assert.equal(app.saveDesign(),true);
    const restored=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});
    assert.deepEqual(copy(restored.NOM.find(item=>item.id===duplicate.id)),copy(duplicate));
  }
});

test('photo metadata permits only bounded raster sources and plain placement fields',async()=>{
  const cases=[
    {photoSource:'javascript:alert(1)',photoCrop:{v:1,zoom:2,x:0,y:0}},
    {photoSource:'data:image/svg+xml;base64,PHN2Zz4=',photoCrop:{v:1,zoom:2,x:0,y:0}},
    {photoSource:'data:image/png;base64,'+'A'.repeat(8*1024*1024*4/3+64),photoCrop:{v:1,zoom:2,x:0,y:0}},
    {photoSource:'/online/nom/image.webp',photoCrop:{v:99,zoom:2,x:0,y:0}},
  ];
  for(const metadata of cases){
    const desktop=await desktopRuntime(),app=desktop.component;
    app.openNom('nom-a');app.setState({ni:{...app.state.ni,photo:'data:image/webp;base64,cGlj',...metadata}});app.nomEdVals().niDone();
    assert.equal(desktop.NOM[0].photoSource,undefined);assert.equal(desktop.NOM[0].photoCrop,undefined);
    assert.equal(desktop.NOM[0].imageUrl,'data:image/webp;base64,cGlj','invalid edit metadata does not lose the ready image');
  }
  const desktop=await desktopRuntime(),app=desktop.component;
  app.openNom('nom-a');app.setState({ni:{...app.state.ni,photo:'data:image/webp;base64,cGlj',photoSource:'/online/nom/image.webp',photoCrop:{v:1,zoom:999,x:999,y:-999}}});app.nomEdVals().niDone();
  assert.deepEqual(copy(desktop.NOM[0].photoCrop),{v:1,zoom:6,x:2.5,y:-2.5});
});

test('the desktop identity transform upgrades the previous photo adapter and remains idempotent',()=>{
  const generated=fs.readFileSync(new URL('../src/desktop/generated/mobile-engine.js',import.meta.url),'utf8');
  const transformed=transformDesktopIdentities(generated);
  assert.equal(transformDesktopIdentities(transformed),transformed);
  assert.equal(transformed.split('const desktopNomPhotoDraft=').length-1,1);
  assert.ok(transformed.includes('...desktopNomPhotoDraft(ni),id:src?.id'));
  assert.ok(transformed.includes('desktopDuplicatePhoto(ni,src)'));
});

async function desktopRuntime({ main = fixture(), saved } = {}) {
  const storageKey = main?.migration?.sourceHash ? 'zamer.desktop.working.v1' : 'zamer.desktop.v1';
  const entries = new Map(saved ? [[storageKey, saved]] : []);
  const localStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
  const date = new Date(2026, 10, 1, 12);
  const ctx = vm.createContext({
    ...projectCatalog, MagicDraw: { preview: roomDrawingPreview },
    DCLogic, createDesktopStorage: () => createDesktopStorage(() => localStorage, () => ctx.MAGIC_MAIN),
    createDesktopDesignStorage, desktopMigrationMetadata,
    desktopToday: () => desktopToday(date), desktopDisplayDate: () => desktopDisplayDate(date),
    desktopPeriodStart: period => desktopPeriodStart(period, date), desktopTodayLabel: () => desktopTodayLabel(date),
    nomKey, resolveNom, withEstimateImages, desktopInstanceLines, normalizePhotoCrop, photoCropSourceUrl, MAX_PHOTO_ZOOM,
    console, localStorage, setTimeout: () => 1, clearTimeout: () => {},
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    document: { querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' },
    addEventListener: () => {}, removeEventListener: () => {},
  });
  vm.runInContext('window=globalThis;', ctx);
  for (const file of ['main-data.js', 'quantity.js', 'storage.js', 'estimate.js']) {
    vm.runInContext(fs.readFileSync(new URL('../public/design/' + file, import.meta.url), 'utf8'), ctx);
  }
  ctx.MagicQuantity=currentQuantityModel;
  ctx.MAGIC_MAIN = copy(main);
  const generated = fs.readFileSync(new URL('../src/desktop/generated/mobile-engine.js', import.meta.url), 'utf8');
  const script = transformDesktopIdentities(generated)
    .replace(/^import .*?;\n/gm, '').replace(/^export \{.*?\};\n/gm, '');
  vm.runInContext(script + '\n;globalThis.testAPI={Component,NOM,PRESETS,BLOCKS,est,instLines};', ctx);
  // Exercise the generated desktop callbacks, including its frozen project catalogue.
  return { ...ctx.testAPI, ctx, entries, component: new ctx.testAPI.Component() };
}

test('desktop deduction controls rebase imported final quantities and persist their effective value',async()=>{
  const main=fixture();
  main.projects[0].rooms[0].main={pid:'main-profile',qtyO:11.45};
  main.projects[0].rooms[0].extra=[{id:'deduction',pid:'duplicate',qty:2,subP:false}];
  main.presets.main=[{id:'main-profile',name:'Основной профиль',items:[{nid:'nom-a',n:name,p:100,u:'м.п.',m:1}]}];
  let desktop=await desktopRuntime({main}),app=desktop.component;
  app.openCalc('project-a');
  const blocks=()=>app.calcVals().blocks;
  const primary=()=>blocks().find(b=>b.title==='Основной профиль');
  const extra=()=>blocks().find(b=>b.id==='extra').insts[0];
  assert.equal(primary().qtyTxt,'11,45');
  assert.equal(app.cur().rooms[0].main.qtyBase,undefined,'opening the calculator leaves the import untouched');
  extra().toggleSubP();
  assert.equal(primary().qtyTxt,'9,45');assert.equal(primary().lines[0].qTxt,'9,45');
  extra().toggleSubP();assert.equal(primary().qtyTxt,'11,45');
  extra().toggleSubP();extra().inc();assert.equal(primary().qtyTxt,'8,95');
  extra().qtyChange({target:{value:'3'}});extra().qtyBlur();assert.equal(primary().qtyTxt,'8,45');
  primary().qtyChange({target:{value:'7'}});primary().qtyBlur();assert.equal(primary().qtyTxt,'7');
  primary().inc();assert.equal(primary().qtyTxt,'8','the step starts from the visible final quantity');
  assert.equal(app.saveDesign(),true);
  desktop=await desktopRuntime({main,saved:desktop.entries.get('zamer.desktop.v1')});app=desktop.component;app.openCalc('project-a');
  assert.equal(primary().qtyTxt,'8');
  extra().remove();assert.equal(primary().qtyTxt,'11');
  primary().qtyReset();assert.equal(app.cur().rooms[0].main.qtyBase,undefined);assert.equal(app.cur().rooms[0].main.qtyO,undefined);
  assert.equal(primary().qtyTxt,'14');
});

test('desktop deduction clamp is reversible and removing an already deducted legacy instance restores its length',async()=>{
  for(const initial of [false,true]){
    const main=fixture();
    main.projects[0].rooms[0].main={qtyO:10};
    main.projects[0].rooms[0].extra=[{id:'deduction',pid:'duplicate',qty:20,subP:initial}];
    const desktop=await desktopRuntime({main}),app=desktop.component;app.openCalc('project-a');
    const primary=()=>app.calcVals().blocks.find(b=>b.title==='Основной профиль');
    const extra=()=>app.calcVals().blocks.find(b=>b.id==='extra').insts[0];
    assert.equal(primary().qtyTxt,'10');
    if(initial){extra().remove();assert.equal(primary().qtyTxt,'30');}
    else {extra().toggleSubP();assert.equal(primary().qtyTxt,'0');extra().toggleSubP();assert.equal(primary().qtyTxt,'10');}
  }
});

test('nomenclature references resolve stable IDs before duplicate display names', () => {
  const nom = catalogue();
  assert.equal(nomKey({ nid: 'reference-id', id: 'record-id', n: name }), 'reference-id');
  assert.equal(nomKey(nom[1]), 'nom-b');
  assert.equal(nomKey({ n: name }), name);
  assert.equal(resolveNom(nom, 'nom-b'), nom[1]);
  assert.equal(resolveNom(nom, { nid: 'nom-b', n: name }), nom[1]);
  assert.equal(resolveNom(nom, { id: 'nom-b', n: name }), nom[1]);
  assert.equal(resolveNom(nom, name), nom[0], 'legacy names still resolve');
  assert.equal(resolveNom(nom, { nid: 'missing-id', n: name }), undefined, 'an explicit removed ID never resolves a different supplier by name');
  assert.equal(resolveNom(nom, { n: name }), nom[0], 'legacy objects without catalogue IDs still resolve');
});

test('quantity overrides and exclusions affect only their ID and instance', () => {
  const preset = duplicatePreset();
  Object.assign(preset.items[0], { k: 2, mult: 3 });
  const instance = { qty: 4, iq: { 'nom-a': 5 }, off: { 'nom-b': true } };
  const before = copy({ preset, instance });
  const lines = desktopInstanceLines(definition, instance, preset, {}, geometry);
  assert.deepEqual(lines.map(line => line.key), ['nom-a', 'nom-b']);
  assert.deepEqual(lines.map(line => [line.q, line.on, line.t]), [[5, true, 500], [4, false, 0]]);
  const sibling = desktopInstanceLines(definition, { qty: 4 }, preset, {}, geometry);
  assert.deepEqual(sibling.map(line => [line.q, line.on, line.t]), [[9, true, 900], [4, true, 3600]]);
  assert.deepEqual(copy({ preset, instance }), before, 'calculating does not mutate saved data');
});

test('ID-selected variants retain the base row override key despite identical names', () => {
  const preset = duplicatePreset();
  const alternative = { nid: 'nom-c', n: name, p: 750, u: 'м.п.', m: 1 };
  preset.items[0].variants = [{ ...preset.items[0] }, alternative];
  const instance = { qty: 2, variants: { 'nom-a': 'nom-c' }, iq: { 'nom-a': 7 }, off: { 'nom-b': true } };
  const [selected, sibling] = desktopInstanceLines(definition, instance, preset, {}, geometry);
  assert.equal(selected.key, 'nom-a');
  assert.equal(selected.nid, 'nom-c');
  assert.equal(selected.p, 750);
  assert.equal(selected.q, 7);
  assert.equal(selected.t, 5250);
  assert.equal(sibling.key, 'nom-b');
  assert.equal(sibling.p, 900);
  assert.equal(sibling.on, false);
  const defaults = desktopInstanceLines(definition, { qty: 2 }, preset, {}, geometry);
  assert.equal(defaults[0].nid, 'nom-a');
  assert.equal(defaults[0].t, 200, 'a second instance retains its own variant selection');
});

test('legacy name-keyed quantities and alternatives retain the shared mobile result', () => {
  const preset = { items: [
    { n: 'Профиль', p: 100, u: 'м.п.', m: 1, k: 2, variants: [
      { n: 'Профиль', p: 100, u: 'м.п.', m: 1 },
      { n: 'Замена', p: 250, u: 'м.п.', m: 1 },
    ] },
    { n: 'Монтаж', p: 50, u: 'м.п.', m: 0 },
  ] };
  const instance = { qty: 4, variants: { 'Профиль': 'Замена' }, iq: { 'Профиль': 7 }, off: { 'Монтаж': true } };
  assert.deepEqual(copy(desktopInstanceLines(definition, instance, preset, {}, geometry)),
    copy(sharedInstanceLines(definition, instance, preset, {}, geometry)));
});

test('export photos follow selected IDs and current catalogue photos while preserving totals', () => {
  const estimate = {
    mats: [
      { nid: 'nom-a', k: 'nom-a', n: name, q: 2, p: 100, t: 200 },
      { nid: 'nom-b', k: 'nom-b|room-a', n: name + ' (Гостиная)', q: 3, p: 900, t: 2700 },
      { nid: 'nom-b', k: 'nom-a', n: name, img: 'custom.webp', q: 1, p: 900, t: 900 },
    ], works: [], equipment: [], total: 3800,
  };
  const before = copy(estimate);
  const result = withEstimateImages(estimate, catalogue());
  assert.deepEqual(result.mats.map(line => line.img), ['/design/nom/first.jpg', '/design/nom/second.jpg', '/design/nom/second.jpg'],
    'a copied estimate image must not hide the current photo of its selected catalogue ID');
  assert.equal(result.total, 3800);
  assert.deepEqual(result.mats.map(({ img, ...line }) => line), estimate.mats.map(({ img, ...line }) => line));
  assert.deepEqual(estimate, before);
});

test('export uses a custom catalogue photo and honors its later explicit removal', () => {
  const nom = catalogue(), estimate = { mats: [{ nid: 'nom-b', n: name, img: 'stale.webp', q: 1, p: 900 }] };
  nom[1].imageUrl = 'data:image/png;base64,custom';
  assert.equal(withEstimateImages(estimate, nom).mats[0].img, nom[1].imageUrl);
  nom[1].photoRemoved = true;
  assert.equal(withEstimateImages(estimate, nom).mats[0].img, undefined, 'removal must also suppress a stale copied image');
  assert.equal(withEstimateImages(estimate, []).mats[0].img, '/design/nom/stale.webp', 'an unlinked historical row can retain its image');
});

test('desktop estimates keep duplicate names separate and apply project edits to one ID', async () => {
  const desktop = await desktopRuntime();
  const rooms = desktop.component.state.projects[0].rooms;
  const estimate = desktop.est(rooms, {});
  assert.equal(estimate.mats.length, 2);
  assert.equal(estimate.total, 2000);
  const byKey = Object.fromEntries(estimate.mats.map(line => [line.k, line]));
  assert.deepEqual(Object.keys(byKey).sort(), ['nom-a', 'nom-b']);
  assert.equal(byKey['nom-a'].t, 200);
  assert.equal(byKey['nom-b'].t, 1800);
  const edited = desktop.est(rooms, { 'nom-a': { q: 0, p: 111 } });
  assert.equal(edited.mats.find(line => line.k === 'nom-a').t, 0, 'zero remains an explicit override');
  assert.equal(edited.mats.find(line => line.k === 'nom-b').t, 1800);
  assert.equal(edited.total, 1800);
});

test('room edits apply before aggregation and additional items use nomenclature IDs', async () => {
  const main = fixture();
  const first = main.projects[0].rooms[0];
  first.estEd = { 'nom-a': { q: 5, p: 110 } };
  first.extraItems = [{ ...reference(main.nom[1]), id: 'extra-instance', qty: 1 }];
  const desktop = await desktopRuntime({ main });
  const estimate = desktop.est(desktop.component.state.projects[0].rooms, {});
  assert.equal(estimate.mats.length, 2, 'the instance ID does not create a new catalogue identity');
  assert.equal(estimate.mats.find(line => line.k === 'nom-a').t, 550);
  assert.equal(estimate.mats.find(line => line.k === 'nom-b').q, 3);
  assert.equal(estimate.total, 3250);
});

test('consolidation preserves different room prices before applying project edits', async () => {
  const main = fixture();
  const rooms = [room('room-a'), room('room-b'), room('room-c')];
  rooms[0].estEd = { 'nom-a': { q: 3, p: 110 } };
  rooms[1].estEd = { 'nom-a': { q: 5, p: 210 } };
  rooms[2].estEd = { 'nom-a': { q: 0, p: 999 } };
  main.projects[0].rooms = rooms;
  const desktop = await desktopRuntime({ main });
  const savedRooms = desktop.component.state.projects[0].rooms;
  const estimate = desktop.est(savedRooms, {});
  const combined = estimate.mats.find(line => line.k === 'nom-a');
  assert.equal(combined.q, 8);
  assert.equal(combined.p, 172.5);
  assert.equal(combined.t, 1380, 'the consolidated amount equals the sum of the room amounts');
  assert.equal(desktop.est(savedRooms, { 'nom-a': { p: 300 } }).mats.find(line => line.k === 'nom-a').t, 2400);
  assert.equal(desktop.est(savedRooms, { 'nom-a': { q: 4 } }).mats.find(line => line.k === 'nom-a').t, 690);
  const zero = desktop.est(savedRooms, { 'nom-a': { q: 0, p: 0 } }).mats.find(line => line.k === 'nom-a');
  assert.equal(zero.p, 0);
  assert.equal(zero.t, 0, 'zero remains an explicit final project override');
});

test('canvas identities remain scoped to their room with matching names', async () => {
  const main = fixture();
  main.presets.canvas = [{ id: 'canvas-test', name: 'Полотно', items: main.nom.map(item => ({ ...reference(item), u: 'м²', cv: 1 })) }];
  main.projects[0].rooms = [room('room-a'), room('room-b')].map(item => ({ ...item, extra: [], canvas: { pid: 'canvas-test' } }));
  const desktop = await desktopRuntime({ main });
  const estimate = desktop.est(desktop.component.state.projects[0].rooms, {});
  assert.equal(estimate.mats.length, 4);
  assert.deepEqual(copy(estimate.mats.map(line => line.k).sort()), ['nom-a|room-a', 'nom-a|room-b', 'nom-b|room-a', 'nom-b|room-b']);
  const edited = desktop.est(desktop.component.state.projects[0].rooms, { 'nom-b|room-a': { q: 1 } });
  assert.equal(edited.mats.find(line => line.k === 'nom-b|room-a').q, 1);
  assert.equal(edited.mats.find(line => line.k === 'nom-b|room-b').q, 12);
});

test('canvas scope follows the item type in extra rows and variants', async () => {
  const main = fixture();
  const canvas = { id: 'canvas-id', n: 'Полотно', p: 2500, u: 'м²', m: 1, cv: 1, br: 'Тест' };
  main.nom.push(canvas);
  main.presets.canvas = [{ id: 'profile-in-canvas', name: 'Профиль', items: [reference(main.nom[0])] }];
  const target = main.projects[0].rooms[0];
  target.canvas.pid = 'profile-in-canvas';
  target.extra = [];
  target.extraItems = [{ ...reference(canvas), id: 'canvas-extra', qty: 2 }];
  target.estEd = { 'canvas-id|room-a': { q: 3, p: 2600 } };
  const desktop = await desktopRuntime({ main });
  const estimate = desktop.est(desktop.component.state.projects[0].rooms, {});
  assert.equal(estimate.mats.find(line => line.k === 'nom-a').q, 12, 'a profile in the canvas block is still consolidated');
  assert.equal(estimate.mats.find(line => line.k === 'canvas-id|room-a').t, 7800, 'an extra canvas uses its scoped room edit');
  const preset = { items: [{ ...reference(canvas), variants: [reference(canvas), reference(main.nom[0])] }] };
  const [selected] = desktopInstanceLines(definition, { qty: 2, variants: { 'canvas-id': 'nom-a' } }, preset, {}, geometry);
  assert.equal(selected.nid, 'nom-a');
  assert.equal(selected.cv, undefined, 'selecting a profile does not inherit the base canvas type');
  desktop.component.openNom('canvas-id');
  desktop.component.nomEdVals().niPrices[0].change({ target: { value: '2700' } });
  desktop.component.nomEdVals().niDone();
  assert.equal(desktop.NOM.find(item => item.id === 'canvas-id').cv, 1);
  assert.equal(desktop.component.state.projects[0].rooms[0].extraItems[0].cv, 1, 'editing a price preserves canvas scope');
});

test('calculator callbacks write ID maps and isolate identical display names', async () => {
  const main = fixture();
  const alternative = { id: 'nom-c', n: name, p: 750, u: 'м.п.', m: 1, br: 'Тест' };
  main.nom.push(alternative);
  main.presets.extra[0].items[0].variants = [reference(main.nom[0]), reference(alternative)];
  const desktop = await desktopRuntime({ main });
  const app = desktop.component;
  app.openCalc('project-a');
  const lines = () => app.calcVals().blocks.find(block => block.id === 'extra').insts[0].lines;
  lines()[0].qChange({ target: { value: '7' } });
  lines()[0].qBlur();
  assert.deepEqual(copy(app.cur().rooms[0].extra[0].iq), { 'nom-a': 7 });
  assert.equal(lines()[0].qTxt, '7');
  assert.equal(lines()[1].qTxt, '2');
  lines()[1].toggle();
  assert.deepEqual(copy(app.cur().rooms[0].extra[0].off), { 'nom-b': true });
  assert.equal(lines()[0].on, true);
  assert.equal(lines()[1].on, false);
  lines()[0].variantChoices[1].pick();
  assert.deepEqual(copy(app.cur().rooms[0].extra[0].variants), { 'nom-a': 'nom-c' });
  assert.equal(app.cur().rooms[0].extra[0].iq['nom-a'], undefined, 'changing variant clears only its own final override');
  assert.equal(lines()[0].priceTxt, '750 ₽/м.п.');
  assert.equal(lines()[1].on, false);
});

test('editing one ID updates its references without renaming or repricing its sibling', async () => {
  const desktop = await desktopRuntime();
  const app = desktop.component;
  app.openNom('nom-b');
  assert.equal(app.state.ni.ref, 'nom-b');
  assert.equal(app.state.ni.p, '900');
  app.nomEdVals().niSet.n({ target: { value: 'Другой профиль' } });
  app.nomEdVals().niPrices[0].change({ target: { value: '950' } });
  app.nomEdVals().niDone();
  assert.equal(desktop.NOM.find(item => item.id === 'nom-a').n, name);
  assert.equal(desktop.NOM.find(item => item.id === 'nom-a').p, 100);
  assert.equal(desktop.NOM.find(item => item.id === 'nom-b').n, 'Другой профиль');
  assert.equal(desktop.PRESETS.extra[0].items[0].n, name);
  assert.equal(desktop.PRESETS.extra[0].items[1].n, 'Другой профиль');
  assert.equal(desktop.PRESETS.extra[0].items[1].nid, 'nom-b');
  assert.equal(desktop.est(app.state.projects[0].rooms, {}).total, 2000, 'editing the global catalogue keeps the saved project price');
});

test('editing a retained extra row restores its missing ID instead of its namesake', async () => {
  const main = fixture();
  main.projects[0].rooms[0].extraItems = [{ ...reference(main.nom[0]), id: 'extra-instance', qty: 1 }];
  const desktop = await desktopRuntime({ main });
  desktop.NOM.splice(desktop.NOM.findIndex(item => item.id === 'nom-a'), 1);
  const extra = desktop.component.state.projects[0].rooms[0].extraItems[0];
  const { img, ...withoutPhoto } = extra;
  const missingPhoto = withEstimateImages({ mats: [{ ...withoutPhoto, k: 'nom-a' }] }, desktop.NOM);
  assert.equal(missingPhoto.mats[0].img, '/design/nom/first.jpg', 'a saved project keeps its own photo after library deletion');
  desktop.component.openNom(extra);
  assert.equal(desktop.component.state.ni.ref, 'nom-a');
  assert.equal(desktop.component.state.ni.p, '100');
  desktop.component.nomEdVals().niPrices[0].change({ target: { value: '150' } });
  desktop.component.nomEdVals().niDone();
  assert.equal(desktop.NOM.find(item => item.id === 'nom-a').p, 150);
  assert.equal(desktop.NOM.find(item => item.id === 'nom-b').p, 900);
});

test('assigning an ID while editing a legacy canvas keeps room-scoped edits', async () => {
  const main = fixture();
  main.nom = [{ n: 'Старое полотно', p: 500, u: 'м²', m: 1, br: 'Тест' }];
  main.presets.canvas = [{ id: 'legacy-canvas', name: 'Полотно', items: [{ ...main.nom[0] }] }];
  main.presets.extra = [];
  const target = main.projects[0].rooms[0];
  target.canvas.pid = 'legacy-canvas';
  target.extra = [];
  target.estEd = { 'Старое полотно|room-a': { q: 7 } };
  const desktop = await desktopRuntime({ main });
  desktop.component.openCalc('project-a');
  desktop.component.openNom('Старое полотно');
  desktop.component.nomEdVals().niPrices[0].change({ target: { value: '600' } });
  desktop.component.nomEdVals().niDone();
  const key = desktop.NOM[0].id;
  const savedRoom = desktop.component.state.projects[0].rooms[0];
  assert.equal(desktop.PRESETS.canvas[0].items[0].cv, 1);
  assert.equal(savedRoom.estEd[key + '|room-a'].q, 7);
  const estimate = desktop.est([savedRoom], {});
  assert.equal(estimate.mats[0].k, key + '|room-a');
  assert.equal(estimate.mats[0].t, 4200);
});

test('duplicate-name variants and ID-keyed edits survive desktop save and restore', async () => {
  const main = fixture();
  main.presets.extra[0].items[0].variants = main.nom.map(reference);
  main.projects[0].rooms[0].extra[0] = {
    ...main.projects[0].rooms[0].extra[0], variants: { 'nom-a': 'nom-b' }, iq: { 'nom-a': 7 }, off: { 'nom-b': true },
  };
  const desktop = await desktopRuntime({ main });
  assert.equal(desktop.component.saveDesign(), true, 'IDs allow variants with the same visible name');
  const saved = desktop.entries.get('zamer.desktop.v1');
  assert.ok(saved);
  assert.equal(desktop.entries.has('zamer.design.v1'), false, 'saving desktop never writes mobile data');
  const restored = await desktopRuntime({ saved });
  assert.deepEqual(copy(restored.PRESETS), copy(desktop.PRESETS));
  assert.deepEqual(copy(restored.component.state.projects), copy(desktop.component.state.projects));
  assert.deepEqual(copy(restored.est(restored.component.state.projects[0].rooms, {})), copy(desktop.est(desktop.component.state.projects[0].rooms, {})));
});

test('desktop validation accepts distinct variant IDs without weakening the mobile schema', () => {
  const snapshot = fixture();
  snapshot.version = 1;
  snapshot.blocks = Object.keys(snapshot.presets).map(id => ({ id, title: id, single: id === 'canvas' || id === 'main' }));
  snapshot.presets.extra[0].items[0].variants = snapshot.nom.map(reference);
  const before = copy(snapshot);
  assert.equal(validateDesignSnapshot(snapshot), false);
  assert.equal(validateDesktopSnapshot(snapshot), true);
  assert.deepEqual(copy(snapshot), before, 'validation preserves original display names and metadata');
  snapshot.presets.extra[0].items[0].variants[1].nid = 'nom-a';
  assert.equal(validateDesktopSnapshot(snapshot), false, 'two references to the same variant are still invalid');
});

test('the actual export path resolves photos by ID for duplicate names', async () => {
  const desktop = await desktopRuntime();
  const app = desktop.component;
  app.openCalc('project-a');
  let options;
  desktop.ctx.MagicEstimate = {
    ...desktop.ctx.MagicEstimate,
    previewEstimate: async value => { options = value; return { status: 'previewed' }; },
  };
  await app.runEstimateExport('preview');
  assert.ok(options, 'the preview receives an estimate');
  assert.equal(options.est.mats.find(line => line.k === 'nom-a').img, '/design/nom/first.jpg');
  assert.equal(options.est.mats.find(line => line.k === 'nom-b').img, '/design/nom/second.jpg');
  assert.equal(options.est.total, 2000);
  assert.equal(options.rooms[0].est.total, 2000);
});

test('desktop contracts use and persist the imported template independently of mobile and demo', async () => {
  const main = fixture();
  main.migration = { sourceHash: 'working-contract-fixture' };
  main.contractTemplate = { head: { company: 'Рабочая компания' }, style: 'accent', numSeq: 42,
    sections: [{ id: 'custom', title: 'Импортированный раздел', text: 'Особые условия: {клиент}' }] };
  const desktop = await desktopRuntime({ main }), app = desktop.component;
  desktop.entries.set('zamer.contractTpl', JSON.stringify({ head: { company: 'Мобильная компания' }, numSeq: 7 }));
  desktop.entries.set('zamer.desktop.v1', 'demo snapshot');
  let projectOptions, editorOptions;
  desktop.ctx.MagicContract = {
    open: options => { projectOptions = options; return { close() {} }; },
    openTemplate: options => { editorOptions = options; return { close() {} }; },
  };
  app.openCalc('project-a');
  app.openContract();
  assert.equal(projectOptions.company, undefined, 'desktop contract does not merge mobile company fallbacks');
  const access = contractTemplateAccess(projectOptions.templateStore), template = access.load();
  assert.equal(template.head.company, main.contractTemplate.head.company);
  assert.equal(template.numSeq, 42);
  assert.deepEqual(copy(template.sections), main.contractTemplate.sections);
  const html = contractHtml(template, contractFields({ client: 'Заказчик' }, 1000), { mats: [], works: [] });
  assert.match(html, /Рабочая компания/);
  assert.match(html, /Импортированный раздел/);
  assert.match(html, /Особые условия: Заказчик/);
  access.save({ ...template, numSeq: 43 });
  app.openContractTpl();
  assert.equal(editorOptions.company, undefined, 'desktop editor uses its own template company');
  assert.equal(editorOptions.onEditCompany, undefined, 'desktop keeps its own company editor');
  assert.equal(contractTemplateAccess(editorOptions.templateStore).load().numSeq, 43);
  const edited = { ...template, numSeq: 43, head: { ...template.head, company: 'Изменённая рабочая компания' } };
  contractTemplateAccess(editorOptions.templateStore).save(edited);
  const saved = desktop.entries.get('zamer.desktop.working.v1');
  assert.ok(saved, 'template edits are saved in the isolated working snapshot');
  assert.equal(JSON.parse(desktop.entries.get('zamer.contractTpl')).head.company, 'Мобильная компания');
  assert.equal(desktop.entries.get('zamer.desktop.v1'), 'demo snapshot');
  const restored = await desktopRuntime({ main, saved });
  assert.deepEqual(copy(restored.component.state.contractTemplate), copy(edited));
  assert.deepEqual(copy(restored.component.designSnapshot().contractTemplate), copy(edited));
});

test('agreement status persists until an explicit action and the first incoming payment signs the contract', async () => {
  const main = fixture();
  main.projects[0].status = 'discuss';
  const desktop = await desktopRuntime({ main }), app = desktop.component;
  app.openProject('project-a');
  const step = app.projectVals().steps.find(item => item.label === 'На согласовании');
  assert.equal(step.on, true);
  assert.equal(step.hint, 'Расчёт передан клиенту на согласование');
  for (const screen of ['home', 'dash', 'analytics']) { app.go(screen); app.renderVals(); }
  assert.equal(app.state.projects[0].status, 'discuss');
  app.go('dash');
  assert.equal(app.dashVals().dStats.find(item => item.label === 'Заявки').value, '1', 'agreement projects remain in the pre-contract dashboard count');
  assert.equal(app.saveDesign(), true);
  const restored = await desktopRuntime({ main, saved: desktop.entries.get('zamer.desktop.v1') });
  assert.equal(restored.component.state.projects[0].status, 'discuss');
  restored.component.openProject('project-a');
  restored.component.projectVals().finIn();
  restored.component.projectVals().finSetSum({ target: { value: '100' } });
  restored.component.projectVals().finSave();
  assert.equal(restored.component.state.projects[0].status, 'contract');
});

const canonicalDataUrl = new URL('../online-src/working-data.json', import.meta.url);
test('the actual desktop engine matches every canonical migrated project and room', {
  skip: !fs.existsSync(canonicalDataUrl) && 'Private migration data is unavailable in this checkout',
}, async () => {
  const main = JSON.parse(fs.readFileSync(canonicalDataUrl, 'utf8'));
  const report = main.migration.report;
  assert.equal(validateDesktopSnapshot(main), true);
  const desktop = await desktopRuntime({ main }), app = desktop.component;
  const snapshot = app.designSnapshot();
  assert.equal(snapshot.nom.length, main.nom.length, 'working data receives no demo catalogue records');
  assert.equal(snapshot.roomOpts.length, main.roomOpts.length, 'working data receives no demo room options');
  assert.deepEqual(copy(snapshot.profile), main.profile);
  assert.deepEqual(copy(snapshot.contractTemplate), main.contractTemplate);
  assert.equal(snapshot.migration.sourceHash, main.migration.sourceHash);
  assert.equal(snapshot.migration.report, undefined, 'the report stays in the canonical file instead of device storage');
  const agreementProjects = main.projects.filter(project => project._main.status === 'discuss');
  assert.equal(agreementProjects.length, 5, 'the canonical source contains five projects awaiting agreement');
  assert.equal(app.state.projects.filter(project => project.status === 'discuss').length, agreementProjects.length);
  const statusesBeforeRendering = copy(app.state.projects.map(project => [project.id, project.status]));
  for (const screen of ['home', 'dash', 'analytics']) { app.go(screen); app.renderVals(); }
  assert.deepEqual(copy(app.state.projects.map(project => [project.id, project.status])), statusesBeforeRendering);

  const compare = (expected, estimate, scope, project) => {
    const lines = ['mats', 'works', 'equipment'].flatMap(kind =>
      (estimate[kind] || []).map(line => ({ ...line, kind })));
    assert.equal(lines.length, expected.expectedLines.length, `${scope}: line count`);
    const keyed = new Map(lines.map(line => [JSON.stringify([line.kind, line.k]), line]));
    for (const line of expected.expectedLines) {
      const actual = keyed.get(JSON.stringify([line.kind, line.key]));
      const label = `${scope}, ${line.kind}, ${line.key}`;
      assert.ok(actual, label + ': row exists');
      assert.equal(actual.nid, line.nid, label + ': nomenclature ID');
      assert.equal(actual.u, line.u, label + ': unit');
      for (const field of ['q', 'p']) {
        assert.ok(Math.abs(actual[field] - line[field]) < 1e-7, label + ': ' + field);
      }
      assert.ok(Math.abs(actual.t - line.q * line.p) < 1e-5, label + ': amount');
    }
    const expectedCents = expected.mainTotalCents ?? Math.round(expected.expectedLines.reduce((sum, line) => sum + line.q * line.p, 0) * 100);
    const actualTotal = project ? app.estimateTotals(project, estimate).adjustedTotal : estimate.total;
    assert.equal(Math.round(actualTotal * 100), expectedCents, scope + ': total with adjustment');
  };

  assert.equal(report.projects.length, main.projects.length);
  assert.equal(report.rooms.length, main.projects.reduce((sum, project) => sum + project.rooms.length, 0));
  for (const expected of report.projects) {
    const project = app.state.projects.find(item => item.id === expected.projectId);
    assert.ok(project, 'canonical project is loaded');
    compare(expected, desktop.est(project.rooms, app.ed(project.id)), `project ${project.id}`, project);
  }
  for (const expected of report.rooms) {
    const project = app.state.projects.find(item => item.id === expected.projectId);
    const room = project.rooms.find(item => item.id === expected.roomId);
    assert.ok(room, 'canonical room is loaded');
    compare(expected, desktop.est([room], {}), `room ${project.id}/${room.id}`);
  }
  assert.equal(app.saveDesign(), true);
  const saved = desktop.entries.get('zamer.desktop.working.v1');
  assert.ok(saved, 'working data is stored in its isolated key');
  const restored = await desktopRuntime({ main, saved });
  assert.deepEqual(copy(restored.component.designSnapshot()), copy(snapshot), 'the migrated snapshot survives a full engine restart');
});

test('new presets from the working catalogue save and reload with their selected IDs', async()=>{
 const main=JSON.parse(fs.readFileSync(new URL('../online-src/working-data.json',import.meta.url)));
 const r=await desktopRuntime({main}),app=r.component;
 const before=copy(app.state.projects);
 for(const block of r.BLOCKS){
  app.go('btnEd',{be:{bid:block.id,pid:r.PRESETS[block.id][0]?.id,from:'account'}});
  app.beVals().beAddBtn();
  app.beVals().beSetName({target:{value:`Новый набор ${block.id}`}});
  const chosen=r.NOM.filter(item=>!item.arch).slice(0,3);
  app.setState({be:{...app.state.be,sel:chosen.map(nomKey)}});
  app.beVals().nomAdd();
  app.presetEditorVals().peSave();
  assert.equal(app.state.screen,'account',`save new preset in ${block.id}: ${app.state.toast}`);
  assert.equal(app._presetDraft,null);
 }
 const restored=await desktopRuntime({main,saved:r.entries.get('zamer.desktop.working.v1')});
 for(const block of r.BLOCKS)assert.ok(restored.PRESETS[block.id].some(p=>p.name===`Новый набор ${block.id}`));
 assert.deepEqual(copy(restored.component.state.projects),before);
});
