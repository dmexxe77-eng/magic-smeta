import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCatalogSeed} from '../src/utils/catalog-seed.js';
import {validateDesktopSnapshot} from '../src/desktop/desktop-storage.js';

const factory = (id, n, extra = {}) => ({id, n, name:n, p:4300, price:4300, pCost:1531, cost:1531,
  u:'м.п.', unit:'м.п.', m:1, category:'equipment', br:'LumFer', ...extra});
const seed = {version:'lumfer-test-v1', rows:[factory('n408', 'Track 23, чёрный'), factory('lf-28162', 'LumFer 28162', {u:'шт', unit:'шт', p:2380, price:2380, pCost:1274, cost:1274})],
  legacyAliases:{'Track 23, чёрный':'n408'}};

test('catalog seed moves exact factory IDs and adds equipment without changing project or preset data', () => {
  const old = {id:'n408', n:'Track 23, чёрный', p:5225, cost:2090, u:'м.п.', m:1, br:'LumFer', custom:'keep'};
  const other = {id:'custom', n:'Моя позиция', p:20, u:'шт', m:1, br:'Мои позиции'};
  const snapshot = {nom:[old, other], projects:[{id:'p', rooms:[]}], presets:{main:[]}, estEd:{p:{x:{p:42}}}, profile:{name:'Имя'}, future:{keep:true}};
  const before = JSON.stringify(snapshot), result = applyCatalogSeed(snapshot, seed);
  assert.equal(JSON.stringify(snapshot), before);
  assert.notEqual(result, snapshot);
  assert.equal(result.nom.length, 3);
  assert.deepEqual(result.nom[0], {...old, ...seed.rows[0]});
  assert.equal(result.nom[1], other);
  assert.equal(result.nom[2].pCost, 1274);
  assert.deepEqual(result.catalogueVersions, [seed.version]);
  for (const key of ['projects','presets','estEd','profile','future']) assert.equal(result[key], snapshot[key]);
});

test('catalog seed recognises legacy mobile names only without an ID and with the exact brand and unit', () => {
  const old = {n:'Track 23, чёрный', p:5225, u:'м.п.', m:1, br:'LumFer'};
  const user = {...old, id:'user-owned', p:2};
  const supplier = {...old, br:'Гришины'};
  const wrongUnit = {...old, u:'шт'};
  const result = applyCatalogSeed({nom:[old, user, supplier, wrongUnit]}, seed);
  assert.equal(result.nom[0].id, 'n408');
  assert.equal(result.nom[0].category, 'equipment');
  assert.equal(result.nom[1], user);
  assert.equal(result.nom[2], supplier);
  assert.equal(result.nom[3], wrongUnit);
  assert.equal(result.nom.filter(row => row.id === 'n408').length, 1);
});

test('canonical IDs take priority over a stale legacy alias and do not create duplicate factory records', () => {
  const alias = {n:'Track 23, чёрный', p:10, u:'м.п.', m:1, br:'LumFer', aliasOnly:true};
  const identified = {...alias, id:'n408', idOnly:true};
  const result = applyCatalogSeed({nom:[alias, identified]}, seed);
  assert.equal(result.nom.length, 2);
  assert.equal(result.nom[0].id, 'n408');
  assert.equal(result.nom[0].idOnly, true);
  assert.equal(result.nom.filter(row => row.id === 'n408').length, 1);
});

test('a renamed factory row and its older name-only alias keep both preset references resolvable', () => {
  const alias = {n:'Track 23, чёрный', p:5225, u:'м.п.', m:1, br:'LumFer', aliasMetadata:{keep:true}};
  const renamed = {...alias, id:'n408', n:'Мой трек', name:'Мой трек', customMetadata:{keep:42}};
  const snapshot = {version:1, nom:[alias, {...alias}, renamed],
    blocks:[{id:'canvas', title:'Полотно'}, {id:'main', title:'Профиль'}],
    presets:{canvas:[], main:[{id:'preset', name:'Существующий пресет', items:[alias, renamed]}]},
    projects:[], roomOpts:[], estEd:{}, profile:{company:'Компания'}};
  const result = applyCatalogSeed(snapshot, seed);
  const oldName = result.nom.filter(row => row.n === alias.n), customName = result.nom.filter(row => row.n === renamed.n);
  assert.equal(oldName.length, 1, 'repeated aliases of the same display name are deduplicated');
  assert.equal(customName.length, 1);
  assert.equal(oldName[0].id, undefined);
  assert.equal(oldName[0].nid, undefined);
  assert.equal(customName[0].id, 'n408');
  assert.deepEqual(oldName[0].aliasMetadata, {keep:true});
  assert.deepEqual(customName[0].customMetadata, {keep:42});
  for (const row of [oldName[0], customName[0]]) {
    assert.equal(row.category, 'equipment');
    assert.equal(row.p, 4300);
    assert.equal(row.pCost, 1531);
  }
  assert.equal(result.presets, snapshot.presets);
  assert.ok(result.presets.main[0].items.every(item => result.nom.some(row => row.n === item.n)));
  assert.equal(validateDesktopSnapshot(result), true);
  assert.equal(applyCatalogSeed(result, seed), result);
});

test('desktop nid identity and unknown row fields survive the equipment update', () => {
  const original = {nid:'n408', n:'Моё изменённое название', p:5000, u:'м.п.', m:1, br:'LumFer', originalMetadata:{keep:true}};
  const result = applyCatalogSeed({nom:[original], catalogueVersions:['another-seed']}, seed);
  assert.equal(result.nom[0].nid, 'n408');
  assert.equal(result.nom[0].n, 'Моё изменённое название');
  assert.equal(result.nom[0].originalMetadata, original.originalMetadata);
  assert.deepEqual(result.catalogueVersions, ['another-seed',seed.version]);
});

test('the saved version prevents later user price edits or deletion from being undone', () => {
  const first = applyCatalogSeed({nom:[]}, seed);
  const edited = {...first, nom:[{...first.nom[0], p:1234, pCost:800}]};
  assert.equal(applyCatalogSeed(edited, seed), edited);
  assert.equal(edited.nom.length, 1);
  assert.equal(edited.nom[0].p, 1234);
});

test('missing seeds are a no-op and malformed prices cannot create free equipment', () => {
  const snapshot = {nom:[]};
  assert.equal(applyCatalogSeed(snapshot), snapshot);
  for (const patch of [{p:0}, {pCost:0}, {pCost:null}, {pCost:-1}, {category:'material'}]) {
    assert.throws(() => applyCatalogSeed(snapshot, {...seed, rows:[{...seed.rows[0], ...patch}]}), /catalog seed/i);
    assert.deepEqual(snapshot, {nom:[]});
  }
});

test('an explicit zero-cost import preserves a supplier zero without allowing missing or invalid prices', () => {
  const zero = {...seed.rows[0], pCost:0, cost:0};
  const allowed = {...seed, allowZeroCost:true, rows:[zero]};
  const result = applyCatalogSeed({nom:[]}, allowed);
  assert.equal(result.nom[0].pCost, 0);
  assert.equal(result.nom[0].cost, 0);
  assert.equal(result.nom[0].p, zero.p);
  assert.deepEqual(result.catalogueVersions, [allowed.version]);
  assert.equal(applyCatalogSeed(result, allowed), result);
  for (const allowZeroCost of [undefined, false, 'true', 1]) {
    assert.throws(() => applyCatalogSeed({nom:[]}, {...allowed, allowZeroCost}), /catalog seed/i);
  }
  for (const pCost of [-1, null, undefined, NaN, Infinity, '0']) {
    assert.throws(() => applyCatalogSeed({nom:[]}, {...allowed, rows:[{...zero, pCost}]}), /catalog seed/i);
  }
  assert.throws(() => applyCatalogSeed({nom:[]}, {...allowed, rows:[{...zero, p:0}]}), /catalog seed/i);
});

test('new factory metadata is detached from the reusable seed', () => {
  const original = {...seed, rows:[{...seed.rows[0], provenance:{page:3}}]};
  const result = applyCatalogSeed({nom:[]}, original);
  result.nom[0].provenance.page = 99;
  assert.equal(original.rows[0].provenance.page, 3);
});

test('an ordered seed list applies two supplier catalogues independently and is repeatable', () => {
  const other = {version:'second-supplier-fixture-v1', brand:'Другой бренд', rows:[
    factory('fixture-other-light', 'Тест второго каталога', {br:'Другой бренд', u:'шт', unit:'шт', p:200, price:200, pCost:100, cost:100}),
  ], legacyAliases:{}};
  const snapshot = {nom:[], projects:[{id:'existing-project'}], presets:{main:[]}};
  const result = applyCatalogSeed(snapshot, [seed, other]);
  assert.deepEqual(result.catalogueVersions, [seed.version, other.version]);
  assert.equal(result.nom.length, seed.rows.length + other.rows.length);
  assert.equal(result.nom.find(row => row.id === 'fixture-other-light').br, other.brand);
  assert.equal(result.projects, snapshot.projects);
  assert.equal(result.presets, snapshot.presets);
  assert.equal(applyCatalogSeed(result, [seed, other]), result);
  assert.equal(applyCatalogSeed(snapshot, []), snapshot);
});

test('adding a second catalogue later does not restore first-catalogue deletions or replace its edited prices', () => {
  const other = {version:'second-supplier-fixture-v1', brand:'Другой бренд', rows:[
    factory('fixture-other-light', 'Тест второго каталога', {br:'Другой бренд'}),
  ]};
  const first = applyCatalogSeed({nom:[]}, seed);
  const customized = {...first, nom:[{...first.nom[0], p:1234, pCost:800}]};
  const result = applyCatalogSeed(customized, [seed, other]);
  assert.equal(result.nom.some(row => row.id === 'lf-28162'), false);
  assert.equal(result.nom.find(row => row.id === 'n408').p, 1234);
  assert.equal(result.nom.find(row => row.id === 'n408').pCost, 800);
  const customizedBoth = {...result, nom:result.nom.filter(row => row.id !== 'fixture-other-light')};
  assert.equal(applyCatalogSeed(customizedBoth, [seed, other]), customizedBoth);
  assert.equal(customizedBoth.nom.length, 1);
});

test('legacy aliases only match the declared supplier brand and seed rows cannot claim another brand', () => {
  const other = {version:'second-supplier-fixture-v1', brand:'Другой бренд', rows:[
    factory('fixture-other-track', 'Совпадающее название', {br:'Другой бренд'}),
  ], legacyAliases:{'Совпадающее название':'fixture-other-track'}};
  const correct = {n:'Совпадающее название', p:900, u:'м.п.', m:1, br:other.brand};
  const foreign = {...correct, br:'LumFer'};
  const result = applyCatalogSeed({nom:[foreign, correct]}, other);
  assert.equal(result.nom[0], foreign);
  assert.equal(result.nom[1].id, 'fixture-other-track');
  assert.equal(result.nom[1].br, other.brand);
  assert.throws(() => applyCatalogSeed({nom:[]}, {...other, rows:[seed.rows[0]]}), /catalog seed/i);
  for (const brand of ['', '   ', null, 5]) {
    assert.throws(() => applyCatalogSeed({nom:[]}, {...other, brand}), /catalog seed/i);
  }
});
