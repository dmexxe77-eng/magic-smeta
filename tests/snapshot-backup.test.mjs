import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SNAPSHOT_BACKUP_BYTES, parseSnapshotBackup, serializeSnapshotBackup,
  snapshotBackupFilename, snapshotBackupSummary,
} from '../src/desktop/snapshot-backup.js';

const snapshot = () => ({
  version:1, blocks:[{id:'canvas',title:'Полотно'},{id:'main',title:'Профиль'}],
  presets:{canvas:[{id:'p1',name:'ПВХ',items:[]}],main:[]},roomOpts:[],estEd:{},
  nom:[{id:'nom-1',n:'Профиль',u:'м.п.',p:500,br:'MSD',
    imageUrl:'data:image/png;base64,Y3JvcHBlZA==',photoSource:'data:image/png;base64,b3JpZ2luYWw=',photoCrop:{v:1,zoom:2.3,x:-0.25,y:0.1}}],
  projects:[{id:'p1',name:'Корсакова',rooms:[{id:'r1',v:[[0,0],[3,0],[3,4]],canvas:{pid:'p1'},main:{pid:null}}]}],
  profile:{company:'Тест'},migration:{source:'working'},catalogFolderOrder:['MSD'],
});

test('a full backup preserves photos, framing, exact identities and additional metadata without touching the source', () => {
  const source = snapshot(),before = structuredClone(source);
  const restored = parseSnapshotBackup(serializeSnapshotBackup(source));
  assert.deepEqual(restored,before);
  assert.deepEqual(source,before);
  restored.nom[0].photoCrop.zoom = 3;
  assert.equal(source.nom[0].photoCrop.zoom,2.3,'parsed data is independent from the live engine');
  assert.deepEqual(snapshotBackupSummary(source),{projects:1,rooms:1,nom:1,presets:1});
});

test('the import accepts a UTF-8 BOM and refuses malformed or incompatible snapshots', () => {
  assert.equal(parseSnapshotBackup('\uFEFF'+JSON.stringify(snapshot())).projects[0].name,'Корсакова');
  for (const input of ['{','null','[]','{}',JSON.stringify({...snapshot(),version:2}),JSON.stringify({...snapshot(),presets:{canvas:[null],main:[]}})]) {
    assert.throws(()=>parseSnapshotBackup(input),/не резервная копия/);
  }
  assert.throws(()=>parseSnapshotBackup(null),/не резервная копия/);
});

test('invalid catalogue identities and negative edited quantities never reach restore', () => {
  const duplicate=snapshot();duplicate.nom.push({...duplicate.nom[0]});
  assert.throws(()=>parseSnapshotBackup(JSON.stringify(duplicate)),/не резервная копия/);
  const invalid=snapshot();invalid.projects[0].rooms[0].estEd={line:{q:-1}};
  assert.throws(()=>parseSnapshotBackup(JSON.stringify(invalid)),/не резервная копия/);
  assert.throws(()=>serializeSnapshotBackup(invalid),/не резервная копия/);
});

test('the size limit counts UTF-8 bytes rather than JavaScript character length', () => {
  const large='я'.repeat(MAX_SNAPSHOT_BACKUP_BYTES/2+1);
  assert.ok(large.length < MAX_SNAPSHOT_BACKUP_BYTES);
  assert.throws(()=>parseSnapshotBackup(large),/64 МБ/);
});

test('download names are filesystem safe and distinguish backups saved in the same day', () => {
  assert.equal(snapshotBackupFilename(new Date(2026,10,2,16,59,37)),'zamerx_backup_2026-11-02_16-59-37.json');
});
