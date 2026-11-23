import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {writeOnlineData} from '../scripts/build-online-data.mjs';
import {LUMFER_CATALOG_SEED} from '../src/data/lumfer-track-catalog.js';
import {CRM_EQUIPMENT_CATALOG_SEEDS} from '../src/data/crm-equipment-catalog.js';
import {writeCrmPhotoFixture, CRM_PHOTO_FIXTURE_BYTES} from './crm-photo-fixture.mjs';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=', 'base64');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zamer-online-builder-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const source = path.join(root, 'online-src/working-data.json');
  const output = path.join(root, 'public/online/main-data.js');
  const image = path.join(root, 'public/online/nom/nom-YQ.png');
  const original = '{\n  "orders": [{"id":"project","privateRawField":"retained"}]\n}\n';
  const row = {nid:'a', n:'Материал', p:12.5, u:'м.п.', m:1, _main:{rawPreset:true}};
  const data = {
    version:1,
    blocks:[{id:'canvas', title:'Полотно', single:true}, {id:'main', title:'Профиль', single:true}],
    nom:[{id:'a', ...row, br:'Бренд', img:'nom-YQ.png', imageUrl:'/online/nom/nom-YQ.png', sourcePhoto:'blob:private-original', sourceImg:'original-bundled-key'}],
    presets:{canvas:[], main:[{id:'preset', name:'Пресет', items:[row], _main:{sourceConfig:true}}]},
    roomOpts:[],
    projects:[{id:'project', name:'Проект', _main:{rawProject:true}, unknownField:{keep:true}, rooms:[{
      id:'room', v:[[0,0], [3,0], [3,4]], canvas:{}, main:{pid:'preset'}, _main:{rawRoom:true},
      extraItems:[{...row, qty:2, _main:{rawExtra:true}}], estEd:{a:{q:2.75, p:11.25}}, _mainType:'functional-hint',
    }]}],
    estEd:{project:{a:{q:6.25, p:10.75}}},
    contractTemplate:{head:{company:'Компания'}, customField:'retain'},
    migration:{sourceHash:digest(original), sourceFile:'/private/backups/working.json', formatVersion:1,
      report:{parityOk:true, unavailablePhotos:[], images:[{id:'a', file:'nom-YQ.png', bytes:imageBytes.length, sha256:digest(imageBytes)}]}},
  };
  fs.mkdirSync(path.dirname(source), {recursive:true});
  fs.mkdirSync(path.dirname(image), {recursive:true});
  fs.writeFileSync(source, JSON.stringify(data));
  fs.writeFileSync(source + '.source.json', original);
  fs.writeFileSync(image, imageBytes);
  fs.writeFileSync(output, 'previous validated public seed');
  const crm = writeCrmPhotoFixture(root);
  return {root, source, output, image, original, data, crm};
}

function run(value) {
  writeOnlineData({projectRoot:value.root, log:()=>{}});
}

function change(value, update) {
  update(value.data);
  fs.writeFileSync(value.source, JSON.stringify(value.data));
}

function assertRejected(value, expected) {
  assert.throws(() => run(value), expected);
  assert.equal(fs.readFileSync(value.output, 'utf8'), 'previous validated public seed');
}

test('builder publishes verified runtime data while leaving canonical and raw backups byte-identical', t => {
  const value = fixture(t);
  const canonical = fs.readFileSync(value.source);
  run(value);
  const script = fs.readFileSync(value.output, 'utf8');
  const payload = JSON.parse(script.slice(script.indexOf('window.MAGIC_MAIN=') + 'window.MAGIC_MAIN='.length).trim().replace(/;$/, ''));
  const assertNoRawFields = entry => {
    if (!entry || typeof entry !== 'object') return;
    for (const [key, item] of Object.entries(entry)) {
      assert.equal(['_main', 'sourcePhoto', 'sourceImg'].includes(key), false, key);
      assertNoRawFields(item);
    }
  };
  assertNoRawFields(payload);
  assert.equal(payload.migration.report, undefined);
  assert.equal(payload.migration.sourceFile, 'working.json');
  assert.equal(payload.migration.sourceHash, digest(value.original));
  assert.deepEqual(payload.estEd, value.data.estEd);
  assert.deepEqual(payload.projects[0].rooms[0].estEd, value.data.projects[0].rooms[0].estEd);
  assert.equal(payload.projects[0].rooms[0]._mainType, 'functional-hint');
  assert.deepEqual(payload.projects[0].unknownField, {keep:true});
  assert.equal(payload.presets.main[0].items[0].nid, 'a');
  assert.equal(payload.nom[0].imageUrl, '/online/nom/nom-YQ.png');
  const seeds = [LUMFER_CATALOG_SEED, ...CRM_EQUIPMENT_CATALOG_SEEDS];
  assert.equal(payload.nom.length, value.data.nom.length + seeds.reduce((sum, seed) => sum + seed.rows.length, 0));
  assert.deepEqual(payload.catalogueVersions, seeds.map(seed => seed.version));
  assert.deepEqual(payload.catalogSeed.map(seed => seed.version), seeds.map(seed => seed.version));
  assert.ok(LUMFER_CATALOG_SEED.rows.every(row => payload.nom.some(item => item.id === row.id && item.pCost === row.pCost && item.category === 'equipment')));
  for (const row of CRM_EQUIPMENT_CATALOG_SEEDS.flatMap(seed => seed.rows)) {
    const published = payload.nom.find(item => item.id === row.id);
    assert.equal(published.br, row.br);
    assert.equal(published.category, 'equipment');
    assert.equal(published.pCost, row.pCost, 'zero procurement prices retain their actual source value');
    assert.deepEqual(fs.readFileSync(path.join(value.root, 'public/online/nom', row.img)), CRM_PHOTO_FIXTURE_BYTES);
  }
  assert.deepEqual(payload.contractTemplate, value.data.contractTemplate);
  assert.deepEqual(fs.readFileSync(value.source), canonical);
  assert.equal(fs.readFileSync(value.source + '.source.json', 'utf8'), value.original);
});

test('CRM photo validation rejects incomplete or corrupt supplier assets before publishing any of them', t => {
  const value = fixture(t), first = value.crm.manifest.images[0];
  const assertNoPublishedCrm = () => assert.equal(fs.readdirSync(path.dirname(value.image)).some(file => file.startsWith('crm_')), false);
  fs.unlinkSync(value.crm.manifestFile);
  assertRejected(value, /CRM.*manifest/i); assertNoPublishedCrm();
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify({...value.crm.manifest, images:value.crm.manifest.images.slice(1)}));
  assertRejected(value, /CRM.*manifest/i); assertNoPublishedCrm();
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify(value.crm.manifest));
  fs.writeFileSync(path.join(value.crm.directory, first.file), CRM_PHOTO_FIXTURE_BYTES.subarray(1));
  assertRejected(value, /CRM.*integrity/i); assertNoPublishedCrm();
});

test('CRM photo manifest rejects unsafe names, duplicate entries, stale references and nonregular files', t => {
  const value = fixture(t), first = value.crm.manifest.images[0];
  for (const patch of [{file:'../escape.webp'}, {sha256:'not-a-hash'}, {bytes:0}, {bytes:1.5}]) {
    fs.writeFileSync(value.crm.manifestFile, JSON.stringify({...value.crm.manifest, images:[{...first, ...patch}, ...value.crm.manifest.images.slice(1)]}));
    assertRejected(value, /CRM.*manifest/i);
  }
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify({...value.crm.manifest, images:[...value.crm.manifest.images, first]}));
  assertRejected(value, /CRM.*manifest/i);
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify({...value.crm.manifest, images:[...value.crm.manifest.images, {...first, file:'crm_00000000000000000000000000000000.webp'}]}));
  assertRejected(value, /CRM.*unknown|CRM.*unreferenced/i);
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify(value.crm.manifest));
  const photo = path.join(value.crm.directory, first.file);
  fs.unlinkSync(photo); fs.mkdirSync(photo);
  assertRejected(value, /CRM.*regular/i);
  fs.rmdirSync(photo);
  fs.symlinkSync(value.image, photo);
  assertRejected(value, /CRM.*regular/i);
});

test('CRM photo validation rejects mislabeled image bytes and never follows an output symlink', t => {
  const value = fixture(t), first = value.crm.manifest.images[0];
  const source = path.join(value.crm.directory, first.file);
  fs.writeFileSync(source, imageBytes);
  const mislabeled = {...first, bytes:imageBytes.length, sha256:digest(imageBytes)};
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify({...value.crm.manifest, images:[mislabeled, ...value.crm.manifest.images.slice(1)]}));
  assertRejected(value, /CRM.*WebP/i);
  fs.writeFileSync(source, CRM_PHOTO_FIXTURE_BYTES);
  fs.writeFileSync(value.crm.manifestFile, JSON.stringify(value.crm.manifest));
  const destination = path.join(path.dirname(value.image), first.file);
  fs.symlinkSync(value.image, destination);
  assertRejected(value, /CRM.*output.*regular/i);
  assert.deepEqual(fs.readFileSync(value.image), imageBytes);
  assert.equal(fs.readdirSync(path.dirname(value.image)).filter(file => file.startsWith('crm_')).length, 1, 'no other CRM photo is published before all output paths pass validation');
});

test('builder rejects malformed source hashes and exact-byte source mismatches before overwriting the previous seed', t => {
  const value = fixture(t);
  change(value, data => { data.migration.sourceHash = 'truthy-but-not-a-hash'; });
  assertRejected(value, /valid source SHA-256/);
  change(value, data => { data.migration.sourceHash = digest(value.original); });
  fs.appendFileSync(value.source + '.source.json', '\n');
  assertRejected(value, /source SHA-256 mismatch/);
});

test('builder requires successful parity and all original photos', t => {
  const value = fixture(t);
  change(value, data => { data.migration.report.parityOk = false; });
  assertRejected(value, /successful calculation parity/);
  change(value, data => {
    data.migration.report.parityOk = true;
    data.migration.report.unavailablePhotos = [{id:'a', originalReference:'blob:missing'}];
  });
  assertRejected(value, /missing 1 original catalogue photos/);
});

test('builder rejects truncated photos and same-length corrupt bytes against the manifest', t => {
  const value = fixture(t);
  fs.writeFileSync(value.image, imageBytes.subarray(1));
  assertRejected(value, /photo integrity mismatch/);
  const corrupt = Buffer.from(imageBytes);
  corrupt[corrupt.length - 1] ^= 1;
  fs.writeFileSync(value.image, corrupt);
  assertRejected(value, /photo integrity mismatch/);
});

test('builder requires regular photo files and rejects directories and symbolic links', t => {
  const value = fixture(t);
  fs.unlinkSync(value.image);
  fs.mkdirSync(value.image);
  assertRejected(value, /regular online catalogue photo/);
  fs.rmdirSync(value.image);
  const original = path.join(value.root, 'original.png');
  fs.writeFileSync(original, imageBytes);
  fs.symlinkSync(original, value.image);
  assertRejected(value, /regular online catalogue photo/);
});

test('builder rejects missing, unmanifested, mismatched and unknown catalogue photos', t => {
  const value = fixture(t);
  change(value, data => { data.migration.report.images = []; });
  assertRejected(value, /Missing online catalogue photo manifest entry/);
  change(value, data => { data.migration.report.images = [{id:'a', file:'nom-YQ.png', bytes:imageBytes.length, sha256:digest(imageBytes)}]; data.nom[0].imageUrl = '/online/nom/nom-other.png'; });
  assertRejected(value, /photo reference mismatch/);
  change(value, data => { data.nom = []; });
  assertRejected(value, /manifest contains unknown records/);
});

test('builder rejects unsafe filenames, invalid integrity metadata and duplicate manifest entries', t => {
  const value = fixture(t);
  const valid = {...value.data.migration.report.images[0]};
  for (const invalid of [{file:'../original.png'}, {sha256:'not-a-hash'}, {bytes:0}, {bytes:1.5}]) {
    change(value, data => { data.migration.report.images = [{...valid, ...invalid}]; });
    assertRejected(value, /Invalid online catalogue photo manifest entry/);
  }
  change(value, data => { data.migration.report.images = [valid, {...valid}]; });
  assertRejected(value, /Duplicate online catalogue photo manifest entry/);
});
