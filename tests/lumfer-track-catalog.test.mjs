import test from 'node:test';
import assert from 'node:assert/strict';
import { LUMFER_CATALOG_SEED, LUMFER_CATALOG_PENDING, LUMFER_CATALOG_SOURCE } from '../src/data/lumfer-track-catalog.js';
import { LUMFER_TRACK_IMAGES } from '../src/data/lumfer-track-images.js';
import { NOM_V2 } from '../src/data/nomenclatureV2.js';
import { NOM_V2_IMAGES } from '../src/data/nomV2Images.js';

const rows = LUMFER_CATALOG_SEED.rows;
const moved = ['n364', 'n365', 'n407', 'n408', 'n409', 'n410', 'n411', 'n412'];

test('LumFer imports only the catalogue products with both supplier prices', () => {
  assert.equal(rows.length, 44);
  assert.equal(new Set(rows.map(row => row.id)).size, 44);
  assert.equal(new Set(rows.map(row => row.n)).size, 44);
  assert.deepEqual(Object.fromEntries(['Треки', 'Комплектующие', 'Светильники'].map(group => [group, rows.filter(row => row.catalogGroup === group).length])), { Треки: 10, Комплектующие: 14, Светильники: 20 });
  for (const row of rows) {
    assert.equal(row.category, 'equipment'); assert.equal(row.m, 1); assert.equal(row.br, 'LumFer');
    assert.ok(row.pCost > 0 && row.p >= row.pCost); assert.equal(row.cost, row.pCost); assert.equal(row.price, row.p);
    assert.ok(row.catalogPage >= 3 && row.catalogPage <= 36);
    assert.doesNotMatch(row.n, /Standart|\bSV\b|DK8|DK7|TR100|TR110|Шина|Торцевая заглушка|Угловой элемент/i);
  }
  assert.match(LUMFER_CATALOG_SOURCE.prices.sha256, /^[a-f0-9]{64}$/);
});

test('the eight existing profiles move to equipment without losing their reference IDs or names', () => {
  assert.deepEqual(Object.values(LUMFER_CATALOG_SEED.legacyAliases).sort(), [...moved].sort());
  for (const id of moved) {
    const row = rows.find(row => row.id === id), factory = NOM_V2.filter(row => row.id === id);
    assert.equal(factory.length, 1); assert.equal(factory[0].category, 'equipment');
    assert.equal(factory[0].name, row.n); assert.equal(row.u, 'м.п.');
    assert.ok(Object.entries(LUMFER_CATALOG_SEED.legacyAliases).some(([name, value]) => value === id && name === row.n));
  }
  assert.equal(rows.find(row => row.id === 'n364').pCost, 2954);
  assert.equal(rows.find(row => row.id === 'n365').p, 6900);
  assert.equal(rows.find(row => row.id === 'n408').pCost, 1531);
  for (const id of ['n409', 'n412']) assert.equal(rows.find(row => row.id === id).mult, 3);
  assert.equal(rows.filter(row => row.id.includes('black_3m')).length, 2);
  for (const id of ['n381', 'n413', 'n414']) assert.notEqual(NOM_V2.find(row => row.id === id).category, 'equipment');
});

test('every imported row has a real registered WebP image available to the existing photo pipeline', () => {
  assert.equal(Object.keys(LUMFER_TRACK_IMAGES).length, 47);
  for (const row of rows) {
    const key = row.img.replace(/\.webp$/, ''), image = NOM_V2_IMAGES[key];
    assert.ok(image?.startsWith('data:image/webp;base64,'), row.id);
    const bytes = Buffer.from(image.split(',')[1], 'base64');
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF'); assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.equal(row.imageUrl, '/design/nom/' + row.img);
  }
  for (const id of ['n409', 'n412']) assert.match(rows.find(row => row.id === id).img, /section\.webp$/);
});

test('the five catalogue lights without price-list entries are kept out of the live catalogue', () => {
  assert.deepEqual(LUMFER_CATALOG_PENDING.map(row => row.sku).sort(), ['29159', '29161', '29162', '29163', '29164']);
  for (const row of LUMFER_CATALOG_PENDING) assert.ok(!rows.some(item => item.sku === row.sku));
});
