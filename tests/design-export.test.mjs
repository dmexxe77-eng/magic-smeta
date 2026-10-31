import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zamer-design-export-'));
  fs.mkdirSync(path.join(dir, 'design-src'));
  fs.symlinkSync(path.join(root, 'scripts'), path.join(dir, 'scripts'));
  fs.symlinkSync(path.join(root, 'src'), path.join(dir, 'src'));
  return dir;
};
const run = (dir, script, args = []) => execFileSync(process.execPath, [path.join(root, script), ...args], { cwd: dir, encoding: 'utf8' });

const backup = () => ({
  customNoms: [{ id: 'nom_export_test', name: 'Проверка отдельного блока', type: 'work', price: 10, unit: 'шт' }],
  customBlocks: [
    { id: 'cst_decor', label: 'Декор', custom: true, source: 'perim', unit: 'м.п.' },
    { id: 'custom_pieces', label: 'Детали', custom: true },
  ],
  presets: [
    { id: 'preset_decor', cat: 'cst_decor', name: 'Профиль', items: ['nom_export_test'], options: [] },
    { id: 'preset_piece', cat: 'custom_pieces', name: 'Деталь', items: ['nom_export_test'], options: [], param: { src: 'area' } },
  ],
  orders: [{ id: 'project_export', name: 'Два своих блока', rooms: [{ id: 'room_export', name: 'Комната', on: true, v: [[0, 0], [4, 0], [4, 3], [0, 3]], cst: {
    cst_decor: [{ id: 'instance_decor', btnId: 'preset_decor', qty: 7, qdef: { source: 'manual', unit: 'м.п.' } }],
    custom_pieces: [{ id: 'instance_piece', btnId: 'preset_piece', qty: 2 }],
  } }] }],
});
const exportBackup = (dir, data) => {
  const file = path.join(dir, 'backup.json');
  fs.writeFileSync(file, JSON.stringify(data));
  run(dir, 'scripts/export-main-data.mjs', [file]);
  return JSON.parse(fs.readFileSync(path.join(dir, 'design-src/main-data.json'), 'utf8'));
};

test('project export retains adjustment scope and disclosure across the design payload', () => {
  const dir = fixture();
  try {
    const input = backup();
    input.orders[0].estimateAdjustment = { percent: 10, scope: 'works' };
    input.orders[0].estimateExportOptions = { showAdjustment: false };
    const output = exportBackup(dir, input);
    assert.deepEqual(output.projects[0].estimateAdjustment, input.orders[0].estimateAdjustment);
    assert.deepEqual(output.projects[0].estimateExportOptions, { showAdjustment: false });
    const payload = writePayload(dir, output);
    assert.deepEqual(payload.projects[0].estimateAdjustment, input.orders[0].estimateAdjustment);
    assert.deepEqual(payload.projects[0].estimateExportOptions, { showAdjustment: false });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('equipment classification survives conversion to the design catalogue', () => {
  const dir = fixture();
  try {
    const input = backup();
    input.customNoms[0].type = 'equipment';
    const output = exportBackup(dir, input);
    assert.equal(output.nom.find(n => n.id === 'nom_export_test').category, 'equipment');
    assert.equal(output.presets.cst_decor[0].items[0].category, 'equipment');
    const payload = writePayload(dir, output);
    assert.equal(payload.nom.find(n => n.n === input.customNoms[0].name).category, 'equipment');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
const writePayload = (dir, data) => {
  fs.writeFileSync(path.join(dir, 'design-src/main-data.json'), JSON.stringify(data));
  const out = path.join(dir, 'out');
  fs.mkdirSync(out);
  execFileSync(process.execPath, ['--input-type=module', '-e', 'const {writeMainData}=await import(' + JSON.stringify(pathToFileURL(path.join(root, 'scripts/design-main-data.mjs')).href) + ');await writeMainData(' + JSON.stringify(out) + ');'], { cwd: dir });
  const js = fs.readFileSync(path.join(out, 'main-data.js'), 'utf8');
  return JSON.parse(js.slice(js.indexOf('window.MAGIC_MAIN=') + 'window.MAGIC_MAIN='.length).trim().slice(0, -1));
};

test('fresh export preserves custom block identities, preset membership and room quantities', () => {
  const dir = fixture();
  try {
    const data = exportBackup(dir, backup());
    assert.deepEqual(data.blocks.map(({ id, title, source, unit }) => ({ id, title, source, unit })), [
      { id: 'cst_decor', title: 'Декор', source: 'perim', unit: 'м.п.' },
      { id: 'custom_pieces', title: 'Детали', source: 'manual', unit: 'шт' },
    ]);
    assert.deepEqual(data.presets.cst_decor.map(p => p.id), ['preset_decor']);
    assert.deepEqual(data.presets.custom_pieces.map(p => p.id), ['preset_piece']);
    assert.equal(data.presets.custom_pieces[0].param, 'area');
    assert.deepEqual(data.presets.other, []);
    assert.equal(data.otherTitle, 'Прочее');
    const room = data.projects[0].rooms[0];
    assert.equal(room.cst_decor[0].qty, 7);
    assert.equal(room.cst_decor[0].pid, 'preset_decor');
    assert.deepEqual(room.cst_decor[0].qdef, { source: 'manual', unit: 'м.п.' });
    assert.equal(room.custom_pieces[0].qty, 2);
    assert.deepEqual(room.other, []);
    assert.equal(data.report.projects[0].diff, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('export rejects dangerous custom block keys and does not overwrite built-ins', () => {
  const dir = fixture();
  try {
    const input = backup();
    input.customBlocks.push({ id: '__proto__', label: 'Нельзя' }, { id: 'canvas', label: 'Не полотно' }, { id: 'constructor', label: 'Нельзя' });
    const data = exportBackup(dir, input);
    assert.deepEqual(data.blocks.map(b => b.id), ['cst_decor', 'custom_pieces']);
    assert.equal(Object.hasOwn(data.presets, '__proto__'), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('main-data writer passes explicit block settings unchanged', () => {
  const dir = fixture();
  try {
    const blocks = [{ id: 'custom_one', title: 'Особый блок', source: 'manual', unit: 'компл', custom: true, single: false }];
    const data = { nom: [], presets: { custom_one: [{ id: 'p1', name: 'Один', param: 'area', items: [] }] }, projects: [], estEd: {}, blocks };
    const payload = writePayload(dir, data);
    assert.deepEqual(payload.blocks, blocks);
    assert.equal(payload.presets.custom_one[0].param, 'S');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('legacy main-data without blocks keeps presets and quantities and declares no new block settings', () => {
  const dir = fixture();
  try {
    const data = { nom: [], presets: { other: [{ id: 'old', name: 'Старый', param: 'area', items: [] }] }, projects: [{ id: 'old-project', rooms: [{ other: [{ id: 'old-instance', pid: 'old', qty: 9 }] }] }], estEd: {} };
    const payload = writePayload(dir, data);
    assert.deepEqual(payload.blocks, []);
    assert.equal(payload.presets.other[0].param, 'S');
    assert.equal(payload.projects[0].rooms[0].other[0].qty, 9);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});


test('code snapshot export retains the reference estimate totals', () => {
  const dir = fixture();
  try {
    run(dir, 'scripts/export-main-data.mjs');
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'design-src/main-data.json'), 'utf8'));
    assert.deepEqual(data.blocks, []);
    assert.ok(data.report.projects.length > 0);
    assert.deepEqual(data.report.projects.filter(p => p.diff !== 0), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('export preserves missing automatic quantity and explicit zero separately',()=>{
  const dir=fixture();
  try{
    const data=backup();
    data.customBlocks[0].source='area';
    data.orders[0].rooms[0].cst.cst_decor=[
      {id:'auto',btnId:'preset_decor',qdef:{source:'area',unit:'м²'}},
      {id:'zero',btnId:'preset_decor',qty:0,qdef:{source:'area',unit:'м²'}},
    ];
    const output=exportBackup(dir,data);
    const instances=output.projects[0].rooms[0].cst_decor;
    assert.equal(Object.hasOwn(instances[0],'qty'),false);
    assert.equal(instances[1].qty,0);
    assert.equal(output.report.projects[0].design,140);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
